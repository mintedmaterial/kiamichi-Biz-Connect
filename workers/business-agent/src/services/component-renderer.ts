import Handlebars from "handlebars";
import type {
  ComponentTemplate,
  BusinessData,
  PageComponent,
  RenderedComponent,
} from "./types";

/**
 * ComponentRenderer
 *
 * Renders component templates using Handlebars, merging template HTML/CSS
 * with component content and business data.
 *
 * Key Features:
 * - Handlebars template interpolation for dynamic content
 * - Business data injection ({{business_name}}, {{business_phone}}, etc.)
 * - Content merging (component content overrides default_content)
 * - Scoped CSS injection with data-component attributes
 */
export class ComponentRenderer {
  /**
   * Render a component by merging template with component content and business data
   *
   * @param template - Component template from R2
   * @param component - Component configuration from database
   * @param businessData - Business information for interpolation
   * @returns Rendered HTML and CSS
   */
  async render(
    template: ComponentTemplate,
    component: PageComponent,
    businessData: BusinessData
  ): Promise<RenderedComponent> {
    // Merge default content with component-specific content
    const mergedContent = this.mergeContent(
      template.default_content,
      component.content
    );

    // Prepare context for Handlebars with business data
    const context = {
      ...mergedContent,
      business_name: businessData.name,
      business_phone: businessData.phone || "",
      business_email: businessData.email || "",
      business_website: businessData.website || "",
      business_city: businessData.city || "",
      business_state: businessData.state || "",
      business_description: businessData.description || "",
      business_image_url: businessData.image_url || "",
    };

    // Compile and render HTML template
    const htmlCompiler = Handlebars.compile(template.html_template);
    let renderedHtml = htmlCompiler(context);

    // Add data-component attribute to root element for CSS scoping
    renderedHtml = this.addComponentAttribute(renderedHtml, component.id);

    // Compile and render CSS template
    const cssCompiler = Handlebars.compile(template.css_template);
    const renderedCss = cssCompiler(context);

    // Scope CSS to component using data-component attribute
    const scopedCss = this.scopeCss(renderedCss, component.id);

    return {
      html: renderedHtml,
      css: scopedCss,
      componentId: component.id,
      componentType: component.component_type,
    };
  }

  /**
   * Merge default content with component content
   * Component content takes precedence over defaults
   *
   * @param defaultContent - Default content from template
   * @param componentContent - Component-specific content
   * @returns Merged content object
   */
  mergeContent(
    defaultContent: Record<string, unknown>,
    componentContent: Record<string, unknown>
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...defaultContent };

    for (const [key, value] of Object.entries(componentContent)) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        typeof merged[key] === "object" &&
        merged[key] !== null &&
        !Array.isArray(merged[key])
      ) {
        // Deep merge for nested objects
        merged[key] = this.mergeContent(
          merged[key] as Record<string, unknown>,
          value as Record<string, unknown>
        );
      } else {
        // Override for primitive values and arrays
        merged[key] = value;
      }
    }

    return merged;
  }

  /**
   * Add data-component attribute to root HTML element
   * This enables CSS scoping and component identification
   *
   * @param html - Rendered HTML
   * @param componentId - Unique component ID
   * @returns HTML with data-component attribute
   */
  private addComponentAttribute(html: string, componentId: string): string {
    // Find the first opening tag and add data-component attribute
    return html.replace(
      /^(\s*<[a-zA-Z][a-zA-Z0-9]*)/,
      `$1 data-component='${componentId}'`
    );
  }

  /**
   * Scope CSS rules to a specific component using data-component selector
   * This prevents CSS conflicts between components
   *
   * @param css - Rendered CSS
   * @param componentId - Unique component ID
   * @returns Scoped CSS
   */
  private scopeCss(css: string, componentId: string): string {
    if (!css || css.trim().length === 0) {
      return "";
    }

    // Add data-component attribute selector to all CSS rules
    const lines = css.split("\n");
    const scopedLines = lines.map((line) => {
      // If line contains a selector (before {), prepend with data-component
      if (line.includes("{") && !line.trim().startsWith("@")) {
        const parts = line.split("{");
        const selector = parts[0].trim();

        // Handle multiple selectors separated by commas
        const selectors = selector.split(",").map((s) => s.trim());
        const scopedSelectors = selectors.map(
          (s) => `[data-component='${componentId}'] ${s}`
        );

        return `${scopedSelectors.join(", ")} {${parts.slice(1).join("{")}`;
      }
      return line;
    });

    return scopedLines.join("\n");
  }
}
