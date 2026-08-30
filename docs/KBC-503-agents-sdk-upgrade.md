# KBC-503 Agents SDK upgrade

**Owner:** Cleo

**Affected runtime:** `kiamichi-business-agent` Cloudflare Worker and `Chat` Durable Object

## Scope

This slice upgrades the existing Business Agent runtime without adding Cloudflare Computer, Sandbox, or Flue packages.

- `agents`: `^0.3.0` → `0.22.0`
- `@cloudflare/ai-chat`: added at `0.11.0` for the current `AIChatAgent` and React chat exports
- `@modelcontextprotocol/client`: added and pinned at `2.0.0`, matching the Agents SDK peer contract
- `ai`: `^6.0.1` → `6.0.271`, satisfying the current Agents/chat peer range

The chat imports move from the deprecated `agents/ai-chat-agent` and `agents/ai-react` entry points to `@cloudflare/ai-chat` and `@cloudflare/ai-chat/react`.

## Runtime compatibility

- The Durable Object class and binding remain named `Chat`; no new Durable Object migration is required.
- Existing `useAgent` instance names remain unchanged, so browser reconnects target the same Durable Object identities.
- `useAgentChat` retains automatic reconnect and active-stream resumption through the current AI Chat package.
- MCP connect, list, and disconnect operations now use the current SDK lifecycle methods.
- MCP disconnect now invokes `removeMcpServer` before reporting success. The previous implementation returned a false success without removing SDK state.
- Chat and MCP requests require a D1-backed, unexpired admin session. A cookie name alone is not accepted as proof of authentication.

## Verification

Run from `workers/business-agent`:

```bash
npm ci --ignore-scripts
npm run test:unit
npm run test:sdk-contract
npm run build
```

The unit suite covers MCP connect, OAuth-connect, list, and disconnect behavior. The SDK type contract verifies the chat hook, explicit reconnect API, and MCP add/list/remove APIs against installed package declarations. The production build verifies the server and both React chat surfaces resolve through the new package exports.

### Recorded evidence for PR #56

- Initial SDK implementation head: `4464866679c1761f335153ad79ab26cb14347a14`.
- `npm run test:unit`: 70 tests passed, including forged and valid D1-backed session handling.
- `npm run test:sdk-contract`: passed.
- `npm run build`: passed.
- Wrangler dry-run: passed with the expected Durable Object, D1, KV, R2, Workers AI, and service bindings.
- TypeScript regression comparison: 83 errors on `origin/main` and 83 on the branch, with no new errors introduced by the upgrade.
- Manual non-production Worker: `kiamichi-business-agent-kbc-503-preview`, version `fe05a0e2-3a36-49f5-a8a6-1ccfeaf27c0d`.
- Browser/CDP and Worker-tail probe confirmed the unauthenticated message request followed the existing login redirect and produced no Worker exception. The direct workers.dev surface cannot complete Google OAuth because that hostname is not an authorized callback.
- A forged-cookie edge probe initially exposed the pre-existing cookie-name-only gate. The follow-up change requires the session ID to resolve to a current D1 `admin_sessions` row before chat or MCP access.
- Voice WebSocket upgrades now require the same D1-backed session, and the Voice Agent forwards that session to the Chat Durable Object for a second verification before processing transcripts.

## Preview acceptance

Before production promotion:

1. Deploy or open the non-traffic Business Agent preview for the exact PR head.
2. Read back the preview Worker version, routes, Durable Object bindings, D1/KV/R2/service bindings, and confirm it has no production route.
3. In a real browser, load the preview at desktop, 390 px, and 360 px widths.
4. Authenticate through the normal flow; do not bypass auth.
5. Open a chat, send a harmless read-only prompt, interrupt/reconnect the browser connection, and verify the transcript and active response recover without duplication.
6. Connect an approved test MCP server, list it, disconnect it, then list again and verify the server is absent. Do not authorize or invoke money-moving or publishing tools.
7. Check Worker logs for uncaught exceptions, repeated stream chunks, MCP transport errors, and secret-bearing output.

## Production promotion and rollback

Record the currently deployed `kiamichi-business-agent` version ID immediately before promotion. Promote only after current-head preview and CI evidence pass. After deployment, read back the active version, routes, and binding graph and run the smallest authenticated chat/reconnect and MCP lifecycle smoke.

If chat persistence, reconnect, MCP lifecycle, or logs regress, stop testing and roll back immediately:

```bash
cd workers/business-agent
npx wrangler rollback <PREVIOUS_VERSION_ID> --message "Rollback KBC-503 Agents SDK upgrade"
```

Read back the active deployment after rollback and repeat the prior known-good health and authenticated chat smoke. A source revert alone is not proof of runtime rollback.
