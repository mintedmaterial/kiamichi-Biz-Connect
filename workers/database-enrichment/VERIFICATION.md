# Database Enrichment - Verification Checklist

Run these commands to verify the worker is ready to deploy.

## 1. Test Suite

```bash
cd /home/flo/kiamichi-Biz-Connect/workers/database-enrichment
npm test
```

**Expected Output:**
```
Test Files  4 passed (4)
Tests      30 passed (30)
```

## 2. Code Quality

```bash
# Check all source files exist
ls -la src/
# Should show: enrich.js, index.js, matcher.js, orchestrator.js, reporter.js, updater.js

# Check all test files exist
ls -la tests/
# Should show: matcher.test.js, orchestrator.test.js, reporter.test.js, updater.test.js
```

## 3. Configuration

```bash
# Verify wrangler.toml
cat wrangler.toml
# Should show D1 binding (kiamichi-biz-connect-db) and R2 binding (atlas-collab-pub)

# Verify dependencies
cat package.json | grep fuzzball
# Should show: "fuzzball": "^2.1.2"
```

## 4. Git Status

```bash
git log --oneline -2
# Should show recent commits with database enrichment

git diff main..HEAD --stat
# Should show ~28 files changed
```

## 5. Dependency Check

```bash
# Check if email extraction file is ready
wrangler r2 object get atlas-collab-pub/kbc-data/business-emails.json --file=/tmp/test.json --remote
# If succeeds: Ready to run enrichment
# If fails (404): Wait for email extraction sub-agent
```

## 6. Test Deployment (Optional)

```bash
# Deploy to Cloudflare (staging)
wrangler deploy

# Test endpoint
curl https://kbc-database-enrichment.srvcflo.workers.dev
# Should return: "KBC Database Enrichment Worker"
```

## 7. Dry Run (After Email Extraction Completes)

```bash
# Run enrichment
curl -X POST https://kbc-database-enrichment.srvcflo.workers.dev/enrich
# Should return JSON with success status

# Or use CLI
node src/enrich.js
```

## 8. Database Verification

```bash
# Check email count before
wrangler d1 execute kiamichi-biz-connect-db --remote \
  --command="SELECT COUNT(*) as total, COUNT(email) as with_emails FROM businesses"

# Run enrichment
# (wait for completion)

# Check email count after
wrangler d1 execute kiamichi-biz-connect-db --remote \
  --command="SELECT COUNT(*) as total, COUNT(email) as with_emails FROM businesses"

# Should show 150+ emails added
```

## 9. Report Verification

```bash
# List enrichment reports in R2
wrangler r2 object list atlas-collab-pub --prefix kbc-data/enrichment-report --remote

# Download latest report
wrangler r2 object get atlas-collab-pub/kbc-data/enrichment-report-XXXX.json --file=/tmp/report.json --remote
cat /tmp/report.json | jq
```

## Success Indicators

- ✅ All 30 tests pass
- ✅ Worker deploys successfully
- ✅ 150+ businesses matched
- ✅ D1 database updated with emails
- ✅ Report uploaded to R2
- ✅ No errors in worker logs

## Rollback Plan

If enrichment fails:

1. Check worker logs: `wrangler tail kbc-database-enrichment`
2. Verify D1 database: `wrangler d1 execute kiamichi-biz-connect-db --remote --command="SELECT * FROM businesses WHERE email IS NOT NULL LIMIT 5"`
3. If corrupted: Restore from backup (if available)
4. Fix issue and re-deploy
5. Re-run enrichment

## Contact

**Issues/Questions:** Post to Discord #kbc-feature-development  
**Status Report:** https://pub-30a843d7499b4062bd2f2e9cde157bd0.r2.dev/kbc-data/database-enrichment-status.md
