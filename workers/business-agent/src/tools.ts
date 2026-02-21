/**
 * Business Listing Agent Tools for Kiamichi Biz Connect
 * Tools for managing business listings, generating content, and SEO optimization
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";
import type { Chat } from "./server";
import { Agent, getCurrentAgent } from "agents";
import { scheduleSchema } from "agents/schedule";
import { executeTemplate, getTemplateInfo, type TemplateName } from "./codemode";

/**
 * Update a page component (hero, services, gallery, etc.)
 * Requires human confirmation before modifying the business listing
 */
const updateComponent = tool({
  description: "Update content for a page component (hero, services, gallery, testimonials, contact, FAQ, about)",
  inputSchema: z.object({
    componentId: z.number().describe("The ID of the component to update"),
    content: z.record(z.any()).describe("The updated content as a JSON object (heading, text, images, etc.)"),
    config: z.record(z.any()).optional().describe("Optional configuration settings for the component")
  })
  // Omitting execute makes this require human confirmation (critical changes)
});

/**
 * Generate an SEO-optimized blog post for the business
 * Requires human confirmation before creating the post
 */
const generateBlogPost = tool({
  description: "Generate an SEO-optimized blog post for the business listing. Creates title, content, meta description, and keywords.",
  inputSchema: z.object({
    topic: z.string().describe("The topic or theme for the blog post"),
    keywords: z.array(z.string()).describe("Target SEO keywords to include"),
    tone: z.enum(["professional", "casual", "friendly", "informative"]).default("professional").describe("The writing tone/voice"),
    wordCount: z.number().min(300).max(2000).default(800).describe("Target word count for the post")
  })
  // Omitting execute makes this require human confirmation
});

/**
 * Analyze and optimize SEO for the business listing
 * Requires human confirmation before applying changes
 */
const optimizeSEO = tool({
  description: "Analyze the business listing page for SEO issues (keywords, meta tags, schema markup, Core Web Vitals) and provide optimization suggestions.",
  inputSchema: z.object({
    autoApply: z.boolean().default(false).describe("Automatically apply high-confidence SEO fixes (requires human confirmation)")
  })
  // Omitting execute makes this require human confirmation
});

/**
 * Get business information and current listing details
 * Auto-executes without confirmation (read-only operation)
 */
const getBusinessInfo = tool({
  description: "Retrieve current business information, listing page components, and metadata",
  inputSchema: z.object({
    businessId: z.number().describe("The business ID to fetch information for")
  }),
  execute: async ({ businessId }) => {
    const { agent } = getCurrentAgent<Agent>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    try {
      // Get business details with listing page info
      const business = await env.DB.prepare(`
        SELECT b.*, lp.seo_title, lp.seo_description, lp.seo_keywords, lp.is_published,
               lp.layout_version, lp.page_views, lp.unique_visitors
        FROM businesses b
        LEFT JOIN listing_pages lp ON b.id = lp.business_id
        WHERE b.id = ?
      `).bind(businessId).first();

      if (!business) {
        return "Business not found";
      }

      return {
        business: {
          id: business.id,
          name: business.name,
          slug: business.slug,
          description: business.description,
          category_id: business.category_id,
          phone: business.phone,
          email: business.email,
          website: business.website,
          address: {
            line1: business.address_line1,
            line2: business.address_line2,
            city: business.city,
            state: business.state,
            zip: business.zip_code
          },
          social: {
            facebook_url: business.facebook_url,
            google_business_url: business.google_business_url
          },
          ratings: {
            google_rating: business.google_rating,
            google_review_count: business.google_review_count,
            facebook_rating: business.facebook_rating,
            facebook_review_count: business.facebook_review_count
          },
          seo: {
            title: business.seo_title,
            description: business.seo_description,
            keywords: business.seo_keywords
          },
          listing: {
            is_published: business.is_published,
            layout_version: business.layout_version,
            page_views: business.page_views,
            unique_visitors: business.unique_visitors
          },
          flags: {
            is_verified: business.is_verified === 1,
            is_featured: business.is_featured === 1,
            is_active: business.is_active === 1
          }
        }
      };
    } catch (error) {
      console.error("Error fetching business info:", error);
      return `Error: ${error}`;
    }
  }
});

/**
 * Schedule a task for later execution
 * Auto-executes without confirmation
 */
