# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Crystal is an Electron desktop application for managing multiple Claude Code instances against a single directory using git worktrees. Each session runs in its own git worktree branch, allowing parallel development without conflicts. Crystal provides structured development with Product Requirement Prompts (PRPs) that guide AI-assisted development for longer coding sessions.

## Common Development Commands

```bash
# One-time setup (install dependencies, build, and rebuild native modules)
pnpm run setup

# Run in development mode (most common)
pnpm run dev
# Or:
pnpm electron-dev

# Build commands
pnpm build              # Build all packages
pnpm build:frontend     # Build frontend only
pnpm build:main        # Build main process only
pnpm typecheck         # Run TypeScript type checking across all packages
pnpm lint              # Run ESLint across all packages

# Testing
pnpm test              # Run Playwright tests
pnpm test:ui           # Run tests with UI mode
pnpm test:headed       # Run tests in headed browser

# Production builds
pnpm build:mac         # Build for macOS (universal binary)
pnpm build:mac:x64     # Build for macOS x64 only
pnpm build:mac:arm64   # Build for macOS ARM64 only
pnpm build:linux       # Build for Linux (deb and AppImage)

# If developing Crystal with Crystal
# Set this as your run script in Crystal project settings:
pnpm run setup && CRYSTAL_DIR=~/.crystal_test pnpm electron-dev
```

## High-Level Architecture

Crystal uses a multi-process Electron architecture with clear separation of concerns:

### Process Architecture
- **Main Process** (Electron + Node.js):
  - Manages Claude Code instances via @anthropic-ai/claude-code SDK
  - Handles git worktree operations for isolated development branches
  - SQLite database for persistent session and output storage
  - Express server on port 3001 for API endpoints (development mode)
  - IPC handlers for secure communication with renderer

- **Renderer Process** (React 19):
  - React with Zustand for state management
  - XTerm.js for terminal emulation with 50,000 line scrollback
  - Real-time updates via IPC events and WebSocket (dev mode)
  - Multiple views: Output, Messages, Diff, Terminal

### Key Architectural Patterns

1. **Git Worktree Isolation**: Each Claude session runs in its own git worktree, preventing conflicts between parallel development efforts.

2. **Session Lifecycle**:
   - Session creation → Git worktree setup → Claude Code process spawn
   - Real-time output streaming → Database persistence → Frontend display
   - Session archiving → Worktree cleanup

3. **State Management**:
   - Database as single source of truth for session data
   - Targeted state updates via IPC events (avoid global refreshes)
   - Frontend state synced with backend through event-driven architecture

4. **Data Flow**:
   - User input → IPC → Main process → Claude Code instance
   - Claude output → Database storage → IPC/WebSocket → Frontend display
   - Git operations → Command execution → Result parsing → UI updates

## Critical Implementation Details

### Modular Architecture (Refactored)

The main process has been refactored from a monolithic `index.ts` file (previously 2,705 lines) into a modular structure:

- **`index.ts`** (414 lines): Core Electron setup and initialization
- **`ipc/git.ts`** (843 lines): All git-related IPC handlers 
- **`ipc/session.ts`** (428 lines): Session management IPC handlers
- **`events.ts`** (359 lines): Event handling and coordination

The frontend has also been modularized:
- **`useSessionView.ts`** (941 lines): Extracted session view logic from the previous monolithic SessionView component

This modular structure improves maintainability and makes it easier to locate and modify specific functionality.

### Session Output Handling (DO NOT MODIFY WITHOUT EXPLICIT PERMISSION)

⚠️ **WARNING**: The session output handling system is complex and fragile. Modifying it frequently causes issues like duplicate messages, disappearing content, or blank screens. Any changes require explicit user permission.

#### How It Works:

1. **Database Storage**:
   - Raw JSON messages from Claude are stored as-is in the database
   - Stdout/stderr outputs are stored directly
   - No formatting or transformation happens at storage time

2. **Real-time Streaming**:
   - When Claude outputs data, it's saved to the database immediately
   - For JSON messages, a formatted stdout version is sent to the frontend for the Output view
   - The original JSON is also sent for the Messages view
   - This provides immediate visual feedback during active sessions

3. **Session Loading**:
   - When navigating to a session, outputs are loaded from the database
   - The `sessions:get-output` handler transforms JSON messages to formatted stdout on-the-fly
   - Uses `setSessionOutputs` for atomic updates to prevent race conditions

4. **Frontend Display**:
   - The useSessionView hook manages session view logic and state (extracted from SessionView component)
   - A mutex lock (`loadingRef`) prevents concurrent loads
   - Timing is carefully managed with `requestAnimationFrame` and delays
   - The `formattedOutput` state is NOT cleared on session switch - it updates naturally

