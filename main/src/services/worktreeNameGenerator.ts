import { ConfigManager } from './configManager';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { findExecutableInPath, getShellPath } from '../utils/shellPath';

export class WorktreeNameGenerator {
  private configManager: ConfigManager;
  private claudePath: string | null = null;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.initializeClaude();
  }

  private initializeClaude(): void {
    // Check for custom Claude path
    const customPath = this.configManager.getConfig()?.claudeExecutablePath;
    if (customPath) {
      this.claudePath = customPath;
      console.log('[WorktreeNameGenerator] Using custom Claude path:', customPath);
      return;
    }
    
    // Find Claude in PATH
    const foundPath = findExecutableInPath('claude');
    if (foundPath) {
      this.claudePath = foundPath;
      console.log('[WorktreeNameGenerator] Found Claude in PATH:', foundPath);
    } else {
      console.log('[WorktreeNameGenerator] Claude not found, AI name generation disabled');
      this.claudePath = null;
    }
  }

  async generateWorktreeName(prompt: string): Promise<string> {
    console.log('[WorktreeNameGenerator] generateWorktreeName called');
    console.log('[WorktreeNameGenerator] Claude path:', this.claudePath);
    
    if (!this.claudePath) {
      console.log('[WorktreeNameGenerator] Claude not available, using fallback name generation');
      const fallbackName = this.generateFallbackName(prompt);
      console.log('[WorktreeNameGenerator] Fallback name generated:', fallbackName);
      return fallbackName;
    }

    console.log('[WorktreeNameGenerator] Attempting AI-powered name generation for prompt:', prompt.substring(0, 50) + '...');
    
    const claudePrompt = `You are a developer assistant that generates concise, descriptive git worktree names. 
            
Rules:
- Generate a short, descriptive name (2-4 words max)
- Use kebab-case (lowercase with hyphens)
- Make it relevant to the coding task described
- Keep it under 30 characters
- Don't include numbers (those will be added for uniqueness)
- Focus on the main feature/task being described

Examples:
- "Fix user authentication bug" → "fix-auth-bug"
- "Add dark mode toggle" → "dark-mode-toggle"
- "Refactor payment system" → "refactor-payments"
- "Update API documentation" → "update-api-docs"

Generate a worktree name for this coding task: "${prompt}"

Respond with ONLY the worktree name, nothing else.`;

    try {
      // Use Claude Code with --print flag to get quick response
      const result = execSync(
        `${this.claudePath} --print --output-format text`,
        {
          input: claudePrompt,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: getShellPath()
          },
          timeout: 15000, // 15 second timeout for name generation
          maxBuffer: 1024 * 1024 // 1MB buffer
        }
      );

      const generatedName = result.trim();
      console.log('[WorktreeNameGenerator] Raw Claude Code response:', generatedName);
      
      if (generatedName) {
        const sanitized = this.sanitizeName(generatedName);
        console.log('[WorktreeNameGenerator] Claude generated name (sanitized):', sanitized);
        return sanitized;
      } else {
        console.log('[WorktreeNameGenerator] Claude Code returned empty response');
      }
    } catch (error) {
      console.error('[WorktreeNameGenerator] Error generating worktree name with Claude Code:', error);
    }

    // Fallback if Claude fails
    return this.generateFallbackName(prompt);
  }

  private generateFallbackName(prompt: string): string {
    // Simple fallback: take first few words and convert to kebab-case
    const words = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3);
    
    return words.join('-') || 'new-task';
  }

  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);
  }

  async generateUniqueWorktreeName(prompt: string): Promise<string> {
    const baseName = await this.generateWorktreeName(prompt);
    const gitRepoPath = this.configManager.getGitRepoPath();
    const worktreesPath = path.join(gitRepoPath, 'worktrees');
    
    let uniqueName = baseName;
    let counter = 1;

    try {
      // Check if worktrees directory exists
      await fs.access(worktreesPath);
      
      // Check for existing directories
      while (await this.worktreeExists(worktreesPath, uniqueName)) {
        uniqueName = `${baseName}-${counter}`;
        counter++;
      }
    } catch (error) {
      // worktrees directory doesn't exist yet, so any name is unique
    }

    return uniqueName;
  }

  private async worktreeExists(worktreesPath: string, name: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path.join(worktreesPath, name));
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}