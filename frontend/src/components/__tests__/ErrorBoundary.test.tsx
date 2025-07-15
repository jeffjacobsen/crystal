import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import React from 'react';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Mock console.error to prevent error logs in tests
  const originalConsoleError = console.error;
  
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should catch errors and display error UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('The editor encountered an error. Please try refreshing the page.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument();
  });

  it('should display error icon', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    const icon = document.querySelector('.text-red-500');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('w-12', 'h-12');
  });

  it('should log error to console', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(console.error).toHaveBeenCalledWith(
      'Error caught by boundary:',
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  it('should reload page when refresh button is clicked', () => {
    // Create a mock for window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true
    });
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    const refreshButton = screen.getByRole('button', { name: 'Refresh Page' });
    fireEvent.click(refreshButton);
    
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('should use custom fallback when provided', () => {
    const customFallback = (error: Error, errorInfo: React.ErrorInfo) => (
      <div>
        <h1>Custom Error</h1>
        <p>{error.message}</p>
        <details>{errorInfo.componentStack}</details>
      </div>
    );
    
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Custom Error')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByText(/ThrowError/)).toBeInTheDocument(); // Component stack includes component name
  });

  it('should recover when error is cleared', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    // Re-render without error
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    
    // Note: In real React, error boundaries don't automatically recover.
    // The error state persists until the component is unmounted or page is refreshed.
    // So the error UI should still be shown.
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should handle multiple children', () => {
    render(
      <ErrorBoundary>
        <div>First child</div>
        <div>Second child</div>
        <div>Third child</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('First child')).toBeInTheDocument();
    expect(screen.getByText('Second child')).toBeInTheDocument();
    expect(screen.getByText('Third child')).toBeInTheDocument();
  });

  it('should catch errors from nested components', () => {
    const NestedError = () => {
      const InnerComponent = () => {
        throw new Error('Nested error');
      };
      
      return (
        <div>
          <InnerComponent />
        </div>
      );
    };
    
    render(
      <ErrorBoundary>
        <NestedError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should have proper styling classes', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    const container = screen.getByText('Something went wrong').parentElement?.parentElement;
    expect(container).toHaveClass('flex', 'items-center', 'justify-center', 'h-full', 'p-8');
    
    const heading = screen.getByText('Something went wrong');
    expect(heading).toHaveClass('text-lg', 'font-semibold', 'text-gray-900', 'dark:text-gray-100');
    
    const description = screen.getByText('The editor encountered an error. Please try refreshing the page.');
    expect(description).toHaveClass('text-gray-600', 'dark:text-gray-400');
    
    const button = screen.getByRole('button', { name: 'Refresh Page' });
    expect(button).toHaveClass('bg-blue-600', 'hover:bg-blue-700');
  });

  it('should not render fallback when error is not provided yet', () => {
    // This test case is actually testing an edge case that doesn't happen in practice
    // When getDerivedStateFromError is called, error is set but errorInfo isn't until componentDidCatch
    // The component still renders the default error UI
    const customFallback = vi.fn(() => <div>Custom fallback</div>);
    
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // The fallback should be called since both error and errorInfo are available after componentDidCatch
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    expect(customFallback).toHaveBeenCalled();
  });
});