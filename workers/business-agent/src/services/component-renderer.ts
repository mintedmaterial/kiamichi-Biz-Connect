import type {
  ComponentTemplate,
  BusinessData,
  PageComponent,
  RenderedComponent,
} from "./types";

/**
 * ComponentRenderer
 *
 * Renders component templates using simple string interpolation,
 * merging template HTML/CSS with component content and business data.
 *
 * Key Features:
 * - Simple {{variable}} interpolation (Workers-compatible, no eval)
 * - {{#if var}}...{{/if}} conditional blocks
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

    // Prepare context with business data
    const context: Record<string, unknown> = {
      ...mergedContent,
      id: component.id,
      business_name: businessData.name,
      business_phone: businessData.phone || "",
      business_email: businessData.email || "",
      business_website: businessData.website || "",
      business_city: businessData.city || "",
      business_state: businessData.state || "",
      business_description: businessData.description || "",
      business_image_url: businessData.image_url || "",
    };

    // Render HTML template using simple interpolation
    let renderedHtml = this.interpolate(template.html_template, context);

    // Add data-component attribute to root element for CSS scoping
    renderedHtml = this.addComponentAttribute(renderedHtml, component.id);

    // Render CSS template using simple interpolation
    const renderedCss = this.interpolate(template.css_template, context);

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
   * Simple template interpolation (Workers-compatible, no eval/Function)
   * Supports:
   * - {{variable}} - simple replacement
   * - {{#if variable}}content{{/if}} - conditional blocks
   *
   * @param template - Template string with {{placeholders}}
   * @param context - Data context for replacement
   * @returns Interpolated string
   */
  private interpolate(
    template: string,
    context: Record<string, unknown>
  ): string {
    let result = template;

    // Handle {{#if var}}...{{/if}} blocks first
    result = result.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, varName, content) => {
        const value = this.getValue(varName, context);
        // Show content if value is truthy (exists and not empty)
        if (value && value !== "" && value !== false && value !== 0) {
          return content;
        }
        return "";
      }
    );

    // Handle simple {{variable}} replacements
    result = result.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      const value = this.getValue(varName, context);
      return value !== undefined && value !== null ? String(value) : "";
    });

    return result;
  }

  /**
   * Get value from context, supporting nested dot notation
   */
  private getValue(
    path: string,
    context: Record<string, unknown>
  ): unknown {
    const parts = path.split(".");
    let value: unknown = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }

    return value;
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
