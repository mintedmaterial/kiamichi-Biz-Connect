# AI Business Analyzer Agent - Implementation Plan

## Overview

Create a Cloudflare Agent that uses MCP (Model Context Protocol) tools to intelligently analyze, enrich, and improve business listings by searching the web for factual information.

**Agent Name**: `kiamichi-biz-ai-analyzer`

---

## Goals

1. **Automated Enrichment**: Continuously analyze new business listings via cron
2. **On-Demand Analysis**: Admin can manually trigger analysis for specific businesses
3. **Web Intelligence**: Use MCP tools to browse the web and gather factual data
4. **Comprehensive Profiles**: Enrich listings with hours, photos, services, reviews, contact info
5. **Quality Scoring**: Assess completeness and suggest improvements

---

## Architecture

### Cloudflare Agent Structure

```
kiamichi-biz-ai-analyzer/
├── src/
│   ├── index.ts              # Main agent entry point
│   ├── agent.ts              # Agent configuration & orchestration
│   ├── tools/
│   │   ├── webBrowse.ts      # MCP web browsing tool
│   │   ├── imageSearch.ts    # Find business photos
│   │   ├── hoursExtractor.ts # Extract business hours
│   │   └── reviewAggregator.ts # Aggregate review data
│   ├── analyzers/
│   │   ├── completeness.ts   # Score profile completeness
│   │   ├── enrichment.ts     # Suggest enrichments
│   │   └── validation.ts     # Validate data accuracy
│   └── database.ts           # Database operations
├── wrangler.toml             # Worker configuration
└── package.json
```

---

## MCP Tools Integration

### 1. Web Browse Tool
**Purpose**: Search the web for business information

```typescript
{
  name: "browse_web",
  description: "Search the web for information about a business",
  parameters: {
    query: string,        // e.g., "Velvet Fringe Valliant OK hours"
    maxResults: number    // Limit results
  }
}
```

**Use Cases**:
- Find official website
- Discover social media profiles
- Extract business hours
- Find customer reviews
- Locate photos

### 2. Image Search Tool
**Purpose**: Find high-quality photos of the business

```typescript
{
  name: "search_images",
  description: "Find photos of the business location, logo, or services",
  parameters: {
    businessName: string,
    location: string,
    imageType: "logo" | "storefront" | "interior" | "product"
  }
}
```

### 3. Schema Extraction Tool
**Purpose**: Extract structured data from websites

```typescript
{
  name: "extract_schema",
  description: "Extract LocalBusiness schema from a website",
  parameters: {
    url: string  // Business website URL
  }
}
```

---

## Agent Capabilities

### Analysis Workflow

```
1. Fetch Business Data
   ↓
2. Assess Completeness (0-100 score)
   ↓
3. Identify Missing Fields
   ↓
4. Use MCP Tools to Find Data
   ↓
5. Validate & Score Findings
   ↓
6. Generate Enrichment Suggestions
   ↓
7. Store Analysis Results
   ↓
8. (Optional) Auto-apply high-confidence data
```

### Completeness Score

**Scoring Formula** (0-100):
- Basic Info (30 points): name, address, phone, category
- Contact (20 points): website, email, social media
- Media (20 points): logo, cover photo, additional images
- Details (20 points): hours, description, services
- Social Proof (10 points): reviews, ratings

### Enrichment Categories

| Category | Data Points | MCP Tool |
|----------|-------------|----------|
| **Contact** | Phone, email, website | browse_web |
| **Hours** | Operating hours, holidays | browse_web + extract_schema |
| **Photos** | Logo, storefront, interior | search_images |
| **Services** | Service list, pricing | browse_web |
| **Reviews** | Google, Facebook, Yelp | browse_web |
| **Social** | Facebook, Instagram, Twitter | browse_web |
| **Location** | GPS coordinates, parking | browse_web + maps API |

---

## Database Schema

### `business_analysis` Table

```sql
CREATE TABLE IF NOT EXISTS business_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    completeness_score INTEGER DEFAULT 0,
    missing_fields TEXT,              -- JSON array of missing fields
    suggestions TEXT,                 -- JSON array of suggestions
    found_data TEXT,                  -- JSON object of discovered data
    confidence_scores TEXT,           -- JSON object of confidence per field
    analysis_date INTEGER DEFAULT (unixepoch()),
    analyzer_version TEXT DEFAULT 'v1.0',
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_business_analysis_business ON business_analysis(business_id);
CREATE INDEX IF NOT EXISTS idx_business_analysis_score ON business_analysis(completeness_score);
```

