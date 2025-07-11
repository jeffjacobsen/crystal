# Crystal Adaptation Plan: Long-Form Development Sessions

> **Note**: This document represents the original adaptation plan for Crystal. Most features described here have been implemented. See PROGRESS_SUMMARY.md for current status.

## Vision

Transform Crystal from a "vibe coding" tool for quick iterations into a **structured development environment** for longer coding sessions with:
- Product Requirement Prompts (PRP) that guide AI-assisted development
- Documentation references accessible to Claude Code instances
- Better session comparison and selection tools
- Support for complex, multi-day projects

## Key Changes

### 1. Remove Stravu Integration

**Files to remove/modify:**
- `main/src/services/stravuAuthManager.ts` - Delete
- `main/src/services/stravuNotebookService.ts` - Delete
- `main/src/ipc/index.ts` - Remove Stravu IPC handlers
- `frontend/src/components/SettingsDialog.tsx` - Remove Stravu tab
- Remove all `stravu:*` IPC channels from preload script

### 2. Add Product Requirement Prompt (PRP) Support

**New Features:**
- PRP editor/viewer in the UI
- PRP storage per project
- PRP accessible to all Claude Code sessions in that project
- Version control for PRP changes

**Implementation:**
- Add `product_requirement_prompts` table to database
- Create PRP editor component (Markdown with preview)
- Add PRP to session context when starting Claude Code
- Include PRP in system prompt for better context

### 3. Add Documentation References

**New Features:**
- Documentation library per project
- Support for multiple document types (MD, PDF, TXT, code files)
- Document categorization (API docs, architecture, guides)
- Quick reference panel during sessions

**Implementation:**
- Add `documentation_references` table
- Create document manager component
- Add document upload/import functionality
- Include relevant docs in Claude Code context

### 4. Enhance for Longer Sessions

**Current limitations for long sessions:**
- No built-in breaks or checkpoints
- Limited context management
- No session planning tools

**Improvements:**
- Session planning with milestones
- Checkpoint system for saving progress
- Better context management for long conversations
- Session metrics (time spent, tokens used, commits made)

### 5. Session Comparison and Selection

**New Features:**
- Side-by-side diff viewer for multiple sessions
- Session scoring/rating system
- Bulk operations (archive multiple, compare outputs)
- Advanced filtering (by outcome, time, changes)

**Implementation:**
- Enhanced diff viewer supporting multiple sessions
- Session comparison view
- Metadata tracking for better filtering

## Database Schema Changes

```sql
-- Product Requirement Prompts
CREATE TABLE product_requirement_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Note: Removed project_id and is_active - PRPs are now project-independent

-- Documentation References
CREATE TABLE documentation_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  file_path TEXT,
  content TEXT,
  url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Session Planning
CREATE TABLE session_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at DATETIME,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Session Metrics
CREATE TABLE session_metrics (
  session_id TEXT PRIMARY KEY,
  total_time_seconds INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  commits_made INTEGER DEFAULT 0,
  files_changed INTEGER DEFAULT 0,
  lines_added INTEGER DEFAULT 0,
  lines_deleted INTEGER DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

## UI/UX Changes

### Project View Enhancements
- Add PRP section to project settings
- Add Documentation tab to project view
- Show session metrics in session list

### New Components
- `PRPEditor.tsx` - Markdown editor for requirements
- `DocumentationManager.tsx` - Document library interface
- `SessionComparisonView.tsx` - Compare multiple sessions
- `SessionMetricsPanel.tsx` - Display session statistics

### Modified Components
- `CreateSessionDialog.tsx` - Add milestone planning
- `SessionView.tsx` - Add checkpoint controls
- `ProjectSettingsDialog.tsx` - Add PRP and docs sections

## Implementation Priority

1. **Phase 1: Remove Stravu** ✅ COMPLETED
   - Clean removal of all Stravu-related code
   - Test to ensure no broken dependencies

2. **Phase 2: PRP Support** ✅ COMPLETED
   - Database schema for PRP ✅
   - Comprehensive PRP editor with Markdown preview ✅
   - Include PRP in session context ✅
   - Template system for guided generation ✅
   - Version control for PRPs ✅
   - AI-assisted PRP generation with Claude Code ✅
   - Real-time progress monitoring during generation ✅
   - End-to-end workflow validation ✅
   - Removed `is_active` flag - simplified to single active PRP per project ✅
   - Fixed PRP Editor dialog height issues ✅
   - Refactored PRP services into separate module ✅
   - Removed legacy PRD tables and code ✅
   - PRP selection in New Session dialog ✅
   - Configurable default PRP prompt template ✅
   - Streamlined session creation UI ✅

3. **Phase 3: Documentation References** 🚧 IN PROGRESS
   - Document storage and categorization ✅
   - UI for managing documents ❌
   - Context inclusion for sessions ✅

4. **Phase 4: Long Session Support** (Refinement)
   - Session planning tools
   - Checkpoint system
   - Enhanced metrics

5. **Phase 5: Comparison Tools** (Advanced)
   - Multi-session comparison
   - Advanced filtering
   - Bulk operations

6. **Phase 6: Fork Maintenance** ✅ COMPLETED
   - Remove version update checking ✅
   - Remove Discord integration ✅
   - Clean up external dependencies ✅
   - Fix white screen flash on startup ✅
   - Resolve database migration errors ✅
   - Polish development experience ✅
   - Simplified Welcome screen logic ✅
   - Welcome now auto-tests Claude and only shows on failure ✅
   - Removed complex preference checking for Welcome screen ✅

## Benefits

1. **Better Context**: PRP and docs provide clear guidance to Claude Code
2. **Longer Sessions**: Structured approach supports multi-day development
3. **Quality Control**: Compare multiple approaches before choosing
4. **Professional Workflow**: Move from experimentation to production development
5. **Knowledge Persistence**: Documentation stays with the project

## Migration Strategy

1. Fork Crystal repository
2. Create feature branch for each phase
3. Maintain backward compatibility for existing sessions
4. Provide migration tools for existing projects
5. Extensive testing with real projects

This adaptation will transform Crystal into a powerful tool for serious development work while maintaining its excellent parallel session capabilities.

## Current Status: Ready for Production

**Phase 2 (PRP Support) is complete and production-ready** with:
- ✅ Comprehensive PRP template system (15 templates)
- ✅ AI-assisted generation with real-time progress monitoring
- ✅ Rich Markdown editor with live preview
- ✅ Version control and management
- ✅ Full integration into session workflow
- ✅ End-to-end validation (used PRP to fix actual bugs)
- ✅ Clean separation of PRP and Document services
- ✅ Simplified PRP management without complex active/inactive states
- ✅ PRP selection in session creation with comprehensive execution process
- ✅ Streamlined Create Session dialog with improved UX

**Phase 6 (Fork Maintenance) is complete** with:
- ✅ Clean separation from upstream services
- ✅ Professional user experience without visual glitches
- ✅ Stable database migrations
- ✅ Polished development environment
- ✅ Simplified Welcome screen that focuses on Claude setup
- ✅ Automatic Claude testing with setup guidance when needed

The PRP system has been successfully validated by generating and implementing real bug fixes, demonstrating the complete workflow from requirement generation to implementation.