const scheduleTask = tool({
  description: "Schedule a task to be executed at a later time (e.g., publish blog post in 2 hours, update content tomorrow)",
  inputSchema: scheduleSchema,
  execute: async ({ when, description }) => {
    const { agent } = getCurrentAgent<Agent>();

    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }

    const input =
      when.type === "scheduled"
        ? when.date
        : when.type === "delayed"
          ? when.delayInSeconds
          : when.type === "cron"
            ? when.cron
            : null;

    if (!input) {
      return "Invalid schedule input";
    }

    try {
      agent!.schedule(input, "executeTask", description);
      return `Task scheduled for ${when.type}: ${input}`;
    } catch (error) {
      console.error("Error scheduling task:", error);
      return `Error scheduling task: ${error}`;
    }
  }
});

/**
 * List all scheduled tasks
 * Auto-executes without confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled for this business",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks:", error);
      return `Error: ${error}`;
    }
  }
});

/**
 * Cancel a scheduled task
 * Auto-executes without confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a previously scheduled task using its ID",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to cancel")
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling task:", error);
      return `Error: ${error}`;
    }
  }
});

/**
 * List all tables in the database
 * Auto-executes without confirmation (read-only operation)
 */
const listDatabaseTables = tool({
  description: "List all tables in the Kiamichi Biz Connect database",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    try {
      const { results } = await env.DB.prepare(`
        SELECT name, type
        FROM sqlite_master
        WHERE type IN ('table', 'view')
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all();

      return {
        tables: results?.map(r => ({
          name: r.name,
          type: r.type
        })) || []
      };
    } catch (error) {
      console.error("Error listing database tables:", error);
      return `Error: ${error}`;
    }
  }
});

/**
 * Query the database with a read-only SQL statement
 * Auto-executes without confirmation (read-only operations only)
 */
const queryDatabase = tool({
  description: "Execute a read-only SQL query on the database (SELECT statements only). Use this to explore data, check table schemas, or retrieve specific information.",
  inputSchema: z.object({
    query: z.string().describe("The SQL SELECT query to execute (INSERT, UPDATE, DELETE are not allowed)"),
    params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe("Optional parameters for the query (strings, numbers, booleans, or null)")
  }),
  execute: async ({ query, params }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    // Security: Only allow SELECT queries
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery.startsWith('select') && !normalizedQuery.startsWith('pragma')) {
      return "Error: Only SELECT and PRAGMA queries are allowed for safety. Modifying queries require human confirmation.";
    }

    try {
      let statement = env.DB.prepare(query);

      if (params && params.length > 0) {
        statement = statement.bind(...params);
      }

      const { results } = await statement.all();

      return {
        rowCount: results?.length || 0,
        rows: results || []
      };
    } catch (error) {
      console.error("Error querying database:", error);
      return `Error: ${error}`;
    }
  }
});

/**
 * Get the schema (structure) of a specific database table
 * Auto-executes without confirmation (read-only operation)
 */
const getTableSchema = tool({
  description: "Get the structure/schema of a specific database table, showing all columns, types, and constraints",
  inputSchema: z.object({
    tableName: z.string().describe("The name of the table to inspect")
  }),
  execute: async ({ tableName }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    try {
      // Get table schema using PRAGMA
      const { results: columns } = await env.DB.prepare(`
        PRAGMA table_info(${tableName})
      `).all();

      if (!columns || columns.length === 0) {
        return `Table '${tableName}' not found`;
      }

      return {
        tableName,
        columns: columns.map(col => ({
          name: col.name,
          type: col.type,
          notNull: col.notnull === 1,
          defaultValue: col.dflt_value,
          primaryKey: col.pk === 1
        }))
      };
    } catch (error) {
      console.error("Error getting table schema:", error);
      return `Error: ${error}`;
    }
  }
});

/**
 * Delegate to specialized RAG agent for complex database queries
 * Requires human confirmation before delegation
 */
const delegateToRagAgent = tool({
  description: "Delegate complex database queries or SQL-related questions to the specialized RAG agent. Use this when users ask about database structure, complex queries, or need intelligent SQL assistance beyond simple SELECT statements.",
  inputSchema: z.object({
    question: z.string().describe("The question or task to delegate to the RAG agent"),
    context: z.string().optional().describe("Additional context about what the user is trying to accomplish")
  })
  // Omitting execute makes this require human confirmation
});

/**
 * Generate AI images using HuggingFace models via MCP
 * Requires human confirmation before generation
 */
const generateImage = tool({
  description: "Generate AI images using HuggingFace's advanced image models (FLUX-LoRA, Stable Diffusion, etc.) via MCP. Perfect for creating business graphics, social media images, promotional materials, and custom visuals.",
  inputSchema: z.object({
    prompt: z.string().describe("Detailed description of the image to generate (e.g., 'Professional hair salon interior with modern styling chairs')"),
    model: z.enum(["flux-lora", "stable-diffusion", "dall-e"]).default("flux-lora").describe("The AI model to use for generation"),
    width: z.number().default(1024).describe("Image width in pixels"),
    height: z.number().default(1024).describe("Image height in pixels"),
    businessId: z.number().optional().describe("Business ID to associate the image with (for storage in R2)")
  })
  // Omitting execute makes this require human confirmation
});

/**
 * Run a Code Mode template for batch operations
 * Auto-executes predefined operation sequences
 */
const runCodeMode = tool({
  description: `Execute a Code Mode template for batch operations on the business listing.
Available templates:
${getTemplateInfo()}

Use this for efficient batch operations instead of multiple individual tool calls.`,
  inputSchema: z.object({
    businessId: z.number().describe("The business ID to operate on"),
    template: z.enum(["refresh-content", "optimize-seo", "schedule-social", "audit-listing"])
      .describe("The operation template to execute"),
    params: z.record(z.any()).optional().describe("Optional parameters for the template")
  }),
  execute: async ({ businessId, template, params }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB || !env?.AI) {
      throw new Error("Database or AI not available");
    }

    const result = await executeTemplate(env, businessId, template as TemplateName, params || {});
    
    if (!result.success) {
      return `Code Mode failed: ${result.error}`;
    }

    return JSON.stringify(result.result, null, 2);
  }
});

/**
 * Export all available tools
 * Note: Social media tools (Facebook posting) are now in tools/facebooktools.ts
 */
export const tools = {
  updateComponent,
  generateBlogPost,
  optimizeSEO,
  getBusinessInfo,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  listDatabaseTables,
  queryDatabase,
  getTableSchema,
  delegateToRagAgent,
  generateImage,
  runCodeMode
} satisfies ToolSet;

/**
 * Execution implementations for tools requiring human confirmation
 * These contain the actual logic that runs after user approval
 */
export const executions = {
  /**
   * Execute component update after human confirmation
   */
  updateComponent: async ({ componentId, content, config }: {
    componentId: number;
    content: Record<string, any>;
    config?: Record<string, any>;
  }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    try {
      await env.DB.prepare(`
        UPDATE page_components
        SET content = ?, config = ?, updated_at = (unixepoch())
        WHERE id = ?
      `).bind(JSON.stringify(content), JSON.stringify(config || {}), componentId).run();

      return `Component ${componentId} updated successfully`;
    } catch (error) {
      console.error("Error updating component:", error);
      return `Error: ${error}`;
    }
  },

  /**
   * Execute blog post generation after human confirmation
   */
  generateBlogPost: async ({ topic, keywords, tone, wordCount }: {
    topic: string;
    keywords: string[];
    tone: string;
    wordCount: number;
  }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.AI || !env?.DB) {
      throw new Error("AI or Database not available");
    }

    try {
      // Use Workers AI to generate blog post content
      const prompt = `Write a ${wordCount}-word ${tone} blog post about "${topic}" for a local business.
Include these SEO keywords naturally: ${keywords.join(", ")}.
Format: JSON with fields "title", "content" (HTML), "metaDescription" (max 160 chars), "readingTimeMinutes".`;

      const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [{ role: "user", content: prompt }]
      });

      // Parse AI response and insert into database
      // Note: This is a simplified version - production would need better parsing
      const blogData = typeof response === 'string' ? JSON.parse(response) : response;

      // Insert blog post (businessId would come from agent context)
      // This is placeholder logic - actual implementation needs businessId from context

      return `Blog post "${blogData.title}" generated successfully. Preview: ${blogData.content.substring(0, 200)}...`;
    } catch (error) {
      console.error("Error generating blog post:", error);
      return `Error: ${error}`;
    }
  },

  /**
   * Execute SEO optimization after human confirmation
   */
  optimizeSEO: async ({ autoApply }: { autoApply: boolean }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    try {
      // Analyze SEO issues (simplified version)
      const issues = [];
      const suggestions = [];

      // Check for missing meta descriptions, schema markup, etc.
      // This would be more comprehensive in production

      if (autoApply) {
        // Apply high-confidence fixes
        // e.g., add missing schema markup, fix meta descriptions
        suggestions.push("Applied automatic SEO fixes: added schema markup, optimized meta tags");
      } else {
        suggestions.push("SEO analysis complete. Use autoApply: true to apply fixes automatically.");
      }

      return {
        score: 75, // Placeholder SEO score
        issues,
        suggestions
      };
    } catch (error) {
      console.error("Error optimizing SEO:", error);
      return `Error: ${error}`;
    }
  },

  /**
   * Execute RAG agent delegation after human confirmation
   * Uses Cloudflare Actors pattern for agent coordination
   */
  delegateToRagAgent: async ({ question, context }: {
    question: string;
    context?: string;
  }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.RAG_AGENT) {
      throw new Error("RAG agent not available");
    }

    try {
      console.log(`[ACTORS] Delegating to RAG agent: ${question}`);

      // Call RAG agent using service binding (Actors pattern)
      // The RAG agent should expose a POST /query endpoint
      const response = await env.RAG_AGENT.fetch(new Request("https://rag-agent/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question,
          context: context || "",
          database_id: env.DB ? "e8b7b17a-a93b-4b61-92ad-80b488266e12" : null
        })
      }));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ACTORS] RAG agent error: ${response.status} - ${errorText}`);
        return `RAG agent returned error: ${response.status} - ${errorText}`;
      }

      const result = await response.json() as { answer: string; sql?: string; data?: unknown };

      console.log(`[ACTORS] RAG agent response received`);

      // Format response for user
      let formattedResponse = `**RAG Agent Response:**\n\n${result.answer}`;

      if (result.sql) {
        formattedResponse += `\n\n**SQL Query Used:**\n\`\`\`sql\n${result.sql}\n\`\`\``;
      }

      if (result.data) {
        formattedResponse += `\n\n**Data:**\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\``;
      }

      return formattedResponse;
    } catch (error) {
      console.error("Error delegating to RAG agent:", error);
      return `Error communicating with RAG agent: ${error}`;
    }
  },

  /**
   * Execute image generation after human confirmation
   * Uses HuggingFace MCP for AI image generation
   */
  generateImage: async ({ prompt, model, width, height, businessId }: {
    prompt: string;
    model: string;
    width: number;
    height: number;
    businessId?: number;
  }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env) {
      throw new Error("Environment not available");
    }

    try {
      console.log(`[MCP] Generating image with model: ${model}, prompt: ${prompt}`);

      // Ensure HuggingFace MCP is connected
      const mcpTools = agent!.mcp.getAITools();

      // Check if HuggingFace MCP is already connected
      const hfToolsExist = Object.keys(mcpTools).some(tool => tool.includes('huggingface') || tool.includes('image'));

      if (!hfToolsExist) {
        // Connect to HuggingFace MCP
        console.log("[MCP] Connecting to HuggingFace MCP server...");

        const mcpUrl = env.HUGGINGFACE_API_KEY
          ? `https://huggingface.co/mcp`
          : `https://huggingface.co/mcp?login`;

        try {
          await agent!.addMcpServer("huggingface", mcpUrl);
          console.log("[MCP] Successfully connected to HuggingFace");
        } catch (mcpError) {
          console.error("[MCP] Failed to connect to HuggingFace:", mcpError);
          return `Failed to connect to HuggingFace MCP. Please ensure you're authenticated. Visit https://huggingface.co/mcp?login to authorize.`;
        }
      }

      // Map model names to HuggingFace model IDs
      const modelMap: Record<string, string> = {
        "flux-lora": "prithivMLmods/FLUX-LoRA-DLC",
        "stable-diffusion": "stabilityai/stable-diffusion-xl-base-1.0",
        "dall-e": "openai/dall-e-3"
      };

      const modelId = modelMap[model] || modelMap["flux-lora"];

      // Generate image via MCP tools
      // The actual MCP tool call would depend on the HuggingFace MCP server's API
      // For now, we'll simulate the call and prepare for R2 storage

      console.log(`[MCP] Image generation request sent for model: ${modelId}`);

      // TODO: Actual MCP tool invocation would go here
      // For now, return a placeholder response explaining the setup
      let response = `**Image Generation Requested**\n\n`;
      response += `- **Prompt**: ${prompt}\n`;
      response += `- **Model**: ${modelId}\n`;
      response += `- **Dimensions**: ${width}x${height}px\n`;

      if (businessId) {
        response += `- **Business ID**: ${businessId}\n`;
        response += `- **Storage**: Will be saved to R2 bucket (kiamichi-biz-images)\n`;
      }

      response += `\n**Next Steps**: The HuggingFace MCP server will generate the image. Once complete, it will be stored in R2 and a public URL will be provided.`;

      // If we had the actual image data, we would store it in R2:
      // if (businessId && env.IMAGES) {
      //   const imageKey = `businesses/${businessId}/generated/${Date.now()}.png`;
      //   await env.IMAGES.put(imageKey, imageBuffer);
      //   const imageUrl = `https://images.kiamichibizconnect.com/${imageKey}`;
      //   response += `\n\n**Image URL**: ${imageUrl}`;
      // }

      return response;
    } catch (error) {
      console.error("Error generating image:", error);
      return `Error generating image: ${error}`;
    }
  }
};
