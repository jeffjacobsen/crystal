import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Mock electron for tests that import it
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => `/mock/path/${name}`),
    getAppPath: vi.fn(() => '/mock/app/path'),
    getVersion: vi.fn(() => '1.0.0'),
    getName: vi.fn(() => 'Crystal'),
    isPackaged: false,
    on: vi.fn(),
    quit: vi.fn()
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  },
  shell: {
    openExternal: vi.fn()
  },
  BrowserWindow: vi.fn(() => ({
    loadURL: vi.fn(),
    on: vi.fn(),
    webContents: {
      send: vi.fn(),
      openDevTools: vi.fn()
    }
  }))
}));

// Set up global test utilities
global.testUtils = {
  createMockSession: (overrides = {}) => ({
    id: 'test-session-id',
    name: 'Test Session',
    worktreePath: '/test/worktree',
    status: 'running',
    pid: 12345,
    projectId: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),
  
  createMockProject: (overrides = {}) => ({
    id: 1,
    name: 'Test Project',
    path: '/test/project',
    worktreeFolder: 'worktrees',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  })
};

// Suppress console errors during tests unless explicitly needed
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});