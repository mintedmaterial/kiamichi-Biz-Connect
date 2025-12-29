# Testing Guide: Business Listing Editor
**Your Listing**: https://kiamichibizconnect.com/business/srvcflo-web-marketing-design
**Your Email**: Mintedmaterial@gmail.com

---

## 🎯 What We Built

You now have a complete AI-powered business listing editor where you can:
- Chat with an AI agent to edit your listing
- See live preview of changes
- Publish changes to production with one click
- Rollback to previous versions if needed

---

## 📊 Implementation Status

### ✅ Complete (100%)

**Backend Services**:
- ✅ TemplateLoader - Loads component templates from R2
- ✅ ComponentRenderer - Renders components with Handlebars
- ✅ PageAssembler - Assembles full HTML pages
- ✅ 9 AI tools for page editing
- ✅ Preview route with authentication
- ✅ Publishing pipeline to R2
- ✅ Snapshot/rollback system

**Frontend UI**:
- ✅ Split-screen layout (chat + preview)
- ✅ PreviewPane component with auto-refresh
- ✅ PublishDialog confirmation modal
- ✅ Session management
- ✅ API endpoints for business info

**Infrastructure**:
- ✅ GitHub Actions CI/CD
- ✅ Database migration applied
- ✅ All secrets configured
- ✅ PR created and updated

**Commits**:
- Commit 1: `c1e1f0d` - Backend services, tools, CI/CD
- Commit 2: `47b6d5e` - Frontend UI, session management

---

## 🚀 How to Test

### Step 1: Wait for CI/CD to Complete

**Monitor your PR**: https://github.com/mintedmaterial/kiamichi-Biz-Connect/pull/1

Watch for:
- ✅ All checks passing (green checkmarks)
- ✅ Preview deployment complete
- ⏱️ Should take ~15-20 minutes total

### Step 2: Access the Editor

Once preview deploys, you'll get URLs like:
```
Preview business-agent: https://kiamichi-business-agent-preview.[...].workers.dev
```

**OR** merge the PR and go to production:
```
Production: https://app.kiamichibizconnect.com
```

### Step 3: Authentication Flow

**IMPORTANT**: You need to set up business ownership first.

**Option A: Via Database (Quick Setup)**
```sql
-- Run this in wrangler d1 console to claim your business
INSERT INTO business_owners (email, email_verified, created_at)
VALUES ('Mintedmaterial@gmail.com', 1, unixepoch());

-- Get the owner_id and business_id for srvcflo
SELECT id FROM business_owners WHERE email = 'Mintedmaterial@gmail.com';
SELECT id FROM businesses WHERE slug = 'srvcflo-web-marketing-design';

-- Create ownership (replace IDs)
INSERT INTO business_ownership (owner_id, business_id, claim_status, verified_at, created_at)
VALUES ([owner_id], [business_id], 'verified', unixepoch(), unixepoch());

-- Create a portal session (replace owner_id)
INSERT INTO portal_sessions (owner_id, session_token, expires_at, created_at, last_activity)
VALUES ([owner_id], 'test-session-token', unixepoch() + 2592000, unixepoch(), unixepoch());
```

**Option B: Via Portal Registration** (if implemented)
1. Go to https://kiamichibizconnect.com/portal/register
2. Enter: Mintedmaterial@gmail.com
3. Verify email
4. Claim your business

### Step 4: Test the Editor

Once authenticated:

**4.1 Open Editor**
```
https://app.kiamichibizconnect.com
```

You should see:
- Left: Chat interface
- Right: Live preview of your listing

**4.2 Test Chat Commands**

Try these commands in chat:

```
1. "List my page components"
   → Should show all components on your page

2. "Add a modern hero section"
   → Adds hero component
   → Preview auto-refreshes

3. "Update the hero heading to 'Professional Web Design & Marketing'"
   → Updates content
   → Preview auto-refreshes

4. "Show me my snapshots"
   → Lists version history

5. "Publish my changes"
   → Opens confirmation dialog
   → Creates snapshot
   → Publishes to R2
```

**4.3 Test Preview**

Verify:
- [ ] Preview loads your business listing
- [ ] Preview shows "PREVIEW MODE" banner
- [ ] Preview updates when you add/edit components
- [ ] Manual refresh button works

**4.4 Test Publishing**

Click "Publish" button:
- [ ] Confirmation dialog appears
- [ ] "Create snapshot" checkbox is checked
- [ ] Publishing shows progress
- [ ] Success message with published URL
- [ ] Live site updates: https://kiamichibizconnect.com/business/srvcflo-web-marketing-design

