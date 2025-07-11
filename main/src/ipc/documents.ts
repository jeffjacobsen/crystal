import { ipcMain } from 'electron';
import type { AppServices } from './types';
import type { PRPGenerationRequest } from '../types/prp';

export function registerDocumentHandlers(services: AppServices) {
  const { localDocumentService: documentService, prpService } = services;

  // Document operations
  ipcMain.handle('documents:get-all', async (_, projectId: number) => {
    try {
      const documents = await documentService.getDocuments(projectId);
      return { success: true, data: documents };
    } catch (error) {
      console.error('Failed to get documents:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get documents' };
    }
  });

  ipcMain.handle('documents:get', async (_, documentId: number) => {
    try {
      const document = await documentService.getDocument(documentId);
      return { success: true, data: document };
    } catch (error) {
      console.error('Failed to get document:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get document' };
    }
  });

  ipcMain.handle('documents:create', async (_, projectId: number, title: string, content: string, category?: string, tags?: string[], filePath?: string, url?: string) => {
    try {
      const document = await documentService.createDocument(
        projectId, 
        title, 
        content, 
        category || 'general', 
        tags || [], 
        filePath, 
        url
      );
      return { success: true, data: document };
    } catch (error) {
      console.error('Failed to create document:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create document' };
    }
  });

  ipcMain.handle('documents:update', async (_, documentId: number, updates: any) => {
    try {
      const document = await documentService.updateDocument(documentId, updates);
      return { success: true, data: document };
    } catch (error) {
      console.error('Failed to update document:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update document' };
    }
  });

  ipcMain.handle('documents:delete', async (_, documentId: number) => {
    try {
      await documentService.deleteDocument(documentId);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete document:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete document' };
    }
  });

  ipcMain.handle('documents:search', async (_, projectId: number, query: string, limit?: number) => {
    try {
      const results = await documentService.searchDocuments(projectId, query, limit);
      return { success: true, data: results };
    } catch (error) {
      console.error('Failed to search documents:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to search documents' };
    }
  });

  // PRP (Product Requirement Prompt) operations

  ipcMain.handle('prp:get', async (_, prpId: number) => {
    try {
      const prp = await prpService.getPRP(prpId);
      return { success: true, data: prp };
    } catch (error) {
      console.error('Failed to get PRP:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get PRP' };
    }
  });

  ipcMain.handle('prp:get-all', async (_, projectId: number) => {
    try {
      const prps = await prpService.getAllPRPs(projectId);
      return { success: true, data: prps };
    } catch (error) {
      console.error('Failed to get all PRPs:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get all PRPs' };
    }
  });

  ipcMain.handle('prp:create', async (_, projectId: number, title: string, content: string) => {
    // console.log('[IPC] prp:create called');
    // console.log('[IPC] Project ID:', projectId);
    // console.log('[IPC] Title:', title);
    // console.log('[IPC] Content length:', content?.length);
    
    try {
      const prp = await prpService.createPRP(projectId, title, content);
      // console.log('[IPC] Created PRP:', prp);
      return { success: true, data: prp };
    } catch (error) {
      console.error('[IPC] Failed to create PRP:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create PRP' };
    }
  });

  ipcMain.handle('prp:update', async (_, prpId: number, content: string, createNewVersion?: boolean) => {
    // console.log('[IPC] prp:update called');
    // console.log('[IPC] PRP ID:', prpId);
    // console.log('[IPC] Content length:', content?.length);
    // console.log('[IPC] Create new version:', createNewVersion);
    
    try {
      const prp = await prpService.updatePRP(prpId, content, createNewVersion);
      // console.log('[IPC] Updated PRP:', prp);
      return { success: true, data: prp };
    } catch (error) {
      console.error('[IPC] Failed to update PRP:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update PRP' };
    }
  });

  ipcMain.handle('prp:delete', async (_, prpId: number) => {
    // console.log('[IPC] prp:delete called');
    try {
      await prpService.deletePRP(prpId);
      // console.log('[IPC] Deleted PRP:', prpId);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to delete PRP:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete PRP' };
    }
  });

  ipcMain.handle('prp:generate-from-template', async (event, request: PRPGenerationRequest) => {
    // console.log('[IPC] prp:generate-from-template called with:', JSON.stringify({
    //   templateId: request.templateId,
    //   hasFeatureRequest: !!request.featureRequest,
    //   codebasePath: request.codebasePath,
    //   streamProgress: request.streamProgress
    // }));
    
    try {
      // Enable streaming by default
      request.streamProgress = request.streamProgress !== false;
      
      // Set up progress listener if streaming is enabled
      if (request.streamProgress) {
        // console.log('[IPC] Setting up progress listener for PRP generation');
        const progressHandler = (progress: any) => {
          // console.log('[IPC] Sending progress to renderer:', progress);
          event.sender.send('prp:generation-progress', progress);
        };
        
        // Add progress listener
        services.prpGenerationService.on('progress', progressHandler);
        
        try {
          const result = await services.prpGenerationService.generateFromTemplate(request);
          return { success: true, data: result };
        } finally {
          // Clean up listener
          services.prpGenerationService.removeListener('progress', progressHandler);
        }
      } else {
        // No streaming
        const result = await services.prpGenerationService.generateFromTemplate(request);
        return { success: true, data: result };
      }
    } catch (error) {
      console.error('Failed to generate PRP from template:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to generate PRP' };
    }
  });

  // Session document associations
  ipcMain.handle('session-documents:add', async (_, sessionId: string, documentIds: number[]) => {
    try {
      await documentService.addDocumentsToSession(sessionId, documentIds);
      return { success: true };
    } catch (error) {
      console.error('Failed to add documents to session:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add documents to session' };
    }
  });

  ipcMain.handle('session-documents:add-prp', async (_, sessionId: string, prpId: number, prpVersion: number) => {
    try {
      await prpService.addPRPToSession(sessionId, prpId, prpVersion);
      return { success: true };
    } catch (error) {
      console.error('Failed to add PRP to session:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add PRP to session' };
    }
  });

  ipcMain.handle('session-documents:get', async (_, sessionId: string) => {
    try {
      const documents = await documentService.getSessionDocuments(sessionId);
      return { success: true, data: documents };
    } catch (error) {
      console.error('Failed to get session documents:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get session documents' };
    }
  });

  // PRP Template operations
  ipcMain.handle('prp:get-templates', async () => {
    try {
      const templates = services.templateService.getAllTemplates();
      return { success: true, data: templates };
    } catch (error) {
      console.error('Failed to get templates:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get templates' };
    }
  });

  ipcMain.handle('prp:validate-template', async (_, templatePath: string) => {
    try {
      const result = await services.templateService.validateTemplate(templatePath);
      return { success: true, data: result };
    } catch (error) {
      console.error('Failed to validate template:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to validate template' };
    }
  });

  ipcMain.handle('prp:reload-templates', async (_, customPaths?: string[]) => {
    try {
      await services.templateService.loadTemplates(customPaths);
      const templates = services.templateService.getAllTemplates();
      return { success: true, data: templates };
    } catch (error) {
      console.error('Failed to reload templates:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to reload templates' };
    }
  });

  // Export the service for use in other modules
  return documentService;
}