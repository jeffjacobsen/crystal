import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render with default props', () => {
    render(<LoadingSpinner />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    const spinner = document.querySelector('svg');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('w-6', 'h-6', 'animate-spin');
  });

  it('should render with custom text', () => {
    render(<LoadingSpinner text="Processing..." />);
    
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('should apply small size classes', () => {
    render(<LoadingSpinner size="small" />);
    
    const spinner = document.querySelector('svg');
    expect(spinner).toHaveClass('w-4', 'h-4');
    expect(screen.getByText('Loading...')).toHaveClass('text-sm');
  });

  it('should apply medium size classes', () => {
    render(<LoadingSpinner size="medium" />);
    
    const spinner = document.querySelector('svg');
    expect(spinner).toHaveClass('w-6', 'h-6');
    expect(screen.getByText('Loading...')).toHaveClass('text-base');
  });

  it('should apply large size classes', () => {
    render(<LoadingSpinner size="large" />);
    
    const spinner = document.querySelector('svg');
    expect(spinner).toHaveClass('w-8', 'h-8');
    expect(screen.getByText('Loading...')).toHaveClass('text-lg');
  });

  it('should apply custom className', () => {
    render(<LoadingSpinner className="mt-4 p-2" />);
    
    const container = screen.getByText('Loading...').parentElement;
    expect(container).toHaveClass('mt-4', 'p-2');
  });

  it('should have proper dark mode classes on text', () => {
    render(<LoadingSpinner />);
    
    const text = screen.getByText('Loading...');
    expect(text).toHaveClass('text-gray-600', 'dark:text-gray-400');
  });

  it('should have blue spinner color', () => {
    render(<LoadingSpinner />);
    
    const spinner = document.querySelector('svg');
    expect(spinner).toHaveClass('text-blue-500');
  });
});