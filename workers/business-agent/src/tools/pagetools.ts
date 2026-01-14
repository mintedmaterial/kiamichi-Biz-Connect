/**
 * Page Editing Tools for Business Agent
 * Tools for managing page components through AI chat interface
 */
import { tool } from "ai";
import { z } from "zod/v3";
import { getCurrentAgent } from "agents";
import type { Chat } from "../server";
import { TemplateLoader } from "../services/template-loader";

/**
 * List all components for the current business page
 * Auto-executes without confirmation (read-only operation)
 */
export const listPageComponents = tool({
  description: "List all page components for the current business listing page. Shows component types, variants, and content preview.",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    const businessId = agent?.metadata?.businessContext?.businessId;

    if (!businessId) {
      return "No business context available. Please specify which business to work with.";
    }

    try {
      // Get listing page for business
      const listingPage = await env.DB.prepare(`
        SELECT id FROM listing_pages
        WHERE business_id = ?
      `).bind(businessId).first();

      if (!listingPage) {
        return "No listing page found for this business. Use selectComponentTemplate to create the first component.";
      }

      // Get all components
      const { results: components } = await env.DB.prepare(`
        SELECT id, component_type, style_variant, display_order, content, is_visible, created_at, updated_at
        FROM page_components
        WHERE listing_page_id = ?
        ORDER BY display_order ASC
      `).bind(listingPage.id).all();

      if (!components || components.length === 0) {
        return {
          components: [],
          message: "No components found. Use selectComponentTemplate to add components."
        };
      }

      // Format components
      const formattedComponents = components.map((comp: any) => {
        const content = typeof comp.content === 'string'
          ? JSON.parse(comp.content)
          : comp.content;

        return {
          id: comp.id,
          type: comp.component_type,
          variant: comp.style_variant,
          displayOrder: comp.display_order,
          isVisible: comp.is_visible === 1,
          contentPreview: Object.keys(content).slice(0, 3).reduce((acc: any, key) => {
            acc[key] = content[key];
            return acc;
          }, {}),
          createdAt: comp.created_at,
          updatedAt: comp.updated_at
        };
      });

      return {
        components: formattedComponents,
        totalCount: formattedComponents.length,
        businessId
      };
    } catch (error) {
      console.error("Error listing page components:", error);
      return `Error: ${error}`;
    }
  }
});

/**
 * Get full details of a specific component
 * Auto-executes without confirmation (read-only operation)
 */
export const getComponentDetails = tool({
  description: "Get full details of a specific page component including all content and configuration.",
  inputSchema: z.object({
    componentId: z.number().describe("The ID of the component to retrieve")
  }),
  execute: async ({ componentId }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    try {
      const component = await env.DB.prepare(`
        SELECT id, listing_page_id, component_type, style_variant, display_order,
               content, config, is_visible, created_at, updated_at
        FROM page_components
        WHERE id = ?
      `).bind(componentId).first();

      if (!component) {
        return `Component not found with ID: ${componentId}`;
      }

      const content = typeof component.content === 'string'
        ? JSON.parse(component.content as string)
        : component.content;

      const config = component.config
        ? (typeof component.config === 'string' ? JSON.parse(component.config as string) : component.config)
        : {};

      return {
        component: {
          id: component.id,
          type: component.component_type,
          variant: component.style_variant,
          displayOrder: component.display_order,
          content,
          config,
          isVisible: component.is_visible === 1,
          createdAt: component.created_at,
          updatedAt: component.updated_at
        }
      };
    } catch (error) {
      console.error("Error getting component details:", error);
      return `Error: ${error}`;
    }
  }
});

/**
 * Add a new component to the page from templates
 * Auto-executes without confirmation
 */