5. **Key Principles**:
   - Database is the single source of truth
   - Transformations happen on-the-fly, not at storage time
   - Real-time updates supplement but don't replace database data
   - Session switches always reload from database to ensure consistency

#### Common Issues and Solutions:

- **Duplicate messages**: Usually caused by sending both formatted and raw versions
- **Disappearing content**: Often due to clearing output states at the wrong time
- **Black screens**: Typically from race conditions during session switching
- **Content only loads once**: Results from improper state management or missing dependencies

The current implementation carefully balances real-time updates with data persistence to provide a smooth user experience.

### Timestamp Handling Guidelines

⚠️ **IMPORTANT**: Proper timestamp handling is critical for the application to function correctly, especially for prompt duration calculations.

#### Overview

Crystal uses timestamps throughout the application for tracking session activity, prompt execution times, and displaying time-based information. Due to the mix of SQLite database storage and JavaScript Date objects, special care must be taken to ensure timezone consistency.

#### Key Principles

1. **Database Storage**: All timestamps are stored in UTC using SQLite's `CURRENT_TIMESTAMP` or `datetime()` functions
2. **Frontend Display**: Timestamps are parsed as UTC and converted to local time only for display
3. **Consistency**: Always use the timestamp utility functions instead of manual date parsing
4. **Validation**: Always validate timestamps before using them in calculations

#### Timestamp Formats

- **SQLite DATETIME**: `YYYY-MM-DD HH:MM:SS` (stored in UTC without timezone indicator)
- **ISO 8601**: `YYYY-MM-DDTHH:MM:SS.sssZ` (with explicit UTC timezone)
- **JavaScript Date**: Local timezone by default (be careful!)

#### Utility Functions

Crystal provides timestamp utilities in both frontend and backend:

**Backend** (`main/src/utils/timestampUtils.ts`):
```typescript
import { formatForDatabase, getCurrentTimestamp } from '../utils/timestampUtils';

// For database storage
const timestamp = formatForDatabase(); // Returns ISO string
const now = getCurrentTimestamp();    // Alias for formatForDatabase()

// For display formatting
const displayTime = formatForDisplay(timestamp);
```

**Frontend** (`frontend/src/utils/timestampUtils.ts`):
```typescript
import { parseTimestamp, formatDuration, getTimeDifference } from '../utils/timestampUtils';

// Parse SQLite timestamps correctly
const date = parseTimestamp("2024-01-01 12:00:00"); // Handles UTC conversion

// Calculate durations
const durationMs = getTimeDifference(startTime, endTime);
const formatted = formatDuration(durationMs); // "2m 34s"

// Display relative time
const ago = formatDistanceToNow(timestamp); // "5 minutes ago"
```

#### Database Operations

When working with timestamps in SQLite:

```sql
-- Use datetime() for UTC timestamps
INSERT INTO prompt_markers (timestamp) VALUES (datetime('now'));

-- When selecting, append 'Z' for proper UTC parsing
SELECT datetime(timestamp) || 'Z' as timestamp FROM prompt_markers;

-- For completion timestamps with NULL handling
SELECT 
  CASE 
    WHEN completion_timestamp IS NOT NULL 
    THEN datetime(completion_timestamp) || 'Z'
    ELSE NULL
  END as completion_timestamp
FROM prompt_markers;
```

#### Common Patterns

**Creating a new timestamp**:
```typescript
// Backend - for database storage
const timestamp = formatForDatabase();

// Frontend - for immediate use
const now = new Date();
```

**Tracking prompt execution time**:
```typescript
// When prompt starts
db.addPromptMarker(sessionId, promptText, outputIndex);

// When prompt completes
db.updatePromptMarkerCompletion(sessionId);
```

**Calculating duration**:
```typescript
// With completion timestamp
if (prompt.completion_timestamp) {
  const duration = getTimeDifference(prompt.timestamp, prompt.completion_timestamp);
  return formatDuration(duration);
}

// For ongoing prompts
const duration = getTimeDifference(prompt.timestamp); // Uses current time as end
return formatDuration(duration) + ' (ongoing)';
```

#### Common Pitfalls to Avoid

1. **Never parse SQLite timestamps directly with `new Date()`**:
   ```typescript
   // ❌ WRONG - treats UTC as local time
   const date = new Date("2024-01-01 12:00:00");
   
   // ✅ CORRECT - uses parseTimestamp utility
   const date = parseTimestamp("2024-01-01 12:00:00");
   ```

2. **Always validate timestamps before calculations**:
   ```typescript
   if (!isValidTimestamp(timestamp)) {
     return 'Unknown duration';
   }
   ```

