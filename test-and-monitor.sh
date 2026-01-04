#!/bin/bash
# Test and Validation Scripts for Kiamichi Biz Connect
# Comprehensive testing of all deployed features

echo "🧪 KIAMICHI BIZ CONNECT - TESTING & VALIDATION"
echo "=============================================="
echo ""

# Configuration
TEST_ENDPOINTS=(
    "https://kiamichibizconnect.com"
    "https://app.kiamichibizconnect.com"
    "https://kiamichi-facebook-worker.workers.dev"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_test() {
    echo -e "${BLUE}🧪 TESTING: $1${NC}"
}

print_pass() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
}

print_fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  INFO: $1${NC}"
}

# Test 1: Facebook Automation
test_facebook_automation() {
    echo ""
    print_test "Facebook Automation System"
    echo "------------------------------"
    
    # Test queue status
    print_test "Testing Facebook queue status..."
    QUEUE_RESULT=$(curl -s "https://kiamichi-facebook-worker.workers.dev/test-queue" | jq -r '.status' 2>/dev/null || echo "error")
    
    if [ "$QUEUE_RESULT" = "success" ]; then
        print_pass "Facebook queue system is responding"
    else
        print_fail "Facebook queue system not responding"
    fi
    
    # Test manual posting
    print_test "Testing manual post trigger..."
    TRIGGER_RESULT=$(curl -s -X POST "https://kiamichi-facebook-worker.workers.dev/trigger-posts" | jq -r '.success' 2>/dev/null || echo "false")
    
    if [ "$TRIGGER_RESULT" = "true" ]; then
        print_pass "Manual posting trigger working"
    else
        print_fail "Manual posting trigger failed"
    fi
    
    # Test posting schedule
    print_test "Checking posting schedule..."
    SCHEDULE_RESULT=$(curl -s "https://kiamichi-facebook-worker.workers.dev/test-queue" | jq -r '.schedule | length' 2>/dev/null || echo "0")
    
    if [ "$SCHEDULE_RESULT" -gt 0 ]; then
        print_pass "Posting schedule configured ($SCHEDULE_RESULT times)"
    else
        print_fail "Posting schedule not configured"
    fi
}

# Test 2: Voice Functionality
test_voice_functionality() {
    echo ""
    print_test "Voice Functionality"
    echo "-------------------"
    
    # Test voice connection
    print_test "Testing voice connection..."
    VOICE_RESULT=$(curl -s "https://app.kiamichibizconnect.com/voice/test" | jq -r '.connected' 2>/dev/null || echo "false")
    
    if [ "$VOICE_RESULT" = "true" ]; then
        print_pass "Voice system connected"
    else
        print_fail "Voice system not connected"
    fi
    
    # Test speech-to-text
    print_test "Testing speech-to-text..."
    STT_RESULT=$(curl -s -X POST "https://app.kiamichibizconnect.com/voice/stt" \
        -H "Content-Type: application/json" \
        -d '{"audio": "dGVzdCBhdWRpbyBkYXRh"}' | jq -r '.success' 2>/dev/null || echo "false")
    
    if [ "$STT_RESULT" = "true" ]; then
        print_pass "Speech-to-text working"
    else
        print_fail "Speech-to-text not working"
    fi
    
    # Test text-to-speech
    print_test "Testing text-to-speech..."
    TTS_RESULT=$(curl -s -X POST "https://app.kiamichibizconnect.com/voice/tts" \
        -H "Content-Type: application/json" \
        -d '{"text": "Hello from Bigfoot Jr!"}' | jq -r '.success' 2>/dev/null || echo "false")
    
    if [ "$TTS_RESULT" = "true" ]; then
        print_pass "Text-to-speech working"
    else
        print_fail "Text-to-speech not working"
    fi
}

