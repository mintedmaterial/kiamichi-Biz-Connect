/**
 * Database Tools
 * Tools for querying and managing the Kiamichi Biz Connect database
 */
import { tool } from "ai";
import { z } from "zod/v3";
import type { Chat } from "../server";
import { getCurrentAgent } from "agents";

/**
 * Get business information and current listing details
 * Auto-executes without confirmation (read-only operation)
 */
export const getBusinessInfo = tool({
  description: "Retrieve current business information, listing page components, and metadata",
  inputSchema: z.object({
    businessId: z.number().describe("The business ID to fetch information for")
  }),
  execute: async ({ businessId }) => {
    const { agent } = getCurrentAgent<Chat>();
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
 * List all tables in the database
 * Auto-executes without confirmation (read-only operation)
 */
export const listDatabaseTables = tool({
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
export const queryDatabase = tool({
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
export const getTableSchema = tool({
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
export const delegateToRagAgent = tool({
  description: "Delegate complex database queries or SQL-related questions to the specialized RAG agent. Use this when users ask about database structure, complex queries, or need intelligent SQL assistance beyond simple SELECT statements.",
  inputSchema: z.object({
    question: z.string().describe("The question or task to delegate to the RAG agent"),
    context: z.string().optional().describe("Additional context about what the user is trying to accomplish")
  })
  // Omitting execute makes this require human confirmation
});

/**
 * Execution implementations for tools requiring human confirmation
 */
export const dbExecutions = {
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
  }
};
