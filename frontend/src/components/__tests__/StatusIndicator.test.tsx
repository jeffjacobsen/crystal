import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusIndicator } from '../StatusIndicator';
import type { Session } from '../../types/session';
import { isDocumentVisible } from '../../utils/performanceUtils';

// Mock the performanceUtils
vi.mock('../../utils/performanceUtils', () => ({
  isDocumentVisible: vi.fn(() => true)
}));

describe('StatusIndicator', () => {
  const mockSession: Session = {
    id: 'session-123',
    projectId: 1,
    name: 'Test Session',
    prompt: 'Test prompt',
    worktreePath: '/test/path',
    status: 'running',
    createdAt: '2024-01-01T00:00:00Z',
    error: undefined,
    output: [],
    jsonMessages: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('dot indicator (showText=false)', () => {
    it('should render running status with pulsing animation', () => {
      render(<StatusIndicator session={mockSession} />);
      
      const dot = document.querySelector('.bg-green-500');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveClass('animate-pulse');
    });

    it('should render initializing status', () => {
      const session = { ...mockSession, status: 'initializing' as const };
      render(<StatusIndicator session={session} />);
      
      const dot = document.querySelector('.bg-green-500');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveClass('animate-pulse');
    });

    it('should render waiting status with amber color', () => {
      const session = { ...mockSession, status: 'waiting' as const };
      render(<StatusIndicator session={session} />);
      
      const dot = document.querySelector('.bg-amber-500');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveClass('animate-pulse', 'animate-ping');
    });

    it('should render stopped status without animation', () => {
      const session = { ...mockSession, status: 'stopped' as const };
      render(<StatusIndicator session={session} />);
      
      const dot = document.querySelector('.bg-gray-400');
      expect(dot).toBeInTheDocument();
      expect(dot).not.toHaveClass('animate-pulse');
      expect(dot).not.toHaveClass('animate-ping');
    });

    it('should render error status with red color', () => {
      const session = { ...mockSession, status: 'error' as const };
      render(<StatusIndicator session={session} />);
      
      const dot = document.querySelector('.bg-red-500');
      expect(dot).toBeInTheDocument();
      expect(dot).not.toHaveClass('animate-pulse');
    });

    it('should render completed_unviewed status with blue color', () => {
      const session = { ...mockSession, status: 'completed_unviewed' as const };
      render(<StatusIndicator session={session} />);
      
      const dot = document.querySelector('.bg-blue-500');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveClass('animate-pulse', 'animate-ping');
    });

    it('should apply size classes correctly', () => {
      const { rerender } = render(<StatusIndicator session={mockSession} size="small" />);
      let dot = document.querySelector('.w-2.h-2');
      expect(dot).toBeInTheDocument();

      rerender(<StatusIndicator session={mockSession} size="medium" />);
      dot = document.querySelector('.w-3.h-3');
      expect(dot).toBeInTheDocument();

      rerender(<StatusIndicator session={mockSession} size="large" />);
      dot = document.querySelector('.w-4.h-4');
      expect(dot).toBeInTheDocument();
    });
  });

  describe('chip indicator (showText=true)', () => {
    it('should render running status with text', () => {
      render(<StatusIndicator session={mockSession} showText />);
      
      expect(screen.getByText('Running')).toBeInTheDocument();
      const icon = document.querySelector('.animate-spin');
      expect(icon).toBeInTheDocument();
    });

    it('should render waiting status with text', () => {
      const session = { ...mockSession, status: 'waiting' as const };
      render(<StatusIndicator session={session} showText />);
      
      expect(screen.getByText('Waiting for input')).toBeInTheDocument();
    });

    it('should render stopped status with text', () => {
      const session = { ...mockSession, status: 'stopped' as const };
      render(<StatusIndicator session={session} showText />);
      
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should render error status with text', () => {
      const session = { ...mockSession, status: 'error' as const };
      render(<StatusIndicator session={session} showText />);
      
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('should render completed_unviewed status with text', () => {
      const session = { ...mockSession, status: 'completed_unviewed' as const };
      render(<StatusIndicator session={session} showText />);
      
      expect(screen.getByText('New activity')).toBeInTheDocument();
    });

    it('should apply proper background and border colors', () => {
      render(<StatusIndicator session={mockSession} showText />);
      
      const chip = screen.getByText('Running').parentElement;
      expect(chip).toHaveClass('bg-green-900/20', 'border-green-800');
    });

    it('should show shimmer animation for running state', () => {
      render(<StatusIndicator session={mockSession} showText />);
      
      const shimmer = document.querySelector('[style*="shimmer"]');
      expect(shimmer).toBeInTheDocument();
    });
  });

  describe('progress indicator', () => {
    it('should show progress bar when showProgress is true', () => {
      render(<StatusIndicator session={mockSession} showText showProgress />);
      
      const progressBar = document.querySelector('[style*="width"]');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: '50%' }); // Running status = 50%
    });

    it('should show 100% progress for stopped status', () => {
      const session = { ...mockSession, status: 'stopped' as const };
      render(<StatusIndicator session={session} showText showProgress />);
      
      const progressBar = document.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('should show 0% progress for error status', () => {
      const session = { ...mockSession, status: 'error' as const };
      render(<StatusIndicator session={session} showText showProgress />);
      
      const progressBar = document.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('should show 75% progress for waiting status', () => {
      const session = { ...mockSession, status: 'waiting' as const };
      render(<StatusIndicator session={session} showText showProgress />);
      
      const progressBar = document.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle({ width: '75%' });
    });

    it('should show 25% progress for initializing status', () => {
      const session = { ...mockSession, status: 'initializing' as const };
      render(<StatusIndicator session={session} showText showProgress />);
      
      const progressBar = document.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle({ width: '25%' });
    });
  });

  describe('visibility and animation handling', () => {
    it('should disable animations when document is not visible', () => {
      vi.mocked(isDocumentVisible).mockReturnValue(false);

      render(<StatusIndicator session={mockSession} />);
      
      const dot = document.querySelector('.bg-green-500');
      expect(dot).not.toHaveClass('animate-pulse');
    });

    it('should enable animations when document becomes visible', () => {
      vi.mocked(isDocumentVisible).mockReturnValue(false);

      const { rerender } = render(<StatusIndicator session={mockSession} />);
      
      // Simulate visibility change
      vi.mocked(isDocumentVisible).mockReturnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
      
      rerender(<StatusIndicator session={mockSession} />);
      
      const dot = document.querySelector('.bg-green-500');
      expect(dot).toHaveClass('animate-pulse');
    });

    it('should clean up event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      
      const { unmount } = render(<StatusIndicator session={mockSession} />);
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  describe('edge cases', () => {
    it('should handle unknown status gracefully', () => {
      const session = { ...mockSession, status: 'unknown' as any };
      render(<StatusIndicator session={session} showText />);
      
      expect(screen.getByText('Unknown')).toBeInTheDocument();
      const chip = screen.getByText('Unknown').parentElement;
      expect(chip).toHaveClass('bg-gray-800', 'border-gray-700');
    });

    it('should render without crashing with minimal props', () => {
      const minimalSession: Session = {
        ...mockSession,
        status: 'running'
      };
      
      const { container } = render(<StatusIndicator session={minimalSession} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});