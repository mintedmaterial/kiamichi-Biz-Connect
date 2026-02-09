# AI Blog Generation System - KiamichiBizConnect

## Blog Categories

### 1. Business Spotlights
Individual features on businesses in our database. Generated per business.

**Example Topics:**
- "Spotlight: Velvet Fringe - Valliant's Premier Hair Salon"
- "Featured Business: Triple J Electrical Services"

### 2. Category Blogs (10 Categories)
Educational content for each business category:

1. **Home Services** - Plumbing, electrical, HVAC, contractors
2. **Beauty & Personal Care** - Salons, spas, barbershops
3. **Professional Services** - Legal, accounting, consulting
4. **Automotive** - Auto repair, detailing, sales
5. **Health & Wellness** - Medical, dental, fitness
6. **Food & Dining** - Restaurants, catering, bakeries
7. **Retail** - Stores, boutiques, shops
8. **Education & Training** - Schools, tutoring
9. **Entertainment & Events** - Event planning, photography
10. **Real Estate** - Realtors, property management

**Example Topics:**
- "Top 5 Questions to Ask Your Plumber in Southeast Oklahoma"
- "How to Choose the Right Hair Salon in the Kiamichi Region"
- "Small Business Accounting Tips for Oklahoma Entrepreneurs"

### 3. Service Area Blogs
Content about the regions we serve:

**Topics:**
- "Best Local Businesses in Valliant, OK"
- "Southeast Oklahoma Business Directory Guide"
- "Supporting Local: Why Shop in Durant, Hugo, and Broken Bow"

### 4. Business News & Tips
General business content:

**Topics:**
- "How to Get More Google Reviews for Your Local Business"
- "2025 Digital Marketing Trends for Small Businesses"
- "Why Your Business Needs to Be Listed on KiamichiBizConnect"

## AI Generation Prompts

### Business Spotlight Prompt Template
```
Write a 500-word blog post featuring [BUSINESS_NAME], a [CATEGORY] business located in [CITY], [STATE].

Business Details:
- Name: [BUSINESS_NAME]
- Rating: [RATING] stars ([REVIEW_COUNT] reviews)
- Services: [DESCRIPTION]
- Location: [ADDRESS]
- Website: [WEBSITE]

Include:
1. Opening paragraph highlighting what makes this business special
2. Services they offer
3. Why local customers love them (mention the rating and reviews)
4. How to contact them
5. Call-to-action encouraging readers to visit

Tone: Friendly, local, supportive of small businesses
Focus: 2025 relevant, highlight local community connections
SEO Keywords: [CITY] [CATEGORY], local business, [specific services]
```

### Category Blog Prompt Template
```
Write an 800-word educational blog post about [CATEGORY] services in Southeast Oklahoma, Northeast Texas, and Southwest Arkansas.

Include:
1. Introduction to [CATEGORY] services in the region
2. What to look for when choosing a [CATEGORY] provider
3. Common questions people have about [CATEGORY]
4. Why supporting local [CATEGORY] businesses matters
5. Featured local businesses from KiamichiBizConnect

Mention these businesses from our directory:
[LIST_OF_BUSINESSES_IN_CATEGORY]

Tone: Educational, helpful, community-focused
Focus: 2025 trends, local expertise, practical advice
SEO Keywords: [CATEGORY] Southeast Oklahoma, local [CATEGORY], [specific services]
```

### Service Area Prompt Template
```
Write a 600-word article about local businesses serving [CITY], [STATE] and the surrounding area.

Include:
1. Overview of the local business community in [CITY]
2. Economic importance of supporting local
3. Featured businesses in the area (from our database)
4. What makes [CITY] special for entrepreneurs
5. How to discover more local businesses on KiamichiBizConnect

Featured businesses in [CITY]:
[LIST_OF_BUSINESSES]

Tone: Community-proud, informative, encouraging
Focus: 2025 local economy, community support
SEO Keywords: [CITY] businesses, local shopping [CITY], support local
```

