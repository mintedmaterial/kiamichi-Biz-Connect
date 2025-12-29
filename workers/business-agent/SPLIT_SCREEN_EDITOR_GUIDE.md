# Split-Screen Business Listing Editor

## Overview

This document describes the split-screen editor interface for the Kiamichi Biz Connect business listing agent. The interface combines an AI chat assistant with a live preview pane, allowing business owners to edit their listings interactively.

## Architecture

### Component Structure

```
app.tsx (Main Interface)
├── Left Pane: Chat Interface (50% width on desktop)
│   ├── Chat Header
│   ├── Message History
│   └── Input Form (with voice support)
│
├── Right Pane: Preview (50% width on desktop)
│   ├── PreviewPane Component
│   │   ├── Preview Header with Toolbar
│   │   ├── Iframe (showing /preview/{businessId})
│   │   └── Refresh & Publish Buttons
│   └── [Hidden on mobile, shows only chat]
│
└── PublishDialog Component (Modal overlay)
    ├── Confirmation Message
    ├── Snapshot Option (checkbox)
    └── Publish/Cancel Buttons
```

### File Organization

**New Components:**

- `src/components/preview-pane/PreviewPane.tsx` - Preview iframe component
- `src/components/publish-dialog/PublishDialog.tsx` - Publish confirmation modal

**New Utilities:**

- `src/utils/session.ts` - Session management and business ownership verification

**New API Routes:**

- `src/routes/api.ts` - RESTful API endpoints
  - `GET /api/my-business` - Get authenticated user's business
  - `POST /api/publish` - Publish draft changes

**Updated Files:**

- `src/app.tsx` - Split-screen layout with preview integration
- `src/server.ts` - Business context initialization and API routing

## Features

### 1. Split-Screen Layout

**Desktop (≥1024px):**

- Left 50%: Chat interface with AI assistant
- Right 50%: Live preview iframe

**Mobile (<1024px):**

- Full width: Chat interface only
- Preview hidden (optimized for conversation)

### 2. Live Preview

The preview pane displays the business listing in draft mode with:

**Preview Banner:**

- Fixed orange gradient banner at top
- "PREVIEW MODE" indicator
- Eye icon for visual clarity

**Iframe Controls:**

- Auto-refresh when tools complete with `refreshPreview: true`
- Manual refresh button in toolbar
- Loading states with spinner
- Error handling with retry option

**Preview URL:**

```
/preview/{businessId}?t={previewKey}
```

- `businessId`: Current authenticated user's business
- `previewKey`: Incrementing number to force iframe reload

### 3. Auto-Refresh System

**How It Works:**

1. **Tool Execution**: When AI uses page editing tools (updateComponentContent, selectComponentTemplate, etc.)
2. **Response Flag**: Tool returns `{ refreshPreview: true }` in result
3. **Detection**: `app.tsx` watches for tool-result parts with this flag
4. **Refresh**: Increments `previewKey` state, forcing iframe reload

**Supported Tools** (from `pagetools.ts`):

- `selectComponentTemplate` - Add new component
- `updateComponentContent` - Edit component content
- `removeComponent` - Delete component
- `reorderComponents` - Change component order
- `rollbackToSnapshot` - Restore previous version

**Implementation:**

```tsx
// In app.tsx
useEffect(() => {
  const latestMessage = agentMessages[agentMessages.length - 1];
  const hasRefreshFlag = latestMessage.parts?.some((part) => {
    if (part.type === "tool-result") {
      const result = (part as any).result;
      return result?.refreshPreview === true;
    }
  });

  if (hasRefreshFlag) {
    handleRefreshPreview(); // Increments previewKey
  }
}, [agentMessages]);
```

### 4. Publishing Workflow

**Publish Button** in preview toolbar opens confirmation dialog:

**PublishDialog Features:**

- **Confirmation Message**: Warns changes go live immediately
- **Snapshot Option**: Create rollback point (default: enabled)
- **Visual States**:
  - Normal: Green publish button
  - Publishing: Loading spinner, disabled controls
  - Error: Error message in chat

**Publish Process:**

1. User clicks "Publish" in preview pane
2. `PublishDialog` modal opens
3. User confirms (with/without snapshot)
4. `POST /api/publish` creates snapshot (if requested)
5. Updates `listing_pages.is_published = 1`
6. Success message appears in chat
7. Preview refreshes to show published state

### 5. Session Management

**Business Context Flow:**

