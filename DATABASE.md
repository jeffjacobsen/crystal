# Crystal Database Documentation

## Database Location
The SQLite database is stored at: `~/.crystal/sessions.db`

On macOS, this expands to: `/Users/[your-username]/.crystal/sessions.db`

## Database Schema Overview

The database contains the following tables organized by functionality:

### Core Tables

1. **projects** - Project configurations and paths
   - Stores project name, path, main branch, and settings
   - Links to sessions and PRPs

2. **sessions** - Claude Code session metadata
   - Tracks session status, prompt, worktree info
   - Links to project and contains timing information

3. **session_outputs** - Raw terminal output storage
   - Stores stdout/stderr from Claude Code processes
   - Indexed by session_id and timestamp

4. **conversation_messages** - Full conversation history
   - Preserves complete Claude conversations for continuations
   - JSON storage of messages with roles and content

5. **execution_diffs** - Git diff snapshots
   - Captures git diffs at each execution checkpoint
   - Useful for tracking changes over time

6. **prompt_markers** - Prompt timestamp tracking
   - Marks when prompts were sent and completed
   - Enables prompt-based navigation in UI

### PRP/Document Tables

7. **product_requirement_prompts** - PRP storage
   - Main PRP content with title and versioning
   - Project-independent (can be used across any project)
   - No longer tracks active/inactive status (simplified)

8. **product_requirement_prompts_fts** - Full-text search for PRPs
   - SQLite FTS5 virtual table for fast searching

9. ~~**prp_versions**~~ - Not implemented
   - Version tracking is done via the `version` field in product_requirement_prompts
   - Full version history not currently stored

10. **documents** - Local documentation storage
    - Stores project documentation and references
    - Supports categories and tags

11. **documents_fts** - Full-text search for documents
    - FTS5 virtual table for document searching

12. **session_documents** - Session-document associations
    - Links sessions to relevant documents
    - Many-to-many relationship table

13. **session_prp** - Session-PRP associations
    - Tracks which PRP was used for each session
    - Stores the PRP version at time of session creation

### Additional Tables

14. **session_milestones** - Session planning
    - For tracking progress in longer sessions
    - Supports multi-day development workflows

15. **session_metrics** - Session statistics
    - Tracks tokens used, time spent, commits made
    - Useful for productivity analytics

16. **folders** - Session organization
    - Groups sessions into folders per project
    - Flat organization (no hierarchy currently)

17. **project_run_commands** - Custom run commands
    - Stores multiple run commands per project
    - Replaces single run_script field

18. **ui_state** - UI preferences storage
    - Stores persistent UI state (e.g., panel sizes)

19. **app_opens** - Application launch tracking
    - Tracks when the app is opened

20. **user_preferences** - User settings
    - Key-value storage for user preferences

21. **file_index** - File indexing for projects
    - Indexes project files for searching (not fully implemented)

## SQLite Database Utilities

### 1. Command Line (sqlite3)

```bash
# Connect to database
sqlite3 ~/.crystal/sessions.db

# Once connected:
.tables                    # List all tables
.schema projects          # Show schema for a specific table
.headers on              # Show column headers in query results
.mode column             # Format output in columns
.width 20 50            # Set column widths

# Example queries
SELECT * FROM product_requirement_prompts;
SELECT id, name, path FROM projects;
.quit                    # Exit
```

### 2. GUI Tools

**macOS:**
- **TablePlus** (Free tier available) - Modern, beautiful interface
  - Download: https://tableplus.com/
- **DB Browser for SQLite** (Free) - Simple and effective
  - Download: https://sqlitebrowser.org/
- **SQLiteStudio** (Free) - Feature-rich with query builder
  - Download: https://sqlitestudio.pl/

**Cross-platform:**
- **DBeaver** (Free) - Comprehensive database tool
  - Download: https://dbeaver.io/
- **DataGrip** (Paid) - JetBrains professional database IDE
  - Download: https://www.jetbrains.com/datagrip/

### 3. VS Code Extensions

- **SQLite Viewer** by qwtel
  - View SQLite files directly in VS Code
  - Read-only but great for quick inspection
  
