import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { TaskQueue } from './services/taskQueue';
import { SessionManager } from './services/sessionManager';
import { ConfigManager } from './services/configManager';
import { WorktreeManager } from './services/worktreeManager';
import { WorktreeNameGenerator } from './services/worktreeNameGenerator';
import { GitDiffManager } from './services/gitDiffManager';
import { ExecutionTracker } from './services/executionTracker';
import { DatabaseService } from './database/database';
import { RunCommandManager } from './services/runCommandManager';
import { PermissionIpcServer } from './services/permissionIpcServer';
import { Logger } from './utils/logger';
import { setCrystalDirectory } from './utils/crystalDirectory';
import { registerIpcHandlers } from './ipc';
import { setupEventListeners } from './events';
import { AppServices } from './ipc/types';
import { ClaudeCodeManager } from './services/claudeCodeManager';

let mainWindow: BrowserWindow | null = null;
let taskQueue: TaskQueue | null = null;

// Service instances
let configManager: ConfigManager;
let logger: Logger;
let sessionManager: SessionManager;
let worktreeManager: WorktreeManager;
let claudeCodeManager: ClaudeCodeManager;
let gitDiffManager: GitDiffManager;
let executionTracker: ExecutionTracker;
let worktreeNameGenerator: WorktreeNameGenerator;
let databaseService: DatabaseService;
let runCommandManager: RunCommandManager;
let permissionIpcServer: PermissionIpcServer | null;

// Store original console methods before overriding
// These must be captured immediately when the module loads
const originalLog: typeof console.log = console.log;
const originalError: typeof console.error = console.error;
const originalWarn: typeof console.warn = console.warn;
const originalInfo: typeof console.info = console.info;

const isDevelopment = process.env.NODE_ENV !== 'production' && !app.isPackaged;

// Parse command-line arguments for custom Crystal directory
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  // Support both --crystal-dir=/path and --crystal-dir /path formats
  if (arg.startsWith('--crystal-dir=')) {
    const dir = arg.substring('--crystal-dir='.length);
    setCrystalDirectory(dir);
    console.log(`[Main] Using custom Crystal directory: ${dir}`);
  } else if (arg === '--crystal-dir' && i + 1 < args.length) {
    const dir = args[i + 1];
    setCrystalDirectory(dir);
    console.log(`[Main] Using custom Crystal directory: ${dir}`);
    i++; // Skip the next argument since we've consumed it
  }
}

