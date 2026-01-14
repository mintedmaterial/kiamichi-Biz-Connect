import { describe, it, expect, beforeEach, vi } from "vitest";
import { TemplateLoader } from "../template-loader";
import type { ComponentTemplate } from "../types";

// Mock R2 bucket
class MockR2Bucket {
  private storage = new Map<string, string>();

  setMockTemplate(key: string, template: ComponentTemplate) {
    this.storage.set(key, JSON.stringify(template));
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const data = this.storage.get(key);
    if (!data) {
      return null;
    }

    return {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(data));
          controller.close();
        },
      }),
      arrayBuffer: async () => new TextEncoder().encode(data).buffer,
      text: async () => data,
      json: async () => JSON.parse(data),
      blob: async () => new Blob([data]),
      httpMetadata: {},
      customMetadata: {},
      range: undefined,
      checksums: {},
      etag: "mock-etag",
      key,
      size: data.length,
      uploaded: new Date(),
      version: "1",
      writeHttpMetadata: vi.fn(),
    } as unknown as R2ObjectBody;
  }

  async put() {
    throw new Error("Put not implemented in mock");
  }

  async delete() {
    throw new Error("Delete not implemented in mock");
  }

  async head() {
    throw new Error("Head not implemented in mock");
  }

  async list() {
    throw new Error("List not implemented in mock");
  }
}

describe("TemplateLoader", () => {
  let mockBucket: MockR2Bucket;
  let loader: TemplateLoader;

  beforeEach(() => {
    mockBucket = new MockR2Bucket();
    loader = new TemplateLoader(mockBucket as unknown as R2Bucket);
  });

  describe("loadTemplate", () => {
    it("should load a template from R2 bucket", async () => {
      const mockTemplate: ComponentTemplate = {
        component_type: "hero",
        variant: "modern",
        html_template: "<section class='hero'><h1>{{heading}}</h1></section>",
        css_template: ".hero { background: {{bg_color}}; }",
        default_content: {
          heading: "Welcome",
          bg_color: "#1a202c",
        },
      };

      mockBucket.setMockTemplate("hero-modern.json", mockTemplate);

      const result = await loader.loadTemplate("hero", "modern");

      expect(result).toEqual(mockTemplate);
      expect(result.component_type).toBe("hero");
      expect(result.variant).toBe("modern");
      expect(result.html_template).toContain("{{heading}}");
    });

    it("should cache templates after first load", async () => {
      const mockTemplate: ComponentTemplate = {
        component_type: "hero",
        variant: "modern",
        html_template: "<section>Test</section>",
        css_template: ".hero {}",
        default_content: {},
      };

      mockBucket.setMockTemplate("hero-modern.json", mockTemplate);

      // First load
      const result1 = await loader.loadTemplate("hero", "modern");

      // Clear the mock bucket to ensure second load comes from cache
      mockBucket = new MockR2Bucket();

      // Second load should still work (from cache)
      const result2 = await loader.loadTemplate("hero", "modern");

      expect(result1).toEqual(result2);
    });

    it("should throw error for missing template", async () => {
      await expect(
        loader.loadTemplate("nonexistent", "variant")
      ).rejects.toThrow("Template not found");
    });

    it("should handle different component types and variants", async () => {
      const heroTemplate: ComponentTemplate = {
        component_type: "hero",
        variant: "minimal",
        html_template: "<div>Hero</div>",
        css_template: "",
        default_content: {},
      };

      const footerTemplate: ComponentTemplate = {
        component_type: "footer",
        variant: "standard",
        html_template: "<footer>Footer</footer>",
        css_template: "",
        default_content: {},
      };

      mockBucket.setMockTemplate("hero-minimal.json", heroTemplate);
      mockBucket.setMockTemplate("footer-standard.json", footerTemplate);

      const hero = await loader.loadTemplate("hero", "minimal");
      const footer = await loader.loadTemplate("footer", "standard");

      expect(hero.component_type).toBe("hero");
      expect(footer.component_type).toBe("footer");
    });

    it("should handle templates with complex default_content", async () => {
      const mockTemplate: ComponentTemplate = {
        component_type: "contact",
        variant: "form",
        html_template: "<form>{{form_html}}</form>",
        css_template: ".form {}",
        default_content: {
          heading: "Contact Us",
          fields: ["name", "email", "message"],
          submit_text: "Send",
          success_message: "Thank you!",
        },
      };

      mockBucket.setMockTemplate("contact-form.json", mockTemplate);

      const result = await loader.loadTemplate("contact", "form");

      expect(result.default_content).toHaveProperty("heading");
      expect(result.default_content).toHaveProperty("fields");
      expect(Array.isArray(result.default_content.fields)).toBe(true);
    });
  });

  describe("clearCache", () => {
    it("should clear the template cache", async () => {
      const mockTemplate: ComponentTemplate = {
        component_type: "hero",
        variant: "modern",
        html_template: "<section>Test</section>",
        css_template: "",
        default_content: {},
      };

      mockBucket.setMockTemplate("hero-modern.json", mockTemplate);

      // Load template (should cache)
      await loader.loadTemplate("hero", "modern");

      // Clear cache
      loader.clearCache();

      // Modify the template in the bucket
      const updatedTemplate = { ...mockTemplate, html_template: "<section>Updated</section>" };
      mockBucket.setMockTemplate("hero-modern.json", updatedTemplate);

      // Load again - should get updated version since cache was cleared
      const result = await loader.loadTemplate("hero", "modern");

      expect(result.html_template).toBe("<section>Updated</section>");
    });
  });

  describe("getTemplateKey", () => {
    it("should generate correct R2 key format", () => {
      const key = loader.getTemplateKey("hero", "modern");
      expect(key).toBe("hero-modern.json");
    });

    it("should handle different component types", () => {
      expect(loader.getTemplateKey("footer", "standard")).toBe("footer-standard.json");
      expect(loader.getTemplateKey("navigation", "sticky")).toBe("navigation-sticky.json");
    });
  });
});