## Implementation in Admin Panel

Admin will have a "Blog Generator" section with:

1. **Quick Generate Options:**
   - Generate Business Spotlight (select from dropdown)
   - Generate Category Blog (select category)
   - Generate Service Area Article (select city)
   - Generate Business Tips Article

2. **Custom Prompt:**
   - Free-form text area for custom blog topics
   - AI will generate based on admin's specific request

3. **Preview & Edit:**
   - See generated blog before publishing
   - Edit title, content, excerpt
   - Set featured image URL
   - Select associated business (optional)
   - Publish or save as draft

4. **Blog Management:**
   - View all blogs (published & drafts)
   - Edit existing blogs
   - Delete blogs
   - Toggle publish status

## Database: blog_posts Table (Already Exists)

```sql
CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER,                    -- Optional: link to specific business
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    excerpt TEXT,
    featured_image TEXT,
    author TEXT DEFAULT 'KiamichiBizConnect',
    is_published BOOLEAN DEFAULT 0,
    publish_date INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id)
);
```

## Workers AI Integration

We use Cloudflare Workers AI (already available via `env.AI`) with these models:

### Text Generation
- **@cf/meta/llama-3-8b-instruct** - For blog content generation
- Generates 600-1200 word SEO-optimized blog posts
- Structured prompts for different blog types

### Image Generation (NEW - IMPLEMENTED)
- **@cf/black-forest-labs/flux-2-dev** - For AI-generated blog images
- Generates 3 candidate images per blog post (1024x1024 PNG)
- Intelligent keyword extraction from blog content
- Images stored in R2 bucket and served via `/images/blog/*`
- Admin approval workflow - select 1 image, delete the other 2

### Smart Image Logic
- **Business Spotlight blogs**: Reuses existing business image if available (no generation)
- **Category blogs**: Attempts to use featured business image from that category
- **Business Tips & Service Area blogs**: Always generates AI images
- Custom prompts influence both content and image generation

Generate blogs with structured prompts and store in database.

## SEO Optimization

Each blog will include:
- Title optimized for search (includes location + category)
- Meta description (excerpt)
- Internal links to businesses
- Location keywords (Southeast Oklahoma, etc.)
- Category keywords
- 2025 relevance

## Publishing Workflow

1. Admin selects blog type to generate
2. AI generates draft content
3. Admin reviews and edits
4. Admin publishes
5. Blog appears on /blog page
6. Individual blog pages at /blog/[slug]

## Benefits

- **SEO Traffic:** Rank for local business searches
- **Business Value:** Feature businesses = premium service opportunity
- **Content Marketing:** Regular fresh content
- **Community Building:** Highlight local economy
- **Revenue:** Charge businesses for featured spots in blogs
- **Visual Appeal:** AI-generated images make blogs more engaging
- **Cost Savings:** No need to source or purchase stock photos

---

## Implementation Details (COMPLETED)

### Independent Blog Worker
**File**: `src/workers/blogWorker.ts`

The blog generation system has been refactored into an independent worker module that can be called from the admin panel or triggered via cron jobs.

**Key Features:**
- Modular architecture similar to `facebookWorker.ts`
- Generates blog content using Llama 3 8B
- Generates 3 AI images using Flux 2 Dev model
- Intelligent image reuse for business spotlights
- Custom prompt support for fine-tuned control
- Saves blogs as drafts for admin approval

**Function Signature:**
```typescript
export async function runBlogWorker(
  env: Env,
  db: DatabaseService,
  request: BlogGenerationRequest
): Promise<BlogGenerationResult>
```

**Blog Generation Request:**
```typescript
interface BlogGenerationRequest {
  type: 'business_spotlight' | 'category' | 'service_area' | 'business_tips';
  business_id?: number;
  category_id?: number;
  city?: string;
  topic?: string;
  customPrompt?: string; // Optional guidance for AI
}
```

