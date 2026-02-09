# KiamichiBizConnect Facebook Automation Enhancement Plan

**Created:** 2025-02-09
**Author:** DevFlo (Subagent)
**Status:** Draft - Ready for Review
**Repo:** https://github.com/mintedmaterial/kiamichi-Biz-Connect

---

## Executive Summary

This plan outlines 6 major feature enhancements to the existing `facebook-worker` to increase engagement, automate business discovery, and create a comprehensive social media presence for KiamichiBizConnect.

### Current State
- ✅ 3x daily cron posts (9AM, 4PM, 9PM CST)
- ✅ AI content generation via Workers AI (Llama 3.1 8B)
- ✅ Flux 2 Dev image generation
- ✅ Graph API posting to Page + Group
- ✅ D1 content queue with scheduling
- ✅ Durable Object BrowserSession for browser automation
- ✅ Token refresh and analytics collection
- ✅ Comment monitoring and auto-response

### Proposed Enhancements
1. **Featured Section Rotation** - Rotate featured businesses on website
2. **Daily Featured List Post** - Tag multiple businesses in one post
3. **Business Highlight Posts** - AI-stylized images from actual business photos
4. **Engagement Driving Posts** - Interactive content for community engagement
5. **Facebook Listing Requests** - Accept submissions via FB comments/messages
6. **Analyzer Worker Integration** - Auto-create/edit listings from requests

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     KiamichiBizConnect Stack                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ Main Worker  │◄──►│FB Worker     │◄──►│ Analyzer Worker      │   │
│  │ (Website)    │    │(Social Auto) │    │ (AI Enrichment)      │   │
│  └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘   │
│         │                   │                       │               │
│         └───────────────────┼───────────────────────┘               │
│                             │                                        │
│                    ┌────────▼────────┐                              │
│                    │      D1 DB      │                              │
│                    │  (Shared State) │                              │
│                    └────────┬────────┘                              │
│                             │                                        │
│         ┌───────────────────┼───────────────────┐                   │
│         │                   │                   │                   │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐             │
│  │  R2 IMAGES  │    │ R2 ASSETS   │    │ R2 BUSINESS │             │
│  │ (Generated) │    │ (Static)    │    │  (Uploads)  │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Rotate Featured Section on Website

### Overview
Automatically rotate which businesses appear in the "Featured" section of the website, ensuring fair exposure and fresh content.

### Database Changes

```sql
-- migrations/004_featured_rotation.sql

-- Track featured rotation history
CREATE TABLE IF NOT EXISTS featured_rotation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    featured_start INTEGER NOT NULL,  -- Unix timestamp
    featured_end INTEGER,              -- Unix timestamp (NULL = currently featured)
    rotation_reason TEXT,              -- 'scheduled', 'manual', 'ad_placement'
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Featured slots configuration
CREATE TABLE IF NOT EXISTS featured_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_position INTEGER NOT NULL UNIQUE,  -- 1, 2, 3, etc.
    business_id INTEGER,
    priority_source TEXT DEFAULT 'rotation', -- 'rotation', 'ad', 'manual'
    rotation_interval_days INTEGER DEFAULT 7,
    last_rotated INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id)
);

CREATE INDEX IF NOT EXISTS idx_featured_rotation_business ON featured_rotation_log(business_id);
CREATE INDEX IF NOT EXISTS idx_featured_rotation_active ON featured_rotation_log(featured_end);
```

### Implementation in facebook-worker

```typescript
// src/featured-rotation.ts

interface RotationConfig {
  slotsCount: number;          // Number of featured slots (default: 6)
  rotationDays: number;        // Days before rotation (default: 7)
  prioritizeVerified: boolean; // Prioritize verified businesses
  excludeRecentDays: number;   // Don't re-feature within X days
}

async function rotateFeaturedBusinesses(env: Env, config: RotationConfig): Promise<void> {
  const db = env.DB;
  const now = Math.floor(Date.now() / 1000);
  const rotationThreshold = now - (config.rotationDays * 86400);
  
  // Get current featured that need rotation
  const slotsNeedingRotation = await db.prepare(`
    SELECT fs.* FROM featured_slots fs
    WHERE fs.priority_source = 'rotation'
    AND (fs.last_rotated IS NULL OR fs.last_rotated < ?)
    ORDER BY fs.slot_position
  `).bind(rotationThreshold).all();
  
  // Get eligible businesses (not recently featured)
  const excludeThreshold = now - (config.excludeRecentDays * 86400);
  const eligibleBusinesses = await db.prepare(`
    SELECT b.* FROM businesses b
    LEFT JOIN featured_rotation_log frl ON b.id = frl.business_id 
      AND frl.featured_end > ?
    WHERE b.is_active = 1
    AND (b.is_verified = 1 OR ? = 0)
    AND frl.id IS NULL
    ORDER BY b.google_rating DESC, RANDOM()
    LIMIT ?
  `).bind(excludeThreshold, config.prioritizeVerified ? 1 : 0, slotsNeedingRotation.results.length).all();
  
  // Rotate each slot
  for (let i = 0; i < slotsNeedingRotation.results.length; i++) {
    const slot = slotsNeedingRotation.results[i];
    const newBusiness = eligibleBusinesses.results[i];
    
    if (newBusiness) {
      // End previous featured period
      if (slot.business_id) {
        await db.prepare(`
          UPDATE featured_rotation_log SET featured_end = ? 
          WHERE business_id = ? AND featured_end IS NULL
        `).bind(now, slot.business_id).run();
        
        // Remove is_featured flag
        await db.prepare(`
          UPDATE businesses SET is_featured = 0 WHERE id = ?
        `).bind(slot.business_id).run();
      }
      
      // Start new featured period
      await db.prepare(`
        INSERT INTO featured_rotation_log (business_id, featured_start, rotation_reason)
        VALUES (?, ?, 'scheduled')
      `).bind(newBusiness.id, now).run();
      
      // Update slot
      await db.prepare(`
        UPDATE featured_slots SET business_id = ?, last_rotated = ? WHERE id = ?
      `).bind(newBusiness.id, now, slot.id).run();
      
      // Set is_featured flag
      await db.prepare(`
        UPDATE businesses SET is_featured = 1 WHERE id = ?
      `).bind(newBusiness.id).run();
    }
  }
}
```

