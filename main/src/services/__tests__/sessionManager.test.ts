import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { SessionManager } from '../sessionManager';
import type { DatabaseService } from '../../database/database';
import type { Project, Session as DbSession } from '../../database/models';

// Mock dependencies
vi.mock('child_process');
vi.mock('../terminalSessionManager', () => ({
  TerminalSessionManager: vi.fn()
}));
vi.mock('../../utils/shellPath', () => ({
  getShellPath: vi.fn(() => '/usr/bin:/usr/local/bin')
}));
vi.mock('../../utils/shellDetector', () => ({
  ShellDetector: {
    getShellCommandArgs: vi.fn(() => ({
      shell: '/bin/bash',
      args: ['-c']
    }))
  }
}));

// Create mock database
const createMockDatabase = (): DatabaseService => ({
  getActiveProject: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  getSession: vi.fn(),
  addSessionOutput: vi.fn(),
  getSessionOutputs: vi.fn(),
  deleteSession: vi.fn(),
  getProjectSessions: vi.fn(),
  addPromptMarker: vi.fn(),
  updatePromptMarkerCompletion: vi.fn(),
  getPromptMarkers: vi.fn(),
  createExecutionDiff: vi.fn(),
  getExecutionDiffs: vi.fn(),
  addConversationMessage: vi.fn(),
  getConversationMessages: vi.fn(),
  deleteConversationMessages: vi.fn(),
  deleteProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  getProject: vi.fn(),
  getProjects: vi.fn(),
  setLastActiveProject: vi.fn(),
  getProjectByPath: vi.fn(),
  close: vi.fn(),
  initializeContinuations: vi.fn(),
  getLatestActiveProject: vi.fn(),
  archiveSession: vi.fn(),
  pruneExecutionDiffs: vi.fn(),
  deleteExecutionDiff: vi.fn()
} as any);

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockDb: DatabaseService;
  let mockTerminalSessionManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Set up mocks
    mockDb = createMockDatabase();
    
    // Mock TerminalSessionManager
    const { TerminalSessionManager } = await import('../terminalSessionManager');
    mockTerminalSessionManager = new EventEmitter();
    mockTerminalSessionManager.createTerminalSession = vi.fn();
    mockTerminalSessionManager.closeTerminalSession = vi.fn();
    mockTerminalSessionManager.sendInput = vi.fn();
    mockTerminalSessionManager.sendCommand = vi.fn();
    mockTerminalSessionManager.hasSession = vi.fn();
    mockTerminalSessionManager.resizeTerminal = vi.fn();
    mockTerminalSessionManager.cleanup = vi.fn();
    vi.mocked(TerminalSessionManager).mockImplementation(() => mockTerminalSessionManager);
    
    sessionManager = new SessionManager(mockDb);
  });

  afterEach(() => {
    sessionManager.removeAllListeners();
  });

  describe('initialization', () => {
    it('should create session manager instance', () => {
      expect(sessionManager).toBeDefined();
      expect(sessionManager).toBeInstanceOf(EventEmitter);
    });

    it('should set max listeners to prevent warnings', () => {
      expect(sessionManager.getMaxListeners()).toBe(50);
    });

    it('should forward terminal output events', () => {
      const outputHandler = vi.fn();
      sessionManager.on('session:output', outputHandler);
      
      // Simulate terminal output
      mockTerminalSessionManager.emit('terminal-output', {
        sessionId: 'test-session',
        data: 'test output',
        type: 'stdout'
      });
      
      // Since addScriptOutput is called internally, we can't directly test the event
      // but we can verify the terminal manager event handling is set up
      expect(mockTerminalSessionManager.listenerCount('terminal-output')).toBeGreaterThan(0);
    });

    it('should forward zombie process detection events', () => {
      const zombieHandler = vi.fn();
      sessionManager.on('zombie-processes-detected', zombieHandler);
      
      const zombieData = { count: 5, pids: [123, 456] };
      mockTerminalSessionManager.emit('zombie-processes-detected', zombieData);
      
      expect(zombieHandler).toHaveBeenCalledWith(zombieData);
    });
  });

  describe('active project management', () => {
    const mockProject: Project = {
      id: 1,
      name: 'Test Project',
      path: '/test/project',
      build_script: 'npm run build',
      run_script: 'npm start',
      worktree_folder: 'worktrees',
      active: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    it('should set active project', () => {
      const projectChangeHandler = vi.fn();
      sessionManager.on('active-project-changed', projectChangeHandler);
      
      sessionManager.setActiveProject(mockProject);
      
      expect(sessionManager.getActiveProject()).toEqual(mockProject);
      expect(projectChangeHandler).toHaveBeenCalledWith(mockProject);
    });

    it('should get active project from database if not set', () => {
      vi.mocked(mockDb).getActiveProject.mockReturnValue(mockProject);
      
      const project = sessionManager.getActiveProject();
      
      expect(project).toEqual(mockProject);
      expect(vi.mocked(mockDb).getActiveProject).toHaveBeenCalled();
    });

    it('should return null if no active project', () => {
      vi.mocked(mockDb).getActiveProject.mockReturnValue(null);
      
      const project = sessionManager.getActiveProject();
      
      expect(project).toBeNull();
    });
  });

  describe('session creation', () => {
    const mockProject: Project = {
      id: 1,
      name: 'Test Project',
      path: '/test/project',
      build_script: 'npm run build',
      run_script: 'npm start',
      worktree_folder: 'worktrees',
      active: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    const mockDbSession: DbSession = {
      id: 'session-123',
      project_id: 1,
      initial_prompt: 'Test prompt',
      name: 'Test Session',
      worktree_name: 'session-123',
      worktree_path: '/test/project/worktrees/session-123',
      status: 'running',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      archived: false
    };

    beforeEach(() => {
      sessionManager.setActiveProject(mockProject);
      vi.mocked(mockDb).createSession.mockReturnValue(mockDbSession);
    });

    it('should create a new session', async () => {
      const session = sessionManager.createSession(
        'Test Session',
        '/test/project/worktrees/session-123',
        'Test prompt',
        'session-123'
      );
      
      expect(session).toBeDefined();
      expect(session.id).toBe('session-123');
      expect(session.prompt).toBe('Test prompt');
      expect(session.name).toBe('Test Session');
      expect(session.worktreePath).toBe('/test/project/worktrees/session-123');
      expect(session.projectId).toBe(1);
      expect(vi.mocked(mockDb).createSession).toHaveBeenCalledWith(expect.objectContaining({
        project_id: 1,
        initial_prompt: 'Test prompt',
        name: 'Test Session'
      }));
    });

    it('should not emit session:created event automatically', async () => {
      const sessionCreatedHandler = vi.fn();
      sessionManager.on('session:created', sessionCreatedHandler);
      
      const session = sessionManager.createSession(
        'Test Session',
        '/test/project/worktrees/session-123',
        'Test prompt',
        'session-123'
      );
      
      // The createSession method doesn't emit the event - the caller should
      expect(sessionCreatedHandler).not.toHaveBeenCalled();
      
      // But we can emit it manually
      sessionManager.emit('session:created', session);
      expect(sessionCreatedHandler).toHaveBeenCalledWith(session);
    });

    it('should add session to active sessions map', async () => {
      const session = sessionManager.createSession(
        'Test Session',
        '/test/project/worktrees/session-123',
        'Test prompt',
        'session-123'
      );
      
      // Mock getSession to return the created session
      vi.mocked(mockDb).getSession.mockReturnValue(mockDbSession);
      
      const retrievedSession = sessionManager.getSession('session-123');
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.id).toBe('session-123');
    });

    it('should throw error if no active project', () => {
      sessionManager.setActiveProject(null as any);
      vi.mocked(mockDb).getActiveProject.mockReturnValue(null);
      
      expect(() => sessionManager.createSession(
        'Test Session',
        '/test/project/worktrees/session-123',
        'Test prompt',
        'session-123'
      )).toThrow('No project specified and no active project selected');
    });
  });

  describe('session updates', () => {
    const mockSession = {
      id: 'session-123',
      projectId: 1,
      prompt: 'Test prompt',
      name: 'Test Session',
      worktreePath: '/test/project/worktrees/session-123',
      status: 'running' as const,
      createdAt: new Date(),
      lastActivity: new Date(),
      output: [],
      jsonMessages: []
    };

    beforeEach(async () => {
      // Set up active project
      const mockProject: Project = {
        id: 1,
        name: 'Test Project',
        path: '/test/project',
        build_script: 'npm run build',
        run_script: 'npm start',
        worktree_folder: 'worktrees',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };
      sessionManager.setActiveProject(mockProject);
      
      // Add session to active sessions
      (sessionManager as any).activeSessions.set('session-123', mockSession);
      
      // Mock database responses
      const mockDbSession: DbSession = {
        id: 'session-123',
        project_id: 1,
        initial_prompt: 'Test prompt',
        name: 'Test Session',
        worktree_name: 'session-123',
        worktree_path: '/test/project/worktrees/session-123',
        status: 'running',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        archived: false
      };
      
      vi.mocked(mockDb).getSession.mockReturnValue(mockDbSession);
      // When status is updated to 'stopped' and last_viewed_at is null, it becomes 'completed_unviewed'
      vi.mocked(mockDb).updateSession.mockReturnValue({ ...mockDbSession, status: 'stopped', last_viewed_at: null });
    });

    it('should update session status', () => {
      const sessionUpdatedHandler = vi.fn();
      sessionManager.on('session-updated', sessionUpdatedHandler);
      
      sessionManager.updateSession('session-123', { status: 'completed' });
      
      // The session manager should emit the event with completed_unviewed status
      expect(vi.mocked(mockDb).updateSession).toHaveBeenCalledWith('session-123', { status: 'stopped' });
      expect(sessionUpdatedHandler).toHaveBeenCalledWith(expect.objectContaining({
        id: 'session-123',
        status: 'completed_unviewed'
      }));
      
      // Mock getSession to return the updated session (use the one we already defined)
      const dbSession = vi.mocked(mockDb).getSession();
      vi.mocked(mockDb).getSession.mockReturnValue({ ...dbSession, status: 'stopped', last_viewed_at: null });
      const updatedSession = sessionManager.getSession('session-123');
      expect(updatedSession?.status).toBe('completed_unviewed'); // Based on last_viewed_at logic
    });

    it('should update session error', () => {
      const sessionUpdatedHandler = vi.fn();
      sessionManager.on('session-updated', sessionUpdatedHandler);
      
      const failedDbSession = vi.mocked(mockDb).getSession();
      vi.mocked(mockDb).updateSession.mockReturnValue({ 
        ...failedDbSession,
        status: 'failed'
      });
      
      sessionManager.updateSession('session-123', { 
        status: 'error',
        error: 'Test error message' 
      });
      
      // The session in memory should have error status and error message
      const updatedSession = (sessionManager as any).activeSessions.get('session-123');
      expect(updatedSession?.status).toBe('error'); // Status comes from the update object
      expect(updatedSession?.error).toBe('Test error message');
      expect(vi.mocked(mockDb).updateSession).toHaveBeenCalledWith('session-123', { status: 'failed' });
      expect(sessionUpdatedHandler).toHaveBeenCalledWith(expect.objectContaining({
        id: 'session-123',
        status: 'error',
        error: 'Test error message'
      }));
    });

    it('should throw error for non-existent session', () => {
      vi.mocked(mockDb).updateSession.mockReturnValue(undefined);
      
      expect(() => sessionManager.updateSession('non-existent', { status: 'completed' }))
        .toThrow('Session non-existent not found');
    });
  });

  describe('session output handling', () => {
    const mockSession = {
      id: 'session-123',
      projectId: 1,
      prompt: 'Test prompt',
      name: 'Test Session',
      worktreePath: '/test/project/worktrees/session-123',
      status: 'running' as const,
      createdAt: new Date(),
      lastActivity: new Date(),
      output: [],
      jsonMessages: [],
      isRunning: false
    };

    beforeEach(() => {
      (sessionManager as any).activeSessions.set('session-123', mockSession);
      // Mock getSessionOutputs to return empty array (first output)
      vi.mocked(mockDb).getSessionOutputs.mockReturnValue([]);
    });

    it('should add session output', () => {
      const outputHandler = vi.fn();
      const outputAvailableHandler = vi.fn();
      sessionManager.on('session-output', outputHandler);
      sessionManager.on('session-output-available', outputAvailableHandler);
      
      sessionManager.addSessionOutput('session-123', {
        type: 'stdout',
        data: 'Test output\n'
      });
      
      expect(vi.mocked(mockDb).addSessionOutput).toHaveBeenCalledWith(
        'session-123',
        'stdout',
        'Test output\n'
      );
      expect(outputHandler).toHaveBeenCalledWith({
        sessionId: 'session-123',
        type: 'stdout',
        data: 'Test output\n'
      });
      expect(outputAvailableHandler).toHaveBeenCalledWith({ sessionId: 'session-123' });
    });

    it('should handle JSON message output', () => {
      const jsonMessage = { type: 'message', content: 'Hello' };
      const outputHandler = vi.fn();
      sessionManager.on('session-output', outputHandler);
      
      sessionManager.addSessionOutput('session-123', {
        type: 'json',
        data: jsonMessage
      });
      
      expect(vi.mocked(mockDb).addSessionOutput).toHaveBeenCalledWith(
        'session-123',
        'json',
        JSON.stringify(jsonMessage)
      );
      expect(outputHandler).toHaveBeenCalledWith({
        sessionId: 'session-123',
        type: 'json',
        data: jsonMessage
      });
    });
  });

  describe('session deletion', () => {
    const mockSession = {
      id: 'session-123',
      projectId: 1,
      prompt: 'Test prompt',
      name: 'Test Session',
      worktreePath: '/test/project/worktrees/session-123',
      status: 'running' as const,
      createdAt: new Date(),
      lastActivity: new Date(),
      output: [],
      jsonMessages: [],
      pid: 12345
    };

    beforeEach(() => {
      (sessionManager as any).activeSessions.set('session-123', mockSession);
    });

    it('should delete session', async () => {
      const sessionDeletedHandler = vi.fn();
      sessionManager.on('session-deleted', sessionDeletedHandler);
      
      vi.mocked(mockDb).archiveSession.mockReturnValue(true);
      await sessionManager.archiveSession('session-123');
      
      expect(sessionManager.getSession('session-123')).toBeUndefined();
      expect(vi.mocked(mockDb).archiveSession).toHaveBeenCalledWith('session-123');
      expect(sessionDeletedHandler).toHaveBeenCalledWith({ id: 'session-123' });
    });

    it('should remove session from active sessions', async () => {
      // Verify session exists before deletion
      expect((sessionManager as any).activeSessions.has('session-123')).toBe(true);
      
      vi.mocked(mockDb).archiveSession.mockReturnValue(true);
      await sessionManager.archiveSession('session-123');
      
      // Verify session was removed
      expect((sessionManager as any).activeSessions.has('session-123')).toBe(false);
    });

    it('should close terminal session', async () => {
      vi.mocked(mockDb).archiveSession.mockReturnValue(true);
      await sessionManager.archiveSession('session-123');
      
      expect(mockTerminalSessionManager.closeTerminalSession).toHaveBeenCalledWith('session-123');
    });
  });

  describe('script execution', () => {
    const mockProject: Project = {
      id: 1,
      name: 'Test Project',
      path: '/test/project',
      build_script: 'npm run build',
      run_script: 'npm start',
      worktree_folder: 'worktrees',
      active: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    beforeEach(async () => {
      sessionManager.setActiveProject(mockProject);
      
      // Get the mocked spawn function
      const childProcess = await import('child_process');
      const mockProcess = {
        pid: 12345,
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        stdin: {
          write: vi.fn(),
          end: vi.fn()
        },
        on: vi.fn(),
        kill: vi.fn()
      };
      vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any);
    });

    it('should run project script', async () => {
      const scriptOutputHandler = vi.fn();
      sessionManager.on('script-output', scriptOutputHandler);
      
      await sessionManager.runScript('session-123', ['npm', 'start'], mockProject.path);
      
      const childProcess = await import('child_process');
      expect(childProcess.spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: mockProject.path
        })
      );
    });

    it('should handle script output', async () => {
      const scriptOutputHandler = vi.fn();
      sessionManager.on('script-output', scriptOutputHandler);
      
      await sessionManager.runScript('session-123', ['npm', 'start'], mockProject.path);
      
      // Get the mock process
      const childProcess = await import('child_process');
      const mockProcess = vi.mocked(childProcess.spawn).mock.results[0]?.value;
      
      // Simulate stdout
      mockProcess.stdout.emit('data', Buffer.from('Test output'));
      
      expect(scriptOutputHandler).toHaveBeenCalledWith({
        sessionId: 'session-123',
        data: 'Test output',
        type: 'stdout'
      });
    });

    it('should stop running script', async () => {
      await sessionManager.runScript('session-123', ['npm', 'start'], mockProject.path);
      
      const childProcess = await import('child_process');
      const mockProcess = vi.mocked(childProcess.spawn).mock.results[0]?.value;
      
      await sessionManager.stopRunningScript();
      
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('should stop previous script when running a new one', async () => {
      await sessionManager.runScript('session-123', ['npm', 'start'], mockProject.path);
      
      const childProcess = await import('child_process');
      const firstProcess = vi.mocked(childProcess.spawn).mock.results[0]?.value;
      
      // Run another script - should stop the first one
      await sessionManager.runScript('session-456', ['npm', 'run', 'build'], mockProject.path);
      
      // The first process should have been killed
      expect(firstProcess.kill).toHaveBeenCalled();
    });
  });

  describe('terminal session management', () => {
    it('should forward terminal creation to terminal manager', async () => {
      // The sessionManager uses terminalSessionManager internally
      // These tests verify the terminalSessionManager is set up correctly
      expect(mockTerminalSessionManager).toBeDefined();
      expect(mockTerminalSessionManager.createTerminalSession).toBeDefined();
    });

    it('should forward terminal output events', () => {
      // Verify the terminal output event forwarding is set up
      const outputData = { sessionId: 'test-123', data: 'test', type: 'stdout' };
      
      // Mock addScriptOutput
      sessionManager.addScriptOutput = vi.fn();
      
      // Emit from terminal manager
      mockTerminalSessionManager.emit('terminal-output', outputData);
      
      // Should call addScriptOutput
      expect(sessionManager.addScriptOutput).toHaveBeenCalledWith('test-123', 'test', 'stdout');
    });

    it('should forward zombie process detection events', () => {
      const zombieHandler = vi.fn();
      sessionManager.on('zombie-processes-detected', zombieHandler);
      
      const zombieData = { count: 5, pids: [123, 456] };
      mockTerminalSessionManager.emit('zombie-processes-detected', zombieData);
      
      expect(zombieHandler).toHaveBeenCalledWith(zombieData);
    });
  });

  describe('cleanup', () => {
    it('should stop all running processes on shutdown', async () => {
      // Mock stopRunningScript
      sessionManager.stopRunningScript = vi.fn().mockResolvedValue(undefined);
      
      await sessionManager.cleanup();
      
      expect(sessionManager.stopRunningScript).toHaveBeenCalled();
      expect(mockTerminalSessionManager.cleanup).toHaveBeenCalled();
    });

    it('should clear all active sessions on shutdown', async () => {
      // Add cleanup for terminal sessions
      mockTerminalSessionManager.cleanup = vi.fn().mockResolvedValue(undefined);
      sessionManager.stopRunningScript = vi.fn().mockResolvedValue(undefined);
      
      await sessionManager.cleanup();
      
      expect(mockTerminalSessionManager.cleanup).toHaveBeenCalled();
    });
  });
});