### Database Schema (blog_images table)
**File**: `schema.sql`

New table for managing AI-generated candidate images:

```sql
CREATE TABLE IF NOT EXISTS blog_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blog_post_id INTEGER NOT NULL,
    image_key TEXT NOT NULL,           -- R2 storage key
    image_prompt TEXT,                 -- AI prompt used
    display_order INTEGER DEFAULT 0,   -- 1, 2, 3
    is_approved BOOLEAN DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
);
```

### Admin Panel Updates
**File**: `src/admin.ts`

**New Features:**
1. **Custom Prompt Field**: Added textarea for optional AI guidance
2. **Image Approval UI**: Shows 3 candidate images in blog editor
3. **Approve/Delete Actions**: Admin can select winning image
4. **R2 Image Serving**: `/images/blog/*` endpoint serves images

**New API Endpoints:**
- `POST /admin?action=generate-blog` - Calls blog worker
- `GET /admin?action=blog-images&id=X` - Get candidate images
- `POST /admin?action=approve-blog-image&blog_id=X&image_id=Y` - Approve image
- `POST /admin?action=delete-blog-image&image_id=X` - Delete image

**Workflow:**
1. Admin selects blog type and fills optional custom prompt
2. Clicks "Generate Blog Post with AI Images"
3. Worker generates content + 3 images (or reuses business image)
4. Blog saved as draft with candidate images
5. Admin edits blog in management page
6. Admin sees 3 image candidates and clicks "Approve" on one
7. Approved image becomes featured_image, others deleted from R2
8. Admin publishes blog

### Image Generation Strategy

**Keyword Extraction:**
- Uses Llama 3 8B to analyze blog title and content
- Generates 3 diverse image prompts:
  1. Scenic Oklahoma landscape
  2. Professional tradesman/business scene
  3. Storefront or community scene
- Falls back to default prompts if AI extraction fails

**Flux 2 Dev Integration:**
- Model ID: `@cf/black-forest-labs/flux-2-dev`
- Parameters: 1024x1024, 25 steps
- Output: Base64 encoded PNG
- Uploaded to R2: `blog/{slug}-{timestamp}-{index}.png`

**Smart Reuse Logic:**
```typescript
// Business spotlight - reuse business image
if (type === 'business_spotlight' && business.image_url) {
  featured_image = business.image_url;
  // Skip image generation
}

// Category - try to use featured business image
if (type === 'category' && categoryBusiness.image_url) {
  featured_image = categoryBusiness.image_url;
  // Skip image generation
}

// Otherwise - generate 3 images
```

### Future Enhancements

**MCP Tool for Blog Generation Agent (Planned):**
Add Model Context Protocol (MCP) tool integration to enhance blog quality through web search capabilities:

**Capabilities:**
1. **Web Search for Verification** - Look up current facts, statistics, and data to verify information before including in blogs
2. **Research New Information** - Search for recent developments, news, or trends related to the blog topic
3. **Resource Discovery** - Find authoritative external links, studies, or resources to include as citations
4. **Local Data Enrichment** - Search for local Oklahoma news, events, or data relevant to service areas

**Implementation Notes:**
- The blog generation agent would call an MCP tool before finalizing content
- Tool would search web for: `[blog topic] + [location] + [current year]`
- Results would be fed back to the AI to enrich the blog with current, factual information
- Especially useful for business tips, category guides, and service area content
- Would significantly improve EEAT (Experience, Expertise, Authoritativeness, Trustworthiness) signals

**Example Use Case:**
When generating "Complete Guide to Home Services in Southeast Oklahoma 2025", the MCP tool would:
- Search for "Oklahoma contractor licensing requirements 2025"
- Find current average costs for services in the region
- Discover recent local construction/permit trends
- Include links to Oklahoma State resources and official sites

This would transform AI-generated content from generic to highly localized, current, and authoritative.

---

**Cron/Workflow Automation (Optional):**
To enable automated blog generation:

