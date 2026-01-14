import { describe, it, expect, beforeEach, vi } from "vitest";
import { PageAssembler } from "../page-assembler";
import { TemplateLoader } from "../template-loader";
import { ComponentRenderer } from "../component-renderer";
import type { BusinessData, PageComponent, ComponentTemplate } from "../types";

// Mock D1 Database
class MockD1Database {
  private components: PageComponent[] = [];
  private businesses: BusinessData[] = [];

  setMockComponents(components: PageComponent[]) {
    this.components = components;
  }

  setMockBusiness(business: BusinessData) {
    this.businesses = [business];
  }

  prepare(query: string) {
    const self = this;
    return {
      bind: (...args: unknown[]) => ({
        all: async () => {
          if (query.includes("SELECT * FROM page_components")) {
            return { results: self.components };
          }
          if (query.includes("SELECT") && query.includes("FROM businesses")) {
            return { results: self.businesses };
          }
          return { results: [] };
        },
        first: async () => {
          if (query.includes("SELECT") && query.includes("FROM businesses")) {
            return self.businesses[0] || null;
          }
          return null;
        },
      }),
    };
  }
}

// Mock TemplateLoader
class MockTemplateLoader extends TemplateLoader {
  private mockTemplates = new Map<string, ComponentTemplate>();

  constructor() {
    super({} as R2Bucket);
  }

  setMockTemplate(componentType: string, variant: string, template: ComponentTemplate) {
    const key = this.getTemplateKey(componentType, variant);
    this.mockTemplates.set(key, template);
  }

  async loadTemplate(componentType: string, variant: string): Promise<ComponentTemplate> {
    const key = this.getTemplateKey(componentType, variant);
    const template = this.mockTemplates.get(key);
    if (!template) {
      throw new Error(`Template not found: ${key}`);
    }
    return template;
  }
}