export const selectComponentTemplate = tool({
  description: "Add a new component to the business listing page by selecting from available templates. Choose from component types: hero, services, gallery, testimonials, contact, faq, about, cta.",
  inputSchema: z.object({
    componentType: z.enum(['hero', 'services', 'gallery', 'testimonials', 'contact', 'faq', 'about', 'cta'])
      .describe("Type of component to add"),
    variant: z.string()
      .describe("Style variant (e.g., 'modern', 'classic', 'minimal')"),
    position: z.number().optional()
      .describe("Optional display order position. If not provided, adds to end.")
  }),
  execute: async ({ componentType, variant, position }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB || !env?.TEMPLATES) {
      throw new Error("Database or Templates bucket not available");
    }

    const businessId = agent?.metadata?.businessContext?.businessId;

    if (!businessId) {
      return {
        success: false,
        message: "Business ID not found in context. Please specify which business to work with."
      };
    }

    try {
      // Get or create listing page
      let listingPage = await env.DB.prepare(`
        SELECT id FROM listing_pages WHERE business_id = ?
      `).bind(businessId).first();

      if (!listingPage) {
        // Create new listing page
        await env.DB.prepare(`
          INSERT INTO listing_pages (business_id, layout_version, is_published, draft_updated_at)
          VALUES (?, 'v1', 0, unixepoch())
        `).bind(businessId).run();

        listingPage = await env.DB.prepare(`
          SELECT id FROM listing_pages WHERE business_id = ?
        `).bind(businessId).first();
      }

      if (!listingPage) {
        return {
          success: false,
          message: "Failed to create listing page"
        };
      }

      // Load template from R2
      const templateLoader = new TemplateLoader(env.TEMPLATES);
      let template;

      try {
        template = await templateLoader.loadTemplate(componentType, variant);
      } catch (error) {
        return {
          success: false,
          message: `Template not found: ${componentType}-${variant}. Available variants may include: modern, classic, minimal.`
        };
      }

      // Determine display order
      let displayOrder = position;

      if (displayOrder === undefined) {
        // Add to end - get max order
        const { results } = await env.DB.prepare(`
          SELECT MAX(display_order) as max_order
          FROM page_components
          WHERE listing_page_id = ?
        `).bind(listingPage.id).all();

        const maxOrder = results && results[0] ? (results[0].max_order as number | null) : null;
        displayOrder = maxOrder !== null ? maxOrder + 1 : 0;
      }

      // Insert component
      await env.DB.prepare(`
        INSERT INTO page_components
        (listing_page_id, component_type, style_variant, display_order, content, config, is_visible, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, unixepoch(), unixepoch())
      `).bind(
        listingPage.id,
        componentType,
        variant,
        displayOrder,
        JSON.stringify(template.default_content),
        JSON.stringify({})
      ).run();

      return {
        success: true,
        message: `${componentType} component (${variant} variant) added successfully at position ${displayOrder}`,
        refreshPreview: true
      };
    } catch (error) {
      console.error("Error selecting component template:", error);
      return {
        success: false,
        message: `Error: ${error}`
      };
    }
  }
});

/**
 * Update component content fields
 * Auto-executes without confirmation
 */
export const updateComponentContent = tool({
  description: "Update the content of a page component. New content is merged with existing content, so you can update individual fields without affecting others.",
  inputSchema: z.object({
    componentId: z.number().describe("The ID of the component to update"),
    content: z.record(z.any()).describe("Content fields to update (will be merged with existing content)")
  }),
  execute: async ({ componentId, content }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    try {
      // Get existing component
      const component = await env.DB.prepare(`
        SELECT id, content FROM page_components WHERE id = ?
      `).bind(componentId).first();

      if (!component) {
        return {
          success: false,
          message: `Component not found with ID: ${componentId}`
        };
      }

      // Parse existing content
      const existingContent = typeof component.content === 'string'
        ? JSON.parse(component.content as string)
        : (component.content || {});

      // Merge new content with existing
      const mergedContent = {
        ...existingContent,
        ...content
      };

      // Update component
      await env.DB.prepare(`
        UPDATE page_components
        SET content = ?, updated_at = unixepoch()
        WHERE id = ?
      `).bind(JSON.stringify(mergedContent), componentId).run();

      return {
        success: true,
        message: `Component ${componentId} content updated successfully`,
        refreshPreview: true
      };
    } catch (error) {
      console.error("Error updating component content:", error);
      return {
        success: false,
        message: `Error: ${error}`
      };
    }
  }
});

/**
 * Delete a component from the page
 * Requires human confirmation before execution
 */
export const removeComponent = tool({
  description: "Delete a component from the business listing page. This action requires confirmation and will reorder remaining components.",
  inputSchema: z.object({
    componentId: z.number().describe("The ID of the component to remove")
  })
  // No execute - requires human confirmation
});

/**
 * Reorder page components
 * Auto-executes without confirmation
 */
