#!/bin/bash
# Branch 1: Facebook Automation Fix
# Deploys Facebook worker with corrected timing

echo "🚀 DEPLOYING BRANCH 1: Facebook Automation Fix"
echo "=============================================="

# Navigate to project directory
cd "C:\Users\Minte\Desktop\dev-code\kiamichi-biz-connect"

# Apply SQL fixes
echo "📊 Applying Facebook posting schedule fix..."
sqlite3 kiamichi-biz-connect.db < BRANCH_1_FACEBOOK_FIX.sql

# Deploy Facebook worker
echo "🤖 Deploying Facebook worker..."
cd workers/facebook-worker
wrangler deploy

# Verify deployment
echo "✅ Verifying deployment..."
curl https://kiamichi-facebook-worker.workers.dev/test-queue

# Test manual posting
echo "🧪 Testing manual posting..."
curl https://kiamichi-facebook-worker.workers.dev/trigger-posts

echo ""
echo "✅ BRANCH 1 DEPLOYMENT COMPLETE!"
echo "================================"
echo "Next steps:"
echo "1. Monitor Facebook posts at 9 AM, 4 PM, 9 PM CST"
echo "2. Check if posts appear on Facebook page"
echo "3. Verify queue processing works automatically"

# Create Git commit
cd ../../
git add -A
git commit -m "Branch 1: Fix Facebook automation timing and posting schedule"
git push origin facebook-automation-fix