### Cron Schedule
Add to existing cron: Run rotation check daily at 12 AM UTC (6 PM CST)

```toml
# wrangler.toml
[triggers]
crons = ["0 0,3,15,22 * * *", "0 2,14 * * *"]
```

---

## Feature 2: Daily Featured List Post

### Overview
Create a "Top Businesses" style post that tags multiple businesses, increasing reach and engagement through cross-tagging.

### Database Changes

```sql
-- migrations/005_featured_list_posts.sql

-- Track featured list posts
CREATE TABLE IF NOT EXISTS featured_list_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_type TEXT DEFAULT 'daily_roundup', -- 'daily_roundup', 'category_spotlight', 'new_arrivals'
    business_ids TEXT NOT NULL,              -- JSON array of business IDs
    message TEXT NOT NULL,
    page_post_id TEXT,
    group_post_id TEXT,
    scheduled_for INTEGER NOT NULL,
    posted_at INTEGER,
    status TEXT DEFAULT 'pending',
    engagement_score INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
);

-- Business Facebook profile tracking (for tagging)
ALTER TABLE businesses ADD COLUMN facebook_profile_id TEXT;
ALTER TABLE businesses ADD COLUMN facebook_taggable BOOLEAN DEFAULT 0;
ALTER TABLE businesses ADD COLUMN last_tag_used INTEGER;

CREATE INDEX IF NOT EXISTS idx_featured_list_status ON featured_list_posts(status);
CREATE INDEX IF NOT EXISTS idx_businesses_taggable ON businesses(facebook_taggable);
```

### Content Generation

```typescript
// src/featured-list-generator.ts

interface FeaturedListConfig {
  businessCount: number;      // Number of businesses to feature (3-5)
  postType: 'daily_roundup' | 'category_spotlight' | 'new_arrivals';
  categoryFilter?: number;    // Optional category filter
}

async function generateFeaturedListPost(env: Env, config: FeaturedListConfig): Promise<string> {
  const db = env.DB;
  
  // Get businesses with Facebook profiles for tagging
  let query = `
    SELECT b.*, c.name as category_name 
    FROM businesses b
    JOIN categories c ON b.category_id = c.id
    WHERE b.is_active = 1 
    AND b.facebook_taggable = 1
    AND b.facebook_profile_id IS NOT NULL
  `;
  
  if (config.categoryFilter) {
    query += ` AND b.category_id = ${config.categoryFilter}`;
  }
  
  query += ` ORDER BY 
    CASE WHEN b.last_tag_used IS NULL THEN 0 ELSE 1 END,
    b.google_rating DESC, 
    RANDOM() 
    LIMIT ${config.businessCount}`;
  
  const businesses = await db.prepare(query).all();
  
  // Generate AI content with tag placeholders
  const businessList = businesses.results.map((b: any) => ({
    name: b.name,
    category: b.category_name,
    tag: `@[${b.facebook_profile_id}]`, // Graph API tag format
    city: b.city
  }));
  
  const systemPrompt = `You're a friendly local guide for Southeast Oklahoma businesses.
Create an engaging "Featured Businesses" post that naturally mentions each business.
Use the @tag format provided - these will become real Facebook tags.
Keep it warm, conversational, and genuine. Around 150-200 words.
Include a call-to-action to follow/support local.`;

  const userPrompt = `Create a ${config.postType} post featuring these businesses:
${businessList.map((b, i) => `${i+1}. ${b.name} (${b.category}) in ${b.city} - Tag: ${b.tag}`).join('\n')}

Make it feel like a genuine recommendation from a local, not an ad.`;

  const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 400,
    temperature: 0.85
  });
  
  return (aiResponse as any).response;
}
```