export const reorderComponents = tool({
  description: "Change the display order of page components. Provide the component IDs in the desired order.",
  inputSchema: z.object({
    componentIds: z.array(z.number()).describe("Array of component IDs in desired display order")
  }),
  execute: async ({ componentIds }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    if (!componentIds || componentIds.length === 0) {
      return {
        success: true,
        message: "No components to reorder"
      };
    }

    try {
      // Update display_order for each component
      for (let i = 0; i < componentIds.length; i++) {
        await env.DB.prepare(`
          UPDATE page_components
          SET display_order = ?, updated_at = unixepoch()
          WHERE id = ?
        `).bind(i, componentIds[i]).run();
      }

      return {
        success: true,
        message: `Reordered ${componentIds.length} components successfully`,
        refreshPreview: true
      };
    } catch (error) {
      console.error("Error reordering components:", error);
      return {
        success: false,
        message: `Error: ${error}`
      };
    }
  }
});

/**
 * Publish changes to R2 bucket
 * Requires human confirmation before execution
 */
export const publishChanges = tool({
  description: "Publish the current page draft to production. Generates static HTML from page components and uploads to R2 for public access. Creates a pre-publish snapshot for rollback capability.",
  inputSchema: z.object({
    createSnapshot: z.boolean().default(true).describe("Create a pre-publish snapshot for rollback capability")
  })
  // No execute - requires human confirmation
});

/**
 * Rollback to a previous snapshot
 * Requires human confirmation before execution
 */
export const rollbackToSnapshot = tool({
  description: "Restore page components from a previous snapshot. This replaces all current components with the snapshot version. Use listPageSnapshots to see available snapshots.",
  inputSchema: z.object({
    snapshotId: z.number().describe("The ID of the snapshot to restore from")
  })
  // No execute - requires human confirmation
});

/**
 * List all snapshots for the current page
 * Auto-executes without confirmation (read-only operation)
 */
export const listPageSnapshots = tool({
  description: "List all available snapshots for the current business listing page. Snapshots are created before publishing and can be used for rollback.",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    const businessId = agent?.metadata?.businessContext?.businessId;

    if (!businessId) {
      return "No business context available. Please specify which business to work with.";
    }

    try {
      // Get listing page for business
      const listingPage = await env.DB.prepare(`
        SELECT id FROM listing_pages
        WHERE business_id = ?
      `).bind(businessId).first();

      if (!listingPage) {
        return "No listing page found for this business.";
      }

      // Get all snapshots for this page
      const { results: snapshots } = await env.DB.prepare(`
        SELECT id, snapshot_type, snapshot_label, created_at, created_by_owner_id
        FROM page_snapshots
        WHERE listing_page_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `).bind(listingPage.id).all();

      if (!snapshots || snapshots.length === 0) {
        return {
          snapshots: [],
          message: "No snapshots found for this page."
        };
      }

      return {
        snapshots: snapshots.map((s: any) => ({
          id: s.id,
          type: s.snapshot_type,
          label: s.snapshot_label,
          createdAt: new Date(s.created_at * 1000).toISOString(),
          createdByOwnerId: s.created_by_owner_id
        })),
        totalCount: snapshots.length
      };
    } catch (error) {
      console.error("Error listing snapshots:", error);
      return `Error: ${error}`;
    }
  }
});

/**
 * Execution implementations for tools requiring human confirmation
 */
