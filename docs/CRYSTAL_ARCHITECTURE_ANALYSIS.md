# Crystal Architecture Analysis

## Overview

Crystal uses a **multi-process Electron architecture** with clear separation of concerns:

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

## IPC Communication Flow

### 1. **Preload Script Bridge** (`main/src/preload.ts`)
- Exposes a structured API through `window.electronAPI`
- Organizes functionality into namespaces: `sessions`, `projects`, `folders`, `config`, etc.
- Provides event listeners through `electronAPI.events`
- All IPC calls return standardized `IPCResponse<T>` with success/error handling

### 2. **Frontend API Layer** (`frontend/src/utils/api.ts`)
- Wraps all IPC calls in a clean API class
- Provides type safety and error handling
- Example: `API.sessions.create()` → `window.electronAPI.sessions.create()`

### 3. **IPC Handlers** (Main Process)
- **Session Handlers** (`main/src/ipc/session.ts`): Handle session lifecycle, input/output, conversation management
- **Git Handlers** (`main/src/ipc/git.ts`): Handle git operations, diffs, commits, rebasing
- Each handler validates input, calls services, and returns structured responses

### 4. **Event System** (`main/src/events.ts`)
- Services emit events (e.g., `sessionManager.emit('session-updated')`)
- Event listeners forward to renderer via `webContents.send()`
- Frontend components subscribe via `electronAPI.events.onSessionUpdated()`

## Frontend State Management

### 1. **Zustand Stores**
- **SessionStore** (`sessionStore.ts`): Manages session state, output, and active session
- **ErrorStore** (`errorStore.ts`): Centralized error handling
- Stores use targeted updates to minimize re-renders

### 2. **Component Event Handling**
- Components like `DraggableProjectTreeView` subscribe to IPC events
- Use **targeted state updates** instead of global refreshes
- Example: When a session is created, only that project's sessions array is updated

### 3. **Real-time Updates**
- Session output streams via `session:output` events
- Status changes broadcast via `session:updated` events
- Components update specific items without full reloads

## Key Architectural Patterns

### 1. **Git Worktree Isolation**
Each Claude session runs in its own git worktree, preventing conflicts between parallel development efforts.

### 2. **Session Lifecycle**
- Session creation → Git worktree setup → Claude Code process spawn
- Real-time output streaming → Database persistence → Frontend display
- Session archiving → Worktree cleanup

### 3. **State Management**
- Database as single source of truth for session data
- Targeted state updates via IPC events (avoid global refreshes)
- Frontend state synced with backend through event-driven architecture

### 4. **Data Flow**
- User input → IPC → Main process → Claude Code instance
- Claude output → Database storage → IPC/WebSocket → Frontend display
- Git operations → Command execution → Result parsing → UI updates

### 5. **Async Task Queue**
- Bull queue handles long-running operations
- Session creation, git operations run as background jobs
- Progress updates stream to frontend

### 6. **Modular Architecture**
- Backend split into focused modules (session, git, events)
- Each module has clear responsibilities
- Services layer handles business logic

### 7. **Error Propagation**
- Errors bubble up through standardized response format
- Frontend shows detailed error dialogs
- Git errors include command and output

## Example Flow: Creating a Session

1. User clicks "Create Session" → `CreateSessionDialog` component
2. Dialog calls `API.sessions.create({ prompt, worktreeTemplate, count })`
3. API layer invokes `electronAPI.sessions.create(request)`
4. IPC handler (`sessions:create`) validates request and queues job
5. Task queue creates worktree, starts Claude Code process
6. Session manager emits `session-created` event
7. Event forwarded to renderer: `webContents.send('session:created', session)`
8. `DraggableProjectTreeView` receives event and updates only that project's sessions
9. Session output streams via `session:output` events as Claude runs

## Database Schema

Key tables:
- `projects`: Project configurations and paths
- `sessions`: Core session metadata with status tracking
- `session_outputs`: Raw terminal output storage
- `conversation_messages`: Full conversation history for continuations
- `execution_diffs`: Git diff snapshots per execution
- `prompt_markers`: Prompt timestamps and navigation markers

## Why Electron is Essential

Crystal is architected as a **desktop-first application** that leverages Electron's capabilities extensively:

1. **Native Desktop Features**
   - File dialogs for project selection
   - Desktop notifications for session status
   - Auto-updater for seamless updates
   - Native OS integration

2. **Process Management**
   - Uses `node-pty` for spawning Claude Code processes
   - Direct file system access without browser restrictions
   - Child process management for git operations

3. **Security Model**
   - Context isolation with preload script
   - No direct Node.js access from renderer
   - All system operations go through validated IPC handlers
   - Permission system for MCP integration

4. **Local Data Storage**
   - SQLite database in user's home directory
   - Git worktrees managed on local filesystem
   - Configuration stored via electron-store
