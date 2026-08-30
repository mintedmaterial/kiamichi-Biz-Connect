import { describe, expect, it, vi } from "vitest";
import {
  connectMcpServer,
  disconnectMcpServer,
  listMcpServers,
  type McpLifecycleClient
} from "../mcp-lifecycle";

function createClient(): McpLifecycleClient {
  return {
    addMcpServer: vi.fn(async () => ({
      id: "server-1",
      state: "ready" as const
    })),
    getMcpServers: vi.fn(() => ({ servers: [{ id: "server-1" }] })),
    removeMcpServer: vi.fn(async () => undefined)
  };
}

describe("Agents SDK MCP lifecycle", () => {
  it("connects and returns the durable server id", async () => {
    const client = createClient();

    await expect(
      connectMcpServer(client, "Example", "https://mcp.example.com")
    ).resolves.toEqual({
      status: "connected",
      serverId: "server-1",
      message: "Successfully connected to Example"
    });
    expect(client.addMcpServer).toHaveBeenCalledWith(
      "Example",
      "https://mcp.example.com"
    );
  });

  it("surfaces the OAuth URL when authorization is required", async () => {
    const client = createClient();
    client.addMcpServer = vi.fn(async () => ({
      id: "server-oauth",
      state: "authenticating" as const,
      authUrl: "https://mcp.example.com/authorize"
    }));

    await expect(
      connectMcpServer(client, "OAuth", "https://mcp.example.com")
    ).resolves.toEqual({
      status: "auth_required",
      serverId: "server-oauth",
      authUrl: "https://mcp.example.com/authorize"
    });
  });

  it("lists the current SDK-managed server state", () => {
    const client = createClient();

    expect(listMcpServers(client)).toEqual({
      servers: [{ id: "server-1" }]
    });
    expect(client.getMcpServers).toHaveBeenCalledOnce();
  });

  it("removes the SDK-managed server before reporting disconnect", async () => {
    const client = createClient();

    await expect(disconnectMcpServer(client, "server-1")).resolves.toEqual({
      status: "disconnected",
      message: "Disconnected from server server-1"
    });
    expect(client.removeMcpServer).toHaveBeenCalledWith("server-1");
  });
});