```
Browser Request
  ↓ (Cookie: portal_session=...)
Chat DO fetch()
  ↓
getBusinessContextFromSession(request, DB)
  ↓
├─ parseSessionCookie() → sessionId
├─ verifySession() → ownerId
└─ getOwnerBusinesses() → businessId
  ↓
Store in this.metadata.businessContext
  ↓
Tools access via getCurrentAgent()
```

**Security:**

- All requests verify `portal_session` cookie
- Session validation checks expiry
- Business ownership verified (`claim_status = 'verified'`)
- Preview route checks ownership before rendering

## API Endpoints

### GET /api/my-business

Returns authenticated user's business information.

**Response:**

```json
{
  "businessId": 1,
  "name": "SRVCflo Web Marketing & Design",
  "slug": "srvcflo-web-marketing-design",
  "description": "...",
  "listingPageId": 1,
  "isPublished": true,
  "previewUrl": "/preview/1",
  "liveUrl": "https://kiamichibizconnect.com/business/srvcflo-web-marketing-design"
}
```

**Used By:**

- Frontend on mount to load `businessId`
- Preview pane to construct iframe URL

### POST /api/publish

Publishes draft changes to live listing.

**Request:**

```json
{
  "createSnapshot": true
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Changes published successfully",
  "businessId": 1,
  "listingPageId": 1,
  "snapshotCreated": true,
  "publishedAt": 1735411200
}
```

**Process:**

1. Verify session and business ownership
2. Get listing page ID
3. If `createSnapshot: true`:
   - Fetch all current components
   - Insert into `page_snapshots` table
4. Set `listing_pages.is_published = 1`
5. Return success response

## User Flow

### Initial Load

1. User navigates to business-agent worker
2. Auth middleware checks `portal_session` cookie
3. If authenticated, loads React app
4. `app.tsx` calls `GET /api/my-business`
5. Sets `businessId` state
6. Preview pane loads `/preview/{businessId}`
7. Chat DO initializes with business context in metadata

### Editing Workflow

1. **User asks AI**: "Add a services section with our offerings"
2. **AI responds**: Uses `selectComponentTemplate` tool
3. **Tool executes**: Creates component in database
4. **Tool returns**: `{ success: true, refreshPreview: true }`
5. **Frontend detects**: `refreshPreview` flag in tool-result
6. **Preview updates**: Increments `previewKey`, iframe reloads
7. **User sees**: New component in preview pane

### Publishing Workflow

1. **User clicks**: "Publish" button in preview toolbar
2. **Dialog opens**: `PublishDialog` with confirmation
3. **User confirms**: Checks "Create snapshot" (default)
4. **API call**: `POST /api/publish { createSnapshot: true }`
5. **Backend**:
   - Creates snapshot of current state
   - Sets `is_published = 1`
   - Returns success
6. **Frontend**:
   - Shows success message in chat
   - Refreshes preview
   - Closes dialog

## Styling

**Responsive Design:**

```css
/* Desktop: Split-screen */
.chat-pane {
  width: 50%;
  display: flex;
}

.preview-pane {
  width: 50%;
  display: flex;
}

/* Mobile: Chat only */
@media (max-width: 1024px) {
  .preview-pane {
    display: none;
  }
  .chat-pane {
    width: 100%;
  }
}
```

**Preview Banner:**

```css
position: fixed;
top: 0;
left: 0;
right: 0;
background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
z-index: 9999;
padding: 16px;
```

**Dark Mode:**

- Tailwind `dark:` classes throughout
- Theme toggle in chat header
- Persists to localStorage

## Error Handling

### Preview Load Errors

**States:**

- **Loading**: Spinner with "Loading preview..."
- **Error**: Warning card with retry button
- **Success**: Iframe visible, no overlay

**Error Recovery:**

```tsx
const [hasError, setHasError] = useState(false);

const handleIframeError = () => {
  setIsLoading(false);
  setHasError(true);
};

const handleRefresh = () => {
  setHasError(false);
  setIsLoading(true);
  onRefresh();
};
```

### Publish Errors

**Handled In:**

- `handlePublishConfirm()` in `app.tsx`

**Error Display:**

- Parse error response JSON
- Show message in chat as user message
- Close dialog, reset `isPublishing` state

**Example:**

```tsx
if (!response.ok) {
  const error = await response.json();
  await sendMessage({
    role: "user",
    parts: [
      {
        type: "text",
        text: `❌ Publish failed: ${error.message}`
      }
    ]
  });
}
```

### Session Errors

**No Business Found:**

- `GET /api/my-business` returns 404
- Preview shows "No Business Selected" state
- User sees empty state card

**Expired Session:**

- Session validation fails
- Redirect to login via server.ts
- User re-authenticates

## Testing

### Manual Testing Checklist

