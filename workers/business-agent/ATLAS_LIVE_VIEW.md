# Atlas Live View 🌳

A real-time visual interface for watching AI work, inspired by ClawdBot Henry.

## Features

### 1. Animated Avatar
- **Tree Character (🌳)**: Represents Atlas with smooth animations
- **State Indicators**: 
  - 🟢 Idle - Gentle breathing animation
  - 🔵 Thinking - Subtle movement and blue glow
  - 🟣 Coding - Active pulse with branch-like subagents
  - 🟠 Deploying - Energetic glow
  - 🔴 Error - Shake animation with red glow
- **Built with Framer Motion** for buttery-smooth 60fps animations

### 2. Real-Time Activity Feed
- WebSocket connection for live updates
- Last 20 events displayed with auto-scroll
- Event types:
  - 🚀 Task Started
  - ✅ Task Complete
  - 🌱 Subagent Spawned
  - 🎯 Subagent Complete
  - 💭 Thinking
  - 😴 Idle
  - ❌ Error
- Color-coded events with timestamps

### 3. Subagent Tree Visualization
- Shows active subagents as branches from the main Atlas tree
- Pulsing indicators for active work
- Branch lines connecting subagents to main tree
- Real-time spawn and complete animations

### 4. Statistics Dashboard
- Total events tracked
- Active subagent count
- Current state indicator

## Architecture

### Frontend Components
```
src/components/atlas/
├── AtlasLiveView.tsx     - Main wrapper with layout
├── AtlasAvatar.tsx       - Animated tree character
├── ActivityFeed.tsx      - Event stream display
└── SubagentTree.tsx      - Subagent visualization
```

### Backend
```
src/atlas-live.ts         - Durable Object for WebSocket handling
src/utils/atlas-events.ts - Helper functions for sending events
```

### Database
```sql
atlas_activity table:
- id, event_type, task_name, task_id
- subagent_id, subagent_label, parent_task_id
- message, metadata, created_at
```

## Usage

### Toggle Atlas Live View
Click the 🌳 toggle button in the top-right header to open/close the live view panel.

### Sending Events from Code

#### Simple Event
```typescript
import { sendAtlasEvent } from '@/utils/atlas-events';

await sendAtlasEvent(env, {
  type: 'thinking',
  message: 'Analyzing the request...'
});
```

#### Task Tracking
```typescript
import { AtlasTaskTracker } from '@/utils/atlas-events';

const task = new AtlasTaskTracker(env, 'Build Login System');
await task.start('Creating authentication endpoints');

// ... do work ...

await task.complete('Login system ready!');
```

#### Subagent Tracking
```typescript
import { AtlasSubagentTracker } from '@/utils/atlas-events';

const subagent = new AtlasSubagentTracker(
  env, 
  'Database Designer',
  parentTaskId
);

await subagent.spawn(taskId, 'Creating users table');

// ... subagent works ...

await subagent.complete('Database schema complete');
```

## API Endpoints

### WebSocket Connection
```
wss://your-domain.com/api/atlas/live/ws
```

### HTTP Endpoints
```
POST   /api/atlas/live/event   - Send event
GET    /api/atlas/live/status  - Get current state
GET    /api/atlas/live/activity?limit=100 - Get event history
```

## Demo

Run the included demo script to see Atlas Live View in action:

```bash
# Start the dev server
npm run dev

# In another terminal, run the demo
node atlas-demo.js
```

This will simulate a complete task lifecycle with subagents spawning and completing.

## Event Schema

```typescript
interface AtlasEvent {
  id: string;                    // Auto-generated UUID
  type: 'task_start' | 'task_complete' | 'subagent_spawn' | 
        'subagent_complete' | 'thinking' | 'idle' | 'error';
  taskName?: string;             // Human-readable task name
  taskId?: string;               // Unique task identifier
  subagentId?: string;           // Subagent identifier
  subagentLabel?: string;        // Subagent display name
  parentTaskId?: string;         // Parent task reference
  message?: string;              // Additional context
  metadata?: Record<string, any>; // Custom data
  timestamp: number;             // Unix timestamp
}
```

## Styling

The Atlas Live View uses:
- **Dark mode by default** with glassmorphism effects
- **Gradient backgrounds** for different states
- **Backdrop blur** for modern aesthetic
- **Responsive design** - works on mobile and desktop
- **Smooth animations** at 60fps with Framer Motion

## Performance

- WebSocket connection with automatic reconnection
- Events limited to last 1000 in database (auto-cleanup)
- Activity feed shows only last 20 events
- Minimal re-renders with React optimization
- Lightweight animations using CSS transforms

## Future Enhancements

- [ ] Kanban board integration with glow effects on active cards
- [ ] Task-specific activity logs (click card to see its events)
- [ ] Activity timeline/ticker at bottom
- [ ] Voice notifications for major events
- [ ] Export activity log as JSON/CSV
- [ ] Filter events by type or subagent
- [ ] Replay mode to review past sessions

## Troubleshooting

### WebSocket not connecting
1. Check that the worker is running: `npm run dev`
2. Verify the AtlasLive Durable Object is deployed
3. Check browser console for connection errors

### No events showing
1. Verify events are being sent: check Network tab
2. Check D1 database has atlas_activity table
3. Run atlas-demo.js to send test events

### Animations laggy
1. Check GPU acceleration in browser
2. Reduce number of active subagents (>10 may slow down)
3. Close other tabs to free up resources

## Credits

Inspired by ClawdBot Henry's real-time visualization capabilities.
Built with React, TypeScript, Framer Motion, and Cloudflare Durable Objects.
