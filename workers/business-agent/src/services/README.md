# Component Rendering System

This directory contains the implementation of the component rendering system for business listing pages, built using Test-Driven Development (TDD) with Vitest.

## Overview

The system allows business owners to edit their listing pages through AI chat by:
1. Loading component templates from R2 storage
2. Rendering components with Handlebars templates
3. Assembling complete HTML pages with proper meta tags and CSS

## Architecture

```
┌─────────────────┐
│  PageAssembler  │  Orchestrates the full page assembly
└────────┬────────┘
         │
         ├──────────────┬──────────────────┐
         │              │                  │
         ▼              ▼                  ▼
┌─────────────┐  ┌──────────────┐  ┌──────────┐
│ TemplateLoader │  │ ComponentRenderer │  │ D1 Database │
└─────────────┘  └──────────────┘  └──────────┘
         │
         ▼
┌─────────────┐
│  R2 Bucket  │
└─────────────┘
```

## Components

### 1. TemplateLoader (`template-loader.ts`)

**Purpose**: Load component templates from R2 bucket with caching.

**Key Features**:
- Loads templates from R2 bucket `kiamichi-component-templates`
- In-memory caching to reduce R2 requests
- Template key format: `{component_type}-{variant}.json`

**Example Usage**:
```typescript
import { TemplateLoader } from './services';

const loader = new TemplateLoader(env.TEMPLATES);
const template = await loader.loadTemplate('hero', 'modern');
```

**Template JSON Structure**:
```json
{
  "component_type": "hero",
  "variant": "modern",
  "html_template": "<section class='hero'><h1>{{heading}}</h1></section>",
  "css_template": ".hero { background: {{bg_color}}; }",
  "default_content": {
    "heading": "Welcome",
    "bg_color": "#1a202c"
  }
}
```

### 2. ComponentRenderer (`component-renderer.ts`)

**Purpose**: Render individual components by merging templates with data.

**Key Features**:
- Handlebars template interpolation
- Business data injection (`{{business_name}}`, `{{business_phone}}`, etc.)
- Content merging (component content overrides default_content)
- CSS scoping with `data-component` attributes

**Example Usage**:
```typescript
import { ComponentRenderer } from './services';

const renderer = new ComponentRenderer();
const rendered = await renderer.render(template, component, businessData);
// Output: { html: '...', css: '...', componentId: '...', componentType: '...' }
```

**Business Data Variables**:
- `{{business_name}}` - Business name
- `{{business_phone}}` - Phone number
- `{{business_email}}` - Email address
- `{{business_website}}` - Website URL
- `{{business_city}}` - City
- `{{business_state}}` - State
- `{{business_description}}` - Description
- `{{business_image_url}}` - Logo/image URL

### 3. PageAssembler (`page-assembler.ts`)

**Purpose**: Assemble complete HTML pages from components.

**Key Features**:
- Fetches components from D1 database
- Renders components in order (`display_order`)
- Only includes visible components (`is_visible = 1`)
- Generates complete HTML with meta tags, CSS, and structure
- Preview mode support with banner

**Example Usage**:
```typescript
import { PageAssembler } from './services';

const assembler = new PageAssembler(env.DB, templateLoader, renderer);
const page = await assembler.assemblePage('page-123', { previewMode: true });
// Output: { html: '<!DOCTYPE html>...', meta: {...}, previewMode: true }
```

## Database Schema

### `page_components` Table
```sql
CREATE TABLE page_components (
  id TEXT PRIMARY KEY,
  listing_page_id TEXT NOT NULL,
  component_type TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  config TEXT, -- JSON
  content TEXT, -- JSON
  style_variant TEXT NOT NULL,
  is_visible INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);
```

### `businesses` Table
```sql
CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,
  city TEXT,
  state TEXT,
  description TEXT,
  image_url TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

## Testing

All services are implemented using Test-Driven Development with comprehensive test coverage.

### Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific test file
npm run test:unit -- template-loader.test.ts

# Watch mode
npm run test:unit -- --watch
```

### Test Coverage

- **TemplateLoader**: 8 tests
  - Loading templates from R2
  - Caching behavior
  - Error handling for missing templates
  - Multiple component types/variants

- **ComponentRenderer**: 10 tests
  - Handlebars interpolation
  - Business data injection
  - Content merging
  - CSS scoping
  - Nested objects and arrays
  - Conditional helpers

- **PageAssembler**: 12 tests
  - Full page assembly
  - Multiple components in order
  - Visible components filtering
  - Combined CSS
  - Meta tags generation
  - Preview mode
  - Error handling

**Total**: 30 passing tests

## Example: Full Page Rendering Flow

```typescript
import { TemplateLoader, ComponentRenderer, PageAssembler } from './services';

// Initialize services
const templateLoader = new TemplateLoader(env.TEMPLATES);
const componentRenderer = new ComponentRenderer();
const pageAssembler = new PageAssembler(
  env.DB,
  templateLoader,
  componentRenderer
);

// Assemble a page
const result = await pageAssembler.assemblePage('page-123', {
  previewMode: true
});

// Return HTML to client
return new Response(result.html, {
  headers: { 'Content-Type': 'text/html' }
});
```

## Handlebars Template Examples

### Simple Variable Interpolation
```handlebars
<h1>{{heading}}</h1>
<p>Contact: {{business_phone}}</p>
```

### Conditional Rendering
```handlebars
{{#if show_phone}}
  <a href="tel:{{business_phone}}">Call Us</a>
{{/if}}
```

### Iteration
```handlebars
{{#each features}}
  <div class="feature">
    <h3>{{this.title}}</h3>
    <p>{{this.description}}</p>
  </div>
{{/each}}
```

### CSS Variables
```css
.hero {
  --primary-color: {{primary_color}};
  background: var(--primary-color);
}
```

## CSS Scoping

All CSS is automatically scoped to prevent conflicts between components:

**Input CSS**:
```css
.hero { padding: 2rem; }
h1 { font-size: 3rem; }
```

**Output CSS**:
```css
[data-component='comp-hero-123'] .hero { padding: 2rem; }
[data-component='comp-hero-123'] h1 { font-size: 3rem; }
```

**Corresponding HTML**:
```html
<section data-component='comp-hero-123'>
  <h1>Hero Title</h1>
</section>
```

## Performance Considerations

1. **R2 Caching**: Templates are cached in memory after first load to minimize R2 requests
2. **CPU Time**: Handlebars compilation is fast but consider caching compiled templates for high-traffic pages
3. **Database Queries**: Single query to fetch all components for a page
4. **Edge Rendering**: All rendering happens at the edge for minimal latency

## Future Enhancements

- [ ] Compiled template caching in KV for even faster rendering
- [ ] Component schema validation with Zod
- [ ] A/B testing support with variant rendering
- [ ] Component preview API for chat interface
- [ ] Real-time preview via WebSockets
- [ ] Analytics integration for component performance

## Related Files

- `C:\Users\Minte\Desktop\dev-code\kiamichi-biz-connect\workers\business-agent\src\services\types.ts` - TypeScript interfaces
- `C:\Users\Minte\Desktop\dev-code\kiamichi-biz-connect\workers\business-agent\vitest.unit.config.ts` - Test configuration
- `C:\Users\Minte\Desktop\dev-code\kiamichi-biz-connect\workers\business-agent\wrangler.jsonc` - R2 bucket bindings

## Support

For questions or issues, please contact the development team or create an issue in the project repository.