### `enrichment_queue` Table

```sql
CREATE TABLE IF NOT EXISTS enrichment_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    priority INTEGER DEFAULT 5,       -- 1-10 (10 = highest)
    status TEXT DEFAULT 'pending',    -- pending, processing, completed, failed
    scheduled_at INTEGER DEFAULT (unixepoch()),
    started_at INTEGER,
    completed_at INTEGER,
    error_message TEXT,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON enrichment_queue(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_priority ON enrichment_queue(priority DESC);
```

### `enrichment_suggestions` Table

```sql
CREATE TABLE IF NOT EXISTS enrichment_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,         -- e.g., "hours", "logo_url", "description"
    current_value TEXT,
    suggested_value TEXT,
    confidence REAL,                  -- 0.0 - 1.0
    source_url TEXT,                  -- Where data was found
    status TEXT DEFAULT 'pending',    -- pending, approved, rejected
    created_at INTEGER DEFAULT (unixepoch()),
    reviewed_at INTEGER,
    reviewed_by TEXT,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enrichment_suggestions_business ON enrichment_suggestions(business_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_suggestions_status ON enrichment_suggestions(status);
```

---

## Agent Implementation

### Main Agent Configuration

```typescript
import { Agent } from '@cloudflare/agents';

export class BusinessAnalyzerAgent extends Agent {
  name = "BusinessAnalyzer";
  description = "Analyzes and enriches business listings using web intelligence";

  tools = [
    {
      name: "browse_web",
      description: "Search the web for business information",
      execute: this.browseWeb.bind(this)
    },
    {
      name: "extract_hours",
      description: "Extract business hours from web content",
      execute: this.extractHours.bind(this)
    },
    {
      name: "find_images",
      description: "Find business photos on the web",
      execute: this.findImages.bind(this)
    },
    {
      name: "validate_data",
      description: "Validate and score data quality",
      execute: this.validateData.bind(this)
    }
  ];

  async run(businessId: number) {
    // Fetch business data
    const business = await this.getBusiness(businessId);

    // Analyze completeness
    const completeness = await this.analyzeCompleteness(business);

    // Generate enrichment plan
    const plan = await this.generateEnrichmentPlan(business, completeness);

    // Execute plan using MCP tools
    const enrichments = await this.executeEnrichmentPlan(plan);

    // Store results
    await this.storeAnalysis(businessId, enrichments);

    return enrichments;
  }
}
```

---

## Cron Configuration

### `wrangler.toml` for Agent Worker

```toml
name = "kiamichi-biz-ai-analyzer"
main = "src/index.ts"
compatibility_date = "2024-12-09"

# Analyze new businesses daily at 2 AM
[[triggers.crons]]
cron = "0 2 * * *"

# Re-analyze low-scoring businesses weekly
[[triggers.crons]]
cron = "0 3 * * 0"

# Bindings
[[d1_databases]]
binding = "DB"
database_name = "kiamichi-biz-connect-db"
database_id = "e8b7b17a-a93b-4b61-92ad-80b488266e12"

[ai]
binding = "AI"

[vars]
MAIN_WORKER_URL = "https://kiamichibizconnect.com"
```

### Cron Handler

```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    const db = new DatabaseService(env.DB);

    // Get businesses needing analysis
    const businesses = await db.getBusinessesForAnalysis({
      limit: 50,
      prioritize: 'new_or_incomplete'
    });

    const agent = new BusinessAnalyzerAgent(env);

    for (const business of businesses) {
      try {
        await agent.run(business.id);
      } catch (error) {
        console.error(`Failed to analyze business ${business.id}:`, error);
      }
    }
  }
}
```

---

## Admin Dashboard Integration

### New Admin Panel Features

1. **Business Analysis Dashboard**
   - View completeness scores for all businesses
   - See pending enrichment suggestions
   - One-click approve/reject suggestions

2. **Manual Trigger**
   - "Analyze Business" button on each business listing
   - Real-time progress updates via SSE
   - Display analysis results

3. **Enrichment Review Interface**
   - Side-by-side comparison (current vs suggested)
   - Confidence score display
   - Source attribution
   - Bulk approve/reject

### API Endpoints