describe("PageAssembler", () => {
  let mockDb: MockD1Database;
  let mockTemplateLoader: MockTemplateLoader;
  let mockRenderer: ComponentRenderer;
  let assembler: PageAssembler;
  let mockBusinessData: BusinessData;

  beforeEach(() => {
    mockDb = new MockD1Database();
    mockTemplateLoader = new MockTemplateLoader();
    mockRenderer = new ComponentRenderer();
    assembler = new PageAssembler(
      mockDb as unknown as D1Database,
      mockTemplateLoader,
      mockRenderer
    );

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

    mockDb.setMockBusiness(mockBusinessData);
  });

  describe("assemblePage", () => {
    it("should assemble a complete HTML page with components", async () => {
      const heroComponent: PageComponent = {
        id: "comp-1",
        listing_page_id: "page-1",
        component_type: "hero",
        display_order: 1,
        config: {},
        content: { heading: "Welcome" },
        style_variant: "modern",
        is_visible: true,
      };

      const heroTemplate: ComponentTemplate = {
        component_type: "hero",
        variant: "modern",
        html_template: "<section><h1>{{heading}}</h1></section>",
        css_template: ".hero { padding: 2rem; }",
        default_content: { heading: "Default" },
      };

      mockDb.setMockComponents([heroComponent]);
      mockTemplateLoader.setMockTemplate("hero", "modern", heroTemplate);

      const result = await assembler.assemblePage("page-1");

      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<html");
      expect(result.html).toContain("<head>");
      expect(result.html).toContain("<body>");
      expect(result.html).toContain("<h1>Welcome</h1>");
      expect(result.html).toContain("data-component='comp-1'");
      expect(result.meta.title).toBe("Mountain Coffee Roasters");
    });

    it("should render multiple components in order", async () => {
      const components: PageComponent[] = [
        {
          id: "comp-1",
          listing_page_id: "page-1",
          component_type: "hero",
          display_order: 1,
          config: {},
          content: { heading: "Hero Section" },
          style_variant: "modern",
          is_visible: true,
        },
        {
          id: "comp-2",
          listing_page_id: "page-1",
          component_type: "about",
          display_order: 2,
          config: {},
          content: { text: "About Us" },
          style_variant: "standard",
          is_visible: true,
        },
        {
          id: "comp-3",
          listing_page_id: "page-1",
          component_type: "contact",
          display_order: 3,
          config: {},
          content: {},
          style_variant: "simple",
          is_visible: true,
        },
      ];

      mockDb.setMockComponents(components);

      mockTemplateLoader.setMockTemplate("hero", "modern", {
        component_type: "hero",
        variant: "modern",
        html_template: "<section>{{heading}}</section>",
        css_template: "",
        default_content: {},
      });

      mockTemplateLoader.setMockTemplate("about", "standard", {
        component_type: "about",
        variant: "standard",
        html_template: "<div>{{text}}</div>",
        css_template: "",
        default_content: {},
      });

      mockTemplateLoader.setMockTemplate("contact", "simple", {
        component_type: "contact",
        variant: "simple",
        html_template: "<footer>Contact</footer>",
        css_template: "",
        default_content: {},
      });

      const result = await assembler.assemblePage("page-1");

      const heroIndex = result.html.indexOf("Hero Section");
      const aboutIndex = result.html.indexOf("About Us");
      const contactIndex = result.html.indexOf("Contact");

      expect(heroIndex).toBeGreaterThan(-1);
      expect(aboutIndex).toBeGreaterThan(heroIndex);
      expect(contactIndex).toBeGreaterThan(aboutIndex);
    });

    it("should only render visible components", async () => {
      const components: PageComponent[] = [
        {
          id: "comp-1",
          listing_page_id: "page-1",
          component_type: "hero",
          display_order: 1,
          config: {},
          content: { heading: "Visible" },
          style_variant: "modern",
          is_visible: true,
        },
        {
          id: "comp-2",
          listing_page_id: "page-1",
          component_type: "about",
          display_order: 2,
          config: {},
          content: { text: "Hidden" },
          style_variant: "standard",
          is_visible: false,
        },
      ];

      mockDb.setMockComponents(components.filter((c) => c.is_visible));

      mockTemplateLoader.setMockTemplate("hero", "modern", {
        component_type: "hero",
        variant: "modern",
        html_template: "<section>{{heading}}</section>",
        css_template: "",
        default_content: {},
      });

      const result = await assembler.assemblePage("page-1");

      expect(result.html).toContain("Visible");
      expect(result.html).not.toContain("Hidden");
    });

    it("should include combined CSS from all components", async () => {
      const components: PageComponent[] = [
        {
          id: "comp-1",
          listing_page_id: "page-1",
          component_type: "hero",
          display_order: 1,
          config: {},
          content: {},
          style_variant: "modern",
          is_visible: true,
        },
        {
          id: "comp-2",
          listing_page_id: "page-1",
          component_type: "footer",
          display_order: 2,
          config: {},
          content: {},
          style_variant: "standard",
          is_visible: true,
        },
      ];

      mockDb.setMockComponents(components);

      mockTemplateLoader.setMockTemplate("hero", "modern", {
        component_type: "hero",
        variant: "modern",
        html_template: "<section>Hero</section>",
        css_template: ".hero { background: blue; }",
        default_content: {},
      });

      mockTemplateLoader.setMockTemplate("footer", "standard", {
        component_type: "footer",
        variant: "standard",
        html_template: "<footer>Footer</footer>",
        css_template: ".footer { background: gray; }",
        default_content: {},
      });

      const result = await assembler.assemblePage("page-1");

      expect(result.html).toContain("<style>");
      expect(result.html).toContain("background: blue");
      expect(result.html).toContain("background: gray");
    });

    it("should set meta tags from business data", async () => {
      mockDb.setMockComponents([]);

      const result = await assembler.assemblePage("page-1");

      expect(result.meta.title).toBe("Mountain Coffee Roasters");
      expect(result.meta.description).toBe("Locally roasted artisan coffee");
      expect(result.html).toContain("<title>Mountain Coffee Roasters</title>");
      expect(result.html).toContain('name="description"');
      expect(result.html).toContain("Locally roasted artisan coffee");
    });

    it("should include preview banner when in preview mode", async () => {
      mockDb.setMockComponents([]);

      const result = await assembler.assemblePage("page-1", { previewMode: true });

      expect(result.previewMode).toBe(true);
      expect(result.html).toContain("preview");
      expect(result.html).toContain("This is a preview");
    });

    it("should not include preview banner in production mode", async () => {
      mockDb.setMockComponents([]);

      const result = await assembler.assemblePage("page-1", { previewMode: false });

      expect(result.previewMode).toBe(false);
      expect(result.html).not.toContain("This is a preview");
    });

    it("should handle empty page with no components", async () => {
      mockDb.setMockComponents([]);

      const result = await assembler.assemblePage("page-1");

      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<body>");
      expect(result.html).toContain("</body>");
      expect(result.meta.title).toBe("Mountain Coffee Roasters");
    });

    it("should include viewport and responsive meta tags", async () => {
      mockDb.setMockComponents([]);

      const result = await assembler.assemblePage("page-1");

      expect(result.html).toContain('name="viewport"');
      expect(result.html).toContain("width=device-width, initial-scale=1");
    });

    it("should include Open Graph meta tags", async () => {
      mockDb.setMockComponents([]);

      const result = await assembler.assemblePage("page-1");

      expect(result.html).toContain('property="og:title"');
      expect(result.html).toContain('property="og:description"');
      expect(result.html).toContain("Mountain Coffee Roasters");
    });

    it("should throw error if business not found", async () => {
      const emptyDb = new MockD1Database();
      const emptyAssembler = new PageAssembler(
        emptyDb as unknown as D1Database,
        mockTemplateLoader,
        mockRenderer
      );

      await expect(emptyAssembler.assemblePage("page-1")).rejects.toThrow();
    });
  });

  describe("getBusinessByListingPageId", () => {
    it("should fetch business data from database", async () => {
      const business = await assembler.getBusinessByListingPageId("page-1");

      expect(business).toBeDefined();
      expect(business.name).toBe("Mountain Coffee Roasters");
      expect(business.slug).toBe("mountain-coffee-roasters");
    });
  });
});
