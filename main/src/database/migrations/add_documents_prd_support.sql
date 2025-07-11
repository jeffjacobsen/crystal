-- Add support for local documents and PRD (Product Requirements Documents)
-- This migration adds tables for managing project documentation and requirements

-- Product Requirements Documents table
CREATE TABLE IF NOT EXISTS product_requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Local documents table (replaces cloud notebooks)
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  category TEXT DEFAULT 'general',
  tags TEXT, -- JSON array
  word_count INTEGER,
  file_path TEXT, -- Optional local file reference
  url TEXT, -- Optional URL reference
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Full-text search index for documents
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  title, 
  content, 
  tags,
  content=documents,
  content_rowid=id
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, title, content, tags)
  VALUES (new.id, new.title, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content, tags)
  VALUES ('delete', old.id, old.title, old.content, old.tags);
  INSERT INTO documents_fts(rowid, title, content, tags)
  VALUES (new.id, new.title, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content, tags)
  VALUES ('delete', old.id, old.title, old.content, old.tags);
END;

-- Session documents association (which documents were included in a session)
CREATE TABLE IF NOT EXISTS session_documents (
  session_id TEXT NOT NULL,
  document_id INTEGER NOT NULL,
  included_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, document_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Session PRD association
CREATE TABLE IF NOT EXISTS session_prd (
  session_id TEXT NOT NULL,
  prd_id INTEGER NOT NULL,
  prd_version INTEGER NOT NULL,
  included_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (prd_id) REFERENCES product_requirements(id) ON DELETE CASCADE
);

-- File index for local search (future enhancement)
CREATE TABLE IF NOT EXISTS file_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  size INTEGER,
  modified_at DATETIME,
  content_preview TEXT,
  indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Session milestones for longer coding sessions
CREATE TABLE IF NOT EXISTS session_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Session metrics for tracking longer sessions
CREATE TABLE IF NOT EXISTS session_metrics (
  session_id TEXT PRIMARY KEY,
  total_time_seconds INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  commits_made INTEGER DEFAULT 0,
  files_changed INTEGER DEFAULT 0,
  lines_added INTEGER DEFAULT 0,
  lines_deleted INTEGER DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_prd_project ON product_requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_prd_active ON product_requirements(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_file_index_project ON file_index(project_id);
CREATE INDEX IF NOT EXISTS idx_session_milestones_session ON session_milestones(session_id);