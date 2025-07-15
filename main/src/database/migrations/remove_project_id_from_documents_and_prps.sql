-- Remove project_id from documents and product_requirement_prompts tables
-- SQLite doesn't support DROP COLUMN, so we need to recreate the tables

-- 1. Create new documents table without project_id
CREATE TABLE documents_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  category TEXT DEFAULT 'general',
  tags TEXT, -- JSON array
  word_count INTEGER,
  file_path TEXT, -- Optional local file reference
  url TEXT, -- Optional URL reference
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Copy data from old table (excluding project_id)
INSERT INTO documents_new (id, title, content, excerpt, category, tags, word_count, file_path, url, created_at, updated_at)
SELECT id, title, content, excerpt, category, tags, word_count, file_path, url, created_at, updated_at
FROM documents;

-- 3. Drop old table and rename new one
DROP TABLE documents;
ALTER TABLE documents_new RENAME TO documents;

-- 4. Recreate indexes (without project index)
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);

-- 5. Recreate FTS table
DROP TABLE IF EXISTS documents_fts;
CREATE VIRTUAL TABLE documents_fts USING fts5(
  title, 
  content, 
  tags,
  content=documents,
  content_rowid=id
);

-- 6. Recreate triggers for FTS
DROP TRIGGER IF EXISTS documents_ai;
CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, title, content, tags)
  VALUES (new.id, new.title, new.content, new.tags);
END;

DROP TRIGGER IF EXISTS documents_au;
CREATE TRIGGER documents_au AFTER UPDATE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content, tags)
  VALUES ('delete', old.id, old.title, old.content, old.tags);
  INSERT INTO documents_fts(rowid, title, content, tags)
  VALUES (new.id, new.title, new.content, new.tags);
END;

DROP TRIGGER IF EXISTS documents_ad;
CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content, tags)
  VALUES ('delete', old.id, old.title, old.content, old.tags);
END;

-- 7. Create new product_requirement_prompts table without project_id
CREATE TABLE product_requirement_prompts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Copy data if table exists (excluding project_id)
INSERT INTO product_requirement_prompts_new (id, title, content, version, created_at, updated_at)
SELECT id, title, content, version, created_at, updated_at
FROM product_requirement_prompts
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='product_requirement_prompts');

-- 9. Drop old table and rename
DROP TABLE IF EXISTS product_requirement_prompts;
ALTER TABLE product_requirement_prompts_new RENAME TO product_requirement_prompts;