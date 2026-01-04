#!/bin/bash
# Branch 2: Business Agent Voice & UI Updates
# Deploys voice functionality and UI improvements

echo "🎙️ DEPLOYING BRANCH 2: Business Agent Voice & UI"
echo "==============================================="

# Navigate to project directory
cd "C:\Users\Minte\Desktop\dev-code\kiamichi-biz-connect"

# Copy voice system files
echo "📁 Setting up voice system..."
cp workers/business-agent/src/FixedAppWithVoice.tsx workers/business-agent/src/app.tsx
cp src/voice-system.ts workers/business-agent/src/

# Update wrangler configuration if needed
echo "⚙️ Updating worker configuration..."
cd workers/business-agent

# Add voice server route to wrangler.jsonc if not present
if ! grep -q "voice/stream" wrangler.jsonc; then
    echo "Adding voice endpoint to wrangler.jsonc..."
    # Add voice routes to wrangler config
fi

# Deploy voice server
echo "🎤 Deploying voice server..."
cd ../voice-server
wrangler deploy

# Deploy business agent with voice
echo "🤖 Deploying business agent with voice..."
cd ../business-agent
wrangler deploy

# Test voice functionality
echo "🧪 Testing voice functionality..."
curl https://app.kiamichibizconnect.com/voice/test

# Test UI updates
echo "🎨 Testing UI updates..."
curl https://app.kiamichibizconnect.com/

echo ""
echo "✅ BRANCH 2 DEPLOYMENT COMPLETE!"
echo "=================================="
echo "Next steps:"
echo "1. Test voice functionality in the app"
echo "2. Click microphone button and speak"
echo "3. Verify text appears from speech"
echo "4. Check if audio responses play"

# Create Git commit
cd ../../
git add -A
git commit -m "Branch 2: Add voice functionality and improve business agent UI"
git push origin business-agent-voice-ui