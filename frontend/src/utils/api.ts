// Utility for making API calls using Electron IPC

// Type for IPC response
export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  command?: string;
}

// Check if we're running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI;
};

// Wrapper class for API calls that provides error handling and consistent interface
export class API {
  // Session management
  static sessions = {
    async getAll() {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.getAll();
    },

    async getAllWithProjects() {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.getAllWithProjects();
    },

    async get(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.get(sessionId);
    },

    async create(request: any) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.create(request);
    },

    async delete(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.delete(sessionId);
    },

    async sendInput(sessionId: string, input: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.sendInput(sessionId, input);
    },

    async continue(sessionId: string, prompt?: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.continue(sessionId, prompt);
    },

    async getOutput(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.getOutput(sessionId);
    },

    async getConversation(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.getConversation(sessionId);
    },

    async markViewed(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.markViewed(sessionId);
    },

    async stop(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.stop(sessionId);
    },

    async getExecutions(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.getExecutions(sessionId);
    },

    async getExecutionDiff(sessionId: string, executionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.getExecutionDiff(sessionId, executionId);
    },

    async gitCommit(sessionId: string, message: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.gitCommit(sessionId, message);
    },

    async gitDiff(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.gitDiff(sessionId);
    },

    async getCombinedDiff(sessionId: string, executionIds?: number[]) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.getCombinedDiff(sessionId, executionIds);
    },

    // Main repo session
    async getOrCreateMainRepoSession(projectId: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.getOrCreateMainRepoSession(projectId);
    },

    // Script operations
    async hasRunScript(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.hasRunScript(sessionId);
    },

    async getRunningSession() {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.getRunningSession();
    },

    async runScript(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.runScript(sessionId);
    },

    async stopScript() {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.stopScript();
    },

    async runTerminalCommand(sessionId: string, command: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.runTerminalCommand(sessionId, command);
    },

    async sendTerminalInput(sessionId: string, data: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.sendTerminalInput(sessionId, data);
    },

    async preCreateTerminal(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.preCreateTerminal(sessionId);
    },

    async resizeTerminal(sessionId: string, cols: number, rows: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.resizeTerminal(sessionId, cols, rows);
    },

    // Prompt operations
    async getPrompts(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.getPrompts(sessionId);
    },

    // Git rebase operations
    async rebaseMainIntoWorktree(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.rebaseMainIntoWorktree(sessionId);
    },

    async abortRebaseAndUseClaude(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.abortRebaseAndUseClaude(sessionId);
    },

    async squashAndRebaseToMain(sessionId: string, commitMessage: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.squashAndRebaseToMain(sessionId, commitMessage);
    },

    async rebaseToMain(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.rebaseToMain(sessionId);
    },

    // Git operation helpers
    async hasChangesToRebase(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.hasChangesToRebase(sessionId);
    },

    async generateName(prompt: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.generateName(prompt);
    },

    async rename(sessionId: string, newName: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.rename(sessionId, newName);
    },

    async toggleFavorite(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.toggleFavorite(sessionId);
    },

    async toggleAutoCommit(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.toggleAutoCommit(sessionId);
    },

    async getGitCommands(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.getGitCommands(sessionId);
    },

    // Git pull/push operations
    async gitPull(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.gitPull(sessionId);
    },

    async gitPush(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.gitPush(sessionId);
    },

    async getLastCommits(sessionId: string, count: number = 20) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.getLastCommits(sessionId, count);
    },

    async openIDE(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.openIDE(sessionId);
    },

    async reorder(sessionOrders: Array<{ id: string; displayOrder: number }>) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessions.reorder(sessionOrders);
    },
  };

  // Project management
  static projects = {
    async getAll() {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.projects.getAll();
    },

    async getActive() {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.projects.getActive();
    },

    async create(projectData: any) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.projects.create(projectData);
    },

    async activate(projectId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.projects.activate(projectId);
    },

    async update(projectId: string, updates: any) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.projects.update(projectId, updates);
    },

    async delete(projectId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.projects.delete(projectId);
    },

    async detectBranch(path: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.projects.detectBranch(path);
    },

    async reorder(projectOrders: Array<{ id: number; displayOrder: number }>) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.projects.reorder(projectOrders);
    },

    async listBranches(projectId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.projects.listBranches(projectId);
    },
  };

  // Folders
  static folders = {
    async getByProject(projectId: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.folders.getByProject(projectId);
    },

    async create(name: string, projectId: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.folders.create(name, projectId);
    },

    async update(folderId: string, updates: { name?: string; display_order?: number }) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.folders.update(folderId, updates);
    },

    async delete(folderId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.folders.delete(folderId);
    },

    async reorder(projectId: number, folderIds: string[]) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.folders.reorder(projectId, folderIds);
    },

    async moveSession(sessionId: string, folderId: string | null) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.folders.moveSession(sessionId, folderId);
    },
  };

  // Configuration
  static config = {
    async get() {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.config.get();
    },

    async update(updates: any) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.config.update(updates);
    },

    async testClaude(customPath?: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.config.testClaude(customPath);
    },
  };

  // Prompts
  static prompts = {
    async getAll() {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prompts.getAll();
    },
    
    async getByPromptId(promptId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prompts.getByPromptId(promptId);
    },
  };

  // Dialog
  static dialog = {
    async openFile(options?: any) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.dialog.openFile(options);
    },

    async openDirectory(options?: any) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.dialog.openDirectory(options);
    },
  };

  // Permissions
  static permissions = {
    async respond(requestId: string, response: any) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.permissions.respond(requestId, response);
    },

    async getPending() {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.permissions.getPending();
    },
  };


  // Document management
  static documents = {
    async getAll(projectId: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.documents.getAll(projectId);
    },

    async get(documentId: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.documents.get(documentId);
    },

    async create(projectId: number, title: string, content: string, category?: string, tags?: string[], filePath?: string, url?: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.documents.create(projectId, title, content, category, tags, filePath, url);
    },

    async update(documentId: number, updates: any) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.documents.update(documentId, updates);
    },

    async delete(documentId: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.documents.delete(documentId);
    },

    async search(projectId: number, query: string, limit?: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.documents.search(projectId, query, limit);
    },
  };

  // PRP (Product Requirement Prompt) management
  static prp = {
    async get(prpId: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prp.get(prpId);
    },

    async getAll(projectId?: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prp.getAll(projectId);
    },

    async create(projectId: number, title: string, content: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prp.create(projectId, title, content);
    },

    async update(prpId: number, content: string, createNewVersion?: boolean) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prp.update(prpId, content, createNewVersion);
    },

    async delete(prpId: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prp.delete(prpId);
    },

    async generateFromTemplate(request: {
      templateId: string;
      featureRequest: string;
      additionalContext?: string;
      codebasePath?: string;
      variables?: Record<string, any>;
      streamProgress?: boolean;
    }) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prp.generateFromTemplate(request);
    },

    async getTemplates() {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prp.getTemplates();
    },

    async validateTemplate(templatePath: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prp.validateTemplate(templatePath);
    },

    async reloadTemplates(customPaths?: string[]) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prp.reloadTemplates(customPaths);
    },
  };

  // PRD management (legacy for backward compatibility)
  static prd = {
    async getActive(projectId: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prd.getActive(projectId);
    },

    async get(prdId: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prd.get(prdId);
    },

    async create(projectId: number, title: string, content: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prd.create(projectId, title, content);
    },

    async update(prdId: number, content: string, createNewVersion?: boolean) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.prd.update(prdId, content, createNewVersion);
    },
  };

  // Session document associations
  static sessionDocuments = {
    async add(sessionId: string, documentIds: number[]) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessionDocuments.add(sessionId, documentIds);
    },

    async addPRP(sessionId: string, prpId: number, prpVersion: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessionDocuments.addPRP(sessionId, prpId, prpVersion);
    },

    async addPRD(sessionId: string, prdId: number, prdVersion: number) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessionDocuments.addPRD(sessionId, prdId, prdVersion);
    },

    async get(sessionId: string) {
      if (!isElectron()) throw new Error('Electron API not available');
      return window.electronAPI.sessionDocuments.get(sessionId);
    },
  };

}

// Legacy support - removed as migration is complete
// All HTTP API calls have been migrated to IPC via the API class