### Posting with Tags

```typescript
// src/fb-official-api.ts - Add tag support

interface TaggedPostOptions {
  message: string;
  tags: string[];  // Array of Facebook profile/page IDs
}

async function postWithTags(pageId: string, token: string, options: TaggedPostOptions): Promise<any> {
  // Format tags for Graph API
  const taggedMessage = options.message;
  
  // Note: Page tagging requires the tagged page to have liked/followed your page
  // For profiles, requires friendship or public profile
  const params = new URLSearchParams({
    message: taggedMessage,
    access_token: token
  });
  
  // Add message_tags if available
  if (options.tags.length > 0) {
    // Graph API message_tags format
    params.set('message_tags', JSON.stringify(options.tags.map((id, offset) => ({
      id,
      type: 'page',
      offset: taggedMessage.indexOf(`@[${id}]`),
      length: id.length + 3
    }))));
  }
  
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}/feed`,
    { method: 'POST', body: params }
  );
  
  return response.json();
}
```

### Schedule
- **Time:** 10 AM CST (4 PM UTC) daily - different from regular posts
- **Content:** 3-5 businesses per post, rotated weekly

---

## Feature 3: Business Highlight Posts with AI-Generated Images

### Overview
Create stylized social media images from actual business photos, using Workers AI image models for professional-looking promotional content.

### Database Changes

```sql
-- migrations/006_social_media_images.sql

-- Track AI-generated social media images
CREATE TABLE IF NOT EXISTS social_media_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    source_image_key TEXT,           -- Original business image from R2
    generated_image_key TEXT NOT NULL, -- Generated image in R2
    image_prompt TEXT,
    style_preset TEXT,               -- 'modern', 'vintage', 'bold', 'minimal'
    platform TEXT DEFAULT 'facebook', -- 'facebook', 'instagram', 'both'
    width INTEGER DEFAULT 1200,
    height INTEGER DEFAULT 630,       -- Facebook optimal: 1200x630
    model TEXT DEFAULT 'flux-2-dev',
    quality_score INTEGER DEFAULT 80,
    usage_count INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_social_images_business ON social_media_images(business_id);
CREATE INDEX IF NOT EXISTS idx_social_images_platform ON social_media_images(platform);
CREATE INDEX IF NOT EXISTS idx_social_images_unused ON social_media_images(usage_count, is_approved);
```

### Image Workflow Pipeline

```typescript
// src/image-pipeline.ts

interface ImagePipelineConfig {
  businessId: number;
  sourceType: 'database' | 'facebook' | 'google' | 'website';
  stylePreset: 'modern' | 'vintage' | 'bold' | 'minimal' | 'local';
  platform: 'facebook' | 'instagram' | 'both';
}

class BusinessImagePipeline {
  constructor(private env: Env) {}
  
  /**
   * Step 1: Acquire source image
   */
  async getSourceImage(businessId: number): Promise<{ buffer: ArrayBuffer; source: string } | null> {
    const db = this.env.DB;
    const business = await db.prepare('SELECT * FROM businesses WHERE id = ?').bind(businessId).first();
    
    if (!business) return null;
    
    // Priority 1: Existing image in R2
    if (business.image_url && business.image_url.includes('kiamichibizconnect.com')) {
      const key = business.image_url.replace('https://kiamichibizconnect.com/images/', '');
      const obj = await this.env.BUSINESS_IMAGES.get(key);
      if (obj) {
        return { buffer: await obj.arrayBuffer(), source: 'r2' };
      }
    }
    
    // Priority 2: Facebook profile picture (if has page)
    if (business.facebook_page_id) {
      try {
        const fbUrl = `https://graph.facebook.com/${business.facebook_page_id}/picture?type=large&access_token=${this.env.FB_PAGE_ACCESS_TOKEN}`;
        const response = await fetch(fbUrl, { redirect: 'follow' });
        if (response.ok) {
          return { buffer: await response.arrayBuffer(), source: 'facebook' };
        }
      } catch (e) {
        console.warn('Failed to fetch Facebook image:', e);
      }
    }
    
    // Priority 3: Google Places photo (if has Google URL)
    if (business.google_business_url) {
      // Would need Places API integration
    }
    
    // Priority 4: Scrape from website
    if (business.website) {
      // Could use Puppeteer/Browser API for screenshot
    }
    
    return null;
  }
  