### Step 5: Verify Production

After publishing:

1. **Check R2 Bucket**:
```bash
npx wrangler r2 object get kiamichi-business-assets/business/srvcflo-web-marketing-design/index.html
```

2. **Check Database**:
```sql
SELECT * FROM published_pages_r2 WHERE listing_page_id = (
  SELECT id FROM listing_pages WHERE business_id = (
    SELECT id FROM businesses WHERE slug = 'srvcflo-web-marketing-design'
  )
);
```

3. **Visit Live Site**:
```
https://kiamichibizconnect.com/business/srvcflo-web-marketing-design
```

Should show your published changes!

---

## 🐛 Troubleshooting

### Issue: "No business found"

**Cause**: Business ownership not set up

**Fix**: Run database setup commands above

### Issue: "Unauthorized" or 401 error

**Cause**: Session cookie not set

**Fix**:
1. Check portal_sessions table has your session
2. Verify cookie domain is `.kiamichibizconnect.com`
3. Try logging in again

### Issue: Preview doesn't load

**Cause**: Business ID not passed to frontend

**Fix**: Check browser console for errors. The `/api/my-business` endpoint should return your business.

### Issue: Preview doesn't refresh

**Cause**: Tool responses not returning `refreshPreview: true`

**Fix**: Check network tab - tool responses should include this flag

### Issue: Publish fails

**Cause**: R2 permissions or database error

**Fix**:
1. Check wrangler.jsonc has BUSINESS_ASSETS binding
2. Verify R2 bucket exists
3. Check server logs: `npx wrangler tail kiamichi-business-agent`

---

## 📝 What to Test

### Critical Path ✅
- [ ] Login with Mintedmaterial@gmail.com
- [ ] Editor loads with split-screen
- [ ] Preview shows srvcflo-web-marketing-design
- [ ] Chat: "List my components" works
- [ ] Chat: "Add a component" works
- [ ] Preview auto-refreshes
- [ ] Publish button works
- [ ] Live site updates

### Edge Cases
- [ ] Error handling (bad business ID)
- [ ] Session expiry
- [ ] Mobile view (chat only)
- [ ] Concurrent edits
- [ ] Rollback to snapshot

---

## 📚 Available AI Commands

Your agent understands these commands:

**Viewing**:
- "List my page components"
- "Show me component details for ID X"
- "List my snapshots"
- "What components can I add?"

**Editing**:
- "Add a [modern/classic/minimal] [hero/services/gallery/etc] section"
- "Update component X with heading 'New Title'"
- "Change the hero background color to blue"
- "Remove component X"
- "Move component X to position 2"

**Publishing**:
- "Publish my changes"
- "Create a snapshot"
- "Rollback to snapshot X"

**Database**:
- "Show me my business info"
- "List all database tables"
- "Query the database: SELECT ..."

---

## 🎯 Success Criteria

**MVP Complete When**:
- ✅ You can login
- ✅ Editor loads your listing
- ✅ Preview shows live changes
- ✅ Publishing works
- ✅ Live site updates

**Production Ready When**:
- ✅ All CI checks pass
- ✅ Manual testing successful
- ✅ Error handling verified
- ✅ Performance acceptable
- ✅ Documentation complete

---

## 📞 Quick Commands

**View PR Status**:
```bash
gh pr view 1
```

**Watch CI**:
```bash
gh run watch
```

**Check Logs**:
```bash
npx wrangler tail kiamichi-business-agent
```

**Database Query**:
```bash
npx wrangler d1 execute kiamichi-biz-connect-db --remote --command "SELECT * FROM businesses WHERE slug='srvcflo-web-marketing-design'"
```

**Deploy Manually** (if needed):
```bash
cd workers/business-agent
npx wrangler deploy
```

---

## 🎉 What's Next

After successful testing:

1. **Merge PR** → Production deployment
2. **Add More Templates** → Expand component library
3. **Build Template Marketplace** → Let users browse
4. **Add Analytics** → Track page performance
5. **Mobile Editor** → Responsive editing

---

**Your Test Environment**:
- Business: srvcflo-web-marketing-design
- Email: Mintedmaterial@gmail.com
- PR: #1
- Preview: Pending CI completion

**Status**: ✅ Ready for Testing (pending CI)
**Next Action**: Monitor PR for preview deployment

Good luck testing! 🚀
