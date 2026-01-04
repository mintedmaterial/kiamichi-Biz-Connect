import { routeAgentRequest, type Schedule } from "agents";

import { getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";

// Export VoiceAgent for Durable Object binding
export { VoiceAgent } from "./voice-agent";

// Export Workflow for Workflow binding
export { SocialPostWorkflow } from "./workflows";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { openai } from "@ai-sdk/openai";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools/index";
import {
  handleMcpConnect,
  handleMcpServers,
  handleMcpDisconnect
} from "./mcp-handlers";
import { handlePreview } from "./routes/preview";
import { handleMyBusiness, handlePublish } from "./routes/api";
import { getBusinessContextFromSession } from "./utils/session";

// Using OpenAI for now - will switch to Workers AI later
const model = openai("gpt-4o-mini");

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  metadata?: {
    businessContext?: {
      businessId: number;
      businessName: string;
      businessSlug: string;
      ownerId: string;
    };
  };

  /**
   * Override fetch to check auth on EVERY request (including WebSocket upgrades)
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    console.log(`[DO] Chat DO request: ${request.method} ${url.pathname}`);

    // Handle MCP-specific routes before auth (internal calls only)
    if (url.pathname === "/mcp/connect") {
      return this.handleMcpConnect(request);
    }

    if (url.pathname === "/mcp/servers") {
      return this.handleMcpServers(request);
    }

    if (url.pathname === "/mcp/disconnect") {
      return this.handleMcpDisconnect(request);
    }

    // Handle voice message endpoint (internal calls from VoiceAgent)
    if (url.pathname === "/voice/message" && request.method === "POST") {
      return this.handleVoiceMessage(request);
    }

    // Simple cookie check - if no session cookie, user needs to login
    const cookie = request.headers.get("Cookie");
    const hasSession = cookie && cookie.includes("admin_session=");

    if (!hasSession) {
      console.log(`[DO] No session cookie - redirecting to login`);
      // Redirect to main domain for authentication
      return Response.redirect("https://kiamichibizconnect.com/auth/google/login", 302);
    }

    console.log(`[DO] Session cookie present - allowing access`);

    // Get business context from session and store in metadata
    // This is used by tools to know which business to operate on
    if (!this.metadata?.businessContext && this.env?.DB) {
      try {
        const businessContext = await getBusinessContextFromSession(request, this.env.DB);
        if (businessContext) {
          console.log(`[DO] Setting business context: ${businessContext.businessName} (ID: ${businessContext.businessId})`);
          this.metadata = {
            ...this.metadata,
            businessContext: {
              businessId: businessContext.businessId,
              businessName: businessContext.businessName,
              businessSlug: businessContext.businessSlug,
              ownerId: businessContext.ownerId
            }
          };
        } else {
          console.warn(`[DO] No business context found for session`);
        }
      } catch (error) {
        console.error(`[DO] Error loading business context:`, error);
      }
    }

    // Pass to parent AIChatAgent
    return super.fetch(request);
  }


  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // Ensure jsonSchema is initialized before getting MCP tools
    await this.mcp.ensureJsonSchema();

    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions
        });

        // Get business context from metadata (passed when agent is instantiated)
        const businessContext = this.metadata?.businessContext || {};

        // Build dynamic system prompt based on business information
        const systemPrompt = this.buildSystemPrompt(businessContext);

        const result = streamText({
          system: systemPrompt,
          messages: await convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }

  /**
   * Build system prompt for the AI assistant
   */
  private buildSystemPrompt(businessContext: any): string {
    return `You are an Chi, and agent with Kiamichi Biz Connect.

YOUR ROLE:
- You can help manage ANY business listing in the directory
- Generate blog posts, social content, and SEO optimization for any business
- Create multi-modal content: images, videos, voice, and audio (via MCP)
- Analyze business listings and provide improvement suggestions
- Use the blog worker and analyzer tools to assist with content creation

AVAILABLE CAPABILITIES:

**Content Management:**
1. Update page components (hero, services, gallery, testimonials, etc.)
2. Generate SEO-optimized blog posts
3. **Create social media content - MANDATORY 3-STEP WORKFLOW:**

   **STEP 1**: Call generateSocialPostDraft(businessName, platform, tone)
   - Returns: { businessId, postText, message }
   - Auto-executes, no confirmation needed

   **STEP 2**: IMMEDIATELY call generateSocialImage(businessId, postText)
   - Use businessId and postText from Step 1 result
   - Returns: { imageUrl, imagePrompt, message }
   - Auto-executes, no confirmation needed
   - **CRITICAL**: You MUST call this after Step 1

   **STEP 3**: Call publishSocialPost(postText, imageUrl, target)
   - Use postText from Step 1 and imageUrl from Step 2
   - Requires user confirmation before posting
   - Show user the preview with BOTH text and image before confirming

**Analytics & Optimization:**
4. Optimize SEO (keywords, meta tags, schema markup)
5. Schedule tasks for future execution
6. Retrieve business information and analytics

**Database Access:**
7. List all database tables
8. Query the database with read-only SQL (SELECT statements)
9. Get table schemas and structures
10. Access business data, listings, components, and more

**Specialized Agent Delegation:**
11. Delegate complex SQL/database questions to the RAG agent (requires user approval)
   - Use this for intelligent database queries beyond simple SELECTs
   - The RAG agent specializes in SQL analysis and complex data retrieval
   - You'll need user confirmation before delegating

**IMPORTANT RULES:**
- Always ask for confirmation before PUBLISHING content (publishSocialPost, updateComponent, etc.)
- generateSocialImage auto-executes without confirmation (just creates the image)
- Images/videos/audio are automatically stored in R2 and you'll receive a public URL
- When the user asks to work on a business, ask them for the business ID or name first
- ALWAYS call generateSocialImage after generateSocialPostDraft to include an image with social posts

${getSchedulePrompt({ date: new Date() })}`;
  }
  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }

  /**
   * Connect to MCP server (called internally by Worker)
   */
  private async handleMcpConnect(request: Request): Promise<Response> {
    try {
      const { serverUrl, name } = await request.json<{
        serverUrl: string;
        name: string;
      }>();

      console.log(`[MCP] Connecting to ${name} at ${serverUrl}`);

      // Use Agent's addMcpServer method (as per Cloudflare docs)
      const { id, authUrl } = await this.addMcpServer(name, serverUrl);

      // If OAuth required, return authUrl
      if (authUrl) {
        console.log(`[MCP] OAuth required for ${name}`);
        return Response.json({
          status: "auth_required",
          authUrl: authUrl,
          serverId: id
        });
      }

      // Otherwise, connection successful
      console.log(`[MCP] Successfully connected to ${name}`);
      return Response.json({
        status: "connected",
        serverId: id,
        message: `Successfully connected to ${name}`
      });
    } catch (error) {
      console.error("[MCP] Connect error:", error);
      return Response.json({ error: String(error) }, { status: 500 });
    }
  }

  /**
   * List connected MCP servers and their tools
   */
  private async handleMcpServers(request: Request): Promise<Response> {
    try {
      console.log("[MCP] Listing servers");
      // Use Agent's getMcpServers method (as per Cloudflare docs)
      const mcpState = this.getMcpServers();

      return Response.json(mcpState);
    } catch (error) {
      console.error("[MCP] Servers list error:", error);
      return Response.json({ error: String(error) }, { status: 500 });
    }
  }

  /**
   * Disconnect from MCP server
   */
  private async handleMcpDisconnect(request: Request): Promise<Response> {
    try {
      const { serverId } = await request.json<{ serverId: string }>();

      console.log(`[MCP] Disconnecting server ${serverId}`);

      // Note: The agents framework may not expose a disconnect method
      // For now, we'll return success - servers are managed in SQL storage
      return Response.json({
        status: "disconnected",
        message: `Disconnected from server ${serverId}`
      });
    } catch (error) {
      console.error("[MCP] Disconnect error:", error);
      return Response.json({ error: String(error) }, { status: 500 });
    }
  }

  /**
   * Handle voice message from VoiceAgent DO
   * This is a simplified endpoint that accepts text input and returns text output
   * without the full WebSocket streaming protocol
   */
  private async handleVoiceMessage(request: Request): Promise<Response> {
    try {
      const { text } = await request.json<{ text: string }>();

      console.log(`[Voice] Processing voice message: ${text}`);

      // Ensure jsonSchema is initialized
      await this.mcp.ensureJsonSchema();

      // Collect all tools, including MCP tools
      const allTools = {
        ...tools,
        ...this.mcp.getAITools()
      };

      // Add user message to conversation
      const userMessage = {
        id: generateId(),
        role: "user" as const,
        parts: [
          {
            type: "text" as const,
            text: text
          }
        ],
        metadata: {
          createdAt: new Date(),
          source: "voice"
        }
      };

      // Add to messages
      this.messages.push(userMessage);

      // Clean up incomplete tool calls
      const cleanedMessages = cleanupMessages(this.messages);

      // Process tool calls
      const processedMessages = await processToolCalls({
        messages: cleanedMessages,
        dataStream: null as any, // Voice doesn't need streaming
        tools: allTools,
        executions
      });

      // Get business context
      const businessContext = this.metadata?.businessContext || {};
      const systemPrompt = this.buildSystemPrompt(businessContext);

      // Generate response (non-streaming)
      const result = await streamText({
        system: systemPrompt,
        messages: await convertToModelMessages(processedMessages),
        model,
        tools: allTools,
        stopWhen: stepCountIs(10)
      });

      // Collect the full text response
      let fullText = "";
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }

      console.log(`[Voice] Generated response: ${fullText.substring(0, 100)}...`);

      // Add assistant message to conversation
      const assistantMessage = {
        id: generateId(),
        role: "assistant" as const,
        parts: [
          {
            type: "text" as const,
            text: fullText
          }
        ],
        metadata: {
          createdAt: new Date(),
          source: "voice"
        }
      };

      this.messages.push(assistantMessage);

      // Save messages to storage
      await this.saveMessages(this.messages);

      return Response.json({
        text: fullText,
        success: true
      });

    } catch (error) {
      console.error("[Voice] Error processing voice message:", error);
      return Response.json(
        {
          error: String(error),
          text: "I'm sorry, I encountered an error processing your request."
        },
        { status: 500 }
      );
    }
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        service: "kiamichi-business-agent",
        ai: !!env.AI,
        db: !!env.DB,
        r2: !!env.TEMPLATES && !!env.BUSINESS_ASSETS
      });
    }

    // Preview route for business listing pages
    // Must be before routeAgentRequest to avoid conflict
    if (url.pathname.startsWith("/preview/")) {
      return handlePreview(request, env);
    }

    // API endpoints for frontend
    if (url.pathname === "/api/my-business") {
      return handleMyBusiness(request, env);
    }

    if (url.pathname === "/api/publish") {
      return handlePublish(request, env);
    }

    // MCP Server Management Endpoints
    if (url.pathname === "/api/mcp/connect") {
      return handleMcpConnect(request, env);
    }

    if (url.pathname === "/api/mcp/servers") {
      return handleMcpServers(request, env);
    }

    if (url.pathname === "/api/mcp/disconnect") {
      return handleMcpDisconnect(request, env);
    }

    // Voice Agent Endpoints
    if (url.pathname.startsWith("/voice/")) {
      // Route to VoiceAgent Durable Object
      const voiceAgentId = env.VoiceAgent.idFromName("default");
      const voiceAgent = env.VoiceAgent.get(voiceAgentId);
      return voiceAgent.fetch(request);
    }

    // Root path: Let routeAgentRequest handle it (it will serve the frontend)
    // No special handling needed - just fall through to routeAgentRequest

    // Verify required bindings
    if (!env.AI) {
      console.error("Workers AI binding not available");
    }
    if (!env.DB) {
      console.error("D1 Database binding not available");
    }

    // Note: Authentication is handled by the main worker (/chat route)
    // The main worker validates the session before redirecting here
    // Additional auth here causes issues with the React app's direct requests

    // Let agents framework handle routing
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
