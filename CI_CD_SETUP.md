# CI/CD Setup Guide for Kiamichi Biz Connect

This document provides comprehensive instructions for setting up and using the GitHub Actions CI/CD pipeline for the Kiamichi Biz Connect project.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [GitHub Secrets Configuration](#github-secrets-configuration)
- [Workflow Descriptions](#workflow-descriptions)
- [Environment Configuration](#environment-configuration)
- [Triggering Deployments](#triggering-deployments)
- [Monitoring Deployments](#monitoring-deployments)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

The Kiamichi Biz Connect project uses three GitHub Actions workflows to automate testing, deployment, and preview environments:

1. **CI Workflow** (`ci.yml`) - Runs on every pull request to validate code
2. **Deploy Workflow** (`deploy.yml`) - Deploys to production on merges to main
3. **Preview Workflow** (`preview.yml`) - Creates preview environments for pull requests

### Worker Architecture

The project consists of four Cloudflare Workers:

| Worker | Domain | Purpose |
|--------|--------|---------|
| Main Worker | kiamichibizconnect.com | Public-facing business directory |
| Business Agent | app.kiamichibizconnect.com | Business management dashboard with AI agent |
| Analyzer Worker | (background) | AI-powered business listing enrichment (cron) |
| Facebook Worker | (background) | Automated social media posting (cron) |

All workers share:
- **D1 Database**: `kiamichi-biz-connect-db` (e8b7b17a-a93b-4b61-92ad-80b488266e12)
- **KV Namespace**: `a5a33e270e4548548d43cf0554323e57`
- **R2 Buckets**: `kiamichi-biz-images`, `kiamichi-component-templates`, `kiamichi-business-assets`

---

## Prerequisites

Before setting up CI/CD, ensure you have:

1. **Cloudflare Account** with Workers enabled
2. **GitHub Repository** with admin access
3. **Cloudflare API Token** with Workers deploy permissions
4. **OAuth Credentials** (Google, Facebook) for authentication

---

## GitHub Secrets Configuration

Navigate to your GitHub repository settings: **Settings > Secrets and variables > Actions**

### Required Secrets

Configure the following secrets by clicking **New repository secret**:

#### Cloudflare Configuration

```
CLOUDFLARE_API_TOKEN
```
- **How to get**: Go to Cloudflare Dashboard > My Profile > API Tokens > Create Token
- **Permissions needed**:
  - Account: Workers Scripts (Edit)
  - Account: Workers KV Storage (Edit)
  - Account: Workers R2 Storage (Edit)
  - Account: D1 (Edit)
- **Value**: Your API token (starts with `ey...`)

```
CLOUDFLARE_ACCOUNT_ID
```
- **How to get**: Cloudflare Dashboard > Workers & Pages > Overview (in the right sidebar)
- **Value**: `ff3c5e2beaea9f85fee3200bfe28da16`

#### Application Secrets

```
ADMIN_KEY
```
- **Description**: Admin authentication key for privileged operations
- **How to generate**: Use a strong random string (e.g., `openssl rand -base64 32`)
- **Value**: Your chosen admin key

```
GOOGLE_CLIENT_SECRET
```
- **Description**: Google OAuth client secret for user authentication
- **How to get**: Google Cloud Console > APIs & Services > Credentials
- **Value**: Your Google OAuth client secret

```
FACEBOOK_APP_SECRET
```
- **Description**: Facebook App secret for OAuth and API access
- **How to get**: Meta for Developers > Your App > Settings > Basic
- **Value**: Your Facebook app secret

```
FB_EMAIL
```
- **Description**: Facebook account email for browser-based posting
- **Value**: Email address for Facebook account used by the worker

```
FB_PASSWORD
```
- **Description**: Facebook account password for browser-based posting
- **Value**: Password for Facebook account used by the worker
- **Security Note**: Consider using App Passwords if available

#### Optional Secrets

```
DATABASE_ID
```
- **Description**: Explicitly set D1 database ID (usually in wrangler.toml)
- **Value**: `e8b7b17a-a93b-4b61-92ad-80b488266e12`

### Verifying Secrets

After adding secrets, verify by checking:
1. All secrets show in the **Actions secrets** list
2. Names match exactly (case-sensitive)
3. No trailing spaces or newlines in values

---

## Workflow Descriptions

### 1. CI Workflow (`ci.yml`)

**Triggers**: Pull requests to main, pushes to main

**Jobs**:
- **Type Check & Lint**: Validates TypeScript types across all workers
- **Build All Workers**: Ensures all workers build successfully
- **Run Tests**: Executes unit tests with Vitest (business-agent)
- **Security Audit**: Runs `npm audit` on all dependencies
- **CI Success**: Summary job that validates all checks passed

**Duration**: ~10-15 minutes

**When it runs**:
- Every time you push commits to a PR
- When you merge to main (before deployment)

### 2. Deploy Workflow (`deploy.yml`)

**Triggers**: Pushes to main, manual dispatch

**Jobs**:
1. **Check Migrations**: Detects new `.sql` files in the commit
2. **Run Database Migrations**: Executes schema updates if needed
3. **Deploy Workers** (parallel):
   - Deploy Main Worker
   - Deploy Business Agent
   - Deploy Analyzer Worker
   - Deploy Facebook Worker
4. **Deployment Complete**: Summary and status notification

**Duration**: ~8-12 minutes (workers deploy in parallel)

**Concurrency**: Only one production deployment runs at a time

### 3. Preview Workflow (`preview.yml`)

**Triggers**: Pull request opened/updated/closed

**Jobs**:
- **Deploy Preview** (on open/update):
  - Deploys all four workers to preview environments
  - Comments on PR with preview URLs
  - Uses `-preview` suffix for worker names

- **Cleanup Preview** (on close):
  - Deletes all preview workers
  - Comments confirmation on PR

**Duration**: ~15-20 minutes

**Preview URLs**:
- Main: `https://kiamichi-biz-connect-preview.workers.dev`
- Business Agent: `https://kiamichi-business-agent-preview.workers.dev`
- Analyzer/Facebook: Background workers (no public URL)

---

## Environment Configuration

### Preview Environment Setup

To enable preview deployments, add preview environments to your `wrangler.toml` files:

**Main Worker** (`wrangler.toml`):
```toml
[env.preview]
name = "kiamichi-biz-connect-preview"
vars = { ENVIRONMENT = "preview" }

[[env.preview.d1_databases]]
binding = "DB"
database_name = "kiamichi-biz-connect-db"
database_id = "e8b7b17a-a93b-4b61-92ad-80b488266e12"

# Copy other bindings (KV, R2, AI) from main config
```

**Business Agent** (`workers/business-agent/wrangler.jsonc`):
```json
{
  "env": {
    "preview": {
      "name": "kiamichi-business-agent-preview",
      "vars": {
        "ENVIRONMENT": "preview"
      },
      "d1_databases": [...],
      "kv_namespaces": [...],
      "r2_buckets": [...]
    }
  }
}
```

Repeat for `analyzer-worker` and `facebook-worker`.

### Disabling Cron in Preview

Ensure cron triggers don't run in preview environments:

```toml
# Only in main config, not in [env.preview]
[triggers]
crons = ["0 14 * * *"]
```

---

## Triggering Deployments

### Automatic Deployments

**Production**: Merging a PR to `main` automatically triggers deployment

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and push: `git push origin feature/my-feature`
3. Create a pull request on GitHub
4. Wait for CI to pass (green checkmark)
5. Merge the PR
6. Deployment starts automatically

**Preview**: Opening or updating a PR automatically creates preview environments

### Manual Deployments

You can manually trigger deployments from the GitHub Actions UI:

1. Go to **Actions** tab in your repository
2. Select **Deploy to Production** workflow
3. Click **Run workflow**
4. Choose workers to deploy (default: all)
5. Click **Run workflow**

**Use cases**:
- Re-deploying after fixing secrets
- Deploying only specific workers
- Emergency hotfixes

### Local Testing Before Deployment

Always test locally before pushing:

```bash
# Main worker
npm run dev

# Business agent
cd workers/business-agent && npm run dev

# Analyzer worker
cd workers/analyzer-worker && npm run dev

# Facebook worker
cd workers/facebook-worker && npm run dev
```

---

## Monitoring Deployments

### GitHub Actions UI

1. Navigate to **Actions** tab in your repository
2. Click on the running workflow
3. View real-time logs for each job
4. Check deployment summaries in each job's output

### Deployment Status

**Success Indicators**:
- Green checkmarks on all jobs
- Deployment summary shows URLs
- PR comment (for previews) shows "success" status

**Failure Indicators**:
- Red X on failed jobs
- Error messages in job logs
- Deployment summary shows failures

### Cloudflare Dashboard

Monitor deployed workers:

1. Go to **Cloudflare Dashboard > Workers & Pages**
2. Click on a worker to see:
   - Deployment history
   - Real-time logs
   - Analytics and metrics
   - Resource usage

### Viewing Logs

**During Deployment**:
```bash
# Watch logs in real-time (requires wrangler CLI locally)
wrangler tail kiamichi-biz-connect
wrangler tail kiamichi-business-agent
```

**After Deployment**:
- GitHub Actions: Actions tab > Workflow run > Job > View logs
- Cloudflare: Dashboard > Worker > Logs tab

### Deployment Notifications

The deploy workflow creates a **Deployment Summary** showing:
- Which workers were deployed
- Success/failure status for each
- Deployment URLs
- Commit SHA and timestamp

---

## Troubleshooting

### Common Issues

#### 1. "Cloudflare API Token Invalid"

**Symptoms**: Deployment fails with authentication error

**Solution**:
```bash
# Verify token in GitHub Secrets
1. Go to Settings > Secrets and variables > Actions
2. Delete CLOUDFLARE_API_TOKEN
3. Create a new API token in Cloudflare with correct permissions
4. Add the new token to GitHub Secrets
```

**Required Permissions**:
- Account: Workers Scripts (Edit)
- Account: Workers KV Storage (Edit)
- Account: Workers R2 Storage (Edit)
- Account: D1 (Edit)

#### 2. "Build Failed" During CI

**Symptoms**: Build job fails with TypeScript errors

**Solution**:
```bash
# Run locally to reproduce
cd workers/business-agent
npm ci
npm run build

# Fix TypeScript errors
# Then commit and push fixes
```

#### 3. "Database Migration Failed"

**Symptoms**: Migration job fails with SQL errors

**Solution**:
```bash
# Test migration locally
npm run db:schema:local

# Check for syntax errors in schema.sql
# Ensure migration is idempotent (safe to run multiple times)

# Manually run migration if needed
npx wrangler d1 execute kiamichi-biz-connect-db --remote --file=./schema.sql
```

#### 4. "Secrets Not Found in Worker"

**Symptoms**: Worker crashes with "undefined" secret values

**Solution**:
```yaml
# Ensure secrets are passed in workflow
- uses: cloudflare/wrangler-action@v3
  with:
    secrets: |
      ADMIN_KEY
      GOOGLE_CLIENT_SECRET
  env:
    ADMIN_KEY: ${{ secrets.ADMIN_KEY }}
    GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
```

#### 5. "Preview Deployment Conflicts"

**Symptoms**: Preview deployment fails with "worker already exists"

**Solution**:
```bash
# Manually delete stale preview
npx wrangler delete --name kiamichi-biz-connect-preview --force

# Or wait for PR close trigger to clean up automatically
```

#### 6. "Exceeded CPU Time Limit"

**Symptoms**: Worker returns 500 errors in production

**Solution**:
- Check Cloudflare logs for specific errors
- Optimize database queries (use indexes, limit results)
- Implement caching with KV
- Split heavy operations across multiple requests

#### 7. "D1 Database Connection Failed"

**Symptoms**: "Binding DB not found" error

**Solution**:
```toml
# Verify wrangler.toml has correct binding
[[d1_databases]]
binding = "DB"
database_name = "kiamichi-biz-connect-db"
database_id = "e8b7b17a-a93b-4b61-92ad-80b488266e12"
```

### Debugging Steps

1. **Check GitHub Actions logs**:
   - Look for red error messages
   - Check which step failed
   - Read full error output

2. **Reproduce locally**:
   ```bash
   # Use wrangler to test deployment
   npx wrangler deploy --dry-run

   # Test with local dev environment
   npm run dev
   ```

3. **Verify environment variables**:
   ```bash
   # Check what's configured in wrangler.toml
   cat wrangler.toml

   # Verify secrets are set in Cloudflare
   npx wrangler secret list
   ```

4. **Check Cloudflare status**:
   - Visit [Cloudflare Status](https://www.cloudflarestatus.com/)
   - Check for ongoing incidents affecting Workers

5. **Enable debug logging**:
   ```yaml
   # Add to workflow for verbose output
   - name: Deploy with debug
     run: npx wrangler deploy --verbose
   ```

### Getting Help

If you're still stuck:

1. **Check workflow run logs**: Detailed error messages are in the job output
2. **Review Cloudflare documentation**: [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
3. **Search GitHub Issues**: Check if others have similar problems
4. **Cloudflare Discord**: [Join the community](https://discord.gg/cloudflaredev)

---

## Best Practices

### Development Workflow

1. **Always create feature branches**:
   ```bash
   git checkout -b feature/add-new-feature
   ```

2. **Test locally before pushing**:
   ```bash
   npm run dev
   # Test your changes thoroughly
   ```

3. **Keep commits atomic**:
   - One logical change per commit
   - Clear commit messages
   - Easy to revert if needed

4. **Wait for CI before merging**:
   - Green checkmark = safe to merge
   - Red X = fix issues first

### Database Migrations

1. **Make migrations idempotent**:
   ```sql
   -- Use IF NOT EXISTS
   CREATE TABLE IF NOT EXISTS new_table (...);

   -- Use IF EXISTS for drops
   DROP TABLE IF EXISTS old_table;
   ```

2. **Test migrations locally first**:
   ```bash
   npm run db:schema:local
   # Verify changes
   npm run db:schema:remote  # Only after local success
   ```

3. **Never delete data in migrations**:
   - Archive instead of delete
   - Add columns, don't remove them
   - Coordinate data cleanup separately

### Security Best Practices

1. **Never commit secrets**:
   ```bash
   # Add to .gitignore
   .env
   .dev.vars
   secrets.json
   ```

2. **Rotate secrets regularly**:
   - Update API tokens every 90 days
   - Use different tokens for CI/CD vs local dev

3. **Audit dependencies**:
   ```bash
   npm audit
   npm audit fix
   ```

4. **Review third-party packages**:
   - Check package download counts
   - Review recent updates
   - Verify maintainer reputation

### Performance Optimization

1. **Cache aggressively**:
   ```typescript
   // Use KV for caching
   const cached = await env.CACHE.get(key);
   if (cached) return cached;

   const result = await expensiveOperation();
   await env.CACHE.put(key, result, { expirationTtl: 600 });
   ```

2. **Minimize database queries**:
   ```typescript
   // Batch queries
   const stmt = env.DB.prepare('SELECT * FROM businesses WHERE id IN (?, ?, ?)');
   const results = await stmt.bind(id1, id2, id3).all();
   ```

3. **Use service bindings**:
   - Call workers directly instead of HTTP
   - Faster and more reliable
   - No egress charges

4. **Monitor resource usage**:
   - Check Cloudflare Dashboard for CPU time
   - Set up alerts for high usage
   - Optimize hot paths

### Deployment Strategy

1. **Deploy during low traffic**:
   - Prefer off-peak hours
   - Monitor logs after deployment
   - Have rollback plan ready

2. **Use preview environments**:
   - Test in preview before production
   - Validate OAuth flows
   - Check database queries

3. **Gradual rollouts**:
   - Deploy to one worker at a time if issues suspected
   - Use manual workflow dispatch for control

4. **Monitor after deployment**:
   ```bash
   # Watch logs for 5-10 minutes
   wrangler tail kiamichi-biz-connect
   ```

### Code Quality

1. **Run linters locally**:
   ```bash
   cd workers/business-agent
   npm run check
   ```

2. **Write tests for critical paths**:
   ```bash
   npm run test:unit
   ```

3. **Keep dependencies updated**:
   ```bash
   npm outdated
   npm update
   ```

4. **Document complex logic**:
   - Add comments for non-obvious code
   - Update README when adding features
   - Keep wrangler.toml well-organized

---

## Workflow Commands Reference

### CI Workflow
```bash
# CI runs automatically on PRs, but you can test locally:

# Type check
npx wrangler types

# Build all workers
npm run build

# Run tests
cd workers/business-agent && npm run test:unit

# Security audit
npm audit
```

### Deploy Workflow
```bash
# Deploy all workers (automatic on merge to main)
npm run deploy:all

# Deploy individual workers
npm run deploy              # Main worker
npm run deploy:business     # Business agent
npm run deploy:analyzer     # Analyzer worker
npm run deploy:facebook     # Facebook worker

# Run database migrations
npm run db:schema:remote
```

### Preview Workflow
```bash
# Preview deploys automatically on PR creation
# To test preview configuration locally:

# Deploy to preview environment
npx wrangler deploy --env preview

# Delete preview deployment
npx wrangler delete --name kiamichi-biz-connect-preview --force
```

---

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [R2 Storage Documentation](https://developers.cloudflare.com/r2/)
- [Workers KV Documentation](https://developers.cloudflare.com/kv/)

---

## Maintenance Schedule

### Weekly
- Review failed workflow runs
- Check for dependency updates (`npm outdated`)
- Monitor deployment frequency

### Monthly
- Rotate Cloudflare API tokens
- Review and update secrets
- Audit security dependencies (`npm audit`)
- Clean up old preview deployments (if any leaked)

### Quarterly
- Review and optimize workflows
- Update action versions (e.g., `actions/checkout@v4` → `@v5`)
- Performance audit of workers
- Review Cloudflare usage and costs

---

## Quick Reference

### Secrets Checklist

- [ ] CLOUDFLARE_API_TOKEN
- [ ] CLOUDFLARE_ACCOUNT_ID
- [ ] ADMIN_KEY
- [ ] GOOGLE_CLIENT_SECRET
- [ ] FACEBOOK_APP_SECRET
- [ ] FB_EMAIL
- [ ] FB_PASSWORD

### Workflow Status

| Workflow | Trigger | Duration | Purpose |
|----------|---------|----------|---------|
| CI | PR to main | ~10-15 min | Validate code quality |
| Deploy | Push to main | ~8-12 min | Deploy to production |
| Preview | PR open/update | ~15-20 min | Create preview environments |

### Emergency Procedures

**Rollback to previous version**:
```bash
# Find previous deployment
npx wrangler deployments list --name kiamichi-biz-connect

# Rollback to specific deployment
npx wrangler rollback --deployment-id <deployment-id>
```

**Disable worker temporarily**:
```bash
# Route traffic to maintenance page (requires route configuration)
# Or delete worker entirely
npx wrangler delete --name kiamichi-biz-connect
```

**Force redeploy**:
```bash
# Trigger manual deployment from GitHub Actions
# Or deploy locally
npm run deploy:all
```

---

**Last Updated**: December 2024
**Maintained By**: Kiamichi Biz Connect Team
**Support**: admin@kiamichibizconnect.com