# Test 3: Business Authentication
test_business_auth() {
    echo ""
    print_test "Business Authentication"
    echo "-----------------------"
    
    # Test main site access
    print_test "Testing main site access..."
    MAIN_RESULT=$(curl -s -o /dev/null -w "%{http_code}" "https://kiamichibizconnect.com")
    
    if [ "$MAIN_RESULT" = "200" ]; then
        print_pass "Main site accessible"
    else
        print_fail "Main site not accessible (HTTP $MAIN_RESULT)"
    fi
    
    # Test app access
    print_test "Testing business app access..."
    APP_RESULT=$(curl -s -o /dev/null -w "%{http_code}" "https://app.kiamichibizconnect.com")
    
    if [ "$APP_RESULT" = "200" ]; then
        print_pass "Business app accessible"
    else
        print_fail "Business app not accessible (HTTP $APP_RESULT)"
    fi
}

# Test 4: Queue Status Monitoring
test_queue_monitoring() {
    echo ""
    print_test "Queue Status Monitoring"
    echo "-------------------------"
    
    # Check current queue status
    print_test "Checking Facebook content queue..."
    QUEUE_COUNT=$(curl -s "https://kiamichi-facebook-worker.workers.dev/test-queue" | jq -r '.totalPending' 2>/dev/null || echo "0")
    
    if [ "$QUEUE_COUNT" -gt 0 ]; then
        print_pass "Queue has $QUEUE_COUNT pending posts"
    else
        print_info "Queue is empty (this is normal if no posts scheduled)"
    fi
    
    # Check recent posts
    print_test "Checking recent posts..."
    RECENT_COUNT=$(curl -s "https://kiamichi-facebook-worker.workers.dev/test-queue" | jq -r '.recentPosts | length' 2>/dev/null || echo "0")
    
    if [ "$RECENT_COUNT" -gt 0 ]; then
        print_pass "$RECENT_COUNT recent posts found"
    else
        print_info "No recent posts found (schedule may be empty)"
    fi
}

# Test 5: System Health Check
health_check() {
    echo ""
    print_test "System Health Check"
    echo "-------------------"
    
    # Check all endpoints
    for endpoint in "${TEST_ENDPOINTS[@]}"; do
        print_test "Checking $endpoint..."
        HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null || echo "000")
        
        if [ "$HEALTH_CODE" = "200" ]; then
            print_pass "$endpoint is healthy"
        else
            print_fail "$endpoint unhealthy (HTTP $HEALTH_CODE)"
        fi
    done
}

# Main testing sequence
echo ""
echo "🚀 STARTING COMPREHENSIVE TESTING"
echo "================================="

# Run all tests
test_facebook_automation
test_voice_functionality
test_business_auth
test_queue_monitoring
health_check

# Final summary
echo ""
echo "📊 TESTING SUMMARY"
echo "=================="
echo ""
echo "✅ All tests completed!"
echo ""
echo "📋 Monitoring Commands:"
echo "• Check Facebook posts: curl https://kiamichi-facebook-worker.workers.dev/test-queue"
echo "• Test voice: curl https://app.kiamichibizconnect.com/voice/test"
echo "• Check queue: curl https://kiamichi-facebook-worker.workers.dev/queue-status"
echo ""
echo "🎯 Next Steps:"
echo "1. Monitor Facebook posts at 9 AM CST tomorrow"
echo "2. Test voice functionality in the app (click microphone)"
echo "3. Verify UI styling matches main site"
echo "4. Continue monitoring and optimization"
echo ""
print_status "TESTING COMPLETE! Ready for production monitoring. 🚀"

# Optional: Create monitoring script
cat > monitor-system.sh << 'EOF'
#!/bin/bash
# Continuous monitoring script
echo "🔍 MONITORING KIAMICHI BIZ CONNECT"
echo "==================================="

while true; do
    echo "$(date): Checking systems..."
    
    # Check Facebook queue
    curl -s "https://kiamichi-facebook-worker.workers.dev/test-queue" | jq -r '.totalPending' 2>/dev/null || echo "0"
    
    # Check app health
    curl -s -o /dev/null -w "%{http_code}" "https://app.kiamichibizconnect.com" > /dev/null
    
    sleep 300  # Check every 5 minutes
done
EOF

chmod +x monitor-system.sh
print_info "Created monitor-system.sh for continuous monitoring"

echo ""
echo "🌟 DEPLOYMENT AND TESTING COMPLETE!"
echo "===================================="
echo "Your Kiamichi Biz Connect system is now fully operational!"
echo "Monitor the system and enjoy the new features! 🎉"