- **SQLite** by alexcvzz
  - Browse and query SQLite databases
  - Supports running queries and viewing results

### 4. Useful Queries

```sql
-- View all PRPs (project-independent)
SELECT 
  prp.id,
  prp.title,
  prp.version,
  prp.created_at,
  prp.updated_at
FROM product_requirement_prompts prp
ORDER BY prp.updated_at DESC;

-- Count sessions per project
SELECT 
  p.name as project_name,
  COUNT(s.id) as session_count,
  COUNT(CASE WHEN s.status = 'running' THEN 1 END) as running_sessions
FROM projects p
LEFT JOIN sessions s ON p.id = s.project_id
GROUP BY p.id
ORDER BY session_count DESC;

-- Find recent sessions with their execution times
SELECT 
  s.name,
  s.status,
  s.created_at,
  s.run_started_at,
  julianday(s.updated_at) - julianday(s.run_started_at) as days_elapsed
FROM sessions s
WHERE s.run_started_at IS NOT NULL
ORDER BY s.created_at DESC
LIMIT 10;

-- Search for PRPs containing specific text
SELECT 
  prp.title,
  snippet(product_requirement_prompts_fts, -1, '**', '**', '...', 20) as match_snippet
FROM product_requirement_prompts_fts
JOIN product_requirement_prompts prp ON product_requirement_prompts_fts.rowid = prp.id
WHERE product_requirement_prompts_fts MATCH 'search term';

-- View session metrics
SELECT 
  s.name as session_name,
  sm.total_time_seconds / 3600.0 as hours_spent,
  sm.tokens_used,
  sm.commits_made,
  sm.files_changed
FROM session_metrics sm
JOIN sessions s ON sm.session_id = s.id
ORDER BY sm.total_time_seconds DESC;

-- View sessions with their PRPs
SELECT 
  s.name as session_name,
  p.name as project_name,
  prp.title as prp_title,
  sp.prp_version,
  s.created_at
FROM sessions s
JOIN projects p ON s.project_id = p.id
LEFT JOIN session_prp sp ON s.id = sp.session_id
LEFT JOIN product_requirement_prompts prp ON sp.prp_id = prp.id
WHERE s.created_at > date('now', '-7 days')
ORDER BY s.created_at DESC;
```

## Database Backup

It's recommended to periodically backup your database:

```bash
# Create backup
cp ~/.crystal/sessions.db ~/.crystal/sessions_backup_$(date +%Y%m%d).db

# Create compressed backup
sqlite3 ~/.crystal/sessions.db ".backup ~/.crystal/sessions_backup.db"
gzip ~/.crystal/sessions_backup.db
```

## Database Maintenance

```bash
# Vacuum database (reclaim space and optimize)
sqlite3 ~/.crystal/sessions.db "VACUUM;"

# Analyze database (update statistics for query optimizer)
sqlite3 ~/.crystal/sessions.db "ANALYZE;"

# Check database integrity
sqlite3 ~/.crystal/sessions.db "PRAGMA integrity_check;"
```

## Schema Migrations

The database schema is managed through migrations in `/main/src/database/database.ts`. Each migration checks for existing structures before applying changes, making them safe to run multiple times.

Key migration features:
- Automatic index creation for performance
- Safe column additions with NULL checks
- Data migration when restructuring tables
- Full-text search index maintenance

## Notes

- The database uses SQLite's Write-Ahead Logging (WAL) mode for better concurrency
- All timestamps are stored in UTC
- Full-text search uses SQLite's FTS5 extension
- Foreign key constraints are enforced for data integrity
- The database is created automatically on first run

## Recent Schema Changes

- **Removed**: `is_active` field from product_requirement_prompts (simplified to single active PRP)
- **Removed**: `project_id` from product_requirement_prompts (now project-independent)
- **Removed**: Legacy `product_requirements` and `session_prd` tables
- **Renamed**: `product_requirements` → `product_requirement_prompts`
- **Renamed**: `session_prd` → `session_prp`
- **Note**: `prp_versions` table mentioned in models but not implemented in schema