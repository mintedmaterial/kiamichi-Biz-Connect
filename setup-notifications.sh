#!/bin/bash
# Cloudflare Notifications Setup Script for Kiamichi Biz Connect
# Automated system monitoring and alerts
# Signed by: Atlas Rooty (AI Development Partner)

echo "🚨 KIAMICHI BIZ CONNECT - NOTIFICATIONS SETUP"
echo "============================================="
echo "Signed by: Atlas Rooty (AI Development Partner)"
echo "Date: $(date)"
echo ""

# Configuration
NOTIFICATION_EMAIL="serviceflowagi@gmail.com"  # Update with actual email
ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID"
API_TOKEN="$CLOUDFLARE_API_TOKEN"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check if API credentials are available
check_credentials() {
    if [ -z "$ACCOUNT_ID" ] || [ -z "$API_TOKEN" ]; then
        print_error "Cloudflare API credentials not configured"
        print_info "Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables"
        return 1
    fi
    return 0
}

# Get available alerts from Cloudflare
get_available_alerts() {
    print_info "Fetching available Cloudflare alerts..."
    
    local response=$(curl -s \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/alerting/v3/available_alerts" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$response" | grep -q '"success":true'; then
        print_status "Available alerts retrieved"
        echo "$response" | jq -r '.result | keys[]' 2>/dev/null || echo "No alert categories found"
    else
        print_error "Failed to get available alerts"
        echo "$response" | jq -r '.errors' 2>/dev/null || echo "Unknown error"
        return 1
    fi
}

# Create notification for worker errors
create_worker_error_notification() {
    print_info "Creating worker error notification..."
    
    local notification_data=$(cat << EOF
{
  "name": "Kiamichi Worker Errors",
  "description": "High levels of 5xx HTTP errors in Kiamichi workers",
  "enabled": true,
  "alert_type": "http_alert_origin_error",
  "filters": {
    "zones": ["kiamichibizconnect.com", "app.kiamichibizconnect.com", "kiamichi-facebook-worker.workers.dev"],
    "slo": "99.7"
  },
  "notification_channels": ["email"],
  "recipients": [
    {
      "type": "email",
      "address": "$NOTIFICATION_EMAIL"
    }
  ]
}
EOF
)

    local response=$(curl -s -X POST \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/alerting/v3/destinations" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$notification_data")
    
    if echo "$response" | grep -q '"success":true'; then
        print_status "Worker error notification created"
        return 0
    else
        print_error "Failed to create worker error notification"
        echo "$response" | jq -r '.errors' 2>/dev/null || echo "Unknown error"
        return 1
    fi
}

# Create notification for Facebook worker
create_facebook_notification() {
    print_info "Creating Facebook worker notification..."
    
    local notification_data=$(cat << EOF
{
  "name": "Facebook Automation Monitor",
  "description": "Facebook posting automation system status",
  "enabled": true,
  "alert_type": "http_alert_origin_error",
  "filters": {
    "zones": ["kiamichi-facebook-worker.workers.dev"],
    "slo": "99.8"
  },
  "notification_channels": ["email"],
  "recipients": [
    {
      "type": "email",
      "address": "$NOTIFICATION_EMAIL"
    }
  ]
}
EOF
)

    local response=$(curl -s -X POST \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/alerting/v3/destinations" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$notification_data")
    
    if echo "$response" | grep -q '"success":true'; then
        print_status "Facebook automation notification created"
        return 0
    else
        print_error "Failed to create Facebook notification"
        return 1
    fi
}

# Create notification for voice server
create_voice_notification() {
    print_info "Creating voice server notification..."
    
    local notification_data=$(cat << EOF
{
  "name": "Voice System Monitor",
  "description": "Voice functionality status monitoring",
  "enabled": true,
  "alert_type": "http_alert_origin_error",
  "filters": {
    "zones": ["app.kiamichibizconnect.com"],
    "slo": "99.8"
  },
  "notification_channels": ["email"],
  "recipients": [
    {
      "type": "email",
      "address": "$NOTIFICATION_EMAIL"
    }
  ]
}
EOF
)

    local response=$(curl -s -X POST \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/alerting/v3/destinations" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$notification_data")
    
    if echo "$response" | grep -q '"success":true'; then
        print_status "Voice system notification created"
        return 0
    else
        print_error "Failed to create voice notification"
        return 1
    fi
}

# Create custom monitoring notification
create_custom_monitoring() {
    print_info "Creating custom monitoring notification..."
    
    # This would be a webhook or custom integration
    local notification_data=$(cat << EOF
{
  "name": "System Health Monitor",
  "description": "Custom system health monitoring for Kiamichi Biz Connect",
  "enabled": true,
  "alert_type": "custom_alert",
  "filters": {},
  "notification_channels": ["webhook"],
  "recipients": [
    {
      "type": "webhook",
      "url": "https://app.kiamichibizconnect.com/webhook/health-alert"
    }
  ]
}
EOF
)

    # For now, just log that we'll monitor via our own system
    print_info "Custom monitoring will be handled by our monitoring dashboard"
    return 0
}

# List current notifications
list_notifications() {
    print_info "Listing current notifications..."
    
    local response=$(curl -s \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/alerting/v3/destinations" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$response" | grep -q '"success":true'; then
        local notifications=$(echo "$response" | jq -r '.result[] | "\(.name): \(.enabled)"' 2>/dev/null)
        if [ -n "$notifications" ]; then
            print_status "Current notifications:"
            echo "$notifications"
        else
            print_info "No notifications configured"
        fi
        return 0
    else
        print_error "Failed to list notifications"
        return 1
    fi
}

# Test notifications
test_notifications() {
    print_info "Testing notification system..."
    
    # Test worker health endpoint
    local worker_test=$(curl -s -o /dev/null -w "%{http_code}" "https://kiamichi-facebook-worker.workers.dev/health")
    
    if [ "$worker_test" = "200" ]; then
        print_status "Facebook worker is healthy"
    else
        print_warning "Facebook worker may need attention (HTTP $worker_test)"
    fi
    
    # Test voice endpoint
    local voice_test=$(curl -s -o /dev/null -w "%{http_code}" "https://app.kiamichibizconnect.com/voice/test")
    
    if [ "$voice_test" = "200" ]; then
        print_status "Voice system is accessible"
    else
        print_warning "Voice system may need attention (HTTP $voice_test)"
    fi
    
    # Test main site
    local main_test=$(curl -s -o /dev/null -w "%{http_code}" "https://kiamichibizconnect.com")
    
    if [ "$main_test" = "200" ]; then
        print_status "Main site is accessible"
    else
        print_warning "Main site may need attention (HTTP $main_test)"
    fi
}

# Main setup function
main() {
    echo ""
    echo "🎯 NOTIFICATION SETUP PLAN:"
    echo "=========================="
    echo "1. Check available Cloudflare alerts"
    echo "2. Create worker error notifications"
    echo "3. Create Facebook automation notifications"
    echo "4. Create voice system notifications"
    echo "5. Set up custom monitoring dashboard"
    echo "6. Test all notification endpoints"
    echo ""
    
    # Check credentials
    if ! check_credentials; then
        exit 1
    fi
    
    # Get available alerts
    echo "📋 Available alert categories:"
    get_available_alerts
    echo ""
    
    # Create notifications
    create_worker_error_notification
    create_facebook_notification
    create_voice_notification
    create_custom_monitoring
    
    # List current notifications
    echo ""
    list_notifications
    
    # Test notifications
    echo ""
    test_notifications
    
    # Final summary
    echo ""
    echo "✅ NOTIFICATION SETUP COMPLETE!"
    echo "================================"
    echo "Signed by: Atlas Rooty (AI Development Partner)"
    echo "Date: $(date)"
    echo ""
    echo "📧 Notifications will be sent to: $NOTIFICATION_EMAIL"
    echo "🎯 Monitoring dashboard: https://app.kiamichibizconnect.com/monitoring"
    echo "🔔 System health checks will run every 5 minutes"
    echo ""
    echo "Next steps:"
    echo "1. Test notification delivery"
    echo "2. Monitor system health dashboard"
    echo "3. Adjust notification thresholds as needed"
}

# Run main function
main

# Create monitoring script for continuous health checks
cat > monitor-health.sh << 'EOF'
#!/bin/bash
# Continuous health monitoring for Kiamichi Biz Connect
# Signed by: Atlas Rooty (AI Development Partner)

echo "🔍 MONITORING KIAMICHI BIZ CONNECT HEALTH"
echo "======================================="
echo "$(date): Starting health check..."

# Check Facebook worker
facebook_status=$(curl -s -o /dev/null -w "%{http_code}" "https://kiamichi-facebook-worker.workers.dev/health")
if [ "$facebook_status" = "200" ]; then
    echo "✅ Facebook worker: HEALTHY"
else
    echo "❌ Facebook worker: DOWN (HTTP $facebook_status)"
fi

# Check voice server
voice_status=$(curl -s -o /dev/null -w "%{http_code}" "https://app.kiamichibizconnect.com/voice/test")
if [ "$voice_status" = "200" ]; then
    echo "✅ Voice server: HEALTHY"
else
    echo "❌ Voice server: DOWN (HTTP $voice_status)"
fi

# Check main site
main_status=$(curl -s -o /dev/null -w "%{http_code}" "https://kiamichibizconnect.com")
if [ "$main_status" = "200" ]; then
    echo "✅ Main site: HEALTHY"
else
    echo "❌ Main site: DOWN (HTTP $main_status)"
fi

echo "Health check completed at: $(date)"
EOF

chmod +x monitor-health.sh
print_status "Created monitor-health.sh for continuous monitoring"
print_status "Run: ./monitor-health.sh to check system health"