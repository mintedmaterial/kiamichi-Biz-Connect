export interface McpLifecycleClient {
  addMcpServer(
    name: string,
    serverUrl: string
  ): Promise<
    | { id: string; state: "authenticating"; authUrl: string }
    | { id: string; state: "ready" }
  >;
  getMcpServers(): unknown;
  removeMcpServer(id: string): Promise<void>;
}

export async function connectMcpServer(
  client: McpLifecycleClient,
  name: string,
  serverUrl: string
) {
  const result = await client.addMcpServer(name, serverUrl);

  if (result.state === "authenticating") {
    return {
      status: "auth_required" as const,
      authUrl: result.authUrl,
      serverId: result.id
    };
  }

  return {
    status: "connected" as const,
    serverId: result.id,
    message: `Successfully connected to ${name}`
  };
}

export function listMcpServers(client: McpLifecycleClient): unknown {
  return client.getMcpServers();
}

export async function disconnectMcpServer(
  client: McpLifecycleClient,
  serverId: string
) {
  await client.removeMcpServer(serverId);
  return {
    status: "disconnected" as const,
    message: `Disconnected from server ${serverId}`
  };
}