// Install Devtron in development
if (isDevelopment) {
  // Devtron can be installed manually in DevTools console with: require('devtron').install()
  console.log('[Main] Development mode - Devtron can be installed in DevTools console');
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false, // Don't show window until ready
    backgroundColor: '#111827', // Match dark theme (gray-900)
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 10, y: 10 }
    } : {})
  });

  // Show window when ready to prevent white flash (set up listener before loading)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDevelopment) {
    await mainWindow.loadURL('http://localhost:4521');
    // Delay dev tools opening to reduce startup sounds
    setTimeout(() => {
      mainWindow?.webContents.openDevTools();
    }, 1000);
    
    // Enable IPC debugging in development
    console.log('[Main] 🔍 IPC debugging enabled - check DevTools console for IPC call logs');
    
    // Log all IPC calls in main process
    const originalHandle = ipcMain.handle;
    ipcMain.handle = function(channel: string, listener: any) {
      const wrappedListener = async (event: any, ...args: any[]) => {
        const result = await listener(event, ...args);
        return result;
      };
      return originalHandle.call(this, channel, wrappedListener);
    };
  } else {
    // Log the path we're trying to load
    const indexPath = path.join(__dirname, '../../frontend/dist/index.html');
    console.log('Loading index.html from:', indexPath);

    try {
      await mainWindow.loadFile(indexPath);
    } catch (error) {
      console.error('Failed to load index.html:', error);
    }
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Log any console messages from the renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // Skip messages that are already prefixed to avoid circular logging
    if (message.includes('[Main Process]') || message.includes('[Renderer]')) {
      return;
    }
    // Also skip Electron security warnings and other system messages
    if (message.includes('Electron Security Warning') || sourceId.includes('electron/js2c')) {
      return;
    }
    // Only log errors and warnings from renderer, not all messages
    if (level >= 2) { // 2 = warning, 3 = error
      console.log(`[Renderer] ${message} (${sourceId}:${line})`);
    }
  });

  // Override console methods to forward to renderer and logger
  console.log = (...args: any[]) => {
    // Format the message
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    // Write to logger if available
    if (logger) {
      logger.info(message);
    } else {
      originalLog.apply(console, args);
    }

    // Forward to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('main-log', 'log', message);
      } catch (e) {
        // If sending to renderer fails, use original console to avoid recursion
        originalLog('[Main] Failed to send log to renderer:', e);
      }
    }
  };

  console.error = (...args: any[]) => {
    // Prevent infinite recursion by checking if we're already in an error handler
    if ((console.error as any).__isHandlingError) {
      return originalError.apply(console, args);
    }
    
    (console.error as any).__isHandlingError = true;
    
    try {
      // If logger is not initialized or we're in the logger itself, use original console
      if (!logger) {
        originalError.apply(console, args);
        return;
      }

      const message = args.map(arg => {
        if (typeof arg === 'object') {
          if (arg instanceof Error) {
            return `Error: ${arg.message}\nStack: ${arg.stack}`;
          }
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            // Handle circular structure
            return `[Object with circular structure: ${arg.constructor?.name || 'Object'}]`;
          }
        }
        return String(arg);
      }).join(' ');

      // Extract Error object if present
      const errorObj = args.find(arg => arg instanceof Error) as Error | undefined;

      // Use logger but with recursion protection
      logger.error(message, errorObj);

      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('main-log', 'error', message);
        } catch (e) {
          // If sending to renderer fails, use original console to avoid recursion
          originalError('[Main] Failed to send error to renderer:', e);
        }
      }
    } catch (e) {
      // If anything fails in the error handler, fall back to original
      originalError.apply(console, args);
    } finally {
      (console.error as any).__isHandlingError = false;
    }
  };

  console.warn = (...args: any[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        if (arg instanceof Error) {
          return `Error: ${arg.message}\nStack: ${arg.stack}`;
        }
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          // Handle circular structure
          return `[Object with circular structure: ${arg.constructor?.name || 'Object'}]`;
        }
      }
      return String(arg);
    }).join(' ');

    // Extract Error object if present for warnings too
    const errorObj = args.find(arg => arg instanceof Error) as Error | undefined;

    if (logger) {
      logger.warn(message, errorObj);
    } else {
      originalWarn.apply(console, args);
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('main-log', 'warn', message);
      } catch (e) {
        // If sending to renderer fails, use original console to avoid recursion
        originalWarn('[Main] Failed to send warning to renderer:', e);
      }
    }
  };

  console.info = (...args: any[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        if (arg instanceof Error) {
          return `Error: ${arg.message}\nStack: ${arg.stack}`;
        }
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          // Handle circular structure
          return `[Object with circular structure: ${arg.constructor?.name || 'Object'}]`;
        }
      }
      return String(arg);
    }).join(' ');

    if (logger) {
      logger.info(message);
    } else {
      originalInfo.apply(console, args);
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('main-log', 'info', message);
      } catch (e) {
        // If sending to renderer fails, use original console to avoid recursion
        originalInfo('[Main] Failed to send info to renderer:', e);
      }
    }
  };

  // Log any renderer errors
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process crashed:', details);
  });
}