3. **Be careful with timezone conversions**:
   ```typescript
   // Database stores UTC, display shows local
   const dbTime = "2024-01-01 12:00:00";    // UTC
   const parsed = parseTimestamp(dbTime);    // Correctly handled as UTC
   const display = formatForDisplay(parsed); // Converts to local for display
   ```

4. **Handle negative durations gracefully**:
   ```typescript
   const duration = endTime - startTime;
   if (duration < 0) {
     console.warn('Negative duration detected');
     return 'Invalid duration';
   }
   ```

#### Testing Timestamp Code

When testing timestamp-related features:

1. Test with different timezones (especially negative UTC offsets)
2. Test with daylight saving time transitions
3. Test with very old and future timestamps
4. Test with invalid/malformed timestamps
5. Verify duration calculations are always positive

### State Management Guidelines

⚠️ **IMPORTANT**: Crystal follows a targeted update pattern for state management to minimize unnecessary re-renders and network requests.

#### Overview

Crystal uses a combination of Zustand stores, IPC events, and targeted updates to manage application state efficiently. The application prioritizes specific, targeted updates over global refreshes to improve performance and user experience.

#### Key Principles

1. **Targeted Updates**: Always update only the specific data that changed
2. **Event-Driven Updates**: Use IPC events to communicate changes between processes
3. **Avoid Global Refreshes**: Never reload entire lists when only one item changes
4. **Database as Source of Truth**: Frontend state should reflect backend state, not override it

#### State Update Patterns

**Session Updates**:
```typescript
// ❌ BAD: Global refresh
const handleSessionCreated = () => {
  loadProjectsWithSessions(); // Reloads everything
};

// ✅ GOOD: Targeted update
const handleSessionCreated = (newSession: Session) => {
  setProjectsWithSessions(prevProjects => {
    return prevProjects.map(project => {
      if (project.id === newSession.projectId) {
        return {
          ...project,
          sessions: [...project.sessions, newSession]
        };
      }
      return project;
    });
  });
};
```

**Project Updates**:
```typescript
// ❌ BAD: Reload all projects
const handleProjectDeleted = () => {
  fetchProjects(); // Network request for all projects
};

// ✅ GOOD: Remove from local state
const handleProjectDeleted = () => {
  setProjects(prev => prev.filter(p => p.id !== deletedId));
};
```

#### IPC Event Handling

The application uses IPC events to synchronize state between the main process and renderer:

1. **Session Events**:
   - `session:created` - Add new session to appropriate project
   - `session:updated` - Update specific session properties
   - `session:deleted` - Remove session from project list

2. **Project Events** (if implemented):
   - `project:created` - Add new project to list
   - `project:updated` - Update specific project properties
   - `project:deleted` - Remove project from list

#### When Global Refreshes Are Acceptable

- **Initial Load**: When component mounts for the first time
- **User-Triggered Refresh**: When user explicitly requests a refresh
- **Error Recovery**: After connection loss or critical errors
- **Complex State Changes**: When multiple interdependent items change

#### Implementation Examples

**DraggableProjectTreeView.tsx**:
- Uses targeted updates for session creation, update, and deletion
- Only reloads all data on initial mount or when critical errors occur
- Maintains local state synchronized with backend through IPC events

**ProjectSelector.tsx**:
- Updates project list locally when projects are deleted
- Falls back to refresh only when necessary (e.g., complex updates)

#### Best Practices

1. **Use State Setters with Callbacks**: Always use the callback form of setState to ensure you're working with the latest state
2. **Merge Updates**: When updating objects, spread existing properties to preserve data
3. **Handle Edge Cases**: Always check if the item exists before updating
4. **Log State Changes**: Add console logs for debugging state updates in development
5. **Validate IPC Data**: Ensure IPC events contain expected data structure

### Diff Viewer CSS Troubleshooting

⚠️ **IMPORTANT**: The diff viewer (react-diff-viewer-continued) has specific CSS requirements that can be tricky to debug.

#### Common Issue: No Scrollbars on Diff Viewer

If the diff viewer content is cut off and scrollbars don't appear:

1. **DO NOT add complex CSS overrides** - This often makes the problem worse
2. **Check parent containers for `overflow-hidden`** - This is usually the root cause
3. **Use simple `overflow: 'auto'`** on the immediate diff container
4. **Remove any forced widths or min-widths** unless absolutely necessary

#### The Solution That Works:

```tsx
// In DiffViewer.tsx - Keep it simple!
<div className="border border-t-0 border-gray-600 rounded-b-lg" style={{ overflow: 'auto', maxHeight: '600px' }}>
  <ReactDiffViewer
    oldValue={file.oldValue || ''}
    newValue={file.newValue || ''}
    splitView={viewType === 'split'}
    useDarkTheme={isDarkMode}
    styles={currentStyles}
    // Don't add complex style overrides here
  />
</div>
```