export const pageToolExecutions = {
  /**
   * Execute component selection after confirmation
   */
  selectComponentTemplate: async ({ componentType, variant, position }: {
    componentType: string;
    variant: string;
    position?: number;
  }) => {
    // Reuse the execute logic from the tool
    return selectComponentTemplate.execute!({ componentType: componentType as any, variant, position });
  },

  /**
   * Execute content update after confirmation
   */
  updateComponentContent: async ({ componentId, content }: {
    componentId: number;
    content: Record<string, any>;
  }) => {
    // Reuse the execute logic from the tool
    return updateComponentContent.execute!({ componentId, content });
  },

  /**
   * Execute component removal after human confirmation
   */
  removeComponent: async ({ componentId }: {
    componentId: number;
  }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    try {
      // Get the listing_page_id before deletion
      const component = await env.DB.prepare(`
        SELECT listing_page_id FROM page_components WHERE id = ?
      `).bind(componentId).first();

      if (!component) {
        return {
          success: false,
          message: `Component not found with ID: ${componentId}`
        };
      }

      // Delete the component
      await env.DB.prepare(`
        DELETE FROM page_components WHERE id = ?
      `).bind(componentId).run();

      // Get remaining components and reorder them
      const { results: remainingComponents } = await env.DB.prepare(`
        SELECT id FROM page_components
        WHERE listing_page_id = ?
        ORDER BY display_order ASC
      `).bind(component.listing_page_id).all();

      // Update display_order for remaining components
      if (remainingComponents && remainingComponents.length > 0) {
        for (let i = 0; i < remainingComponents.length; i++) {
          await env.DB.prepare(`
            UPDATE page_components
            SET display_order = ?, updated_at = unixepoch()
            WHERE id = ?
          `).bind(i, remainingComponents[i].id).run();
        }
      }

      return {
        success: true,
        message: `Component ${componentId} removed successfully. ${remainingComponents?.length || 0} components reordered.`,
        refreshPreview: true
      };
    } catch (error) {
      console.error("Error removing component:", error);
      return {
        success: false,
        message: `Error: ${error}`
      };
    }
  },

  /**
   * Execute component reordering after confirmation
   */
  reorderComponents: async ({ componentIds }: {
    componentIds: number[];
  }) => {
    // Reuse the execute logic from the tool
    return reorderComponents.execute!({ componentIds });
  },

  /**
   * Execute page publishing after human confirmation
   */
  publishChanges: async ({ createSnapshot = true }: {
    createSnapshot?: boolean;
  }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB || !env?.BUSINESS_ASSETS || !env?.TEMPLATES) {
      throw new Error("Required services not available (DB, BUSINESS_ASSETS, TEMPLATES)");
    }

    const businessId = agent?.metadata?.businessContext?.businessId;

    if (!businessId) {
      return {
        success: false,
        message: "Business ID not found in context"
      };
    }

    try {
      // Get listing page
      const listingPage = await env.DB.prepare(`
        SELECT id FROM listing_pages WHERE business_id = ?
      `).bind(businessId).first();

      if (!listingPage) {
        return {
          success: false,
          message: "No listing page found for this business"
        };
      }

      // Get business data to generate slug
      const business = await env.DB.prepare(`
        SELECT id, name, slug FROM businesses WHERE id = ?
      `).bind(businessId).first();

      if (!business) {
        return {
          success: false,
          message: "Business not found"
        };
      }

      // Create pre-publish snapshot if requested
      let snapshotId: number | null = null;
      if (createSnapshot) {
        // Get all current components
        const { results: components } = await env.DB.prepare(`
          SELECT id, component_type, style_variant, display_order, content, config, is_visible
          FROM page_components
          WHERE listing_page_id = ?
          ORDER BY display_order ASC
        `).bind(listingPage.id).all();

        // Serialize to JSON
        const componentsJson = JSON.stringify(components || []);

        // Insert snapshot
        const snapshotResult = await env.DB.prepare(`
          INSERT INTO page_snapshots
          (listing_page_id, snapshot_type, components_json, metadata, created_at, snapshot_label)
          VALUES (?, 'pre_publish', ?, '{}', unixepoch(), ?)
        `).bind(
          listingPage.id,
          componentsJson,
          `Pre-publish snapshot ${new Date().toISOString()}`
        ).run();

        // Get the inserted snapshot ID (D1 returns meta.last_row_id)
        snapshotId = snapshotResult.meta.last_row_id as number;
      }

      // Generate static HTML using PageAssembler
      const { PageAssembler } = await import('../services/page-assembler');
      const { TemplateLoader } = await import('../services/template-loader');
      const { ComponentRenderer } = await import('../services/component-renderer');

      const templateLoader = new TemplateLoader(env.TEMPLATES);
      const componentRenderer = new ComponentRenderer();
      const pageAssembler = new PageAssembler(env.DB, templateLoader, componentRenderer);

      const assembledPage = await pageAssembler.assemblePage(String(listingPage.id), {
        previewMode: false
      });

      // Calculate SHA-256 hash of HTML
      const encoder = new TextEncoder();
      const data = encoder.encode(assembledPage.html);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const htmlHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Upload to R2
      const r2Key = `business/${business.slug}/index.html`;
      await env.BUSINESS_ASSETS.put(r2Key, assembledPage.html, {
        httpMetadata: {
          contentType: 'text/html; charset=utf-8'
        },
        customMetadata: {
          businessId: String(businessId),
          publishedAt: new Date().toISOString()
        }
      });

      const fileSizeBytes = new Blob([assembledPage.html]).size;

      // Insert into published_pages_r2 table
      await env.DB.prepare(`
        INSERT INTO published_pages_r2
        (listing_page_id, r2_key, html_hash, published_at, snapshot_id, file_size_bytes)
        VALUES (?, ?, ?, unixepoch(), ?, ?)
      `).bind(
        listingPage.id,
        r2Key,
        htmlHash,
        snapshotId,
        fileSizeBytes
      ).run();

      // Update listing_pages
      await env.DB.prepare(`
        UPDATE listing_pages
        SET is_published = 1, last_published_at = unixepoch()
        WHERE id = ?
      `).bind(listingPage.id).run();

      // Insert into portal_activity_log (if owner_id is available)
      const ownerId = agent?.metadata?.businessContext?.ownerId;
      if (ownerId) {
        await env.DB.prepare(`
          INSERT INTO portal_activity_log
          (owner_id, business_id, activity_type, activity_data, created_at)
          VALUES (?, ?, 'page_published', ?, unixepoch())
        `).bind(
          ownerId,
          businessId,
          JSON.stringify({ r2_key: r2Key, html_hash: htmlHash })
        ).run();
      }

      const publicUrl = `https://kiamichibizconnect.com/business/${business.slug}`;

      return {
        success: true,
        message: `Page published successfully! View at: ${publicUrl}`,
        publishedUrl: publicUrl,
        r2Key: r2Key,
        htmlHash: htmlHash,
        snapshotCreated: createSnapshot
      };
    } catch (error) {
      console.error("Error publishing changes:", error);
      return {
        success: false,
        message: `Error publishing: ${error}`
      };
    }
  },

  /**
   * Execute snapshot rollback after human confirmation
   */
  rollbackToSnapshot: async ({ snapshotId }: {
    snapshotId: number;
  }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    const businessId = agent?.metadata?.businessContext?.businessId;

    if (!businessId) {
      return {
        success: false,
        message: "Business ID not found in context"
      };
    }

    try {
      // Get the snapshot
      const snapshot = await env.DB.prepare(`
        SELECT ps.*, lp.business_id
        FROM page_snapshots ps
        INNER JOIN listing_pages lp ON lp.id = ps.listing_page_id
        WHERE ps.id = ?
      `).bind(snapshotId).first();

      if (!snapshot) {
        return {
          success: false,
          message: `Snapshot not found with ID: ${snapshotId}`
        };
      }

      // Security check: Verify snapshot belongs to user's business
      if (snapshot.business_id !== businessId) {
        return {
          success: false,
          message: "Access denied: Snapshot belongs to a different business"
        };
      }

      // Parse components from snapshot
      const componentsJson = typeof snapshot.components_json === 'string'
        ? snapshot.components_json
        : JSON.stringify(snapshot.components_json);
      const components = JSON.parse(componentsJson) as any[];

      if (!Array.isArray(components)) {
        return {
          success: false,
          message: "Invalid snapshot data format"
        };
      }

      // Delete current components
      await env.DB.prepare(`
        DELETE FROM page_components WHERE listing_page_id = ?
      `).bind(snapshot.listing_page_id).run();

      // Insert components from snapshot
      for (const comp of components) {
        await env.DB.prepare(`
          INSERT INTO page_components
          (listing_page_id, component_type, style_variant, display_order, content, config, is_visible, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
        `).bind(
          snapshot.listing_page_id,
          comp.component_type,
          comp.style_variant,
          comp.display_order,
          typeof comp.content === 'string' ? comp.content : JSON.stringify(comp.content),
          typeof comp.config === 'string' ? comp.config : JSON.stringify(comp.config),
          comp.is_visible ? 1 : 0
        ).run();
      }

      // Update draft_updated_at
      await env.DB.prepare(`
        UPDATE listing_pages
        SET draft_updated_at = unixepoch()
        WHERE id = ?
      `).bind(snapshot.listing_page_id).run();

      // Log activity
      const ownerId = agent?.metadata?.businessContext?.ownerId;
      if (ownerId) {
        await env.DB.prepare(`
          INSERT INTO portal_activity_log
          (owner_id, business_id, activity_type, activity_data, created_at)
          VALUES (?, ?, 'page_rollback', ?, unixepoch())
        `).bind(
          ownerId,
          businessId,
          JSON.stringify({ snapshot_id: snapshotId, snapshot_type: snapshot.snapshot_type })
        ).run();
      }

      return {
        success: true,
        message: `Successfully restored ${components.length} components from snapshot`,
        refreshPreview: true,
        componentsRestored: components.length
      };
    } catch (error) {
      console.error("Error rolling back to snapshot:", error);
      return {
        success: false,
        message: `Error during rollback: ${error}`
      };
    }
  }
};
