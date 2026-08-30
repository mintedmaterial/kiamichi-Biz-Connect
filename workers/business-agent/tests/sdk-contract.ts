import type { AIChatAgent } from "@cloudflare/ai-chat";
import type { useAgentChat } from "@cloudflare/ai-chat/react";
import type { AgentClient } from "agents/client";

declare const chatAgent: AIChatAgent;
declare const client: AgentClient;

const connectResult = chatAgent.addMcpServer(
  "contract-test",
  "https://mcp.example.com"
);
const serverState = chatAgent.getMcpServers();
const disconnectResult = chatAgent.removeMcpServer("contract-test");
const reconnectResult = client.reconnect();

type ChatHook = typeof useAgentChat;

declare const chatHook: ChatHook;

void connectResult;
void serverState;
void disconnectResult;
void reconnectResult;
void chatHook;