  /**
   * Step 2: Generate stylized image using Workers AI
   */
  async generateStylizedImage(
    sourceBuffer: ArrayBuffer,
    business: Business,
    style: string
  ): Promise<ArrayBuffer> {
    // Style-specific prompts
    const stylePrompts: Record<string, string> = {
      modern: `Modern, clean social media promotional image for ${business.name}. 
        Bright, professional lighting. Minimalist design with bold typography spaces.
        High contrast, saturated colors. Perfect for Facebook/Instagram.`,
      vintage: `Warm, nostalgic style image for ${business.name}.
        Soft lighting, muted earth tones. Classic Americana feel.
        Local business charm, authentic small-town vibe.`,
      bold: `Eye-catching, vibrant promotional image for ${business.name}.
        Bold colors, dynamic composition. High energy, attention-grabbing.
        Modern marketing style with space for text overlay.`,
      minimal: `Clean, minimalist image for ${business.name}.
        Lots of white space, subtle shadows. Professional, trustworthy feel.
        Simple yet elegant design.`,
      local: `Authentic local business image for ${business.name} in ${business.city}, Oklahoma.
        Genuine, approachable, community-focused. Natural lighting.
        Showcase the real people and place, not stock photography feel.`
    };
    
    // Use Workers AI image generation
    const prompt = stylePrompts[style] || stylePrompts.modern;
    
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('width', '1200');
    form.append('height', '630');  // Facebook optimal ratio
    
    const result = await this.env.AI.run('@cf/black-forest-labs/flux-2-dev', {
      prompt,
      width: 1200,
      height: 630
    });
    
    // If we have source image, could use img2img instead
    // Would need to check for img2img support in Workers AI
    
    return (result as any).image;
  }
  
  /**
   * Step 3: Store generated image in R2
   */
  async storeImage(
    imageBuffer: ArrayBuffer,
    businessId: number,
    metadata: Record<string, string>
  ): Promise<string> {
    const timestamp = Date.now();
    const key = `social/business-${businessId}-${timestamp}.png`;
    
    await this.env.IMAGES.put(key, imageBuffer, {
      httpMetadata: { contentType: 'image/png' },
      customMetadata: metadata
    });
    
    return `https://kiamichibizconnect.com/images/${key}`;
  }
  
  /**
   * Full pipeline execution
   */
  async generateBusinessImage(config: ImagePipelineConfig): Promise<string | null> {
    const db = this.env.DB;
    const business = await db.prepare('SELECT * FROM businesses WHERE id = ?')
      .bind(config.businessId).first() as Business;
    
    if (!business) return null;
    
    // Check for existing unused images
    const existing = await db.prepare(`
      SELECT * FROM social_media_images 
      WHERE business_id = ? AND is_approved = 1 AND usage_count < 3
      ORDER BY created_at DESC LIMIT 1
    `).bind(config.businessId).first();
    
    if (existing) {
      // Increment usage and return
      await db.prepare('UPDATE social_media_images SET usage_count = usage_count + 1 WHERE id = ?')
        .bind(existing.id).run();
      return `https://kiamichibizconnect.com/images/${existing.generated_image_key}`;
    }
    
    // Generate new image
    const source = await this.getSourceImage(config.businessId);
    const imageBuffer = await this.generateStylizedImage(
      source?.buffer || new ArrayBuffer(0),
      business,
      config.stylePreset
    );
    
    const imageUrl = await this.storeImage(imageBuffer, config.businessId, {
      business_id: config.businessId.toString(),
      business_name: business.name,
      style: config.stylePreset,
      platform: config.platform,
      generated_at: Date.now().toString()
    });
    
    // Store in DB
    const key = imageUrl.replace('https://kiamichibizconnect.com/images/', '');
    await db.prepare(`
      INSERT INTO social_media_images 
      (business_id, generated_image_key, style_preset, platform, model, is_approved)
      VALUES (?, ?, ?, ?, 'flux-2-dev', 1)
    `).bind(config.businessId, key, config.stylePreset, config.platform).run();
    
    return imageUrl;
  }
}
```

### Integration with Posting

```typescript
// Modify existing test-post endpoint to use pipeline

async function createHighlightPost(env: Env, businessId: number): Promise<void> {
  const pipeline = new BusinessImagePipeline(env);
  
  // Generate or get cached image
  const imageUrl = await pipeline.generateBusinessImage({
    businessId,
    sourceType: 'database',
    stylePreset: 'local',
    platform: 'facebook'
  });
  
  // Generate AI content
  const message = await generateBusinessSpotlightContent(env, businessId);
  
  // Post with image
  await officialPostToPage(env.FB_PAGE_ID, env.FB_PAGE_ACCESS_TOKEN, {
    message,
    imageUrl
  });
}
```

---

## Feature 4: Engagement Driving Posts

### Overview
Create interactive content designed to boost engagement: polls, questions, "This or That", local trivia, etc.

### Content Types

```typescript
// src/engagement-posts.ts

type EngagementPostType = 
  | 'poll'
  | 'question'
  | 'this_or_that'
  | 'trivia'
  | 'fill_blank'
  | 'recommendation_request'
  | 'throwback'
  | 'community_spotlight';

interface EngagementPost {
  type: EngagementPostType;
  content: string;
  options?: string[];  // For polls
  correctAnswer?: string;  // For trivia
  hashtags?: string[];
  callToAction: string;
}