**Preview Functionality:**

- [ ] Preview loads on initial page load
- [ ] Preview refreshes after component update
- [ ] Preview refreshes after component deletion
- [ ] Preview refreshes after reorder
- [ ] Manual refresh button works
- [ ] Preview shows draft banner

**Publishing:**

- [ ] Publish button opens dialog
- [ ] Snapshot checkbox defaults to checked
- [ ] Publish creates snapshot when enabled
- [ ] Publish succeeds without snapshot
- [ ] Success message appears in chat
- [ ] Preview refreshes after publish
- [ ] Dialog closes after publish

**Responsive Design:**

- [ ] Desktop shows split-screen
- [ ] Mobile hides preview pane
- [ ] Chat interface works on mobile
- [ ] Preview toolbar is responsive

**Error Handling:**

- [ ] Preview shows error state on load failure
- [ ] Retry button reloads preview
- [ ] Publish errors show in chat
- [ ] Session expiry redirects to login

## Configuration

### Environment Variables

**Required:**

- `DB` - D1 database binding for session/business queries
- `TEMPLATES` - R2 bucket for page templates
- `BUSINESS_ASSETS` - R2 bucket for uploaded images

### Database Tables

**Required:**

- `portal_sessions` - User session tracking
- `business_ownership` - Business claim verification
- `businesses` - Business records
- `listing_pages` - Page metadata
- `page_components` - Component data
- `page_snapshots` - Rollback history

## Future Enhancements

### Planned Features

1. **Multi-Business Support**
   - Business selector dropdown
   - Switch between multiple owned businesses
   - Per-business chat history

2. **Mobile Preview Toggle**
   - Button to show/hide preview on mobile
   - Fullscreen preview mode
   - Responsive preview simulation

3. **Live Collaboration**
   - Real-time preview updates via WebSocket
   - Multiple editors indicator
   - Conflict resolution

4. **Version History UI**
   - List all snapshots in sidebar
   - Preview snapshot before restore
   - Diff view between versions

5. **Performance Optimizations**
   - Preview iframe lazy loading
   - Component-level preview updates (not full reload)
   - Debounced auto-save

## Troubleshooting

### Preview Not Loading

**Symptoms:**

- Iframe shows white screen
- Console errors about CORS
- 401/403 errors in network tab

**Solutions:**

1. Check `portal_session` cookie exists
2. Verify business ownership in database
3. Check preview route handler logs
4. Ensure TEMPLATES R2 bucket has templates

### Auto-Refresh Not Working

**Symptoms:**

- Tool executes successfully
- Preview doesn't update
- No `previewKey` increment

**Solutions:**

1. Check tool returns `refreshPreview: true`
2. Verify `useEffect` dependency array includes `agentMessages`
3. Check console for "[App] Tool returned refreshPreview" log
4. Inspect tool-result part structure in debug mode

### Publish Failing

**Symptoms:**

- Dialog shows error
- Chat shows "Publish failed" message
- No snapshot created

**Solutions:**

1. Check `listing_pages` exists for business
2. Verify session has valid `owner_id`
3. Check database permissions for INSERT
4. Inspect `/api/publish` logs in Cloudflare dashboard

## Code References

### Key Files

**Frontend:**

- `src/app.tsx` - Lines 49-53 (preview state), 88-169 (handlers), 222-245 (auto-refresh)
- `src/components/preview-pane/PreviewPane.tsx` - Entire file
- `src/components/publish-dialog/PublishDialog.tsx` - Entire file

**Backend:**

- `src/server.ts` - Lines 75-97 (business context), 449-456 (API routing)
- `src/routes/api.ts` - Entire file
- `src/utils/session.ts` - Entire file

**Tools:**

- `src/tools/pagetools.ts` - Lines with `refreshPreview: true` flag

### Important Patterns

**Business Context Access:**

```typescript
const { agent } = getCurrentAgent<Chat>();
const businessId = agent?.metadata?.businessContext?.businessId;
```

**Tool Response Format:**

```typescript
return {
  success: true,
  message: "Component updated",
  componentId: 123,
  refreshPreview: true // Triggers frontend reload
};
```

**Session Verification:**

```typescript
const businessContext = await getBusinessContextFromSession(request, env.DB);
if (!businessContext) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

## Support

For issues or questions:

- Check Cloudflare Workers logs for backend errors
- Use browser DevTools to inspect network/console
- Enable debug mode (toggle in chat header) for message inspection
- Review database records for session/ownership issues

---

**Last Updated:** 2025-12-28
**Version:** 1.0.0
**Author:** Business Agent Development Team
