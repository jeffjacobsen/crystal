# Crystal Project PRP Customizations

This file contains Crystal-specific customizations for PRP templates.

## Project Context

### Codebase Overview
- **Language**: TypeScript (Node.js + React)
- **Architecture**: Electron desktop application
- **Database**: SQLite with Better-SQLite3
- **State Management**: Zustand stores
- **UI Framework**: React 19 + Tailwind CSS
- **Build System**: Vite + Electron Builder

### Key Documentation References
```yaml
- file: /CLAUDE.md
  why: Comprehensive development guidance and architectural principles
  
- file: /docs/commands/generate-prp.md  
  why: PRP generation workflow and research process
  
- url: https://docs.anthropic.com/en/docs/claude-code
  section: SDK integration patterns
  
- file: /main/src/services/localDocumentService.ts
  why: Service layer patterns and database integration
  
- file: /frontend/src/stores/
  why: State management patterns with Zustand
```

### Common File Patterns
```bash
# Frontend structure
frontend/src/
├── components/          # React components
│   ├── common/         # Reusable UI components  
│   └── feature/        # Feature-specific components
├── hooks/              # Custom React hooks
├── stores/             # Zustand state stores
├── types/              # TypeScript definitions
└── utils/              # Helper functions

# Backend structure  
main/src/
├── ipc/                # IPC handlers (git.ts, session.ts, documents.ts)
├── services/           # Business logic services
├── database/           # SQLite database and migrations
├── types/              # Shared TypeScript definitions
└── utils/              # Backend utilities
```

## Crystal-Specific Gotchas

### Session Output Handling
```typescript
// CRITICAL: Session output system is fragile - DO NOT MODIFY without explicit permission
// See CLAUDE.md "Session Output Handling" section for details
// Any changes to output handling require careful consideration of:
// - Real-time streaming vs database persistence
// - Race conditions during session switching  
// - Message formatting and display logic
```

### Database Operations
```typescript
// PATTERN: Use migrations for schema changes
// Location: main/src/database/migrations/
// Always create new migration files, never modify existing ones

// PATTERN: SQLite datetime handling
// Store as UTC, convert for display using timestampUtils
const timestamp = formatForDatabase(); // UTC ISO string
const parsed = parseTimestamp(dbTime); // Handles UTC conversion
```

### IPC Communication
```typescript
// PATTERN: IPC handlers in separate files by domain
// main/src/ipc/git.ts - Git operations
// main/src/ipc/session.ts - Session management  
// main/src/ipc/documents.ts - Document operations

// PATTERN: Consistent error handling
interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  command?: string;
}
```

### State Management
```typescript
// PATTERN: Targeted updates, avoid global refreshes
// Use event-driven updates via IPC events
// Maintain database as single source of truth
// See CLAUDE.md "State Management Guidelines"

// PATTERN: Zustand store structure
interface FeatureStore {
  items: Item[];
  loading: boolean;
  error: string | null;
  // Actions
  fetchItems: () => Promise<void>;
  createItem: (data: ItemData) => Promise<void>;
}
```

## Project-Specific Validation Commands

### Development Setup
```bash
# One-time setup
pnpm run setup

# Development mode  
pnpm run dev
# OR
pnpm electron-dev
```

### Code Quality
```bash
# Type checking across all packages
pnpm typecheck

# Linting across all packages
pnpm lint

# Auto-fix linting issues
pnpm lint --fix
```

### Testing
```bash
# Run Playwright tests
pnpm test

# Run with UI
pnpm test:ui

# Run in headed browser
pnpm test:headed
```

### Building
```bash
# Build all packages
pnpm build

# Build frontend only
pnpm build:frontend

# Build main process only  
pnpm build:main

# Production build for macOS
pnpm build:mac
```

## Integration Points

### Adding New IPC Handlers
```typescript
// 1. Create handler in appropriate ipc/ file
// 2. Register in main/src/ipc/index.ts
// 3. Add to preload script (main/src/preload.ts)
// 4. Add to frontend types (frontend/src/types/electron.d.ts)
// 5. Add to API utility (frontend/src/utils/api.ts)
```

### Database Schema Changes
```typescript
// 1. Create migration in main/src/database/migrations/
// 2. Update models in main/src/database/models.ts
// 3. Update services to use new schema
// 4. Add TypeScript interfaces
// 5. Test migration thoroughly
```

### Adding New UI Components
```typescript
// 1. Create component in appropriate frontend/src/components/ subdirectory
// 2. Add TypeScript interfaces
// 3. Create custom hook if complex logic
// 4. Add to parent component or routing
// 5. Write unit tests
// 6. Test responsive design and dark mode
```

## Success Criteria Templates

### Frontend Features
- [ ] Component renders without errors
- [ ] TypeScript compilation passes
- [ ] Responsive design works on all screen sizes
- [ ] Dark mode support implemented
- [ ] Keyboard navigation functional
- [ ] Loading and error states handled
- [ ] Integration with existing UI flow

### Backend Features  
- [ ] IPC handlers respond correctly
- [ ] Database operations work properly
- [ ] Error handling comprehensive
- [ ] TypeScript types updated
- [ ] Service integration successful
- [ ] Performance benchmarks met

### Bug Fixes
- [ ] Original reproduction steps no longer cause issue
- [ ] Fix is minimal and targeted
- [ ] Regression test added
- [ ] Related functionality verified
- [ ] No performance degradation
- [ ] Error messages improved if applicable

## Common Anti-Patterns for Crystal

### ❌ Don't Do These
- Modify session output handling without explicit permission
- Skip database migrations for schema changes
- Use global state refreshes instead of targeted updates
- Ignore TypeScript errors or use `any` types
- Skip responsive design considerations
- Forget to test both light and dark modes
- Hardcode values that should be configurable
- Skip IPC error handling
- Modify existing migration files

### ✅ Do These Instead
- Follow existing patterns from similar components
- Use provided utility functions (timestampUtils, etc.)
- Implement proper loading and error states
- Test across different screen sizes
- Use the design system (Tailwind classes)
- Add comprehensive TypeScript types
- Follow the modular architecture patterns
- Write regression tests for bug fixes