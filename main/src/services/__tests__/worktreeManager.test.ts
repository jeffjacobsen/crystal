import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

// Mock child_process
vi.mock('child_process');

// Mock util.promisify with hoisted mock
vi.mock('util', () => {
  const mockExecAsync = vi.fn();
  // Store reference for tests
  (globalThis as any).__mockExecAsync = mockExecAsync;
  return {
    promisify: vi.fn(() => mockExecAsync)
  };
});

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn()
}));

// Mock shellPath
vi.mock('../../utils/shellPath', () => ({
  getShellPath: vi.fn()
}));

// Import after all mocks are defined
import { WorktreeManager } from '../worktreeManager';
import { promisify } from 'util';
import { mkdir } from 'fs/promises';
import { getShellPath } from '../../utils/shellPath';

// Get references to mocked functions
const mockMkdir = vi.mocked(mkdir);
const mockGetShellPath = vi.mocked(getShellPath);
// Get mockExecAsync from global
const mockExecAsync = () => (globalThis as any).__mockExecAsync;

describe('WorktreeManager', () => {
  let worktreeManager: WorktreeManager;
  const mockProjectPath = '/test/project';
  const mockWorktreeFolder = 'worktrees';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up mock implementations
    mockGetShellPath.mockReturnValue('/usr/bin:/usr/local/bin');
    mockMkdir.mockResolvedValue(undefined);
    
    // Reset the mock execAsync
    mockExecAsync().mockReset();
    mockExecAsync().mockResolvedValue({ stdout: '', stderr: '' });
    
    worktreeManager = new WorktreeManager();
  });

  describe('initialization', () => {
    it('should create worktree manager instance', () => {
      expect(worktreeManager).toBeDefined();
      expect(worktreeManager).toBeInstanceOf(WorktreeManager);
    });
  });

  describe('initializeProject', () => {
    it('should create worktrees directory', async () => {
      await worktreeManager.initializeProject(mockProjectPath);
      
      expect(mockMkdir).toHaveBeenCalledWith(
        path.join(mockProjectPath, 'worktrees'),
        { recursive: true }
      );
    });

    it('should handle custom worktree folder', async () => {
      const customFolder = '/custom/worktrees';
      await worktreeManager.initializeProject(mockProjectPath, customFolder);
      
      expect(mockMkdir).toHaveBeenCalledWith(
        customFolder,
        { recursive: true }
      );
    });

    it('should handle mkdir errors gracefully', async () => {
      mockMkdir.mockRejectedValue(new Error('Permission denied'));
      
      // Should not throw
      await expect(
        worktreeManager.initializeProject(mockProjectPath)
      ).resolves.toBeUndefined();
    });
  });

  describe('createWorktree', () => {
    beforeEach(() => {
      mockExecAsync().mockReset();
      mockExecAsync().mockResolvedValue({ stdout: '', stderr: '' });
    });

    it('should create worktree for existing git repository', async () => {
      const name = 'feature-test';
      const branch = 'feature/test-branch';
      
      // Mock git commands
      mockExecAsync()
        .mockResolvedValueOnce({ stdout: 'true', stderr: '' }) // git rev-parse
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git worktree remove
        .mockResolvedValueOnce({ stdout: 'abc123', stderr: '' }) // git rev-parse HEAD
        .mockRejectedValueOnce(new Error('branch not found')) // git show-ref (branch doesn't exist)
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // git worktree add
      
      const result = await worktreeManager.createWorktree(
        mockProjectPath,
        name,
        branch
      );
      
      expect(result.worktreePath).toBe(path.join(mockProjectPath, 'worktrees', name));
      
      // Check that git worktree add was called
      const calls = mockExecAsync().mock.calls;
      const worktreeAddCall = calls.find((call: any) => 
        call[0].includes('git worktree add')
      );
      expect(worktreeAddCall).toBeDefined();
      expect(worktreeAddCall[0]).toContain(`git worktree add -b ${branch}`);
    });

    it('should use existing branch if it exists', async () => {
      const name = 'existing-branch';
      const branch = 'main';
      
      mockExecAsync()
        .mockResolvedValueOnce({ stdout: 'true', stderr: '' }) // git rev-parse
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git worktree remove
        .mockResolvedValueOnce({ stdout: 'abc123', stderr: '' }) // git rev-parse HEAD
        .mockResolvedValueOnce({ stdout: 'refs/heads/main', stderr: '' }) // branch exists
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // git worktree add
      
      await worktreeManager.createWorktree(mockProjectPath, name, branch);
      
      expect(mockExecAsync()).toHaveBeenCalledWith(
        expect.stringContaining(`git worktree add "${path.join(mockProjectPath, 'worktrees', name)}" ${branch}`),
        expect.any(Object)
      );
    });

    it('should initialize git repo if not already initialized', async () => {
      const name = 'new-project';
      
      mockExecAsync()
        .mockRejectedValueOnce(new Error('not a git repository')) // git rev-parse fails
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git init
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git worktree remove
        .mockRejectedValueOnce(new Error('no commits')) // git rev-parse HEAD fails
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git add
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git commit
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git show-ref
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // git worktree add
      
      await worktreeManager.createWorktree(mockProjectPath, name);
      
      expect(mockExecAsync()).toHaveBeenCalledWith(
        expect.stringContaining('git init'),
        expect.any(Object)
      );
    });


    it('should handle worktree creation errors', async () => {
      const name = 'error-test';
      
      mockExecAsync()
        .mockResolvedValueOnce({ stdout: 'true', stderr: '' }) // git rev-parse
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git worktree remove
        .mockResolvedValueOnce({ stdout: 'abc123', stderr: '' }) // git rev-parse HEAD
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git show-ref
        .mockRejectedValueOnce(new Error('fatal: worktree creation failed')); // git worktree add fails
      
      await expect(
        worktreeManager.createWorktree(mockProjectPath, name)
      ).rejects.toThrow('Failed to create worktree');
    });
  });

  describe('removeWorktree', () => {
    beforeEach(() => {
      mockExecAsync().mockReset();
      mockExecAsync().mockResolvedValue({ stdout: '', stderr: '' });
    });
    
    it('should remove worktree successfully', async () => {
      const name = 'feature-remove';
      
      mockExecAsync().mockResolvedValueOnce({ stdout: '', stderr: '' });
      
      await worktreeManager.removeWorktree(mockProjectPath, name);
      
      expect(mockExecAsync()).toHaveBeenCalledWith(
        expect.stringContaining(`git worktree remove "${path.join(mockProjectPath, 'worktrees', name)}" --force`),
        expect.any(Object)
      );
    });

    it('should handle non-existent worktree gracefully', async () => {
      const name = 'non-existent';
      
      mockExecAsync().mockRejectedValueOnce({ 
        message: 'Command failed',
        stderr: 'fatal: is not a working tree'
      });
      
      // Should not throw
      await expect(
        worktreeManager.removeWorktree(mockProjectPath, name)
      ).resolves.toBeUndefined();
    });
  });

  describe('listWorktrees', () => {
    beforeEach(() => {
      mockExecAsync().mockReset();
    });
    
    it('should list all worktrees', async () => {
      const worktreeOutput = `worktree /test/project
HEAD abc123
branch refs/heads/main

worktree /test/project/worktrees/feature-1
HEAD def456
branch refs/heads/feature-1

worktree /test/project/worktrees/feature-2
HEAD ghi789
branch refs/heads/feature-2
`;
      
      mockExecAsync().mockResolvedValueOnce({ stdout: worktreeOutput, stderr: '' });
      
      const worktrees = await worktreeManager.listWorktrees(mockProjectPath);
      
      expect(worktrees).toHaveLength(3);
      expect(worktrees[0]).toEqual({
        path: '/test/project',
        branch: 'main'
      });
      expect(worktrees[1]).toEqual({
        path: '/test/project/worktrees/feature-1',
        branch: 'feature-1'
      });
      expect(worktrees[2]).toEqual({
        path: '/test/project/worktrees/feature-2',
        branch: 'feature-2'
      });
    });

    it('should handle empty worktree list', async () => {
      mockExecAsync().mockResolvedValueOnce({ stdout: '', stderr: '' });
      
      const worktrees = await worktreeManager.listWorktrees(mockProjectPath);
      
      expect(worktrees).toEqual([]);
    });

    it('should handle git errors', async () => {
      mockExecAsync().mockRejectedValueOnce(new Error('not a git repository'));
      
      await expect(
        worktreeManager.listWorktrees(mockProjectPath)
      ).rejects.toThrow('Failed to list worktrees');
    });
  });

  describe.skip('detectMainBranch (deprecated)', () => {
    beforeEach(() => {
      mockExecAsync().mockReset();
    });
    
    it('should detect main branch from remote', async () => {
      mockExecAsync()
        .mockResolvedValueOnce({ stdout: 'refs/remotes/origin/main\n', stderr: '' }) // symbolic-ref
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }); // current branch
      
      const branch = await worktreeManager.detectMainBranch(mockProjectPath);
      
      expect(branch).toBe('main');
    });

    it('should fallback to common branch names', async () => {
      mockExecAsync()
        .mockRejectedValueOnce(new Error('No remote HEAD')) // symbolic-ref fails
        .mockRejectedValueOnce(new Error('No current branch')) // current branch fails
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // show-ref for main
      
      const branch = await worktreeManager.detectMainBranch(mockProjectPath);
      
      expect(branch).toBe('main');
    });
  });

  describe('listBranches', () => {
    beforeEach(() => {
      mockExecAsync().mockReset();
    });
    
    it('should return list of branches with metadata', async () => {
      const branchOutput = `
* main
  feature/branch-1
  feature/branch-2
      `.trim();
      
      const worktreeOutput = `
worktree /test/project
branch refs/heads/main

worktree /test/project/worktrees/feature-1
branch refs/heads/feature/branch-1
      `.trim();
      
      mockExecAsync()
        .mockResolvedValueOnce({ stdout: branchOutput, stderr: '' }) // git branch
        .mockResolvedValueOnce({ stdout: worktreeOutput, stderr: '' }); // git worktree list
      
      const branches = await worktreeManager.listBranches(mockProjectPath);
      
      expect(branches).toEqual([
        { name: 'feature/branch-1', isCurrent: false, hasWorktree: true },
        { name: 'main', isCurrent: true, hasWorktree: true },
        { name: 'feature/branch-2', isCurrent: false, hasWorktree: false }
      ]);
    });

    it('should handle empty branch list', async () => {
      mockExecAsync()
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });
      
      const branches = await worktreeManager.listBranches(mockProjectPath);
      
      expect(branches).toEqual([]);
    });
  });
});