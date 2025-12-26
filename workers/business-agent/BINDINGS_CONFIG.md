# Kiamichi Business Agent - Resource Bindings

## Deployment Status
✅ **Live URL**: https://app.kiamichibizconnect.com
✅ **Version**: 4f8d7997-f62a-4f0c-bea6-d57e5fea3745
✅ **Logs**: Enabled with 100% sampling

## D1 Database Binding

| Binding | Database Name | Database ID | Status |
|---------|---------------|-------------|--------|
| `env.DB` | kiamichi-biz-connect-db | e8b7b17a-a93b-4b61-92ad-80b488266e12 | ✅ Shared with main worker |

**Tables Available**:
- businesses
- business_owners
- business_ownership
- portal_sessions
- listing_pages
- page_components
- component_catalog
- agent_contexts
- blog_posts
- social_content_queue
- seo_audits
- portal_activity_log

## R2 Bucket Bindings

| Binding | Bucket Name | Purpose | Shared |
|---------|-------------|---------|--------|
| `env.TEMPLATES` | kiamichi-component-templates | Component templates (hero, services, etc.) | ✅ Yes |
| `env.BUSINESS_ASSETS` | kiamichi-business-assets | Business-uploaded assets (images, videos, docs) | ⚠️ Agent-specific |
| `env.IMAGES` | kiamichi-biz-images | Blog images, business logos | ✅ Shared with main |

**Note**:
- `kiamichi-business-images` was created during initial deployment but is NOT used (duplicate)
- Agent uses `kiamichi-biz-images` to match main worker configuration

## Durable Objects Binding

| Binding | Class Name | Purpose |
|---------|------------|---------|
| `env.Chat` | Chat | Persistent AI agent instances (one per business) |

**Migration Tag**: v1
**Type**: SQLite-backed Durable Object

## Workers AI Binding

| Binding | Status | Current Model |
|---------|--------|---------------|
| `env.AI` | ✅ Enabled (remote) | OpenAI GPT-4o-mini (temporary) |

**Planned**: Switch to Workers AI Llama 3.1 8B Instruct after testing

## Observability Configuration

```jsonc
{
  "observability": {
    "enabled": true,
    "logs": {
      "enabled": true,
      "head_sampling_rate": 1,    // 100% of requests
      "invocation_logs": true     // Log all invocations
    }
  }
}
```

**View Logs**:
```bash
wrangler tail kiamichi-business-agent
```

Or in Cloudflare Dashboard:
https://dash.cloudflare.com → Workers → kiamichi-business-agent → Logs

## Routes

| Pattern | Zone | Worker |
|---------|------|--------|
| `app.kiamichibizconnect.com/*` | kiamichibizconnect.com | kiamichi-business-agent |

## Health Check

Test the worker is running:
```bash
curl https://app.kiamichibizconnect.com/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "kiamichi-business-agent",
  "ai": true,
  "db": true,
  "r2": true
}
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/agents/chat/{agentId}` | POST | Send message to agent |
| `/api/agents/chat/{agentId}/ws` | WS | WebSocket connection |

## Environment Variables Required

### Production Secrets
Set using `wrangler secret put`:

```bash
# OpenAI API key (temporary, until we switch to Workers AI)
wrangler secret put OPENAI_API_KEY
```

## Integration with Main Worker

The main worker at `kiamichibizconnect.com` will eventually include a service binding:

```toml
# In main worker wrangler.toml
[[services]]
binding = "BUSINESS_AGENT"
service = "kiamichi-business-agent"
```

Then route portal requests:
```typescript
// In src/index.ts
if (path.startsWith('/api/portal/agent/')) {
  return env.BUSINESS_AGENT.fetch(request);
}
```

## Testing Checklist

- [x] Worker deploys successfully
- [x] Route responds at app.kiamichibizconnect.com
- [x] D1 database binding works
- [x] R2 buckets accessible
- [x] Durable Objects can be instantiated
- [ ] OpenAI API key configured (secret)
- [ ] Agent chat UI loads
- [ ] WebSocket connection establishes
- [ ] Tools execute correctly
- [ ] Logs appear in dashboard

## Resource Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| D1 Database | Shared | 10GB free tier |
| R2 Buckets | 3 buckets | 10GB free per bucket |
| Workers AI | 10,000 neurons/day | Free tier |
| Durable Objects | Unlimited instances | $0.15/million requests |

## Troubleshooting

### Check logs
```bash
wrangler tail kiamichi-business-agent
```

### Test D1 connection
```bash
wrangler d1 execute kiamichi-biz-connect-db --command="SELECT COUNT(*) FROM businesses"
```

### List R2 objects
```bash
wrangler r2 object list kiamichi-component-templates
```

### Verify bindings
```bash
curl https://app.kiamichibizconnect.com/health
```

## Next Steps

1. **Set OpenAI API Key**:
   ```bash
   cd workers/business-agent
   wrangler secret put OPENAI_API_KEY
   ```

2. **Test Agent**: Visit https://app.kiamichibizconnect.com

3. **Switch to Workers AI**: Update server.ts to use Workers AI provider

4. **Integrate with Portal**: Add service binding to main worker
