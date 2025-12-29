/**
 * Page Tools Test Suite
 * Testing page editing tools for business-agent using TDD approach
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Chat } from "../../server";
import { getCurrentAgent } from "agents";

// Mock getCurrentAgent
vi.mock("agents", () => ({
  getCurrentAgent: vi.fn()
}));

// Import tools and executions (will be implemented)
import {
  selectComponentTemplate,
  updateComponentContent,
  removeComponent,
  reorderComponents,
  listPageComponents,
  getComponentDetails,
  pageToolExecutions
} from "../pagetools";

describe("Page Tools - TDD", () => {
  let mockEnv: Env;
  let mockAgent: Partial<Chat>;

  beforeEach(() => {
    // Setup mock D1 database
    const mockDB = {
      prepare: vi.fn((query: string) => ({
        bind: vi.fn((...params: any[]) => ({
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        })),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] })
      }))
    } as unknown as D1Database;

    // Setup mock R2 bucket
    const mockTemplates = {
      get: vi.fn((key: string) => {
        if (key === "hero-modern.json") {
          return Promise.resolve({
            json: vi.fn().mockResolvedValue({
              component_type: "hero",
              variant: "modern",
              html_template: "<div>Hero</div>",
              css_template: ".hero {}",
              default_content: {
                heading: "Welcome",
                subheading: "Your business here",
                cta_text: "Get Started"
              }
            })
          } as unknown as R2ObjectBody);
        }
        return Promise.resolve(null);
      }),
      put: vi.fn().mockResolvedValue(undefined)
    } as unknown as R2Bucket;

    // Setup environment
    mockEnv = {
      DB: mockDB,
      TEMPLATES: mockTemplates,
      BUSINESS_ASSETS: {} as R2Bucket,
      IMAGES: {} as R2Bucket,
      AI: {} as Ai,
      CACHE: {} as KVNamespace
    } as Env;

    // Setup agent
    mockAgent = {
      env: mockEnv,
      metadata: {
        businessContext: {
          businessId: 1,
          businessName: "Test Business"
        }
      }
    };

    // Mock getCurrentAgent to return our mock agent
    vi.mocked(getCurrentAgent).mockReturnValue({
      agent: mockAgent as Chat
    } as any);
  });

  describe("listPageComponents (auto-execute, read-only)", () => {
    it("should return empty list when business has no listing page", async () => {
      const result = await listPageComponents.execute!({});

      expect(result).toContain("No listing page found");
    });

    it("should list all components for business page", async () => {
      // Setup: Mock listing page and components
      const mockListingPage = { id: 1, business_id: 1 };
      const mockComponents = [
        {
          id: 1,
          listing_page_id: 1,
          component_type: "hero",
          style_variant: "modern",
          display_order: 0,
          content: JSON.stringify({ heading: "Welcome" }),
          is_visible: 1
        },
        {
          id: 2,
          listing_page_id: 1,
          component_type: "services",
          style_variant: "grid",
          display_order: 1,
          content: JSON.stringify({ title: "Our Services" }),
          is_visible: 1
        }
      ];

      const mockPrepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockListingPage)
          })
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mockComponents })
          })
        });

      mockEnv.DB.prepare = mockPrepare;

      const result = await listPageComponents.execute!({});

      expect(result).toHaveProperty("components");
      expect(result.components).toHaveLength(2);
      expect(result.components[0]).toMatchObject({
        id: 1,
        type: "hero",
        variant: "modern"
      });
    });

    it("should handle database errors gracefully", async () => {
      const mockPrepare = vi.fn().mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      mockEnv.DB.prepare = mockPrepare;

      const result = await listPageComponents.execute!({});

      expect(result).toContain("Error");
    });
  });

  describe("getComponentDetails (auto-execute, read-only)", () => {
    it("should return full component details", async () => {
      const mockComponent = {
        id: 1,
        listing_page_id: 1,
        component_type: "hero",
        style_variant: "modern",
        display_order: 0,
        content: JSON.stringify({ heading: "Welcome", subheading: "Test" }),
        config: JSON.stringify({ animation: "fade" }),
        is_visible: 1,
        created_at: "2024-01-01",
        updated_at: "2024-01-01"
      };

      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockComponent)
        })
      });

      mockEnv.DB.prepare = mockPrepare;

      const result = await getComponentDetails.execute!({ componentId: 1 });

      expect(result).toHaveProperty("component");
      expect(result.component).toMatchObject({
        id: 1,
        type: "hero",
        variant: "modern",
        content: { heading: "Welcome", subheading: "Test" },
        config: { animation: "fade" }
      });
    });

    it("should handle missing component", async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null)
        })
      });

      mockEnv.DB.prepare = mockPrepare;

      const result = await getComponentDetails.execute!({ componentId: 999 });

      expect(result).toContain("Component not found");
    });

    it("should require componentId parameter", () => {
      expect(getComponentDetails.inputSchema).toBeDefined();
      const schema = getComponentDetails.inputSchema as any;
      expect(schema.shape).toHaveProperty("componentId");
    });
  });

  describe("selectComponentTemplate (auto-execute)", () => {
    it("should create listing page if it doesn't exist", async () => {
      let createPageCalled = false;
      let insertComponentCalled = false;

      const mockPrepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null) // No listing page
          })
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockImplementation(() => {
              createPageCalled = true;
              return Promise.resolve({ success: true });
            })
          })
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ id: 1, business_id: 1 })
          })
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [{ max_order: null }] })
          })
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockImplementation(() => {
              insertComponentCalled = true;
              return Promise.resolve({ success: true });
            })
          })
        });

      mockEnv.DB.prepare = mockPrepare;

      const result = await pageToolExecutions.selectComponentTemplate({
        componentType: "hero",
        variant: "modern"
      });

      expect(createPageCalled).toBe(true);
      expect(insertComponentCalled).toBe(true);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("refreshPreview", true);
    });

    it("should add component to existing page", async () => {
      let insertCalled = false;

      // Mock R2 template
      const mockGet = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          component_type: "services",
          variant: "grid",
          html_template: "<div>Services</div>",
          css_template: ".services {}",
          default_content: {
            title: "Our Services",
            items: []
          }
        })
      } as unknown as R2ObjectBody);

      mockEnv.TEMPLATES.get = mockGet;

      const mockPrepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ id: 1, business_id: 1 })
          })
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [{ max_order: 2 }] })
          })
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockImplementation(() => {
              insertCalled = true;
              return Promise.resolve({ success: true });
            })
          })
        });

      mockEnv.DB.prepare = mockPrepare;

      const result = await pageToolExecutions.selectComponentTemplate({
        componentType: "services",
        variant: "grid"
      });

      expect(insertCalled).toBe(true);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("message");
      expect(result.message).toContain("added");
    });

    it("should load template from R2 and use default_content", async () => {
      const mockPrepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ id: 1, business_id: 1 })
          })
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [{ max_order: 0 }] })
          })
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockImplementation((...params: any[]) => {
            // The 5th parameter (index 4) is the content JSON string
            const contentJson = params[4];
            const content = JSON.parse(contentJson);
            expect(content).toHaveProperty("heading", "Welcome");
            return {
              run: vi.fn().mockResolvedValue({ success: true })
            };
          })
        });

      mockEnv.DB.prepare = mockPrepare;

      await pageToolExecutions.selectComponentTemplate({
        componentType: "hero",
        variant: "modern"
      });

      expect(mockEnv.TEMPLATES.get).toHaveBeenCalledWith("hero-modern.json");
    });

    it("should respect custom position parameter", async () => {
      let insertedOrder: number | null = null;

      const mockPrepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ id: 1, business_id: 1 })
          })
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockImplementation((...params: any[]) => {
            // Capture the bind parameters for the INSERT statement
            // Parameters: listing_page_id, component_type, variant, display_order, content, config
            insertedOrder = params[3];
            return {
              run: vi.fn().mockResolvedValue({ success: true })
            };
          })
        });

      mockEnv.DB.prepare = mockPrepare;

      await pageToolExecutions.selectComponentTemplate({
        componentType: "hero",
        variant: "modern",
        position: 5
      });

      expect(insertedOrder).toBe(5);
    });

    it("should handle template not found error", async () => {
      const mockGet = vi.fn().mockResolvedValue(null);
      mockEnv.TEMPLATES.get = mockGet;

      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ id: 1, business_id: 1 })
        })
      });

      mockEnv.DB.prepare = mockPrepare;

      const result = await pageToolExecutions.selectComponentTemplate({
        componentType: "nonexistent",
        variant: "invalid"
      });

      expect(result).toHaveProperty("success", false);
      expect(result.message).toContain("not found");
    });

    it("should handle missing businessId", async () => {
      vi.mocked(getCurrentAgent).mockReturnValue({
        agent: {
          env: mockEnv,
          metadata: {}
        } as Chat
      } as any);

      const result = await pageToolExecutions.selectComponentTemplate({
        componentType: "hero",
        variant: "modern"
      });

      expect(result).toHaveProperty("success", false);
      expect(result.message).toContain("Business ID");
    });
  });

  describe("updateComponentContent (auto-execute)", () => {
    it("should merge new content with existing content", async () => {
      const existingComponent = {
        id: 1,
        content: JSON.stringify({ heading: "Old Heading", subheading: "Keep this" })
      };

      let updatedContent: any = null;

      const mockPrepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(existingComponent)
          })
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockImplementation((contentJson: string, ...rest: any[]) => {
            updatedContent = JSON.parse(contentJson);
            return {
              run: vi.fn().mockResolvedValue({ success: true })
            };
          })
        });

      mockEnv.DB.prepare = mockPrepare;

      const result = await pageToolExecutions.updateComponentContent({
        componentId: 1,
        content: { heading: "New Heading" }
      });

      expect(updatedContent).toEqual({
        heading: "New Heading",
        subheading: "Keep this"
      });
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("refreshPreview", true);
    });

    it("should handle component not found", async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null)
        })
      });

      mockEnv.DB.prepare = mockPrepare;

      const result = await pageToolExecutions.updateComponentContent({
        componentId: 999,
        content: { heading: "Test" }
      });

      expect(result).toHaveProperty("success", false);
      expect(result.message).toContain("not found");
    });

    it("should update timestamp", async () => {
      const existingComponent = {
        id: 1,
        content: JSON.stringify({})
      };

      let updateCalled = false;

      const mockPrepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(existingComponent)
          })
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockImplementation(() => {
              updateCalled = true;
              return Promise.resolve({ success: true });
            })
          })
        });

      mockEnv.DB.prepare = mockPrepare;

      await pageToolExecutions.updateComponentContent({
        componentId: 1,
        content: { test: "value" }
      });

      expect(updateCalled).toBe(true);
      // The SQL should include updated_at = unixepoch()
    });
  });

  describe("removeComponent (requires confirmation)", () => {
    it("should delete component and reorder remaining components", async () => {
      const remainingComponents = [
        { id: 2, display_order: 1 },
        { id: 3, display_order: 2 }
      ];

      let deleteCalled = false;
      let reorderCalls = 0;

      const mockPrepare = vi.fn()
        // First call: Get the listing_page_id before deletion
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ listing_page_id: 1 })
          })
        })
        // Second call: Delete the component
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockImplementation(() => {
              deleteCalled = true;
              return Promise.resolve({ success: true });
            })
          })
        })
        // Third call: Get remaining components
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: remainingComponents })
          })
        })
        // Fourth and fifth calls: Reorder each remaining component
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockImplementation(() => {
              reorderCalls++;
              return Promise.resolve({ success: true });
            })
          })
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockImplementation(() => {
              reorderCalls++;
              return Promise.resolve({ success: true });
            })
          })
        });

      mockEnv.DB.prepare = mockPrepare;

      const result = await pageToolExecutions.removeComponent({
        componentId: 1
      });

      expect(deleteCalled).toBe(true);
      expect(reorderCalls).toBe(2); // Should reorder 2 remaining components
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("refreshPreview", true);
    });

    it("should verify tool requires confirmation (no execute function)", () => {
      expect(removeComponent.execute).toBeUndefined();
    });

    it("should handle deletion errors", async () => {
      const mockPrepare = vi.fn().mockImplementation(() => {
        throw new Error("Database error");
      });

      mockEnv.DB.prepare = mockPrepare;

      const result = await pageToolExecutions.removeComponent({
        componentId: 1
      });

      expect(result).toHaveProperty("success", false);
      expect(result.message).toContain("Error");
    });
  });

  describe("reorderComponents (auto-execute)", () => {
    it("should update display_order for all components in order", async () => {
      const componentIds = [3, 1, 2]; // Desired order
      const updateCalls: Array<{ id: number; order: number }> = [];

      const mockPrepare = vi.fn().mockImplementation((query: string) => ({
        bind: vi.fn().mockImplementation((order: number, id: number) => {
          updateCalls.push({ id, order });
          return {
            run: vi.fn().mockResolvedValue({ success: true })
          };
        })
      }));

      mockEnv.DB.prepare = mockPrepare;

      const result = await pageToolExecutions.reorderComponents({
        componentIds
      });

      expect(updateCalls).toHaveLength(3);
      expect(updateCalls[0]).toEqual({ id: 3, order: 0 });
      expect(updateCalls[1]).toEqual({ id: 1, order: 1 });
      expect(updateCalls[2]).toEqual({ id: 2, order: 2 });
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("refreshPreview", true);
    });

    it("should handle empty array", async () => {
      const result = await pageToolExecutions.reorderComponents({
        componentIds: []
      });

      expect(result).toHaveProperty("success", true);
      expect(result.message).toContain("No components");
    });

    it("should handle single component", async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true })
        })
      });

      mockEnv.DB.prepare = mockPrepare;

      const result = await pageToolExecutions.reorderComponents({
        componentIds: [1]
      });

      expect(result).toHaveProperty("success", true);
    });
  });

  describe("Tool input schema validation", () => {
    it("selectComponentTemplate should have correct schema", () => {
      expect(selectComponentTemplate.inputSchema).toBeDefined();
      const schema = selectComponentTemplate.inputSchema as any;

      expect(schema.shape).toHaveProperty("componentType");
      expect(schema.shape).toHaveProperty("variant");
      expect(schema.shape).toHaveProperty("position");
    });

    it("updateComponentContent should have correct schema", () => {
      expect(updateComponentContent.inputSchema).toBeDefined();
      const schema = updateComponentContent.inputSchema as any;

      expect(schema.shape).toHaveProperty("componentId");
      expect(schema.shape).toHaveProperty("content");
    });

    it("removeComponent should have correct schema", () => {
      expect(removeComponent.inputSchema).toBeDefined();
      const schema = removeComponent.inputSchema as any;

      expect(schema.shape).toHaveProperty("componentId");
    });

    it("reorderComponents should have correct schema", () => {
      expect(reorderComponents.inputSchema).toBeDefined();
      const schema = reorderComponents.inputSchema as any;

      expect(schema.shape).toHaveProperty("componentIds");
    });

    it("listPageComponents should accept empty input", () => {
      expect(listPageComponents.inputSchema).toBeDefined();
    });

    it("getComponentDetails should require componentId", () => {
      expect(getComponentDetails.inputSchema).toBeDefined();
      const schema = getComponentDetails.inputSchema as any;

      expect(schema.shape).toHaveProperty("componentId");
    });
  });

  describe("Tool execution patterns", () => {
    it("auto-execute tools should have execute function", () => {
      expect(selectComponentTemplate.execute).toBeDefined();
      expect(updateComponentContent.execute).toBeDefined();
      expect(reorderComponents.execute).toBeDefined();
      expect(listPageComponents.execute).toBeDefined();
      expect(getComponentDetails.execute).toBeDefined();
    });

    it("confirmation-required tools should NOT have execute function", () => {
      expect(removeComponent.execute).toBeUndefined();
    });

    it("all tools should have descriptions", () => {
      expect(selectComponentTemplate.description).toBeDefined();
      expect(updateComponentContent.description).toBeDefined();
      expect(removeComponent.description).toBeDefined();
      expect(reorderComponents.description).toBeDefined();
      expect(listPageComponents.description).toBeDefined();
      expect(getComponentDetails.description).toBeDefined();
    });
  });

  describe("Return format validation", () => {
    it("successful operations should return refreshPreview: true", async () => {
      const mockPrepare = vi.fn()
        .mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ id: 1, business_id: 1 }),
            all: vi.fn().mockResolvedValue({ results: [{ max_order: 0 }] }),
            run: vi.fn().mockResolvedValue({ success: true })
          })
        });

      mockEnv.DB.prepare = mockPrepare;

      const selectResult = await pageToolExecutions.selectComponentTemplate({
        componentType: "hero",
        variant: "modern"
      });

      expect(selectResult).toHaveProperty("refreshPreview", true);
    });

    it("failed operations should return success: false", async () => {
      vi.mocked(getCurrentAgent).mockReturnValue({
        agent: {
          env: mockEnv,
          metadata: {}
        } as Chat
      } as any);

      const result = await pageToolExecutions.selectComponentTemplate({
        componentType: "hero",
        variant: "modern"
      });

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("message");
    });
  });
});
