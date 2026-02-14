# Kiamichi Biz Connect - Incremental Development Checklist

## 📋 **Current Status: January 4, 2025**

### 🎯 **Priority 1: Facebook Automation Fixes**
- [ ] **Fix posting schedule timing** - Posts not publishing due to cron/schedule mismatch
- [ ] **Implement image strategy** - 2/3 business photos, 1/3 AI generated
- [ ] **Test manual posting** - Verify queue processing works
- [ ] **Add group posting fallback** - Handle missing group tokens

### 🎯 **Priority 2: UI Layout Fix**
- [ ] **Fix app.kiamichibizconnect.com layout** - Chat vs preview sections
- [ ] **Implement proper preview system** - Show actual page content in preview
- [ ] **Add user authentication** - Email-based business access
- [ ] **Create template system** - Based on Cloudflare VibeSDK approach

### 🎯 **Priority 3: User Agent System**
- [ ] **Business authentication** - Email validation against business.listing_email
- [ ] **Preview/approval queue** - User changes → developer approval → merge
- [ ] **Image generation for users** - Context-aware image creation
- [ ] **GitHub workflow integration** - Automated deployments

### 🎯 **Priority 4: Developer Controls**
- [ ] **Notification system** - Alert on pending user changes
- [ ] **Preview management** - View/approve user modifications
- [ ] **Full site control** - Developer access to all tools
- [ ] **Background monitoring** - Cloudflare logs analysis

---

## 🔧 **Immediate Next Steps**

### 1. **Facebook Automation - Critical Fix**
```sql
-- Run this SQL to fix posting schedule
DELETE FROM facebook_posting_schedule;
INSERT INTO facebook_posting_schedule (time_slot, hour_utc, minute, preferred_content_types, target_type) VALUES
  ('evening', 3, 0, '["business_spotlight", "engagement_prompt"]', 'both'),
  ('morning', 15, 0, '["business_spotlight", "category_highlight"]', 'both'),
  ('afternoon', 22, 0, '["blog_share", "business_spotlight"]', 'both');
```

### 2. **UI Layout Fix - Immediate**
Need to see the current app.kiamichibizconnect.com implementation to fix the chat/preview overlap.

### 3. **Template System Research**
Looking at Cloudflare VibeSDK for inspiration on user-friendly template system.

---

## 📊 **Progress Tracking**

**Completed Today:**
- [x] Analyzed Facebook automation issues
- [x] Created diagnostic tools
- [x] Identified timing mismatch problem
- [x] Started checklist system

**Next Actions:**
1. Apply Facebook posting schedule fix
2. Examine current app.kiamichibizconnect.com UI
3. Design template system architecture
4. Implement incremental fixes

**Approval Required:**
- Facebook automation fixes (after testing)
- UI layout changes
- Template system design
- User agent authentication flow

---

## 📝 **Notes**

- All code changes require Minte approval
- Incremental approach - small, testable changes
- Background testing via Cloudflare logs
- Template inspiration from VibeSDK but business-focused
- User authentication via business.listing_email validation