const engagementTemplates: Record<EngagementPostType, () => EngagementPost> = {
  poll: () => ({
    type: 'poll',
    content: "Where's your favorite place to grab lunch in Kiamichi Country?",
    options: ['Local Diner', 'Food Truck', 'Home Cooking', 'Depends on the Day!'],
    callToAction: 'Vote below and tell us your go-to spot! 👇'
  }),
  
  question: () => ({
    type: 'question',
    content: "What's the one local business you couldn't live without?",
    callToAction: 'Tag them in the comments so we can feature them! 🏆'
  }),
  
  this_or_that: () => ({
    type: 'this_or_that',
    content: "Morning person or night owl? ☀️🌙\n\nReact 👍 for Morning\nReact ❤️ for Night",
    callToAction: "Either way, we've got local businesses ready to serve you!"
  }),
  
  trivia: () => ({
    type: 'trivia',
    content: "TRIVIA TIME! 🎯\n\nWhat year was Kiamichi Country first settled?",
    options: ['1820', '1850', '1880', '1900'],
    correctAnswer: '1850',
    callToAction: "Drop your guess below - winner gets featured in our next post!"
  }),
  
  fill_blank: () => ({
    type: 'fill_blank',
    content: "Fill in the blank:\n\nMy favorite thing about living in Southeast Oklahoma is _______",
    callToAction: "We love hearing what makes our community special! 💚"
  }),
  
  recommendation_request: () => ({
    type: 'recommendation_request',
    content: "HELP NEEDED! 🆘\n\nLooking for recommendations:\n• Best place for breakfast?\n• Most reliable mechanic?\n• Hidden gem restaurant?",
    callToAction: "Share your favorites below - you might help your neighbor find their new favorite spot!"
  }),
  
  throwback: () => ({
    type: 'throwback',
    content: "THROWBACK THURSDAY 📸\n\nRemember when [local landmark] looked like this?",
    callToAction: "Share your favorite local memories in the comments!"
  }),
  
  community_spotlight: () => ({
    type: 'community_spotlight',
    content: "COMMUNITY SHOUTOUT 📣\n\nKnow a local business owner going above and beyond?",
    callToAction: "Tag them here and tell us why they deserve recognition!"
  })
};
```

### AI-Enhanced Engagement Generation

```typescript
async function generateEngagementPost(env: Env): Promise<EngagementPost> {
  const db = env.DB;
  
  // Get local context
  const recentBusinesses = await db.prepare(`
    SELECT name, category_id FROM businesses 
    WHERE is_active = 1 ORDER BY created_at DESC LIMIT 5
  `).all();
  
  const categories = await db.prepare('SELECT * FROM categories').all();
  
  // Pick random engagement type weighted by day of week
  const dayOfWeek = new Date().getDay();
  const weightedTypes: EngagementPostType[] = [
    dayOfWeek === 0 ? 'community_spotlight' : 'question',  // Sunday
    dayOfWeek === 1 ? 'recommendation_request' : 'poll',   // Monday
    dayOfWeek === 2 ? 'trivia' : 'this_or_that',           // Tuesday
    dayOfWeek === 3 ? 'fill_blank' : 'question',           // Wednesday
    dayOfWeek === 4 ? 'throwback' : 'trivia',              // Thursday
    dayOfWeek === 5 ? 'poll' : 'recommendation_request',   // Friday
    dayOfWeek === 6 ? 'this_or_that' : 'community_spotlight' // Saturday
  ];
  
  const selectedType = weightedTypes[Math.floor(Math.random() * weightedTypes.length)];
  
  // Generate with AI for freshness
  const systemPrompt = `You create engaging social media posts for a local business directory in Southeast Oklahoma.
Your goal is maximum engagement - comments, reactions, shares.
Be warm, friendly, and authentically local. NO hashtags.
The area includes: Hugo, Idabel, Antlers, Poteau, McAlester, and surrounding towns.`;

  const userPrompt = `Create a ${selectedType} post for our Facebook page.
Recent categories we feature: ${categories.results.slice(0, 5).map((c: any) => c.name).join(', ')}
Keep it conversational and engaging. Include a clear call-to-action.`;

  const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 300,
    temperature: 0.9
  });
  
  return {
    type: selectedType,
    content: (aiResponse as any).response,
    callToAction: 'Join the conversation below! 👇'
  };
}
```

### Facebook Poll Integration

```typescript
// Using Graph API for native polls (Page only)
async function postPoll(
  pageId: string, 
  token: string, 
  question: string, 
  options: string[]
): Promise<any> {
  const params = new URLSearchParams({
    access_token: token,
    question,
    options: JSON.stringify(options.map(text => ({ text }))),
    allow_multiple: 'false'
  });
  
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}/feed`,
    { method: 'POST', body: params }
  );
  
  return response.json();
}
```

### Schedule
- **Engagement posts:** 2x per week (Tuesday & Saturday at 7 PM CST)
- **Separate from business spotlights to avoid content fatigue**

---

## Feature 5: Facebook Listing Requests via Comments/Messages

### Overview
Monitor Facebook comments and Messenger for business listing requests, creating a submission pipeline from social media.

### Database Changes