async function initializeServices() {
  configManager = new ConfigManager();
  await configManager.initialize();

  // Initialize logger early so it can capture all logs
  logger = new Logger(configManager);
  console.log('[Main] Logger initialized with file logging to ~/.crystal/logs');

  // Use the same database path as the original backend
  const dbPath = configManager.getDatabasePath();
  databaseService = new DatabaseService(dbPath);
  databaseService.initialize();

  sessionManager = new SessionManager(databaseService);
  sessionManager.initializeFromDatabase();

  // Start permission IPC server
  console.log('[Main] Initializing Permission IPC server...');
  permissionIpcServer = new PermissionIpcServer();
  console.log('[Main] Starting Permission IPC server...');

  let permissionIpcPath: string | null = null;
  try {
    await permissionIpcServer.start();
    permissionIpcPath = permissionIpcServer.getSocketPath();
    console.log('[Main] Permission IPC server started successfully');
    console.log('[Main] Permission IPC socket path:', permissionIpcPath);
  } catch (error) {
    console.error('[Main] Failed to start Permission IPC server:', error);
    console.error('[Main] Permission-based MCP will be disabled');
    permissionIpcServer = null;
  }

  // Create worktree manager without a specific path
  worktreeManager = new WorktreeManager();

  // Initialize the active project's worktree directory if one exists
  const activeProject = sessionManager.getActiveProject();
  if (activeProject) {
    await worktreeManager.initializeProject(activeProject.path);
  }

  claudeCodeManager = new ClaudeCodeManager(sessionManager, logger, configManager, permissionIpcPath);
  gitDiffManager = new GitDiffManager();
  executionTracker = new ExecutionTracker(sessionManager, gitDiffManager);
  worktreeNameGenerator = new WorktreeNameGenerator(configManager);
  runCommandManager = new RunCommandManager(databaseService);
  
  
  // Import LocalDocumentService
  const { LocalDocumentService } = await import('./services/localDocumentService');
  const localDocumentService = new LocalDocumentService(databaseService, logger);
  
  // Import PRP Service
  const { PRPService } = await import('./services/prpService');
  const prpService = new PRPService(databaseService, logger);
  
  // Import Template and PRP Generation services
  const { TemplateService } = await import('./services/templateService');
  const { PRPGenerationService } = await import('./services/prpGenerationService');
  const templateService = new TemplateService(logger);
  const prpGenerationService = new PRPGenerationService(templateService, logger, configManager);
  
  // Import Web Scraping Service
  const { WebScrapingService } = await import('./services/webScrapingService');
  let webScrapingService: InstanceType<typeof WebScrapingService> | undefined;
  try {
    webScrapingService = new WebScrapingService(logger);
    await webScrapingService.initialize();
    logger.info('Web scraping service initialized successfully');
  } catch (error) {
    logger.warn('Web scraping service initialization failed:', error instanceof Error ? error : new Error(String(error)));
    // Continue without web scraping - it's an optional feature
  }
  
  // Initialize templates
  await templateService.initialize(configManager.getConfig().customTemplatePaths);

  taskQueue = new TaskQueue({
    sessionManager,
    worktreeManager,
    claudeCodeManager,
    gitDiffManager,
    executionTracker,
    worktreeNameGenerator,
    localDocumentService,
    prpService,
    getMainWindow: () => mainWindow
  });

  const services: AppServices = {
    app,
    configManager,
    databaseService,
    sessionManager,
    worktreeManager,
    claudeCodeManager,
    gitDiffManager,
    executionTracker,
    worktreeNameGenerator,
    runCommandManager,
    localDocumentService,
    prpService,
    templateService,
    prpGenerationService,
    webScrapingService,
    taskQueue,
    getMainWindow: () => mainWindow,
  };

  // Set up IPC event listeners for real-time updates
  setupEventListeners(services, () => mainWindow);
  registerIpcHandlers(services);
  
}

app.whenReady().then(async () => {
  console.log('[Main] App is ready, initializing services...');
  await initializeServices();
  console.log('[Main] Services initialized, creating window...');
  await createWindow();
  console.log('[Main] Window created successfully');
  

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log('[Main] Activating app, creating new window...');
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Cleanup all sessions and terminate child processes
  if (sessionManager) {
    console.log('[Main] Cleaning up sessions and terminating child processes...');
    await sessionManager.cleanup();
    console.log('[Main] Session cleanup complete');
  }

  // Stop all run commands
  if (runCommandManager) {
    console.log('[Main] Stopping all run commands...');
    await runCommandManager.stopAllRunCommands();
    console.log('[Main] Run commands stopped');
  }

  // Kill all Claude processes
  if (claudeCodeManager) {
    console.log('[Main] Killing all Claude processes...');
    await claudeCodeManager.killAllProcesses();
    console.log('[Main] Claude processes killed');
  }

  // Close task queue
  if (taskQueue) {
    await taskQueue.close();
  }

  // Stop permission IPC server
  if (permissionIpcServer) {
    console.log('[Main] Stopping permission IPC server...');
    await permissionIpcServer.stop();
    console.log('[Main] Permission IPC server stopped');
  }
  

  // Close logger to ensure all logs are flushed
  if (logger) {
    logger.close();
  }
});

// Export getter function for mainWindow
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
