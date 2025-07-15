import type { App, BrowserWindow } from 'electron';
import type { TaskQueue } from '../services/taskQueue';
import type { SessionManager } from '../services/sessionManager';
import type { ConfigManager } from '../services/configManager';
import type { WorktreeManager } from '../services/worktreeManager';
import type { WorktreeNameGenerator } from '../services/worktreeNameGenerator';
import type { GitDiffManager } from '../services/gitDiffManager';
import type { ExecutionTracker } from '../services/executionTracker';
import type { DatabaseService } from '../database/database';
import type { RunCommandManager } from '../services/runCommandManager';
import type { ClaudeCodeManager } from '../services/claudeCodeManager';
import type { LocalDocumentService } from '../services/localDocumentService';
import type { PRPService } from '../services/prpService';
import type { TemplateService } from '../services/templateService';
import type { PRPGenerationService } from '../services/prpGenerationService';
import type { WebScrapingService } from '../services/webScrapingService';

export interface AppServices {
  app: App;
  configManager: ConfigManager;
  databaseService: DatabaseService;
  sessionManager: SessionManager;
  worktreeManager: WorktreeManager;
  claudeCodeManager: ClaudeCodeManager;
  gitDiffManager: GitDiffManager;
  executionTracker: ExecutionTracker;
  worktreeNameGenerator: WorktreeNameGenerator;
  runCommandManager: RunCommandManager;
  localDocumentService: LocalDocumentService;
  prpService: PRPService;
  templateService: TemplateService;
  prpGenerationService: PRPGenerationService;
  webScrapingService?: WebScrapingService;
  taskQueue: TaskQueue | null;
  getMainWindow: () => BrowserWindow | null;
} 