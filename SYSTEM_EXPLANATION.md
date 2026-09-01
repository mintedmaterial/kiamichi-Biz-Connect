# System Architecture Explanation

## 🎯 How the Component System Works

### Current Situation:
Your live pages (like velvet-fringe, srvcflo) are **static HTML templates** generated in `src/index.ts:handleBusinessPage()`. They pull data from the `businesses` table and render a fixed layout.

### New Component System:
The editor we built uses a **modular component database** where each section of a page (hero, about, contact, etc.) is a separate record in the `page_components` table.

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────┐
│ STATIC PAGES (Current Production)          │
├─────────────────────────────────────────────┤
│ src/index.ts:handleBusinessPage()          │
│ ├── Hardcoded HTML template                │
│ ├── Pulls from `businesses` table only     │
│ └── Returns fixed layout                   │
└─────────────────────────────────────────────┘
                    ↓
      [NOT CONNECTED TO COMPONENT SYSTEM]
                    ↓
┌─────────────────────────────────────────────┐
│ COMPONENT-BASED SYSTEM (New Editor)        │
├─────────────────────────────────────────────┤
│ Database: page_components table             │
│ ├── Hero component (display_order: 1)      │
│ ├── About component (display_order: 2)     │
│ └── Contact component (display_order: 3)   │
│                                             │
│ Services (workers/business-agent/):         │
│ ├── TemplateLoader (loads from R2)         │
│ ├── ComponentRenderer (Handlebars)         │
│ └── PageAssembler (combines components)    │
│                                             │
│ Routes:                                     │
│ ├── /preview/{businessId} - Draft view     │
│ └── Published → R2 static HTML              │
└─────────────────────────────────────────────┘
```

## 🔄 How Editing Works

### Option 1: Preview Route (What we built)
```
User: "Add a hero section"
  ↓
Agent: Creates record in page_components table
  ↓
Preview Route: /preview/373
  ├── Queries page_components WHERE listing_page_id = 1
  ├── Renders each component using templates
  └── Returns assembled HTML
  ↓
User sees changes in preview pane
```

### Option 2: Publishing to Production
```
User: "Publish my changes"
  ↓
Agent: Calls publishChanges tool
  ↓
PageAssembler:
  ├── Queries all page_components
  ├── Renders with templates
  ├── Generates complete HTML
  └── Uploads to R2: business/{slug}/index.html
  ↓
Main worker updated to serve from R2 instead of static template
```

## 🚨 The Disconnect

**Problem**: Your production pages use the static template, NOT the component system.

**What I just did**: Created initial components for your business (ID 373):
- ✅ Hero component (modern style)
- ✅ About component
- ✅ Contact component with form

**Now when you use the editor**:
- "List my components" → Will show these 3 components
- "Add a gallery section" → Adds new component
- Preview updates in real-time

## 🎯 Migration Path

### Phase 1: Hybrid (Current)
- Static pages stay live at kiamichibizconnect.com/business/{slug}
- Component-based preview at /preview/{businessId}
- Publish creates R2 version but main worker still serves static

### Phase 2: Switch to R2 (Next)
Update `handleBusinessPage()` to check R2 first:
```typescript
// Check if published version exists in R2
const r2Object = await env.BUSINESS_ASSETS.get(`business/${slug}/index.html`);
if (r2Object) {
  return new Response(await r2Object.text(), {
    headers: { 'Content-Type': 'text/html' }
  });
}
// Fallback to static template
return renderStaticTemplate(business);
```

### Phase 3: Full Migration
- Convert all businesses to component system
- Deprecate static template
- All editing happens through component system

## 📱 Mobile Editor Issue

**Current**: Preview pane has `hidden lg:flex` - **completely hidden on mobile**

**Why**: Split-screen doesn't work well on small screens

**Solutions**:
1. **Quick**: Add toggle button to switch between chat/preview on mobile
2. **Better**: Tabbed interface (Chat tab | Preview tab)
3. **Best**: Bottom sheet preview that slides up on mobile

## 🖼️ Image Display Issue

**Problem**: "Images not showing after generation"

**Likely causes**:
1. S3 URLs need CORS configuration
2. Images aren't being embedded in chat response
3. Frontend isn't rendering image URLs from tool results

**Fix**: Update generateImage execution to return embedded image in chat:
```typescript
return {
  success: true,
  imageUrl: s3Url,
  // Add markdown image for chat display
  displayMessage: `![Generated Image](${s3Url})\n\nImage saved to: ${s3Url}`
};
```

## 🎯 What You Can Do Right Now

1. **Login**: https://kiamichibizconnect.com/auth/github/login
2. **Open Editor**: https://app.kiamichibizconnect.com
3. **Test Commands**:
   - "List my page components" → Should show 3 components
   - "Add a modern services section" → Adds new component
   - Preview updates automatically

4. **Publish**:
   - Click "Publish" button
   - Creates static HTML in R2
   - (Main site won't use it yet until we update handleBusinessPage)

## 🔧 Next Steps

1. ✅ **DONE**: Created initial components for your business
2. ⏳ **TODO**: Make mobile-friendly (add toggle button)
3. ⏳ **TODO**: Fix image display in chat
4. ⏳ **TODO**: Update handleBusinessPage to serve from R2
5. ⏳ **TODO**: Migrate all businesses to component system
