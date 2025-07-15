import { DatabaseService } from '../database/database';
import { Document } from '../database/models';
import { Logger } from '../utils/logger';

export class LocalDocumentService {
  private db: DatabaseService;
  private logger: Logger;

  constructor(db: DatabaseService, logger: Logger) {
    this.db = db;
    this.logger = logger;
  }

  // Document operations
  async getDocuments(projectId: number | null = null): Promise<Document[]> {
    try {
      // Since project_id no longer exists, we always get all documents
      const query = `SELECT * FROM documents ORDER BY category, created_at DESC`;
      const documents = this.db.db.prepare(query).all() as Document[];

      // Parse tags from JSON
      return documents.map(doc => ({
        ...doc,
        tags: doc.tags ? JSON.parse(doc.tags as unknown as string) : []
      }));
    } catch (error) {
      this.logger.error('Failed to get documents:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getDocument(documentId: number): Promise<Document> {
    try {
      const document = this.db.db.prepare(`
        SELECT * FROM documents WHERE id = ?
      `).get(documentId) as Document | undefined;

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Parse tags from JSON
      return {
        ...document,
        tags: document.tags ? JSON.parse(document.tags as unknown as string) : []
      };
    } catch (error) {
      this.logger.error(`Failed to get document ${documentId}:`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async createDocument(projectId: number | null, title: string, content: string, category = 'general', tags: string[] = [], filePath?: string, url?: string): Promise<Document> {
    try {
      const excerpt = this.createExcerpt(content);
      const wordCount = this.countWords(content);
      const tagsJson = JSON.stringify(tags);

      const result = this.db.db.prepare(`
        INSERT INTO documents (title, content, excerpt, category, tags, word_count, file_path, url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(title, content, excerpt, category, tagsJson, wordCount, filePath || null, url || null);

      this.logger.info(`Created document: ${title}`);
      return this.getDocument(result.lastInsertRowid as number);
    } catch (error) {
      this.logger.error('Failed to create document:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async updateDocument(documentId: number, updates: Partial<Omit<Document, 'id' | 'project_id' | 'created_at'>>): Promise<Document> {
    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.title !== undefined) {
        fields.push('title = ?');
        values.push(updates.title);
      }
      if (updates.content !== undefined) {
        fields.push('content = ?');
        values.push(updates.content);
        fields.push('excerpt = ?');
        values.push(this.createExcerpt(updates.content));
        fields.push('word_count = ?');
        values.push(this.countWords(updates.content));
      }
      if (updates.category !== undefined) {
        fields.push('category = ?');
        values.push(updates.category);
      }
      if (updates.tags !== undefined) {
        fields.push('tags = ?');
        values.push(JSON.stringify(updates.tags));
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(documentId);

      this.db.db.prepare(`
        UPDATE documents 
        SET ${fields.join(', ')}
        WHERE id = ?
      `).run(...values);

      this.logger.info(`Updated document ${documentId}`);
      return this.getDocument(documentId);
    } catch (error) {
      this.logger.error(`Failed to update document ${documentId}:`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async deleteDocument(documentId: number): Promise<void> {
    try {
      this.db.db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);
      this.logger.info(`Deleted document ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to delete document ${documentId}:`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async searchDocuments(projectId: number, query: string, limit = 20): Promise<Document[]> {
    try {
      // Use FTS5 for full-text search
      const results = this.db.db.prepare(`
        SELECT d.*
        FROM documents d
        JOIN documents_fts ON d.id = documents_fts.rowid
        WHERE documents_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(query, limit) as Document[];

      // Parse tags from JSON
      return results.map(doc => ({
        ...doc,
        tags: doc.tags ? JSON.parse(doc.tags as unknown as string) : []
      }));
    } catch (error) {
      this.logger.warn('FTS search failed, falling back to LIKE search:', error instanceof Error ? error : new Error(String(error)));
      
      // Fallback to basic LIKE search
      const likeQuery = `%${query}%`;
      const results = this.db.db.prepare(`
        SELECT * FROM documents
        WHERE title LIKE ? OR 
          content LIKE ? OR 
          tags LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(likeQuery, likeQuery, likeQuery, limit) as Document[];

      return results.map(doc => ({
        ...doc,
        tags: doc.tags ? JSON.parse(doc.tags as unknown as string) : []
      }));
    }
  }



  // Session document associations
  async addDocumentsToSession(sessionId: string, documentIds: number[]): Promise<void> {
    try {
      const stmt = this.db.db.prepare(`
        INSERT OR IGNORE INTO session_documents (session_id, document_id)
        VALUES (?, ?)
      `);

      for (const docId of documentIds) {
        stmt.run(sessionId, docId);
      }

      this.logger.info(`Added ${documentIds.length} documents to session ${sessionId}`);
    } catch (error) {
      this.logger.error('Failed to add documents to session:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }


  async getSessionDocuments(sessionId: string): Promise<Document[]> {
    try {
      const documents = this.db.db.prepare(`
        SELECT d.*
        FROM documents d
        JOIN session_documents sd ON d.id = sd.document_id
        WHERE sd.session_id = ?
        ORDER BY sd.included_at
      `).all(sessionId) as Document[];

      return documents.map(doc => ({
        ...doc,
        tags: doc.tags ? JSON.parse(doc.tags as unknown as string) : []
      }));
    } catch (error) {
      this.logger.error('Failed to get session documents:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Helper methods
  private createExcerpt(content: string, maxLength = 150): string {
    if (!content) return '';

    // Remove markdown formatting
    const text = content.replace(/[#*`_\[\]]/g, '').trim();
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  private countWords(content: string): number {
    if (!content) return 0;
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }

  // Format document for Claude
  formatDocumentForClaude(document: Document): string {
    return `# 📄 Document: ${document.title}

Category: ${document.category}
${document.tags && document.tags.length > 0 ? `Tags: ${document.tags.join(', ')}` : ''}

${document.content}

---
*Source: Local document "${document.title}" (Last updated: ${new Date(document.updated_at).toLocaleDateString()})*`;
  }

}