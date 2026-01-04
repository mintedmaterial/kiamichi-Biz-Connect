# Facebook Automation Fix - Action Plan

## 🚨 Critical Issues to Fix

### 1. **Posts Not Publishing**
**Root Cause**: Timing mismatch between cron schedule and posting schedule
**Fix**: Update posting schedule to match cron times (3, 15, 22 UTC)

```sql
-- Run this in D1:
DELETE FROM facebook_posting_schedule;
INSERT INTO facebook_posting_schedule (time_slot, hour_utc, minute, preferred_content_types, target_type) VALUES
  ('evening', 3, 0, '["business_spotlight", "engagement_prompt"]', 'both'),
  ('morning', 15, 0, '["business_spotlight", "category_highlight"]', 'both'),
  ('afternoon', 22, 0, '["blog_share", "business_spotlight"]', 'both');
```

### 2. **Group Posting Not Working**
**Root Cause**: Missing group token or wrong group ID
**Fix**: Verify tokens and implement fallback to page-only posting

### 3. **Image Strategy Implementation**
**New Feature**: 2/3 business photos, 1/3 AI generated
**Implementation**: New `facebook-image-strategy.ts` module

## 🔧 **Code Changes Needed**

### Update Facebook Worker (`workers/facebook-worker/src/index.ts`)

1. **Fix queue processing timing**:
```typescript
// Around line 920, update the time window check
const windowStart = now - 300; // 5 minutes ago
const windowEnd = now + 300; // 5 minutes from now
// Change to wider window for testing
const windowStart = now - 1800; // 30 minutes ago
const windowEnd = now + 1800; // 30 minutes from now
```

2. **Add image strategy integration**:
```typescript
// Import the new image strategy
import { generatePostWithImageStrategy } from '../../../src/facebook-image-strategy';

// Update content generation in populateContentQueue
const { message, imageUrl, link, shouldGenerateImage } = await generatePostWithImageStrategy(
  env,
  contentType,
  business,
  blogPost,
  category
);
```

### Update Scheduler (`src/facebook-scheduler.ts`)

3. **Integrate new image strategy**:
```typescript
// Replace direct content generation with image strategy
const { message, imageUrl, link } = await generatePostWithImageStrategy(
  env,
  contentType,
  business,
  blogPost,
  category
);

// Update queue insertion to include image URL
await db.prepare(`
  INSERT INTO facebook_content_queue 
  (content_type, target_type, business_id, message, link, image_url, scheduled_for, content_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
  contentType, targetType, business?.id || null, message, link, imageUrl, scheduleTime, contentHash
).run();
```

## 🧪 **Testing Steps**

### 1. **Test Queue Population** (Manual)
```bash
# Deploy and test
npx wrangler deploy

# Check if queue is populated
curl https://your-worker.workers.dev/diagnose-facebook
```

### 2. **Test Manual Posting** (Immediate)
```bash
# Trigger queue processing manually
curl -X POST https://your-worker.workers.dev/trigger-queue
```

### 3. **Test Image Generation** (New)
```bash
# Test AI image generation
curl -X POST https://your-worker.workers.dev/test-post \
  -H "Content-Type: application/json" \
  -d '{"business_id": 1, "force_image": true}'
```

## 📋 **Kiamichi-Biz-Agent User System**

### Authentication Flow
1. User signs in with business email
2. System validates email matches business.listing_email
3. Creates session with business_id scope
4. All agent actions limited to that business

### Preview System
1. User changes go to `business_changes` table
2. Developer approves via admin panel
3. Approved changes merge to main business data
4. GitHub workflow triggers rebuild

### Image Generation for Users
```typescript
// In user chat interface
const business = getBusinessFromSession(userEmail);
const imageChoice = await askUser("Use business photo or generate new image?");

if (imageChoice === 'generate') {
  const prompt = await askUser("Describe the image you want:");
  const image = await generateImage(env, prompt, business);
  await showPreview(image);
  if (userApproves) {
    await saveToQueue(image, business);
  }
}
```

## 🚀 **Next Steps**

1. **Apply SQL fix** - Run the schedule update
2. **Deploy image strategy** - Add new module and updates
3. **Test posting** - Use manual trigger endpoint
4. **Monitor logs** - Check for posting errors
5. **Build user agent** - Start with auth + preview system

Want me to start implementing these fixes? I can begin with the most critical issue (posts not publishing) and work through each step.