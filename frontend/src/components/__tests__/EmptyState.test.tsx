import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../EmptyState';
import { FolderOpen } from 'lucide-react';

describe('EmptyState', () => {
  const defaultProps = {
    icon: FolderOpen,
    title: 'No items found',
    description: 'There are no items to display at this time.'
  };

  it('should render with required props', () => {
    render(<EmptyState {...defaultProps} />);
    
    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText('There are no items to display at this time.')).toBeInTheDocument();
    
    // Check for icon
    const iconContainer = document.querySelector('.bg-gray-100');
    expect(iconContainer).toBeInTheDocument();
    const icon = iconContainer?.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should render icon with proper styling', () => {
    render(<EmptyState {...defaultProps} />);
    
    const icon = document.querySelector('svg');
    expect(icon).toHaveClass('w-8', 'h-8', 'text-gray-600', 'dark:text-gray-400');
  });

  it('should render action button when provided', () => {
    const handleClick = vi.fn();
    const action = {
      label: 'Create new item',
      onClick: handleClick
    };
    
    render(<EmptyState {...defaultProps} action={action} />);
    
    const button = screen.getByRole('button', { name: 'Create new item' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-blue-600', 'hover:bg-blue-700');
  });

  it('should call action onClick when button is clicked', () => {
    const handleClick = vi.fn();
    const action = {
      label: 'Create new item',
      onClick: handleClick
    };
    
    render(<EmptyState {...defaultProps} action={action} />);
    
    const button = screen.getByRole('button', { name: 'Create new item' });
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not render action button when action is not provided', () => {
    render(<EmptyState {...defaultProps} />);
    
    const button = screen.queryByRole('button');
    expect(button).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<EmptyState {...defaultProps} className="mt-8 mb-4" />);
    
    const emptyStateDiv = container.querySelector('.mt-8.mb-4');
    expect(emptyStateDiv).toBeInTheDocument();
  });

  it('should have proper dark mode classes', () => {
    render(<EmptyState {...defaultProps} />);
    
    // Check icon container
    const iconContainer = document.querySelector('.bg-gray-100');
    expect(iconContainer).toHaveClass('dark:bg-gray-800');
    
    // Check title
    const title = screen.getByText('No items found');
    expect(title).toHaveClass('text-gray-900', 'dark:text-gray-100');
    
    // Check description
    const description = screen.getByText('There are no items to display at this time.');
    expect(description).toHaveClass('text-gray-600', 'dark:text-gray-400');
  });

  it('should center content properly', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    
    const emptyStateDiv = container.firstChild;
    expect(emptyStateDiv).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center', 'text-center');
  });

  it('should apply proper spacing', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    
    const emptyStateDiv = container.firstChild;
    expect(emptyStateDiv).toHaveClass('p-12');
    
    const iconContainer = document.querySelector('.bg-gray-100');
    expect(iconContainer).toHaveClass('mb-4');
    
    const title = screen.getByText('No items found');
    expect(title).toHaveClass('mb-2');
    
    const description = screen.getByText('There are no items to display at this time.');
    expect(description).toHaveClass('mb-6');
  });

  it('should constrain description width', () => {
    render(<EmptyState {...defaultProps} />);
    
    const description = screen.getByText('There are no items to display at this time.');
    expect(description).toHaveClass('max-w-sm');
  });

  it('should render different icons correctly', () => {
    const { rerender } = render(<EmptyState {...defaultProps} />);
    
    // Initial icon
    let iconContainer = document.querySelector('.bg-gray-100');
    let icon = iconContainer?.querySelector('svg');
    expect(icon).toBeInTheDocument();
    
    // Change to a different icon
    const FileIcon = () => <svg data-testid="file-icon" />;
    rerender(<EmptyState {...defaultProps} icon={FileIcon as any} />);
    
    expect(screen.getByTestId('file-icon')).toBeInTheDocument();
  });

  it('should have proper button focus styles', () => {
    const action = {
      label: 'Create new item',
      onClick: vi.fn()
    };
    
    render(<EmptyState {...defaultProps} action={action} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500', 'focus:ring-offset-2');
  });
});