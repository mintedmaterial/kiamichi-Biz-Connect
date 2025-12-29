import { describe, it, expect, beforeEach } from "vitest";
import { ComponentRenderer } from "../component-renderer";
import type { ComponentTemplate, BusinessData, PageComponent } from "../types";

describe("ComponentRenderer", () => {
  let renderer: ComponentRenderer;
  let mockBusinessData: BusinessData;

  beforeEach(() => {
    renderer = new ComponentRenderer();
    mockBusinessData = {
      id: "biz-123",
      name: "Mountain Coffee Roasters",
      slug: "mountain-coffee-roasters",
      phone: "(555) 123-4567",
      email: "hello@mountaincoffee.com",
      website: "https://mountaincoffee.com",
      city: "Poteau",
      state: "OK",
      description: "Locally roasted artisan coffee",
      image_url: "https://example.com/logo.jpg",
    };
  });

  describe("render", () => {
    it("should render a basic component with Handlebars interpolation", async () => {
      const template: ComponentTemplate = {
        component_type: "hero",
        variant: "modern",
        html_template: "<section><h1>{{heading}}</h1><p>{{subheading}}</p></section>",
        css_template: ".hero { background: {{bg_color}}; }",
        default_content: {
          heading: "Welcome",
          subheading: "Default tagline",
          bg_color: "#1a202c",
        },
      };

      const component: PageComponent = {
        id: "comp-1",
        listing_page_id: "page-1",
        component_type: "hero",
        display_order: 1,
        config: {},
        content: {
          heading: "Fresh Coffee Daily",
          subheading: "Roasted in the mountains",
        },
        style_variant: "modern",
        is_visible: true,
      };

      const result = await renderer.render(template, component, mockBusinessData);

      expect(result.html).toContain("<h1>Fresh Coffee Daily</h1>");
      expect(result.html).toContain("<p>Roasted in the mountains</p>");
      expect(result.css).toContain("background: #1a202c");
      expect(result.componentId).toBe("comp-1");
      expect(result.componentType).toBe("hero");
    });

    it("should interpolate business data in templates", async () => {
      const template: ComponentTemplate = {
        component_type: "contact",
        variant: "standard",
        html_template: "<div><h2>Contact {{business_name}}</h2><p>Phone: {{business_phone}}</p><p>Email: {{business_email}}</p></div>",
        css_template: ".contact {}",
        default_content: {},
      };

      const component: PageComponent = {
        id: "comp-2",
        listing_page_id: "page-1",
        component_type: "contact",
        display_order: 2,
        config: {},
        content: {},
        style_variant: "standard",
        is_visible: true,
      };

      const result = await renderer.render(template, component, mockBusinessData);

      expect(result.html).toContain("Contact Mountain Coffee Roasters");
      expect(result.html).toContain("Phone: (555) 123-4567");
      expect(result.html).toContain("Email: hello@mountaincoffee.com");
    });

    it("should merge default_content with component content", async () => {
      const template: ComponentTemplate = {
        component_type: "hero",
        variant: "modern",
        html_template: "<section><h1>{{heading}}</h1><p>{{subheading}}</p><span>{{cta_text}}</span></section>",
        css_template: "",
        default_content: {
          heading: "Default Heading",
          subheading: "Default Subheading",
          cta_text: "Learn More",
        },
      };

      const component: PageComponent = {
        id: "comp-3",
        listing_page_id: "page-1",
        component_type: "hero",
        display_order: 1,
        config: {},
        content: {
          heading: "Custom Heading",
          // subheading not provided - should use default
          // cta_text not provided - should use default
        },
        style_variant: "modern",
        is_visible: true,
      };

      const result = await renderer.render(template, component, mockBusinessData);

      expect(result.html).toContain("Custom Heading");
      expect(result.html).toContain("Default Subheading");
      expect(result.html).toContain("Learn More");
    });

    it("should inject scoped CSS with data-component attribute", async () => {
      const template: ComponentTemplate = {
        component_type: "hero",
        variant: "modern",
        html_template: "<section><h1>Test</h1></section>",
        css_template: ".hero { padding: 2rem; } h1 { font-size: 3rem; }",
        default_content: {},
      };

      const component: PageComponent = {
        id: "comp-hero-123",
        listing_page_id: "page-1",
        component_type: "hero",
        display_order: 1,
        config: {},
        content: {},
        style_variant: "modern",
        is_visible: true,
      };

      const result = await renderer.render(template, component, mockBusinessData);

      // CSS should be scoped to data-component attribute
      expect(result.css).toContain("[data-component='comp-hero-123']");
      expect(result.html).toContain("data-component='comp-hero-123'");
    });

    it("should handle missing business data gracefully", async () => {
      const template: ComponentTemplate = {
        component_type: "contact",
        variant: "standard",
        html_template: "<div>{{business_website}}</div>",
        css_template: "",
        default_content: {},
      };

      const component: PageComponent = {
        id: "comp-4",
        listing_page_id: "page-1",
        component_type: "contact",
        display_order: 1,
        config: {},
        content: {},
        style_variant: "standard",
        is_visible: true,
      };

      const businessWithoutWebsite: BusinessData = {
        id: "biz-456",
        name: "Test Business",
        slug: "test-business",
      };

      const result = await renderer.render(template, component, businessWithoutWebsite);

      // Should not throw error, just render empty or handle gracefully
      expect(result.html).toBeDefined();
    });

    it("should handle complex nested content structures", async () => {
      const template: ComponentTemplate = {
        component_type: "features",
        variant: "grid",
        html_template: "<div>{{#each features}}<div class='feature'>{{this.title}}: {{this.description}}</div>{{/each}}</div>",
        css_template: ".feature { margin: 1rem; }",
        default_content: {
          features: [
            { title: "Feature 1", description: "Description 1" },
            { title: "Feature 2", description: "Description 2" },
          ],
        },
      };

      const component: PageComponent = {
        id: "comp-5",
        listing_page_id: "page-1",
        component_type: "features",
        display_order: 1,
        config: {},
        content: {
          features: [
            { title: "Quality Coffee", description: "Freshly roasted" },
            { title: "Local Sourcing", description: "Support local farmers" },
          ],
        },
        style_variant: "grid",
        is_visible: true,
      };

      const result = await renderer.render(template, component, mockBusinessData);

      expect(result.html).toContain("Quality Coffee: Freshly roasted");
      expect(result.html).toContain("Local Sourcing: Support local farmers");
    });

    it("should handle conditional Handlebars helpers", async () => {
      const template: ComponentTemplate = {
        component_type: "cta",
        variant: "button",
        html_template: "<div>{{#if show_phone}}<a href='tel:{{business_phone}}'>Call Us</a>{{/if}}</div>",
        css_template: "",
        default_content: {
          show_phone: true,
        },
      };

      const component: PageComponent = {
        id: "comp-6",
        listing_page_id: "page-1",
        component_type: "cta",
        display_order: 1,
        config: {},
        content: {
          show_phone: true,
        },
        style_variant: "button",
        is_visible: true,
      };

      const result = await renderer.render(template, component, mockBusinessData);

      expect(result.html).toContain("Call Us");
      expect(result.html).toContain("tel:(555) 123-4567");
    });

    it("should handle CSS variables in templates", async () => {
      const template: ComponentTemplate = {
        component_type: "hero",
        variant: "modern",
        html_template: "<section>Hero</section>",
        css_template: ".hero { --primary-color: {{primary_color}}; background: var(--primary-color); }",
        default_content: {
          primary_color: "#3b82f6",
        },
      };

      const component: PageComponent = {
        id: "comp-7",
        listing_page_id: "page-1",
        component_type: "hero",
        display_order: 1,
        config: {},
        content: {
          primary_color: "#ef4444",
        },
        style_variant: "modern",
        is_visible: true,
      };

      const result = await renderer.render(template, component, mockBusinessData);

      expect(result.css).toContain("--primary-color: #ef4444");
      expect(result.css).toContain("background: var(--primary-color)");
    });
  });

  describe("mergeContent", () => {
    it("should merge default content with component content", () => {
      const defaultContent = {
        heading: "Default",
        subheading: "Default Sub",
        color: "blue",
      };

      const componentContent = {
        heading: "Custom",
        color: "red",
      };

      const merged = renderer.mergeContent(defaultContent, componentContent);

      expect(merged.heading).toBe("Custom");
      expect(merged.subheading).toBe("Default Sub");
      expect(merged.color).toBe("red");
    });

    it("should handle nested objects", () => {
      const defaultContent = {
        config: {
          theme: "light",
          fontSize: 16,
        },
      };

      const componentContent = {
        config: {
          theme: "dark",
        },
      };

      const merged = renderer.mergeContent(defaultContent, componentContent);

      expect(merged.config.theme).toBe("dark");
      expect(merged.config.fontSize).toBe(16);
    });
  });
});