```sql
-- migrations/007_fb_submission_requests.sql

CREATE TABLE IF NOT EXISTS fb_submission_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,           -- 'comment', 'message', 'mention'
    source_id TEXT NOT NULL,             -- Facebook comment/message ID
    source_post_id TEXT,                 -- Original post ID (for comments)
    requester_fb_id TEXT,                -- Facebook user ID
    requester_name TEXT,
    raw_text TEXT NOT NULL,              -- Original message/comment text
    extracted_data TEXT,                 -- JSON: parsed business info
    status TEXT DEFAULT 'pending',       -- 'pending', 'processing', 'submitted', 'rejected', 'duplicate'
    business_submission_id INTEGER,      -- Link to business_submissions table
    analyzer_job_id TEXT,                -- Link to analyzer worker job
    admin_notes TEXT,
    responded_at INTEGER,
    response_text TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    processed_at INTEGER,
    FOREIGN KEY (business_submission_id) REFERENCES business_submissions(id)
);

CREATE INDEX IF NOT EXISTS idx_fb_requests_status ON fb_submission_requests(status);
CREATE INDEX IF NOT EXISTS idx_fb_requests_source ON fb_submission_requests(source_type, source_id);
```

### Comment Monitoring

```typescript
// src/submission-monitor.ts

interface SubmissionRequest {
  sourceType: 'comment' | 'message' | 'mention';
  sourceId: string;
  postId?: string;
  requesterId: string;
  requesterName: string;
  rawText: string;
}

const LISTING_REQUEST_PATTERNS = [
  /add\s+(my|our|a)\s+business/i,
  /list\s+(my|our|the)\s+(business|company|shop|store)/i,
  /how\s+(do|can)\s+(i|we)\s+(add|list|submit)/i,
  /want\s+to\s+be\s+listed/i,
  /please\s+add\s+us/i,
  /can\s+you\s+feature/i,
  /submit\s+(my|our|a)\s+business/i
];

async function monitorForSubmissionRequests(env: Env): Promise<void> {
  const db = env.DB;
  const token = env.FB_PAGE_ACCESS_TOKEN;
  const pageId = env.FB_PAGE_ID;
  
  // Get recent posts (last 24 hours)
  const yesterday = Math.floor(Date.now() / 1000) - 86400;
  
  const recentPosts = await db.prepare(`
    SELECT page_post_id FROM facebook_content_queue
    WHERE posted_at > ? AND page_post_id IS NOT NULL
  `).bind(yesterday).all();
  
  for (const post of recentPosts.results) {
    // Fetch comments from Graph API
    const commentsUrl = `https://graph.facebook.com/v18.0/${post.page_post_id}/comments?fields=id,from,message,created_time&access_token=${token}`;
    const response = await fetch(commentsUrl);
    const data = await response.json();
    
    if (!data.data) continue;
    
    for (const comment of data.data) {
      // Check if already processed
      const existing = await db.prepare(
        'SELECT id FROM fb_submission_requests WHERE source_id = ?'
      ).bind(comment.id).first();
      
      if (existing) continue;
      
      // Check for listing request patterns
      const isRequest = LISTING_REQUEST_PATTERNS.some(pattern => 
        pattern.test(comment.message)
      );
      
      if (isRequest) {
        // Extract any business info using AI
        const extracted = await extractBusinessInfo(env, comment.message);
        
        // Store request
        await db.prepare(`
          INSERT INTO fb_submission_requests 
          (source_type, source_id, source_post_id, requester_fb_id, requester_name, raw_text, extracted_data, status)
          VALUES ('comment', ?, ?, ?, ?, ?, ?, 'pending')
        `).bind(
          comment.id,
          post.page_post_id,
          comment.from?.id,
          comment.from?.name,
          comment.message,
          JSON.stringify(extracted)
        ).run();
        
        // Auto-respond with submission link
        await respondToSubmissionRequest(env, comment.id, comment.from?.name);
      }
    }
  }
}

async function extractBusinessInfo(env: Env, text: string): Promise<any> {
  const systemPrompt = `Extract business listing information from user messages.
Return JSON with: name, phone, email, address, city, category, website, description.
Return null for any field not found. Be conservative - only extract clear info.`;

  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Extract business info from: "${text}"` }
    ],
    max_tokens: 200
  });
  
  try {
    return JSON.parse((response as any).response);
  } catch {
    return {};
  }
}

async function respondToSubmissionRequest(
  env: Env, 
  commentId: string, 
  requesterName: string
): Promise<void> {
  const token = env.FB_PAGE_ACCESS_TOKEN;
  const submissionUrl = `${env.SITE_URL}/submit`;
  
  const response = `Hey ${requesterName}! 👋 Thanks for wanting to be listed on KiamichiBizConnect!

You can submit your business here: ${submissionUrl}

Or just reply to this comment with:
• Business name
• Phone number
• Address/City
• What you do

We'll get you set up! 🎉`;

  await fetch(
    `https://graph.facebook.com/v18.0/${commentId}/comments`,
    {
      method: 'POST',
      body: new URLSearchParams({
        message: response,
        access_token: token
      })
    }
  );
  
  // Update DB
  await env.DB.prepare(`
    UPDATE fb_submission_requests 
    SET responded_at = ?, response_text = ?
    WHERE source_id = ?
  `).bind(Math.floor(Date.now() / 1000), response, commentId).run();
}
```

### Messenger Integration (Webhooks)

```typescript
// Extend /webhooks/facebook endpoint

