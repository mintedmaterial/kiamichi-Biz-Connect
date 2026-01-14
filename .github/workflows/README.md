# GitHub Actions Workflows

This directory contains CI/CD workflows for the Kiamichi Biz Connect project.

## Workflows

### `ci.yml` - Continuous Integration
Runs on every pull request to validate code quality.

**Jobs**:
- Type checking (TypeScript)
- Build validation for all workers
- Unit tests (Vitest)
- Security audits (npm audit)

**Triggers**: Pull requests to main, pushes to main

---

### `deploy.yml` - Production Deployment
Deploys all workers to production when code is merged to main.

**Jobs**:
- Database migration detection and execution
- Parallel deployment of all 4 workers:
  - Main Worker → kiamichibizconnect.com
  - Business Agent → app.kiamichibizconnect.com
  - Analyzer Worker → Background cron
  - Facebook Worker → Background cron

**Triggers**: Push to main, manual workflow dispatch

**Manual Deployment**:
```bash
# From GitHub Actions UI:
Actions → Deploy to Production → Run workflow → Select workers
```

---

### `preview.yml` - Preview Deployments
Creates preview environments for pull requests.

**Jobs**:
- Deploy all workers to preview environments
- Comment on PR with preview URLs
- Auto-cleanup on PR close

**Triggers**: PR opened/updated/closed

**Preview URLs**:
- Main: `https://kiamichi-biz-connect-preview.workers.dev`
- Business Agent: `https://kiamichi-business-agent-preview.workers.dev`

---

## Quick Start

### 1. Configure GitHub Secrets

Go to **Settings > Secrets and variables > Actions** and add:

```
CLOUDFLARE_API_TOKEN     - Cloudflare API token with Workers permissions
CLOUDFLARE_ACCOUNT_ID    - Your Cloudflare account ID
ADMIN_KEY                - Admin authentication key
GOOGLE_CLIENT_SECRET     - Google OAuth client secret
FACEBOOK_APP_SECRET      - Facebook app secret
FB_EMAIL                 - Facebook account email
FB_PASSWORD              - Facebook account password
```

### 2. Test the Pipeline

1. Create a feature branch
2. Make changes and push
3. Open a pull request
4. Watch CI run automatically
5. Preview environments deploy automatically
6. Merge PR → Production deployment

### 3. Monitor Deployments

- **GitHub**: Actions tab → Select workflow run
- **Cloudflare**: Dashboard → Workers & Pages → Select worker

---

## Deployment Flow

```
┌─────────────────┐
│  Push to PR     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│   CI Workflow   │────▶│  Build & Test    │
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│Preview Workflow │────▶│ Deploy Previews  │
└─────────────────┘     └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │ Comment on PR    │
                        └──────────────────┘

┌─────────────────┐
│ Merge to main   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│Deploy Workflow  │────▶│ Check Migrations │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│Deploy Workers   │◀────│  Run Migrations  │
│  (parallel)     │     └──────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Production    │
│     Live!       │
└─────────────────┘
```

---

## Troubleshooting

**CI Fails**:
- Check TypeScript errors in logs
- Run `npm run build` locally to reproduce
- Fix errors and push again

**Deploy Fails**:
- Verify all secrets are configured
- Check Cloudflare API token has correct permissions
- Review deployment logs in GitHub Actions

**Preview Not Working**:
- Ensure preview environment is configured in wrangler.toml
- Check that worker names use `-preview` suffix
- Verify OAuth callbacks support preview domains

---

## Documentation

For detailed setup instructions, see [CI_CD_SETUP.md](../../CI_CD_SETUP.md) in the root directory.

## Support

- **Issues**: Open a GitHub issue
- **Documentation**: [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- **Status**: [Cloudflare Status Page](https://www.cloudflarestatus.com/)