```typescript
// Trigger manual analysis
POST /api/analyze-business
Body: { businessId: number }
Response: { jobId: string, status: 'queued' }

// Get analysis status (SSE)
GET /api/analyze-business/:jobId/status
Response: text/event-stream

// Get analysis results
GET /api/business-analysis/:businessId
Response: { score, suggestions, foundData }

// Approve suggestion
POST /api/enrichment-suggestion/:id/approve
Response: { success: boolean }

// Reject suggestion
POST /api/enrichment-suggestion/:id/reject
Response: { success: boolean }

// Get enrichment queue
GET /api/enrichment-queue
Response: { queue: [...] }
```

---

## Example Analysis Flow

### Input: Incomplete Business

```json
{
  "id": 123,
  "name": "Velvet Fringe",
  "city": "Valliant",
  "state": "OK",
  "phone": null,
  "website": null,
  "hours": null,
  "logo_url": null
}
```

### Agent Processing

1. **Completeness Analysis**:
   - Score: 30/100
   - Missing: phone, website, hours, logo, photos

2. **Web Search** (MCP browse_web):
   ```
   Query: "Velvet Fringe Valliant Oklahoma"
   Results:
   - Facebook: facebook.com/velvetfringevalliant
   - Website: velvetfringesalon.com (hypothetical)
   - Hours: Found on Facebook "Tue-Sat 9am-6pm"
   ```

3. **Image Search** (MCP search_images):
   ```
   Query: "Velvet Fringe Valliant storefront"
   Results:
   - Logo from Facebook profile
   - Storefront from Google Street View
   ```

4. **Data Extraction**:
   - Extract phone from website
   - Extract hours from multiple sources
   - Download and upload images to R2

### Output: Enrichment Suggestions

```json
{
  "businessId": 123,
  "completenessScore": 30,
  "suggestions": [
    {
      "field": "phone",
      "currentValue": null,
      "suggestedValue": "(580) 933-7777",
      "confidence": 0.95,
      "source": "https://velvetfringesalon.com/contact"
    },
    {
      "field": "hours",
      "currentValue": null,
      "suggestedValue": "Tue-Sat: 9:00 AM - 6:00 PM, Sun-Mon: Closed",
      "confidence": 0.90,
      "source": "https://facebook.com/velvetfringevalliant"
    },
    {
      "field": "logo_url",
      "currentValue": null,
      "suggestedValue": "https://r2.../velvet-fringe-logo.jpg",
      "confidence": 0.85,
      "source": "Facebook profile picture"
    }
  ]
}
```

---

## Safety & Quality Controls

### Data Validation

1. **Confidence Thresholds**:
   - Auto-apply: confidence > 0.95
   - Suggest for review: 0.7 - 0.95
   - Discard: < 0.7

2. **Cross-Verification**:
   - Verify data from multiple sources
   - Flag conflicting information
   - Prefer official sources (website > social media > directories)

3. **Human Review Required**:
   - Contact information changes
   - Business hours
   - Pricing information
   - Legal/compliance data

### Rate Limiting

- Max 10 web searches per business
- 2-second delay between searches
- Respect robots.txt
- Cache search results for 7 days

---

## Phase 1: MVP Features

**Week 1-2 Implementation:**

1. ✅ Basic agent structure
2. ✅ Completeness scoring
3. ✅ Web browsing MCP tool
4. ✅ Simple enrichment suggestions
5. ✅ Admin dashboard integration
6. ✅ Manual trigger from admin panel

**Deferred to Phase 2:**
- Image search tool
- Auto-approval for high-confidence data
- Sophisticated validation
- Cron automation
- Batch processing

---

## Success Metrics

- **Coverage**: % of businesses with completeness score > 80
- **Accuracy**: % of auto-applied enrichments that are correct
- **Efficiency**: Time to enrich a business (target: < 2 minutes)
- **Value**: Increase in user engagement with enriched listings

---

## Next Steps

1. Create `kiamichi-biz-ai-analyzer` worker
2. Implement basic agent with browse_web MCP tool
3. Add database schema for analysis tracking
4. Create admin panel "Analyze Business" button
5. Test with 5-10 businesses manually
6. Iterate based on results
7. Add cron automation

---

## References

- Cloudflare Agents: https://developers.cloudflare.com/agents/
- MCP Protocol: https://modelcontextprotocol.io/
- Browse Web Tool: https://developers.cloudflare.com/agents/api-reference/browse-the-web/
- HTTP SSE: https://developers.cloudflare.com/agents/api-reference/http-sse/
- MCP Tools: https://developers.cloudflare.com/agents/model-context-protocol/tools/
