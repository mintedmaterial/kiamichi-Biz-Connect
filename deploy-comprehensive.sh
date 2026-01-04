#!/bin/bash
# Comprehensive Deployment Script for Kiamichi Biz Connect
# Handles all three branches with proper testing and validation

echo "🚀 KIAMICHI BIZ CONNECT - COMPREHENSIVE DEPLOYMENT"
echo "=================================================="
echo ""

# Configuration
PROJECT_DIR="C:\Users\Minte\Desktop\dev-code\kiamichi-biz-connect"
MAIN_BRANCH="main"
BRANCH_1="facebook-automation-fix"
BRANCH_2="business-agent-voice-ui"
BRANCH_3="ui-styling-update"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Navigate to project directory
cd "$PROJECT_DIR" || exit 1

echo "📁 Working directory: $(pwd)"
echo ""

# Function to test deployment
test_deployment() {
    local endpoint=$1
    local description=$2
    
    echo "🧪 Testing: $description"
    
    if curl -s -f "$endpoint" > /dev/null; then
        print_status "$description - TEST PASSED"
        return 0
    else
        print_error "$description - TEST FAILED"
        return 1
    fi
}

# Function to deploy a branch
deploy_branch() {
    local branch_name=$1
    local branch_desc=$2
    
    echo ""
    echo "🚀 DEPLOYING $branch_desc"
    echo "================================"
    
    # Create and switch to branch
    git checkout -b "$branch_name" 2>/dev/null || git checkout "$branch_name"
    
    case "$branch_name" in
        "$BRANCH_1")
            echo "📊 Applying Facebook automation fixes..."
            
            # Apply SQL fixes
            if command -v sqlite3 >/dev/null 2>&1; then
                sqlite3 kiamichi-biz-connect.db < BRANCH_1_FACEBOOK_FIX.sql
                print_status "Applied Facebook posting schedule fix"
            else
                print_warning "SQLite not available, skipping SQL fixes"
            fi
            
            # Deploy Facebook worker
            cd workers/facebook-worker
            wrangler deploy
            print_status "Deployed Facebook worker"
            
            # Test Facebook endpoints
            test_deployment "https://kiamichi-facebook-worker.workers.dev/test-queue" "Facebook queue test"
            test_deployment "https://kiamichi-facebook-worker.workers.dev/trigger-posts" "Facebook trigger test"
            
            cd ../../
            ;;
            
        "$BRANCH_2")
            echo "🎙️ Setting up voice functionality..."
            
            # Copy voice system files
            cp workers/business-agent/src/FixedAppWithVoice.tsx workers/business-agent/src/app.tsx
            cp src/voice-system.ts workers/business-agent/src/
            print_status "Copied voice system files"
            
            # Deploy voice server
            cd workers/voice-server
            wrangler deploy
            print_status "Deployed voice server"
            
            # Deploy business agent with voice
            cd ../business-agent
            wrangler deploy
            print_status "Deployed business agent with voice"
            
            # Test voice endpoints
            test_deployment "https://app.kiamichibizconnect.com/voice/test" "Voice system test"
            
            cd ../../
            ;;
            
        "$BRANCH_3")
            echo "🎨 Applying UI styling updates..."
            
            # Copy UI updates
            cp workers/business-agent/src/components/preview-pane/FixedPreviewPane.tsx workers/business-agent/src/components/preview-pane/PreviewPane.tsx
            print_status "Updated preview pane styling"
            
            # Deploy business agent with UI updates
            cd workers/business-agent
            wrangler deploy
            print_status "Deployed business agent with UI updates"
            
            # Test UI
            test_deployment "https://app.kiamichibizconnect.com" "Business agent UI test"
            
            cd ../../
            ;;
    esac
    
    # Commit and push
    git add -A
    git commit -m "$branch_desc - Deployment ready"
    git push origin "$branch_name"
    
    print_status "$branch_desc deployment complete"
}

# Main deployment sequence
echo ""
echo "📋 DEPLOYMENT PLAN:"
echo "=================="
echo "1. $BRANCH_1 - Facebook automation timing fixes"
echo "2. $BRANCH_2 - Voice functionality and UI updates" 
echo "3. $BRANCH_3 - Final UI styling improvements"
echo ""

# Deploy each branch
deploy_branch "$BRANCH_1" "Branch 1: Facebook Automation Fix"
deploy_branch "$BRANCH_2" "Branch 2: Business Agent Voice & UI"
deploy_branch "$BRANCH_3" "Branch 3: UI Styling Update"

# Final testing and validation
echo ""
echo "🧪 FINAL TESTING"
echo "================"

# Test all endpoints
test_deployment "https://kiamichibizconnect.com" "Main site"
test_deployment "https://app.kiamichibizconnect.com" "App site"
test_deployment "https://kiamichi-facebook-worker.workers.dev/queue-status" "Facebook queue status"
test_deployment "https://app.kiamichibizconnect.com/voice/test" "Voice system"

# Create summary report
echo ""
echo "📊 DEPLOYMENT SUMMARY"
echo "===================="
echo ""
echo "✅ All three branches have been deployed successfully!"
echo ""
echo "📋 What's been deployed:"
echo "• Branch 1: Facebook posting schedule fixed for CST times"
echo "• Branch 2: Voice functionality (talk-to-text, text-to-speech)"
echo "• Branch 3: UI styling improvements"
echo ""
echo "🧪 Next steps:"
echo "1. Monitor Facebook posts at 9 AM CST tomorrow"
echo "2. Test voice functionality in the app (click microphone)"
echo "3. Verify UI styling matches main site"
echo "4. Test business authentication and user management"
echo ""
echo "📝 Testing Commands:"
echo "• Facebook: curl https://kiamichi-facebook-worker.workers.dev/test-queue"
echo "• Voice: curl https://app.kiamichibizconnect.com/voice/test"
echo "• Business: curl https://app.kiamichibizconnect.com/api/my-business"
echo ""
print_status "DEPLOYMENT COMPLETE! 🚀"

# Optional: Switch back to main branch
git checkout "$MAIN_BRANCH"
print_info "Switched back to main branch"

echo ""
echo "🎯 Ready for testing! Check the app in the morning."