1. Add to `wrangler.toml`:
```toml
[[triggers.crons]]
cron = "0 2 * * *"  # Daily at 2 AM UTC
```

2. Update `src/index.ts`:
```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    const db = new DatabaseService(env.DB);
    // Auto-generate daily blog
    await runBlogWorker(env, db, {
      type: 'business_tips',
      topic: 'Daily business tip',
      customPrompt: 'Focus on seasonal Oklahoma business trends'
    });
  },
  async fetch(request: Request, env: Env) {
    // ... existing code
  }
}
```

**Cloudflare Workflows Integration:**
For advanced orchestration, consider using [Cloudflare Workflows](https://developers.cloudflare.com/workflows/) to:
- Schedule blog generation with retry logic
- Wait for admin approval before publishing
- Chain multiple blog generations
- Coordinate with other workers (Facebook posting, etc.)

Example workflow:
```typescript
import { WorkflowEntrypoint } from 'cloudflare:workers';

export class BlogGenerationWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    // Step 1: Generate blog
    const blog = await step.do('generate', async () => {
      return await runBlogWorker(this.env, db, params);
    });

    // Step 2: Wait for approval event
    const approval = await step.waitForEvent('blog:approved', {
      timeout: '7d'
    });

    // Step 3: Publish and share to Facebook
    await step.do('publish', async () => {
      await publishBlog(blog.blog_id);
      await runFacebookWorker(this.env, db);
    });
  }
}
```




## Advanced SEO Optimization Strategy

### 1. Expanded SEO Strategy: Deep Keyword Research & Topic Clustering

Your current plan focuses on short-tail keywords (e.g., Plumber Southeast Oklahoma). For optimal SEO, you must target long-tail, high-intent queries.

| Action | SEO Benefit | Implementation Note |
|--------|-------------|---------------------|
| **Integrate Long-Tail Keyword Strategy** | Ranks for specific, less competitive, high-conversion queries | Every AI prompt must target 2-3 specific long-tail keywords (e.g., "Emergency HVAC repair cost Broken Bow OK", "Small business payroll software review Kiamichi") |
| **Formalize the Hub & Spoke Model** | Establishes site authority and topical depth in Google's eyes | Hubs: The 10 Category Blogs (e.g., Home Services). Spokes: All related Business Spotlights, Service Area, and Tips blogs link back to the Hub |
| **Competitor Content Analysis** | Identifies content gaps and opportunities based on what is already ranking in your region | Add an initial research step: Before generating a Category Blog, manually check the SERP for your target keyword to see the average word count, H-tag structure, and topics covered by the top 3 results |
| **Add "Problem/Solution" Categories** | Captures users in the "I need help now" stage | New Category Idea: Local Crisis & Solutions (e.g., "What to Do When Your AC Goes Out in a Valliant Summer," "Navigating a Small Business Lawsuit in Oklahoma") |

### 2. Enhanced AI Prompt Templates for EEAT & Structure

The AI is a tool; better prompts lead to better-ranking content. The goal is to force the AI to produce content that signals EEAT (Experience, Expertise, Authoritativeness, Trustworthiness) and is ready for Google's index.

#### A. Business Spotlight Prompt Template Expansion (EEAT & Structured Data)

| Prompt Addition | Goal |
|----------------|------|
| **Expertise Simulation** | Add a section: "Quote a unique, insightful piece of advice from the business owner regarding their industry trend or service in the [CITY] area." (Simulates Expertise) |
| **Local Data & Specificity** | "Include a specific, localized detail about their service that is only relevant to [CITY] (e.g., 'They handle the unique red-clay plumbing issues common in Southeast Oklahoma')" |
| **Structured Data Hook** | "Format the contact information section with clear headings for Name, Address, Phone Number (NAP), and Website." (Prepares for LocalBusiness Schema) |
| **Internal Linking Mandate** | "Include a linked sentence to the relevant Category Hub Blog (e.g., link 'Valliant's Premier Hair Salon' to the 'Beauty & Personal Care' Category Blog)" |

#### B. Category Blog Prompt Template Expansion (Depth & H-Tags)

| Prompt Addition | Goal |
|----------------|------|
| **Mandate H-Tag Structure** | "Use a minimum of 4 H2 headings and 8 H3 subheadings for optimal scanability and SEO" |
| **FAQ Generation** | "Generate a list of 5 common questions about [CATEGORY] services that could be used in an FAQ section, providing clear, concise answers." (Prepares for FAQPage Schema) |
| **Increase Depth** | "Target a word count of 1200+ words for competitive categories (Home Services, Health & Wellness) to build topical authority" |
| **Featured Business Diversity** | "Ensure the featured businesses mentioned are from at least 3 different towns within the service area (e.g., Valliant, Broken Bow, Hugo)" |

#### C. Service Area Prompt Template Expansion (Location Density)

| Prompt Addition | Goal |
|----------------|------|
| **Micro-Location Keywords** | "Naturally integrate 3-5 nearby neighborhoods/landmarks into the text to expand the geographic relevance beyond just the main [CITY]." (e.g., mentioning Hochatown near Broken Bow) |
| **Local Event Tie-in** | "Tie the business community's support to a recent or upcoming local event or community fixture." (Increases relevance and timeliness) |
| **Internal Linking Mandate** | "Include links to 2-3 Business Spotlights within that specific [CITY]" |

### 3. Technical SEO & On-Page Optimization (Admin Panel Workflow)

This stage ensures the technical execution supports the content strategy.

| Feature Expansion | SEO Benefit | Database/Admin Implementation |
|------------------|-------------|-------------------------------|
| **Structured Data Generation** | Eligibility for Rich Snippets (e.g., stars, FAQ dropdowns) = Higher Click-Through Rate (CTR) | Admin Panel: Add a field to the "Preview & Edit" section to automatically generate and display a JSON-LD code block (LocalBusiness, FAQPage, or HowTo Schema) based on the content structure. Admin confirms before publish |
| **Alt-Text Mandate** | Improves image search ranking and accessibility (WCAG) | Admin Panel: Make the featured_image field require an alt_text field. Prompt the AI to suggest a descriptive alt_text based on the title/topic |
| **Automatic Table of Contents (TOC)** | Improves UX, scanability, and generates internal jump links for Google to index | Publishing Workflow: Implement a front-end script that automatically generates a clickable TOC based on H2/H3 tags for all blogs over 700 words |
| **Canonical URL Check** | Prevents duplicate content issues (critical if you use the AI to generate very similar city-specific content) | Admin Panel/Database: Implement a basic check to suggest a canonical URL if the AI-generated content is highly similar to a previous post |
| **Video/Media Placeholder** | Adds a rich media layer often favored by Google | Prompt Addition: "Suggest a related video topic (e.g., a service demo) that could be embedded here." The admin can then use this to manually source and embed a relevant YouTube video/iframe |

### 4. Monetization & Value Expansion

By providing higher-quality, SEO-optimized content, you can justify premium pricing.

| New Offering | Monetization & Value |
|--------------|---------------------|
| **"EEAT-Optimized" Spotlight** | Charge a premium for a Spotlight where the owner provides an exclusive quote or industry tip (fulfills the Expertise Simulation prompt) |
| **Category Hub Sponsorship** | Charge a higher tier for a business to be the solely featured sponsor/business in a highly-competitive Category Blog (e.g., "The Official [Plumber Name] Guide to Home Services") |
| **Custom Schema Integration** | Offer a service where you guarantee their Business Spotlight includes the validated LocalBusiness Schema (a technical service you can charge for) |
| **In-Content Call-to-Action (CTA)** | For sponsored posts, include a unique, trackable CTA tailored to that business's offer, tracking clicks to prove ROI (e.g., "Click here for 10% off your first consult, exclusive to KiamichiBizConnect readers") |