import { IpcMain } from 'electron';
import type { AppServices } from './types';
import { testClaudeCodeAvailability } from '../utils/claudeCodeTest';

export function registerConfigHandlers(ipcMain: IpcMain, { configManager, claudeCodeManager }: AppServices): void {
  ipcMain.handle('config:get', async () => {
    try {
      const config = configManager.getConfig();
      return { success: true, data: config };
    } catch (error) {
      console.error('Failed to get config:', error);
      return { success: false, error: 'Failed to get config' };
    }
  });

  ipcMain.handle('config:update', async (_event, updates: any) => {
    try {
      // Check if Claude path is being updated
      const oldConfig = configManager.getConfig();
      const claudePathChanged = updates.claudeExecutablePath !== undefined && 
                               updates.claudeExecutablePath !== oldConfig.claudeExecutablePath;
      
      await configManager.updateConfig(updates);
      
      // Clear Claude availability cache if the path changed
      if (claudePathChanged) {
        claudeCodeManager.clearAvailabilityCache();
        console.log('[Config] Claude executable path changed, cleared availability cache');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to update config:', error);
      return { success: false, error: 'Failed to update config' };
    }
  });

  ipcMain.handle('config:test-claude', async (_event, customPath?: string) => {
    try {
      console.log('[Config] Testing Claude Code availability...');
      const result = await testClaudeCodeAvailability(customPath || configManager.getConfig().claudeExecutablePath);
      
      return { 
        success: true, 
        data: {
          available: result.available,
          version: result.version,
          path: result.path,
          error: result.error
        }
      };
    } catch (error) {
      console.error('Failed to test Claude:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to test Claude availability' 
      };
    }
  });
} 