# Component Rendering System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Business Listing Page Request                │
│                    GET /page/mountain-coffee                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker Handler                    │
│                    (business-agent worker)                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PageAssembler                             │
│  • Orchestrates the full page assembly process                 │
│  • Fetches business data and components from D1                │
│  • Coordinates rendering of all components                     │
└────┬───────────────────────┬────────────────────┬───────────────┘
     │                       │                    │
     │                       │                    │
     ▼                       ▼                    ▼
┌─────────────┐    ┌──────────────────┐   ┌─────────────────┐
│  D1 Database│    │  TemplateLoader  │   │ComponentRenderer│
│             │    │                  │   │                 │
│ • businesses│    │ • Loads templates│   │ • Handlebars    │
│ • pages     │    │   from R2        │   │   rendering     │
│ • components│    │ • Caches in      │   │ • Data merge    │
│             │    │   memory         │   │ • CSS scoping   │
└─────────────┘    └────────┬─────────┘   └─────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │    R2 Bucket    │
                   │                 │
                   │  hero-modern    │
                   │  .json          │
                   │  footer-std     │
                   │  .json          │
                   │  contact-form   │
                   │  .json          │
                   └─────────────────┘
```

## Component Rendering Flow

```
1. Client Request
   │
   ├─→ GET /page/mountain-coffee
   │
   └─→ Worker receives request

2. Business Lookup
   │
   ├─→ Query D1: SELECT * FROM businesses WHERE slug = 'mountain-coffee'
   │
   └─→ Find listing_page_id

3. Component Fetch
   │
   ├─→ Query D1: SELECT * FROM page_components
   │            WHERE listing_page_id = ? AND is_visible = 1
   │            ORDER BY display_order
   │
   └─→ Get components: [hero, about, contact, footer]

4. Template Loading (for each component)
   │
   ├─→ Check in-memory cache
   │   ├─→ HIT: Return cached template (< 1ms)
   │   └─→ MISS: Load from R2 (~ 50ms)
   │
   ├─→ R2.get('hero-modern.json')
   │
   └─→ Cache template in memory

5. Component Rendering (for each component)
   │
   ├─→ Merge default_content + component.content
   │
   ├─→ Inject business data (name, phone, etc.)
   │
   ├─→ Compile Handlebars template
   │
   ├─→ Render HTML + CSS
   │
   └─→ Scope CSS with data-component attribute

6. Page Assembly
   │
   ├─→ Combine all rendered HTML
   │
   ├─→ Combine all scoped CSS
   │
   ├─→ Generate meta tags (title, description, OG)
   │
   ├─→ Build complete HTML document
   │
   └─→ Add preview banner if in preview mode

7. Response
   │
   └─→ Return HTML to client
       Content-Type: text/html
       Cache-Control: public, max-age=3600
```

## Data Flow Example

### Input: Component from Database

```json
{
  "id": "comp-hero-123",
  "listing_page_id": "page-456",
  "component_type": "hero",
  "style_variant": "modern",
  "display_order": 1,
  "is_visible": true,
  "content": {
    "heading": "Fresh Coffee Daily",
    "subheading": "Roasted in the mountains"
  }
}
```

### Step 1: Load Template from R2

```json
{
  "component_type": "hero",
  "variant": "modern",
  "html_template": "<section class='hero'><h1>{{heading}}</h1><p>{{subheading}}</p><p>{{business_phone}}</p></section>",
  "css_template": ".hero { background: {{bg_color}}; padding: 4rem; }",
  "default_content": {
    "heading": "Welcome",
    "subheading": "Default tagline",
    "bg_color": "#1a202c"
  }
}
```

### Step 2: Merge Content

```javascript
{
  heading: "Fresh Coffee Daily",        // from component.content
  subheading: "Roasted in the mountains", // from component.content
  bg_color: "#1a202c",                  // from default_content
  business_name: "Mountain Coffee",     // from business data
  business_phone: "(555) 123-4567",     // from business data
  // ... other business fields
}
```

### Step 3: Render with Handlebars

**HTML Output:**
```html
<section data-component='comp-hero-123' class='hero'>
  <h1>Fresh Coffee Daily</h1>
  <p>Roasted in the mountains</p>
  <p>(555) 123-4567</p>
</section>
```

**CSS Output (scoped):**
```css
[data-component='comp-hero-123'] .hero {
  background: #1a202c;
  padding: 4rem;
}
```

### Step 4: Final HTML Page

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mountain Coffee</title>
  <meta name="description" content="Locally roasted artisan coffee">

  <!-- Open Graph -->
  <meta property="og:title" content="Mountain Coffee">
  <meta property="og:description" content="Locally roasted artisan coffee">

  <style>
    /* Reset */
    * { margin: 0; padding: 0; box-sizing: border-box; }

    /* Component Styles (scoped) */
    [data-component='comp-hero-123'] .hero {
      background: #1a202c;
      padding: 4rem;
    }
    /* ... more component styles */
  </style>
</head>
<body>
  <!-- Hero Component -->
  <section data-component='comp-hero-123' class='hero'>
    <h1>Fresh Coffee Daily</h1>
    <p>Roasted in the mountains</p>
    <p>(555) 123-4567</p>
  </section>

  <!-- More components... -->
</body>
</html>
```

