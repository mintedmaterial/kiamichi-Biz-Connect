# KBC Facebook Automation — Master TODO

**Last Updated:** 2025-02-09 06:30 UTC
**Owners:** @Flo, @DevFlo

---

## 🔥 Immediate (Today)

### @Flo
- [ ] Merge `feat/bigfoot-mascot-integration` branch to main
- [ ] Push DevFlo's featured rotation commits (from container)
- [ ] Run D1 migration: `wrangler d1 execute kiamichi-biz-connect-db --file=migrations/004_featured_rotation.sql`
- [ ] Deploy facebook-worker: `wrangler deploy -c workers/facebook-worker/wrangler.toml`
- [ ] Verify `/featured/tier` endpoint returns businesses 1-20

### @DevFlo
- [x] Create featured rotation system
- [x] Create paid tier table (featured_tier_members)
- [x] Add tier management endpoints
- [x] Create platform vision doc
- [x] Create master TODO
- [ ] Wire bigfoot-mascot.ts into facebook-worker
- [ ] Fix `businessId` variable bug in bigfoot-mascot.ts
- [ ] Create VIP business config for Velvet Fringe + Twisted Custom Leather

---

## 🎯 This Week

### Featured Rotation
- [ ] Test rotation at midnight UTC
- [ ] Verify is_featured flag updates correctly
- [ ] Add Velvet Fringe + Twisted Custom Leather to tier with `tier_level = 'premium'`

### VIP Business Daily Posts
- [ ] Create `vip_businesses` table or flag
- [ ] Add daily cron for VIP posts (separate from regular rotation)
- [ ] Implement "unique content" logic (no repeats):
  - Rotate: services, testimonials, seasonal, promotions, new products
  - Track what angles have been used per business
- [ ] Integrate Bigfoot Jr. mascot (30% chance)

### Bigfoot Mascot Integration
- [ ] Merge mascot files from Flo's branch
- [ ] Fix businessId bug in bigfoot-mascot.ts
- [ ] Test Workers AI Flux image gen
- [ ] Add mascot to 30% of posts

### Image Generation Migration
- [ ] Stop using OpenAI for images
- [ ] Switch to Workers AI (`@cf/black-forest-labs/flux-1-dev`)
- [ ] Test image quality vs OpenAI

---

## 📅 Next Week

### Daily Featured List Post
- [ ] Create featured_list_posts table
- [ ] Implement business tagging (Graph API)
- [ ] Schedule 10 AM CST daily
- [ ] Tag 3-5 businesses per post

### Engagement Posts
- [ ] Create engagement post templates (polls, trivia, questions)
- [ ] Schedule Tuesday + Saturday 7 PM CST
- [ ] Implement Facebook poll API

### FB Submission Monitoring
- [ ] Monitor comments for listing requests
- [ ] Extract business info with AI
- [ ] Auto-respond with submission link
- [ ] Queue for Analyzer Worker

---

## 📆 Future (Platform Build-Out)

### Skills to Create
- [ ] `kbc-landing-page-builder` - Deploy worker-based landing pages
- [ ] `kbc-social-automation` - Per-business social config
- [ ] `kbc-business-agent` - DevFlo-lite for paid users
- [ ] `kbc-namespace-manager` - Deploy workers to business subdomains

### Payment Integration
- [ ] Stripe subscription tiers
- [ ] Automated provisioning
- [ ] Usage tracking

### DevFlo-lite Instances
- [ ] Create containerized template
- [ ] Per-business tools (social, listing, analytics)
- [ ] Sandboxed execution

---

## ✅ Completed

- [x] Phase 1: Featured rotation system (DevFlo)
- [x] Featured tier members table (DevFlo)
- [x] Tier management endpoints (DevFlo)
- [x] facebook-scheduler.ts stub (DevFlo)
- [x] Platform vision document (DevFlo)
- [x] Master TODO (DevFlo)
- [x] Business spotlight posts x3 (Flo)
- [x] bigfoot-mascot.ts + facebook-content-generator-mascot.ts (Flo pushed)

---

## 📁 Key Files

| File | Purpose | Status |
|------|---------|--------|
| `migrations/004_featured_rotation.sql` | Featured tier tables | ✅ Created |
| `workers/facebook-worker/src/featured-rotation.ts` | Rotation logic | ✅ Created |
| `src/bigfoot-mascot.ts` | Mascot image gen | 🔄 Flo's branch |
| `src/facebook-content-generator-mascot.ts` | Mascot content | 🔄 Flo's branch |
| `plans/FACEBOOK_AUTOMATION_ENHANCEMENT.md` | Full 10-week plan | ✅ Created |
| `plans/PLATFORM_VISION.md` | Platform architecture | ✅ Created |

---

## 🔗 Collaboration

**R2 Task Folder:** `atlas-collab-pub/tasks/kbc-facebook-automation/`
**GitHub:** https://github.com/mintedmaterial/kiamichi-Biz-Connect

**How to Update This TODO:**
1. Check off items as completed
2. Add timestamp + initials
3. Commit with message: `chore: update TODO [item description]`

---

*Last updated by: DevFlo @ 2025-02-09 06:30 UTC*
