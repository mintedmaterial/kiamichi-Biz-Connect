/**
 * MCP Server Connection Handlers
 * Manages connections to external MCP servers (HuggingFace)
 */

/**
 * Simple cookie check - trust the main worker's authentication
 */
function checkAuth(request: Request): boolean {
  const cookie = request.headers.get("Cookie");
  return cookie !== null && cookie.includes("admin_session=");
}

/**
 * Handle MCP server connection request
 */
export async function handleMcpConnect(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Simple auth check
    if (!checkAuth(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { serverUrl, name } = await request.json<{
      serverUrl: string;
      name: string;
    }>();

    // Validate inputs
    if (!serverUrl || !name) {
      return Response.json(
        { error: "serverUrl and name are required" },
        { status: 400 }
      );
    }

    // Get Chat Durable Object (using default room name)
    const id = env.Chat.idFromName("default");
    const chatDO = env.Chat.get(id);

    // Connect to MCP server via DO
    const connectResponse = await chatDO.fetch(
      new Request(`https://fake-host/mcp/connect`, {
        method: "POST",
        body: JSON.stringify({ serverUrl, name }),
        headers: { "Content-Type": "application/json" }
      })
    );

    return connectResponse;
  } catch (error) {
    console.error("MCP connection error:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * Handle MCP servers list request
 */
export async function handleMcpServers(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Simple auth check
    if (!checkAuth(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = env.Chat.idFromName("default");
    const chatDO = env.Chat.get(id);

    const serversResponse = await chatDO.fetch(
      new Request(`https://docs.mcp.cloudflare.com/mcp`, { method: "GET" })
    );

    return serversResponse;
  } catch (error) {
    console.error("MCP servers list error:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * Handle MCP server disconnect request
 */
export async function handleMcpDisconnect(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Simple auth check
    if (!checkAuth(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { serverId } = await request.json<{ serverId: string }>();

    if (!serverId) {
      return Response.json(
        { error: "serverId is required" },
        { status: 400 }
      );
    }

    const id = env.Chat.idFromName("default");
    const chatDO = env.Chat.get(id);

    const disconnectResponse = await chatDO.fetch(
      new Request(`https://fake-host/mcp/disconnect`, {
        method: "POST",
        body: JSON.stringify({ serverId }),
        headers: { "Content-Type": "application/json" }
      })
    );

    return disconnectResponse;
  } catch (error) {
    console.error("MCP disconnect error:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