async function handleMessengerWebhook(env: Env, body: any): Promise<void> {
  const db = env.DB;
  
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      if (event.message?.text) {
        const text = event.message.text;
        const senderId = event.sender.id;
        
        // Check for listing request
        const isRequest = LISTING_REQUEST_PATTERNS.some(pattern => 
          pattern.test(text)
        );
        
        if (isRequest) {
          // Extract info
          const extracted = await extractBusinessInfo(env, text);
          
          // Store request
          await db.prepare(`
            INSERT INTO fb_submission_requests 
            (source_type, source_id, requester_fb_id, raw_text, extracted_data, status)
            VALUES ('message', ?, ?, ?, ?, 'pending')
          `).bind(
            event.message.mid,
            senderId,
            text,
            JSON.stringify(extracted)
          ).run();
          
          // Send response via Messenger
          await sendMessengerResponse(env, senderId);
        }
      }
    }
  }
}

async function sendMessengerResponse(env: Env, recipientId: string): Promise<void> {
  const token = env.FB_PAGE_ACCESS_TOKEN;
  
  await fetch(
    `https://graph.facebook.com/v18.0/me/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          text: "Thanks for reaching out! 🎉 I'd love to help get your business listed.",
          quick_replies: [
            {
              content_type: 'text',
              title: 'Submit Business',
              payload: 'SUBMIT_BUSINESS'
            },
            {
              content_type: 'text',
              title: 'Learn More',
              payload: 'LEARN_MORE'
            }
          ]
        },
        access_token: token
      })
    }
  );
}
```

---

## Feature 6: Analyzer Worker Integration

### Overview
Connect Facebook submission requests to the existing Analyzer Worker for AI-powered listing creation and enrichment.

### Service Binding Integration

```typescript
// src/analyzer-integration.ts

interface AnalyzerJobRequest {
  source: 'facebook_comment' | 'facebook_message' | 'manual';
  sourceId: string;
  extractedData: Record<string, any>;
  requesterInfo: {
    fbId?: string;
    name?: string;
    email?: string;
  };
}

interface AnalyzerJobResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  businessId?: number;
  suggestions?: any[];
  error?: string;
}

async function submitToAnalyzer(
  env: Env, 
  request: AnalyzerJobRequest
): Promise<AnalyzerJobResponse> {
  // Use service binding
  const analyzerResponse = await env.ANALYZER.fetch(
    new Request('https://analyzer/create-from-submission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
  );
  
  return analyzerResponse.json();
}

async function processSubmissionWithAnalyzer(
  env: Env, 
  submissionId: number
): Promise<void> {
  const db = env.DB;
  
  // Get submission
  const submission = await db.prepare(`
    SELECT * FROM fb_submission_requests WHERE id = ?
  `).bind(submissionId).first();
  
  if (!submission || submission.status !== 'pending') return;
  
  // Update status
  await db.prepare(`
    UPDATE fb_submission_requests SET status = 'processing' WHERE id = ?
  `).bind(submissionId).run();
  
  try {
    const extracted = JSON.parse(submission.extracted_data || '{}');
    
    // Submit to analyzer
    const result = await submitToAnalyzer(env, {
      source: submission.source_type as any,
      sourceId: submission.source_id,
      extractedData: extracted,
      requesterInfo: {
        fbId: submission.requester_fb_id,
        name: submission.requester_name
      }
    });
    
    // Update with job info
    await db.prepare(`
      UPDATE fb_submission_requests 
      SET analyzer_job_id = ?, 
          status = CASE WHEN ? = 'completed' THEN 'submitted' ELSE 'processing' END
      WHERE id = ?
    `).bind(result.jobId, result.status, submissionId).run();
    
    // If business was created, link it
    if (result.businessId) {
      await db.prepare(`
        UPDATE fb_submission_requests 
        SET business_submission_id = ?, status = 'submitted'
        WHERE id = ?
      `).bind(result.businessId, submissionId).run();
      
      // Notify requester
      if (submission.source_type === 'comment') {
        await notifySubmissionComplete(env, submission, result.businessId);
      }
    }
  } catch (error: any) {
    await db.prepare(`
      UPDATE fb_submission_requests 
      SET status = 'rejected', admin_notes = ?
      WHERE id = ?
    `).bind(error.message, submissionId).run();
  }
}
```

### Analyzer Worker Endpoint (Add to analyzer-worker)

```typescript
// workers/analyzer-worker/src/index.ts - Add endpoint

// ... existing code ...

if (path === '/create-from-submission' && request.method === 'POST') {
  const body = await request.json();
  
  // Validate extracted data
  if (!body.extractedData?.name) {
    return Response.json({
      error: 'Business name required',
      status: 'failed'
    }, { status: 400, headers: corsHeaders });
  }
  
  // Create preliminary business submission
  const submissionData = {
    name: body.extractedData.name,
    email: body.requesterInfo?.email || `fb-${body.requesterInfo?.fbId}@placeholder.local`,
    phone: body.extractedData.phone,
    description: body.extractedData.description,
    city: body.extractedData.city || 'Unknown',
    state: body.extractedData.state || 'OK',
    website: body.extractedData.website,
    submission_data: JSON.stringify({
      source: body.source,
      sourceId: body.sourceId,
      extractedData: body.extractedData,
      requesterInfo: body.requesterInfo
    }),
    status: 'pending'
  };
  
  // Insert submission
  const result = await env.DB.prepare(`
    INSERT INTO business_submissions 
    (name, email, phone, description, city, state, website, submission_data, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).bind(
    submissionData.name,
    submissionData.email,
    submissionData.phone,
    submissionData.description,
    submissionData.city,
    submissionData.state,
    submissionData.website,
    submissionData.submission_data,
    submissionData.status
  ).first();
  
  // Queue for enrichment analysis
  const jobId = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  // Trigger analysis (async)
  await analyzeBusiness({
    businessId: result.id,
    mode: 'manual'
  }, env);
  
  return Response.json({
    jobId,
    status: 'queued',
    submissionId: result.id
  }, { headers: corsHeaders });
}
```

---

## Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- [ ] Database migrations for all new tables
- [ ] Featured rotation system
- [ ] Update wrangler.toml with new cron schedules

### Phase 2: Content Pipeline (Week 3-4)
- [ ] Business highlight image pipeline
- [ ] Engagement post generator
- [ ] Daily featured list post system

### Phase 3: Social Listening (Week 5-6)
- [ ] Comment monitoring for submissions
- [ ] Messenger webhook integration
- [ ] AI extraction for business info

### Phase 4: Analyzer Integration (Week 7-8)
- [ ] Service binding setup
- [ ] Submission to analyzer workflow
- [ ] Notification system for completed submissions

### Phase 5: Testing & Polish (Week 9-10)
- [ ] End-to-end testing
- [ ] Rate limiting and error handling
- [ ] Admin dashboard updates
- [ ] Documentation

---

## Cron Schedule Summary

| Time (UTC) | Time (CST) | Action |
|------------|------------|--------|
| 0:00 | 6:00 PM | Featured rotation check |
| 2:00 | 8:00 PM | Analytics & enrichment |
| 3:00 | 9:00 PM | Evening post |
| 14:00 | 8:00 AM | Token refresh |
| 15:00 | 9:00 AM | Morning post |
| 16:00 | 10:00 AM | Featured list post (daily) |
| 22:00 | 4:00 PM | Afternoon post |
| 1:00 | 7:00 PM (Tue/Sat) | Engagement posts |

### Updated wrangler.toml

```toml
[triggers]
crons = [
  "0 0 * * *",      # Featured rotation (midnight UTC)
  "0 1 * * 2,6",    # Engagement posts (Tue/Sat 7PM CST)
  "0 2,14 * * *",   # Analytics & token refresh
  "0 3,15,22 * * *", # Regular posts
  "0 16 * * *"      # Featured list post
]
```

---

## Security Considerations

1. **Rate Limiting**: Implement per-user and global rate limits for comment/message processing
2. **Spam Detection**: AI-based spam filtering for submissions
3. **Token Security**: All FB tokens stored as Wrangler secrets
4. **Data Privacy**: GDPR-compliant data handling for FB user data
5. **Webhook Verification**: Validate Facebook webhook signatures

---

## Monitoring & Observability

1. **Metrics to Track**:
   - Posts per day (by type)
   - Engagement rates (likes, comments, shares)
   - Submission conversion rate
   - Image generation success rate
   - API error rates

2. **Alerts**:
   - Token expiration warnings
   - Posting failures
   - Rate limit warnings
   - Unusual submission patterns

---

## Files to Create/Modify

### New Files
- `src/featured-rotation.ts`
- `src/featured-list-generator.ts`
- `src/image-pipeline.ts`
- `src/engagement-posts.ts`
- `src/submission-monitor.ts`
- `src/analyzer-integration.ts`
- `migrations/004_featured_rotation.sql`
- `migrations/005_featured_list_posts.sql`
- `migrations/006_social_media_images.sql`
- `migrations/007_fb_submission_requests.sql`

### Modified Files
- `workers/facebook-worker/src/index.ts` - Add new endpoints and cron handlers
- `workers/facebook-worker/wrangler.toml` - Update cron triggers
- `workers/analyzer-worker/src/index.ts` - Add submission endpoint
- `src/types.ts` - Add new interfaces

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Prioritize features** based on impact vs. effort
3. **Create GitHub issues** for each feature
4. **Begin Phase 1** implementation

---

*Plan created by DevFlo | Ready for Flo's review and implementation*
