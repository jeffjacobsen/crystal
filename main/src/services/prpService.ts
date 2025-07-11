import { DatabaseService } from '../database/database';
import { ProductRequirementPrompt } from '../database/models';
import { Logger } from '../utils/logger';

export class PRPService {
  private db: DatabaseService;
  private logger: Logger;

  constructor(db: DatabaseService, logger: Logger) {
    this.db = db;
    this.logger = logger;
  }

  // Get a specific PRP by ID
  async getPRP(prpId: number): Promise<ProductRequirementPrompt> {
    try {
      const prp = this.db.db.prepare(`
        SELECT * FROM product_requirement_prompts WHERE id = ?
      `).get(prpId) as ProductRequirementPrompt | undefined;

      if (!prp) {
        throw new Error(`PRP ${prpId} not found`);
      }

      return prp;
    } catch (error) {
      this.logger.error(`Failed to get PRP ${prpId}:`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Get all PRPs (project-independent)
  async getAllPRPs(projectId?: number): Promise<ProductRequirementPrompt[]> {
    // projectId parameter kept for backward compatibility but not used
    try {
      const prps = this.db.db.prepare(`
        SELECT * FROM product_requirement_prompts 
        ORDER BY updated_at DESC
      `).all() as ProductRequirementPrompt[];

      return prps || [];
    } catch (error) {
      this.logger.error(`Failed to get all PRPs:`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Create a new PRP
  async createPRP(projectId: number, title: string, content: string): Promise<ProductRequirementPrompt> {
    // projectId parameter kept for backward compatibility but not used
    // console.log('[PRPService] createPRP called');
    // console.log('[PRPService] Title:', title);
    // console.log('[PRPService] Content length:', content?.length);
    
    try {
      // console.log('[PRPService] Inserting new PRP');
      const result = this.db.db.prepare(`
        INSERT INTO product_requirement_prompts (title, content, version)
        VALUES (?, ?, 1)
      `).run(title, content);

      // console.log('[PRPService] Insert result:', result);
      this.logger.info(`Created PRP: ${title}`);
      
      const newPRP = this.getPRP(result.lastInsertRowid as number);
      // console.log('[PRPService] Retrieved new PRP:', newPRP);
      
      return newPRP;
    } catch (error) {
      console.error('[PRPService] Error creating PRP:', error);
      this.logger.error('Failed to create PRP:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Update an existing PRP
  async updatePRP(prpId: number, content: string, createNewVersion = false): Promise<ProductRequirementPrompt> {
    // console.log('[PRPService] updatePRP called');
    // console.log('[PRPService] PRP ID:', prpId);
    // console.log('[PRPService] Content length:', content?.length);
    // console.log('[PRPService] Create new version:', createNewVersion);
    
    try {
      if (createNewVersion) {
        // Get current PRP
        const currentPRP = await this.getPRP(prpId);
        // console.log('[PRPService] Current PRP:', currentPRP);

        // Create new version
        // console.log('[PRPService] Creating new version');
        const result = this.db.db.prepare(`
          INSERT INTO product_requirement_prompts (title, content, version)
          VALUES (?, ?, ?)
        `).run(currentPRP.title, content, currentPRP.version + 1);

        // console.log('[PRPService] Insert result:', result);
        const newPRP = this.getPRP(result.lastInsertRowid as number);
        // console.log('[PRPService] New version PRP:', newPRP);
        return newPRP;
      } else {
        // Update existing PRP
        // console.log('[PRPService] Updating existing PRP');
        const updateResult = this.db.db.prepare(`
          UPDATE product_requirement_prompts 
          SET content = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(content, prpId);
        
        // console.log('[PRPService] Update result:', updateResult);
        const updatedPRP = this.getPRP(prpId);
        // console.log('[PRPService] Updated PRP:', updatedPRP);
        return updatedPRP;
      }
    } catch (error) {
      console.error('[PRPService] Error updating PRP:', error);
      this.logger.error(`Failed to update PRP ${prpId}:`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Delete a PRP
  async deletePRP(prpId: number): Promise<void> {
    try {
      // console.log('[PRPService] Deleting PRP:', prpId);
      
      const result = this.db.db.prepare(`
        DELETE FROM product_requirement_prompts WHERE id = ?
      `).run(prpId);
      
      // console.log('[PRPService] Delete result:', result);
      
      if (result.changes === 0) {
        throw new Error(`PRP with ID ${prpId} not found`);
      }
    } catch (error) {
      console.error('[PRPService] Error deleting PRP:', error);
      this.logger.error(`Failed to delete PRP ${prpId}:`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Add PRP to session for tracking
  async addPRPToSession(sessionId: string, prpId: number, prpVersion: number): Promise<void> {
    try {
      // console.log(`[PRPService] Adding PRP ${prpId} v${prpVersion} to session ${sessionId}`);
      
      const result = this.db.db.prepare(`
        INSERT INTO session_prp (session_id, prp_id, prp_version)
        VALUES (?, ?, ?)
      `).run(sessionId, prpId, prpVersion);
      
      // console.log('[PRPService] Session PRP association created:', result);
    } catch (error) {
      this.logger.error(`Failed to add PRP to session ${sessionId}:`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Get PRPs associated with a session
  async getSessionPRPs(sessionId: string): Promise<Array<{prp_id: number, prp_version: number}>> {
    try {
      const prps = this.db.db.prepare(`
        SELECT prp_id, prp_version 
        FROM session_prp 
        WHERE session_id = ?
      `).all(sessionId) as Array<{prp_id: number, prp_version: number}>;
      
      return prps || [];
    } catch (error) {
      this.logger.error(`Failed to get PRPs for session ${sessionId}:`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Format PRP for Claude
  formatPRPForClaude(prp: ProductRequirementPrompt): string {
    return `# 📋 Product Requirement Prompt: ${prp.title}

Version: ${prp.version}

${prp.content}

---
*Use this PRP to understand the requirements, context, and validation gates for implementation.*`;
  }
}