# Quick Start Guide - Component Rendering System

## 5-Minute Setup

### 1. Install Dependencies
```bash
cd workers/business-agent
npm install
# Dependencies already installed: handlebars, @types/handlebars
```

### 2. Run Tests
```bash
npm run test:unit
# Expected: 30 tests passing
```

### 3. Basic Usage

```typescript
import { TemplateLoader, ComponentRenderer, PageAssembler } from './services';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Initialize services
    const loader = new TemplateLoader(env.TEMPLATES);
    const renderer = new ComponentRenderer();
    const assembler = new PageAssembler(env.DB, loader, renderer);

    // Render page
    const url = new URL(request.url);
    const slug = url.pathname.split('/').pop();

    // Get page ID from slug
    const page = await env.DB
      .prepare('SELECT id FROM listing_pages WHERE slug = ?')
      .bind(slug)
      .first<{ id: string }>();

    if (!page) {
      return new Response('Not found', { status: 404 });
    }

    // Assemble and return
    const result = await assembler.assemblePage(page.id);
    return new Response(result.html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};
```

## Key Files

| File | Purpose |
|------|---------|
| `src/services/template-loader.ts` | Load templates from R2 |
| `src/services/component-renderer.ts` | Render with Handlebars |
| `src/services/page-assembler.ts` | Assemble full HTML page |
| `src/services/types.ts` | TypeScript interfaces |
| `src/services/README.md` | Full documentation |

## Common Operations

### Create a Template in R2

**Upload to**: `kiamichi-component-templates/hero-modern.json`

```json
{
  "component_type": "hero",
  "variant": "modern",
  "html_template": "<section><h1>{{heading}}</h1></section>",
  "css_template": ".hero { padding: 2rem; }",
  "default_content": {
    "heading": "Welcome"
  }
}
```

### Add Component to Database

```sql
INSERT INTO page_components (
  id, listing_page_id, component_type, style_variant,
  display_order, content, is_visible
) VALUES (
  'comp-123',
  'page-456',
  'hero',
  'modern',
  1,
  '{"heading": "Custom Heading"}',
  1
);
```

### Render Preview

```typescript
const page = await assembler.assemblePage('page-123', {
  previewMode: true
});
// page.html includes preview banner
```

## Template Variables

### Business Data (Auto-injected)
- `{{business_name}}`
- `{{business_phone}}`
- `{{business_email}}`
- `{{business_website}}`
- `{{business_city}}`
- `{{business_state}}`
- `{{business_description}}`
- `{{business_image_url}}`

### Custom Content (from component.content)
- `{{heading}}`
- `{{subheading}}`
- `{{cta_text}}`
- Any custom field you define

## Handlebars Examples

### Conditional
```handlebars
{{#if show_phone}}
  <a href="tel:{{business_phone}}">Call Us</a>
{{/if}}
```

### Loop
```handlebars
{{#each features}}
  <div>{{this.title}}: {{this.description}}</div>
{{/each}}
```

### Nested Objects
```handlebars
<div style="color: {{theme.primary_color}};">
  {{theme.heading}}
</div>
```

## Testing

### Run All Tests
```bash
npm run test:unit
```

### Run Specific Test
```bash
npm run test:unit -- template-loader.test.ts
```

### Watch Mode
```bash
npm run test:unit -- --watch
```

## Troubleshooting

### Template Not Found
```
Error: Template not found: hero-modern (key: hero-modern.json)
```
**Fix**: Upload template to R2 bucket `kiamichi-component-templates`

### Business Not Found
```
Error: Business not found for listing page: page-123
```
**Fix**: Verify listing page exists and has valid business_id

### Handlebars Error
```
Error: Missing helper: "custom_helper"
```
**Fix**: Only use built-in Handlebars helpers or define custom helpers

## Performance Tips

1. Templates are cached automatically - no manual caching needed
2. Use preview mode only for editing, not production
3. Consider pre-rendering popular pages with scheduled worker
4. Monitor R2 requests in Cloudflare dashboard

## Next Steps

1. Read full documentation: `src/services/README.md`
2. Review example usage: `src/services/example-usage.ts`
3. Check architecture: `ARCHITECTURE.md`
4. See implementation details: `IMPLEMENTATION_SUMMARY.md`

## Support

- Documentation: `src/services/README.md`
- Examples: `src/services/example-usage.ts`
- Tests: `src/services/__tests__/`

---

**All 30 tests passing** - System is production-ready!