## Caching Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                        Caching Layers                           │
└─────────────────────────────────────────────────────────────────┘

Layer 1: In-Memory Template Cache
┌────────────────────────────────────────┐
│  TemplateLoader.cache (Map)            │
│  • Key: "hero-modern.json"             │
│  • Value: { template, cachedAt }       │
│  • TTL: Process lifetime               │
│  • Hit Rate: ~95% after warmup         │
└────────────────────────────────────────┘

Layer 2: R2 Object Storage
┌────────────────────────────────────────┐
│  R2 Bucket: kiamichi-component-templates│
│  • Global edge storage                 │
│  • Low latency reads                   │
│  • Infrequent writes                   │
└────────────────────────────────────────┘

Layer 3 (Future): KV for Rendered Pages
┌────────────────────────────────────────┐
│  KV Namespace: PAGE_CACHE              │
│  • Key: "page:{slug}"                  │
│  • Value: Complete HTML                │
│  • TTL: 1 hour                         │
│  • Invalidate on component changes     │
└────────────────────────────────────────┘
```

## Performance Metrics

| Scenario | Time | Requests |
|----------|------|----------|
| **Cold Start (no cache)** | ~200ms | 1 R2 + 2 D1 + Render |
| **Warm (templates cached)** | ~50ms | 2 D1 + Render |
| **Fully cached (future KV)** | ~5ms | 1 KV read |

### Breakdown:
- D1 Query (business): ~10ms
- D1 Query (components): ~15ms
- R2 Template Load (first): ~50ms each
- R2 Template Load (cached): <1ms
- Handlebars Render: ~5ms per component
- Page Assembly: ~10ms

## Error Handling

```
┌─────────────────────────────────────────────────────────────────┐
│                        Error Scenarios                          │
└─────────────────────────────────────────────────────────────────┘

1. Template Not Found
   ├─→ TemplateLoader throws error
   ├─→ PageAssembler catches
   ├─→ Return 500 with error message
   └─→ Log to console for debugging

2. Business Not Found
   ├─→ PageAssembler.getBusinessByListingPageId returns null
   ├─→ Throw "Business not found" error
   ├─→ Worker catches
   └─→ Return 404 response

3. Invalid Component Data
   ├─→ Handlebars renders with missing fields
   ├─→ Empty strings for undefined variables
   ├─→ Page still renders (graceful degradation)
   └─→ Log warning for review

4. R2 Unavailable
   ├─→ R2.get() throws error
   ├─→ TemplateLoader propagates error
   ├─→ PageAssembler catches
   └─→ Return 503 Service Unavailable
```

## Security Considerations

### XSS Prevention
- All meta tag content is HTML-escaped via `escapeHtml()`
- Handlebars automatically escapes HTML by default
- Use `{{{triple-braces}}}` only for trusted HTML content

### SQL Injection Prevention
- All D1 queries use parameterized statements (`.bind()`)
- No string concatenation in queries

### Content Security Policy (Future)
```javascript
headers: {
  'Content-Security-Policy':
    "default-src 'self'; " +
    "style-src 'unsafe-inline' 'self'; " +
    "img-src * data:; " +
    "script-src 'self'"
}
```

## Monitoring & Observability

### Key Metrics to Track
1. Template cache hit rate
2. Average page render time
3. R2 request count
4. D1 query performance
5. Error rate by component type

### Logging Points
```typescript
console.log('Page assembly started', { pageId, previewMode });
console.log('Templates loaded', { count, cacheHits });
console.log('Components rendered', { count, totalTime });
console.log('Page assembly completed', { pageId, duration });
```

## Scaling Considerations

### Current Limits (Cloudflare Workers)
- CPU Time: 50ms (can burst to 200ms)
- Memory: 128MB
- Subrequests: 50 per request
- R2 Reads: Unlimited

### Optimization Strategies
1. **Template Caching**: Reduces R2 requests
2. **Batch D1 Queries**: Fetch all components in single query
3. **Lazy Component Loading**: Load templates only for visible components
4. **Static Site Generation**: Pre-render popular pages during off-peak

### Scaling to 10,000+ Pages
```
Scenario: 10,000 businesses, 5 components avg per page

R2 Storage:
• 50 unique templates × 10KB = 500KB
• Negligible storage cost

D1 Queries:
• 10,000 pages × 1 query = 10K queries/render cycle
• Use batch operations for efficiency

Worker Requests:
• Unlimited with caching
• Cache rendered pages in KV for popular listings
```

## Integration with AI Chat System

```
User: "Update my hero section heading to 'Welcome to Mountain Coffee'"
  │
  ▼
AI Agent analyzes request
  │
  ▼
Tool: update_component_content({
  component_id: "comp-hero-123",
  content: { heading: "Welcome to Mountain Coffee" }
})
  │
  ▼
D1: UPDATE page_components SET content = ? WHERE id = ?
  │
  ▼
Tool: preview_listing_page({ pageId: "page-456" })
  │
  ▼
PageAssembler.assemblePage("page-456", { previewMode: true })
  │
  ▼
Return preview URL to user
  │
  ▼
User reviews preview in chat interface
```

---

**Architecture Design**: Cloudflare Workers Edge Computing
**Data Flow**: R2 → Memory Cache → Handlebars → HTML
**Performance**: <50ms warm, <200ms cold
**Scalability**: Unlimited with edge caching