#### What NOT to Do:

- Don't add multiple wrapper divs with conflicting overflow settings
- Don't use CSS-in-JS to override react-diff-viewer's internal styles
- Don't add global CSS selectors targeting generated class names
- Don't use JavaScript hacks to force reflows

#### Root Cause:

The issue is typically caused by parent containers having `overflow-hidden` which prevents child scrollbars from appearing. Check these files:
- `SessionView.tsx` - Look for `overflow-hidden` classes
- `CombinedDiffView.tsx` - Check both the main container and flex containers
- `App.tsx` - Sometimes the issue starts at the app root level

The react-diff-viewer-continued library uses emotion/styled-components internally, which makes CSS overrides unreliable. The best approach is to ensure proper overflow handling in parent containers and keep the diff viewer wrapper simple.

### Product Requirement Prompts (PRP) System

Crystal includes a comprehensive PRP system for structured development:

#### Key Components:
- **PRP Templates**: Pre-built templates for common development patterns (React components, backend services, bug fixes)
- **AI-Assisted Generation**: Uses Claude Code CLI to generate PRPs from templates
- **Version Control**: Track PRP changes over time
- **Session Integration**: PRPs are included in session context to guide development

#### PRP Workflow:
1. **Create/Select PRP**: Use existing PRP or generate new one from templates
2. **Generate with AI**: Provide feature request and codebase path for context-aware generation
3. **Edit and Refine**: Use the rich Markdown editor to customize
4. **Attach to Session**: Select PRP when creating new session
5. **Guided Development**: PRP content guides Claude through structured implementation

#### Template System:
- Located in `resources/prp-templates/`
- Each template has `metadata.json` and `template.md`
- Supports variable substitution (backend implemented, frontend UI pending)
- Templates include research instructions and structured prompts

See `/docs/PRP-TEMPLATE-SYSTEM.md` for detailed documentation.

### Recent Architectural Changes

#### Removed Features:
- **Stravu Integration**: All cloud file search functionality removed
- **Version Update Checking**: No longer checks for upstream updates
- **Discord Integration**: Discord popup and related functionality removed
- **API Key Dependency**: Now uses Claude Code for session name generation

#### Simplified Components:
- **Welcome Screen**: Now focused solely on Claude setup, auto-tests on mount
- **Session Creation**: Streamlined UI with PRP selection as primary feature
- **PRP Management**: Single active PRP model (removed complex activation logic)


## Project Structure

```
crystal/
├── frontend/               # React renderer process
│   ├── src/
│   │   ├── components/     # UI components (SessionView, Help, PRP*, etc.)
│   │   ├── hooks/         # Custom hooks (useSessionView - session logic)
│   │   ├── stores/        # Zustand stores for state management
│   │   └── utils/         # Utilities including timestampUtils
├── main/                  # Electron main process
│   ├── src/
│   │   ├── index.ts       # Main entry (414 lines - Electron setup)
│   │   ├── events.ts      # Event coordination (359 lines)
│   │   ├── ipc/          # IPC handlers (modularized)
│   │   │   ├── git.ts    # Git operations (843 lines)
│   │   │   ├── session.ts # Session management (428 lines)
│   │   │   ├── prp.ts    # PRP operations
│   │   │   └── documents.ts # Document management
│   │   ├── database/      # SQLite database and migrations
│   │   ├── services/      # Business logic (Claude, worktree, PRP, templates)
│   │   └── utils/         # Backend utilities
├── shared/                # Shared TypeScript types
└── tests/                 # Playwright E2E tests
```

## Database Schema

Key tables:
- `projects`: Project configurations and paths
- `sessions`: Core session metadata with status tracking
- `session_outputs`: Raw terminal output storage
- `conversation_messages`: Full conversation history for continuations
- `execution_diffs`: Git diff snapshots per execution
- `prompt_markers`: Prompt timestamps and navigation markers
- `product_requirement_prompts`: PRP storage with versioning
- `prp_versions`: Version history for PRPs
- `documents`: Local documentation references
- `session_prp`: Links sessions to PRPs
- `session_documents`: Links sessions to documents

## IPC Communication

Main IPC channels:
- `git:*` - Git operations (rebase, squash, diff)
- `sessions:*` - Session lifecycle (create, update, delete, continue)
- `projects:*` - Project management
- `config:*` - Settings and configuration
- `mcp:*` - MCP tool permissions
- `prp:*` - Product Requirement Prompt operations
- `documents:*` - Documentation management
- `prp-generation:*` - AI-assisted PRP generation

Events emitted:
- `session:created/updated/deleted` - Session state changes
- `session:output` - Real-time output streaming
- `git:operation-complete` - Git operation results
- `prp-generation:progress` - Real-time PRP generation updates