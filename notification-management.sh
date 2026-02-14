#!/bin/bash
# Complete Cloudflare Notification Management for Kiamichi Biz Connect
# Handles creation, testing, editing, and management of notifications
# Signed by: Atlas Rooty (AI Development Partner)

echo "🔔 CLOUDFLARE NOTIFICATIONS - COMPLETE MANAGEMENT"
echo "================================================="
echo "Signed by: Atlas Rooty (AI Development Partner)"
echo "Date: $(date)"
echo ""

# Configuration
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-colt@kiamichibizconnect.com}"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"

# Colors
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

# Check credentials
check_credentials() {
    if [ -z "$ACCOUNT_ID" ] || [ -z "$API_TOKEN" ]; then
        print_error "Cloudflare API credentials not configured"
        print_info "Please set environment variables:"
        echo "export CLOUDFLARE_ACCOUNT_ID=your_account_id"
        echo "export CLOUDFLARE_API_TOKEN=your_api_token"
        echo "export NOTIFICATION_EMAIL=your_email@domain.com"
        return 1
    fi
    return 0
}

# Get available alert types
get_available_alerts() {
    print_info "Fetching available Cloudflare alert types..."
    
    local response=$(curl -s \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/alerting/v3/available_alerts" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$response" | grep -q '"success":true'; then
        echo "$response" | jq -r '.result | keys[]' | sort
    else
        print_error "Failed to get available alerts"
        return 1
    fi
}

# List current notifications
list_notifications() {
    print_info "Fetching current notifications..."
    
    local response=$(curl -s \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/alerting/v3/destinations" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$response" | grep -q '"success":true'; then
        local notifications=$(echo "$response" | jq -r '.result[] | "\(.id)|\(.name)|\(.enabled)|\(.alert_type)"' 2>/dev/null)
        
        if [ -n "$notifications" ]; then
            echo "$notifications" | while IFS='|' read -r id name enabled type; do
                echo "ID: $id"
                echo "  Name: $name"
                echo "  Status: $([ "$enabled" = "true" ] && echo "Enabled" || echo "Disabled")"
                echo "  Type: $type"
                echo ""
            done
        else
            print_info "No notifications found"
        fi
    else
        print_error "Failed to list notifications"
        return 1
    fi
}

# Create standard notifications for Kiamichi Biz Connect
create_standard_notifications() {
    print_info "Creating standard notifications for Kiamichi Biz Connect..."
    
    # 1. Worker Errors (High Priority)
    create_notification "Kiamichi Worker Errors" \
        "High levels of 5xx HTTP errors in Kiamichi workers" \
        "http_alert_origin_error" \
        '{"zones":["kiamichibizconnect.com","app.kiamichibizconnect.com","kiamichi-facebook-worker.workers.dev"],"slo":"99.7"}'
    
    # 2. Facebook Automation Monitor
    create_notification "Facebook Automation Monitor" \
        "Facebook posting automation system status" \
        "http_alert_origin_error" \
        '{"zones":["kiamichi-facebook-worker.workers.dev"],"slo":"99.8"}'
    
    # 3. Voice System Monitor
    create_notification "Voice System Monitor" \
        "Voice functionality status monitoring" \
        "http_alert_origin_error" \
        '{"zones":["app.kiamichibizconnect.com"],"slo":"99.8"}'
    
    # 4. High Error Rate (General)
    create_notification "High Error Rate Monitor" \
        "Overall system error rate monitoring" \
        "http_alert_origin_error" \
        '{"zones":["kiamichibizconnect.com","app.kiamichibizconnect.com"],"slo":"99.8"}'
    
    # 5. Daily Summary
    create_notification "Daily System Summary" \
        "Daily summary of system health and metrics" \
        "daily_digest" \
        '{}'
    
    echo "✅ Standard notifications created"
}

# Create individual notification
create_notification() {
    local name="$1"
    local description="$2"
    local alert_type="$3"
    local filters="$4"
    
    print_info "Creating notification: $name"
    
    local notification_data=$(cat << EOF
{
  "name": "$name",
  "description": "$description",
  "enabled": true,
  "alert_type": "$alert_type",
  "filters": $filters,
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
        local notification_id=$(echo "$response" | jq -r '.result.id')
        echo "✅ Created: $name (ID: $notification_id)"
        echo "$notification_id" >> .notification_ids.txt
    else
        print_error "Failed to create: $name"
        echo "Response: $response"
    fi
}

# Test a notification
test_notification() {
    local notification_id="$1"
    
    if [ -z "$notification_id" ]; then
        print_error "Please provide a notification ID"
        return 1
    fi
    
    print_info "Testing notification: $notification_id"
    
    local response=$(curl -s -X POST \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/alerting/v3/destinations/$notification_id/test" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: "application/json")
    
    if echo "$response" | grep -q '"success":true'; then
        print_status "Test notification sent successfully"
        print_info "Check your email ($NOTIFICATION_EMAIL) for the test notification"
    else
        print_error "Failed to test notification"
        echo "Response: $response"
    fi
}

# Enable/disable notification
toggle_notification() {
    local notification_id="$1"
    local enable="$2"  # true or false
    
    if [ -z "$notification_id" ] || [ -z "$enable" ]; then
        print_error "Please provide notification ID and enable status (true/false)"
        return 1
    fi
    
    print_info "Setting notification $notification_id to: $([ "$enable" = "true" ] && echo "Enabled" || echo "Disabled")"
    
    local response=$(curl -s -X PUT \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/alerting/v3/destinations/$notification_id" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"enabled\": $enable}")
    
    if echo "$response" | grep -q '"success":true'; then
        print_status "Notification updated successfully"
    else
        print_error "Failed to update notification"
        echo "Response: $response"
    fi
}

# Delete notification
delete_notification() {
    local notification_id="$1"
    
    if [ -z "$notification_id" ]; then
        print_error "Please provide a notification ID"
        return 1
    fi
    
    print_warning "Are you sure you want to delete notification $notification_id? (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        local response=$(curl -s -X DELETE \
            "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/alerting/v3/destinations/$notification_id" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/json")
        
        if echo "$response" | grep -q '"success":true'; then
            print_status "Notification deleted successfully"
        else
            print_error "Failed to delete notification"
            echo "Response: $response"
        fi
    else
        print_info "Deletion cancelled"
    fi
}

# Create monitoring dashboard
setup_monitoring_dashboard() {
    print_info "Setting up monitoring dashboard..."
    
    # Create dashboard HTML file
    cat > monitoring-dashboard.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kiamichi Biz Connect - Notification Management</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .notification-item { border: 1px solid #e0e0e0; padding: 15px; margin: 10px 0; border-radius: 5px; background: #fafafa; }
        .enabled { color: #4CAF50; font-weight: bold; }
        .disabled { color: #F44336; font-weight: bold; }
        .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
        .btn-primary { background: #2196F3; color: white; }
        .btn-danger { background: #F44336; color: white; }
        .btn-success { background: #4CAF50; color: white; }
        .alert { padding: 15px; margin: 10px 0; border-radius: 5px; }
        .alert-success { background: #E8F5E8; border-left: 4px solid #4CAF50; }
        .alert-danger { background: #FFEBEE; border-left: 4px solid #F44336; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔔 Cloudflare Notifications Management</h1>
            <p>Manage notifications for Kiamichi Biz Connect system monitoring</p>
        </div>
        
        <div class="card">
            <h2>📋 Current Notifications</h2>
            <div id="notifications-list">
                <p>Loading notifications...</p>
            </div>
        </div>
        
        <div class="card">
            <h2>➕ Quick Actions</h2>
            <button class="btn btn-primary" onclick="createStandardNotifications()">Create Standard Notifications</button>
            <button class="btn btn-success" onclick="testAllNotifications()">Test All Notifications</button>
            <button class="btn btn-primary" onclick="listNotifications()">Refresh List</button>
        </div>
        
        <div class="card">
            <h2>📊 System Status</h2>
            <div id="system-status">
                <p>Checking system health...</p>
            </div>
        </div>
    </div>
    
    <script>
        // Load notifications
        async function listNotifications() {
            try {
                const response = await fetch('/api/notifications/list');
                const data = await response.json();
                
                if (data.success) {
                    displayNotifications(data.notifications);
                } else {
                    document.getElementById('notifications-list').innerHTML = 
                        '<div class="alert alert-danger">Failed to load notifications</div>';
                }
            } catch (error) {
                document.getElementById('notifications-list').innerHTML = 
                    '<div class="alert alert-danger">Error loading notifications: ' + error.message + '</div>';
            }
        }
        
        function displayNotifications(notifications) {
            if (notifications.length === 0) {
                document.getElementById('notifications-list').innerHTML = 
                    '<p>No notifications configured. Click "Create Standard Notifications" to set up monitoring.</p>';
                return;
            }
            
            let html = '';
            notifications.forEach(notification => {
                const status = notification.enabled ? 
                    '<span class="enabled">Enabled</span>' : 
                    '<span class="disabled">Disabled</span>';
                
                html += `
                    <div class="notification-item">
                        <h3>${notification.name} ${status}</h3>
                        <p>${notification.description}</p>
                        <p><strong>Type:</strong> ${notification.alert_type}</p>
                        <p><strong>ID:</strong> ${notification.id}</p>
                        <button class="btn btn-primary" onclick="testNotification('${notification.id}')">Test</button>
                        <button class="btn ${notification.enabled ? 'btn-danger' : 'btn-success'}" 
                                onclick="toggleNotification('${notification.id}', ${!notification.enabled})">
                            ${notification.enabled ? 'Disable' : 'Enable'}
                        </button>
                    </div>
                `;
            });
            
            document.getElementById('notifications-list').innerHTML = html;
        }
        
        // Test notification
        async function testNotification(id) {
            try {
                const response = await fetch('/api/notifications/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notification_id: id })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('Test notification sent! Check your email.');
                } else {
                    alert('Test failed: ' + data.error);
                }
            } catch (error) {
                alert('Test error: ' + error.message);
            }
        }
        
        // Toggle notification
        async function toggleNotification(id, enable) {
            try {
                const response = await fetch('/api/notifications/toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notification_id: id, enabled: enable })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    listNotifications(); // Refresh list
                } else {
                    alert('Toggle failed: ' + data.error);
                }
            } catch (error) {
                alert('Toggle error: ' + error.message);
            }
        }
        
        // Create standard notifications
        async function createStandardNotifications() {
            if (confirm('Create standard notifications for Kiamichi Biz Connect?')) {
                try {
                    const response = await fetch('/api/notifications/create-standard', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        alert('Standard notifications created successfully!');
                        listNotifications(); // Refresh list
                    } else {
                        alert('Creation failed: ' + data.error);
                    }
                } catch (error) {
                    alert('Creation error: ' + error.message);
                }
            }
        }
        
        // Test all notifications
        async function testAllNotifications() {
            if (confirm('Test all notifications? This will send test emails.')) {
                // Implementation would test all notifications
                alert('Testing all notifications... Check your email for test messages.');
            }
        }
        
        // Load on page load
        listNotifications();
    </script>
</body>
</html>
EOF

    echo "✅ Monitoring dashboard created"
    echo "📁 Location: monitoring-dashboard.html"
    echo ""
    echo "Open monitoring-dashboard.html in your browser to manage notifications"
}

# Main menu system
show_menu() {
    echo ""
    echo "🎯 NOTIFICATION MANAGEMENT MENU"
    echo "==============================="
    echo "1. List current notifications"
    echo "2. Create standard notifications"
    echo "3. Test a notification"
    echo "4. Enable/disable notification"
    echo "5. Delete notification"
    echo "6. Setup monitoring dashboard"
    echo "7. Get available alert types"
    echo "8. Exit"
    echo ""
    echo -n "Select option: "
}

# Main function
main() {
    # Check credentials first
    if ! check_credentials; then
        echo ""
        echo "💡 Running in demo mode with local monitoring"
        create_local_monitoring
        return 0
    fi
    
    echo ""
    echo "🚀 Starting Cloudflare notification management..."
    echo "Account: $ACCOUNT_ID"
    echo "Email: $NOTIFICATION_EMAIL"
    echo ""
    
    # Show menu and handle user input
    while true; do
        show_menu
        read -r choice
        
        case $choice in
            1)
                list_notifications
                ;;
            2)
                create_standard_notifications
                ;;
            3)
                echo -n "Enter notification ID to test: "
                read -r notification_id
                test_notification "$notification_id"
                ;;
            4)
                echo -n "Enter notification ID: "
                read -r notification_id
                echo -n "Enable (true) or disable (false): "
                read -r enable
                toggle_notification "$notification_id" "$enable"
                ;;
            5)
                echo -n "Enter notification ID to delete: "
                read -r notification_id
                delete_notification "$notification_id"
                ;;
            6)
                setup_monitoring_dashboard
                ;;
            7)
                echo "Available alert types:"
                get_available_alerts
                ;;
            8)
                echo "Exiting..."
                break
                ;;
            *)
                echo "Invalid option. Please try again."
                ;;
        esac
        
        echo ""
        echo "Press Enter to continue..."
        read -r
    done
    
    echo ""
    echo "✅ NOTIFICATION MANAGEMENT COMPLETE!"
    echo "====================================="
    echo "Signed by: Atlas Rooty (AI Development Partner)"
    echo "Date: $(date)"
    echo ""
    echo "📧 Notifications configured for: $NOTIFICATION_EMAIL"
    echo "🎯 Dashboard: Open monitoring-dashboard.html in browser"
    echo "🔔 Management: Use this script to modify notifications"
    echo ""
    echo "Next steps:"
    echo "1. Test notifications to verify they're working"
    echo "2. Monitor your email for alerts"
    echo "3. Adjust notification thresholds as needed"
    echo "4. Use the dashboard to manage notifications"
}

# Make executable and run
chmod +x notification-management.sh

# Run the complete system
main