import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateSessionDialog } from '../CreateSessionDialog';
import { API } from '../../utils/api';
import { useErrorStore } from '../../stores/errorStore';

// Mock the API
vi.mock('../../utils/api', () => ({
  API: {
    config: {
      get: vi.fn()
    },
    projects: {
      listBranches: vi.fn()
    },
    sessions: {
      create: vi.fn(),
      generateName: vi.fn()
    }
  }
}));

// Mock the error store
vi.mock('../../stores/errorStore', () => ({
  useErrorStore: vi.fn()
}));

// Mock the child components
vi.mock('../FilePathAutocomplete', () => ({
  default: ({ value, onChange, placeholder, rows }: any) => (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      data-testid="file-path-autocomplete"
    />
  )
}));

vi.mock('../DocumentSearchDialog', () => ({
  DocumentSearchDialog: vi.fn(({ isOpen, onClose, onMultipleSelect }: any) => 
    isOpen ? (
      <div data-testid="document-search-dialog">
        <button onClick={() => onMultipleSelect([
          { id: 1, title: 'Doc 1' },
          { id: 2, title: 'Doc 2' }
        ])}>
          Select Documents
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  )
}));

vi.mock('../PRPSearchDialog', () => ({
  PRPSearchDialog: ({ isOpen, onClose, onPRPSelect }: any) => 
    isOpen ? (
      <div data-testid="prp-search-dialog">
        <button onClick={() => onPRPSelect({ id: 1, title: 'Test PRP' })}>
          Select PRP
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
}));

describe('CreateSessionDialog', () => {
  const mockShowError = vi.fn();
  const mockOnClose = vi.fn();
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    projectName: 'Test Project',
    projectId: 123
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useErrorStore as any).mockReturnValue({ showError: mockShowError });
    
    // Default API mock responses
    (API.config.get as any).mockResolvedValue({
      success: true,
      data: {
        defaultPermissionMode: 'ignore',
        anthropicApiKey: 'test-key',
        defaultPRPPromptTemplate: 'Test PRP template'
      }
    });
    
    (API.projects.listBranches as any).mockResolvedValue({
      success: true,
      data: [
        { name: 'main', isCurrent: true, hasWorktree: false },
        { name: 'feature-branch', isCurrent: false, hasWorktree: false },
        { name: 'worktree-branch', isCurrent: false, hasWorktree: true }
      ]
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render when isOpen is true', () => {
      render(<CreateSessionDialog {...defaultProps} />);
      
      expect(screen.getByTestId('create-session-dialog')).toBeInTheDocument();
      expect(screen.getByText('Create New Session in Test Project')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<CreateSessionDialog {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByTestId('create-session-dialog')).not.toBeInTheDocument();
    });

    it('should render without project name', () => {
      render(<CreateSessionDialog {...defaultProps} projectName={undefined} />);
      
      expect(screen.getByText('Create New Session')).toBeInTheDocument();
    });

    it('should load config and branches on open', async () => {
      render(<CreateSessionDialog {...defaultProps} />);
      
      await waitFor(() => {
        expect(API.config.get).toHaveBeenCalled();
        expect(API.projects.listBranches).toHaveBeenCalledWith('123');
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate worktree name in real-time', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const nameInput = screen.getByPlaceholderText('Leave empty for AI-generated name');
      
      // Test invalid names
      await user.type(nameInput, 'name with spaces');
      expect(screen.getByText('Session name cannot contain spaces')).toBeInTheDocument();
      
      await user.clear(nameInput);
      await user.type(nameInput, 'name~with~invalid');
      expect(screen.getByText('Session name contains invalid characters (~^:?*[]\\)')).toBeInTheDocument();
      
      await user.clear(nameInput);
      await user.type(nameInput, '.startwithdot');
      expect(screen.getByText('Session name cannot start or end with a dot')).toBeInTheDocument();
      
      await user.clear(nameInput);
      await user.type(nameInput, 'has..dots');
      expect(screen.getByText('Session name cannot contain consecutive dots')).toBeInTheDocument();
      
      // Test valid name
      await user.clear(nameInput);
      await user.type(nameInput, 'valid-name');
      expect(screen.queryByText(/Session name/)).not.toBeInTheDocument();
    });

    it('should disable submit button when prompt is empty', () => {
      render(<CreateSessionDialog {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: /Create Session/i });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when worktree name has error', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const promptInput = screen.getByTestId('file-path-autocomplete');
      const nameInput = screen.getByPlaceholderText('Leave empty for AI-generated name');
      
      await user.type(promptInput, 'Test prompt');
      await user.type(nameInput, 'invalid name');
      
      const submitButton = screen.getByRole('button', { name: /Create Session/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Permission Mode', () => {
    it('should load default permission mode from config', async () => {
      render(<CreateSessionDialog {...defaultProps} />);
      
      await waitFor(() => {
        const ignoreRadio = screen.getByRole('radio', { name: /Skip Permissions/i });
        expect(ignoreRadio).toBeChecked();
      });
    });

    it('should allow changing permission mode', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const approveRadio = screen.getByRole('radio', { name: /Manual Approval/i });
      await user.click(approveRadio);
      
      expect(approveRadio).toBeChecked();
    });
  });

  describe('Branch Selection', () => {
    it('should load and display branches', async () => {
      render(<CreateSessionDialog {...defaultProps} />);
      
      await waitFor(() => {
        const branchSelect = screen.getByLabelText('Base Branch');
        expect(branchSelect).toBeInTheDocument();
        expect(screen.getByText('main (current)')).toBeInTheDocument();
      });
    });

    it('should set current branch as default', async () => {
      render(<CreateSessionDialog {...defaultProps} />);
      
      await waitFor(() => {
        const branchSelect = screen.getByLabelText('Base Branch') as HTMLSelectElement;
        expect(branchSelect.value).toBe('main');
      });
    });

    it('should handle branch loading errors', async () => {
      (API.projects.listBranches as any).mockRejectedValue(new Error('Failed to load'));
      render(<CreateSessionDialog {...defaultProps} />);
      
      await waitFor(() => {
        expect(API.projects.listBranches).toHaveBeenCalled();
      });
      
      // Should not crash and branches section should not be visible
      expect(screen.queryByLabelText('Base Branch')).not.toBeInTheDocument();
    });
  });

  describe('Session Count', () => {
    it('should default to 1 session', () => {
      render(<CreateSessionDialog {...defaultProps} />);
      
      const countInput = screen.getByLabelText('Number of Sessions') as HTMLInputElement;
      expect(countInput.value).toBe('1');
    });

    it('should update button text based on count', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const countInput = screen.getByLabelText('Number of Sessions');
      
      await user.clear(countInput);
      await user.type(countInput, '3');
      
      expect(screen.getByRole('button', { name: /Create 3 Sessions/i })).toBeInTheDocument();
    });

    it('should enforce min/max limits', () => {
      render(<CreateSessionDialog {...defaultProps} />);
      
      const countInput = screen.getByLabelText('Number of Sessions') as HTMLInputElement;
      expect(countInput.min).toBe('1');
      expect(countInput.max).toBe('10');
    });
  });

  describe('AI Name Generation', () => {
    it('should show generate button when API key exists and prompt is entered', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const promptInput = screen.getByTestId('file-path-autocomplete');
      await user.type(promptInput, 'Test prompt');
      
      expect(screen.getByRole('button', { name: /Generate/i })).toBeInTheDocument();
    });

    it('should not show generate button without API key', async () => {
      (API.config.get as any).mockResolvedValue({
        success: true,
        data: { defaultPermissionMode: 'ignore', anthropicApiKey: null }
      });
      
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      await waitFor(() => {
        expect(API.config.get).toHaveBeenCalled();
      });
      
      const promptInput = screen.getByTestId('file-path-autocomplete');
      await user.type(promptInput, 'Test prompt');
      
      expect(screen.queryByRole('button', { name: /Generate/i })).not.toBeInTheDocument();
    });

    it('should generate name successfully', async () => {
      (API.sessions.generateName as any).mockResolvedValue({
        success: true,
        data: 'generated-name'
      });
      
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const promptInput = screen.getByTestId('file-path-autocomplete');
      await user.type(promptInput, 'Test prompt');
      
      const generateButton = screen.getByRole('button', { name: /Generate/i });
      await user.click(generateButton);
      
      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('Leave empty for AI-generated name') as HTMLInputElement;
        expect(nameInput.value).toBe('generated-name');
      });
    });

    it('should handle generation errors', async () => {
      (API.sessions.generateName as any).mockResolvedValue({
        success: false,
        error: 'Generation failed'
      });
      
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const promptInput = screen.getByTestId('file-path-autocomplete');
      await user.type(promptInput, 'Test prompt');
      
      const generateButton = screen.getByRole('button', { name: /Generate/i });
      await user.click(generateButton);
      
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith({
          title: 'Failed to Generate Name',
          error: 'Generation failed'
        });
      });
    });
  });

  describe('Document Selection', () => {
    it('should open document search dialog', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const selectButton = screen.getByRole('button', { name: /Select Documents/i });
      await user.click(selectButton);
      
      expect(screen.getByTestId('document-search-dialog')).toBeInTheDocument();
    });

    it('should display selected documents', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const selectButton = screen.getByRole('button', { name: /Select Documents/i });
      await user.click(selectButton);
      
      const selectDocsButton = screen.getByText('Select Documents', { selector: 'button' });
      await user.click(selectDocsButton);
      
      expect(screen.getByText('Doc 1')).toBeInTheDocument();
      expect(screen.getByText('Doc 2')).toBeInTheDocument();
      expect(screen.getByText('2', { selector: '.bg-blue-600' })).toBeInTheDocument();
    });

    it('should show count when more than 3 documents selected', async () => {
      // Import the mocked component to modify it
      const { DocumentSearchDialog } = await import('../DocumentSearchDialog');
      vi.mocked(DocumentSearchDialog).mockImplementation(({ isOpen, onMultipleSelect }: any) => 
        isOpen ? (
          <div data-testid="document-search-dialog">
            <button onClick={() => onMultipleSelect([
              { id: 1, title: 'Doc 1' },
              { id: 2, title: 'Doc 2' },
              { id: 3, title: 'Doc 3' },
              { id: 4, title: 'Doc 4' },
              { id: 5, title: 'Doc 5' }
            ])}>
              Select Many Documents
            </button>
          </div>
        ) : null
      );
      
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const selectButton = screen.getByRole('button', { name: /Select Documents/i });
      await user.click(selectButton);
      
      const selectManyButton = screen.getByText('Select Many Documents');
      await user.click(selectManyButton);
      
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });
  });

  describe('PRP Selection', () => {
    it('should open PRP search dialog', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const selectButton = screen.getByRole('button', { name: /Select PRP/i });
      await user.click(selectButton);
      
      expect(screen.getByTestId('prp-search-dialog')).toBeInTheDocument();
    });

    it('should display selected PRP and prefill prompt', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const selectButton = screen.getByRole('button', { name: /Select PRP/i });
      await user.click(selectButton);
      
      const selectPRPButton = screen.getByText('Select PRP');
      await user.click(selectPRPButton);
      
      await waitFor(() => {
        expect(screen.getByText('Test PRP')).toBeInTheDocument();
        const promptInput = screen.getByTestId('file-path-autocomplete') as HTMLTextAreaElement;
        expect(promptInput.value).toContain('Test PRP template');
      });
    });

    it('should clear PRP selection', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      // Select a PRP first
      const selectButton = screen.getByRole('button', { name: /Select PRP/i });
      await user.click(selectButton);
      await user.click(screen.getByText('Select PRP'));
      
      // Clear it
      const clearButton = screen.getByRole('button', { name: '' }); // X button
      await user.click(clearButton);
      
      expect(screen.queryByText('Test PRP')).not.toBeInTheDocument();
      const promptInput = screen.getByTestId('file-path-autocomplete') as HTMLTextAreaElement;
      expect(promptInput.value).toBe('');
    });
  });

  describe('Auto-commit', () => {
    it('should be enabled by default', () => {
      render(<CreateSessionDialog {...defaultProps} />);
      
      const autoCommitCheckbox = screen.getByRole('checkbox', { name: /Enable auto-commit/i });
      expect(autoCommitCheckbox).toBeChecked();
    });

    it('should toggle auto-commit', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const autoCommitCheckbox = screen.getByRole('checkbox', { name: /Enable auto-commit/i });
      await user.click(autoCommitCheckbox);
      
      expect(autoCommitCheckbox).not.toBeChecked();
    });
  });

  describe('Form Submission', () => {
    it('should create session successfully', async () => {
      (API.sessions.create as any).mockResolvedValue({
        success: true,
        data: { id: 'new-session' }
      });
      
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const promptInput = screen.getByTestId('file-path-autocomplete');
      await user.type(promptInput, 'Test prompt');
      
      const submitButton = screen.getByRole('button', { name: /Create Session/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(API.sessions.create).toHaveBeenCalledWith({
          prompt: 'Test prompt',
          worktreeTemplate: '',
          count: 1,
          permissionMode: 'ignore',
          projectId: 123,
          autoCommit: true,
          documentIds: [],
          prpId: undefined
        });
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should include all form data in submission', async () => {
      (API.sessions.create as any).mockResolvedValue({
        success: true,
        data: { id: 'new-session' }
      });
      
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      // Fill out form
      const promptInput = screen.getByTestId('file-path-autocomplete');
      await user.type(promptInput, 'Test prompt');
      
      const nameInput = screen.getByPlaceholderText('Leave empty for AI-generated name');
      await user.type(nameInput, 'custom-name');
      
      const countInput = screen.getByLabelText('Number of Sessions');
      await user.clear(countInput);
      await user.type(countInput, '2');
      
      const approveRadio = screen.getByRole('radio', { name: /Manual Approval/i });
      await user.click(approveRadio);
      
      const autoCommitCheckbox = screen.getByRole('checkbox', { name: /Enable auto-commit/i });
      await user.click(autoCommitCheckbox);
      
      // Select documents
      await user.click(screen.getByRole('button', { name: /Select Documents/i }));
      await user.click(screen.getByText('Select Documents', { selector: 'button' }));
      
      // Select PRP
      await user.click(screen.getByRole('button', { name: /Select PRP/i }));
      await user.click(screen.getByText('Select PRP'));
      
      // Submit
      const submitButton = screen.getByRole('button', { name: /Create 2 Sessions/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(API.sessions.create).toHaveBeenCalledWith({
          prompt: expect.stringContaining('Test PRP template'),
          worktreeTemplate: 'custom-name',
          count: 2,
          permissionMode: 'approve',
          projectId: 123,
          autoCommit: false,
          documentIds: [1, 2],
          prpId: 1,
          baseBranch: 'main'
        });
      });
    });

    it('should handle submission errors', async () => {
      (API.sessions.create as any).mockResolvedValue({
        success: false,
        error: 'Creation failed',
        details: 'Some details',
        command: 'git command'
      });
      
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const promptInput = screen.getByTestId('file-path-autocomplete');
      await user.type(promptInput, 'Test prompt');
      
      const submitButton = screen.getByRole('button', { name: /Create Session/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith({
          title: 'Failed to Create Session',
          error: 'Creation failed',
          details: 'Some details',
          command: 'git command'
        });
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });

    it('should show loading state during submission', async () => {
      (API.sessions.create as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );
      
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const promptInput = screen.getByTestId('file-path-autocomplete');
      await user.type(promptInput, 'Test prompt');
      
      const submitButton = screen.getByRole('button', { name: /Create Session/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Creating...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should reset form after successful submission', async () => {
      (API.sessions.create as any).mockResolvedValue({
        success: true,
        data: { id: 'new-session' }
      });
      
      const user = userEvent.setup();
      const { rerender } = render(<CreateSessionDialog {...defaultProps} />);
      
      const promptInput = screen.getByTestId('file-path-autocomplete');
      await user.type(promptInput, 'Test prompt');
      
      const submitButton = screen.getByRole('button', { name: /Create Session/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
      
      // Reopen dialog
      rerender(<CreateSessionDialog {...defaultProps} isOpen={false} />);
      rerender(<CreateSessionDialog {...defaultProps} isOpen={true} />);
      
      await waitFor(() => {
        const newPromptInput = screen.getByTestId('file-path-autocomplete') as HTMLTextAreaElement;
        expect(newPromptInput.value).toBe('');
      });
    });
  });

  describe('Dialog Controls', () => {
    it('should close on cancel button', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close on X button', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const closeButton = screen.getByTitle('Close');
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should disable cancel button during submission', async () => {
      (API.sessions.create as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );
      
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const promptInput = screen.getByTestId('file-path-autocomplete');
      await user.type(promptInput, 'Test prompt');
      
      const submitButton = screen.getByRole('button', { name: /Create Session/i });
      await user.click(submitButton);
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing projectId', () => {
      render(<CreateSessionDialog {...defaultProps} projectId={undefined} />);
      
      // Should not crash and branches should not be loaded
      expect(API.projects.listBranches).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Base Branch')).not.toBeInTheDocument();
    });

    it('should handle config loading failure', async () => {
      (API.config.get as any).mockRejectedValue(new Error('Config failed'));
      
      render(<CreateSessionDialog {...defaultProps} />);
      
      await waitFor(() => {
        expect(API.config.get).toHaveBeenCalled();
      });
      
      // Should not crash and use defaults
      const ignoreRadio = screen.getByRole('radio', { name: /Skip Permissions/i });
      expect(ignoreRadio).toBeChecked();
    });

    it('should handle invalid session count', async () => {
      const user = userEvent.setup();
      render(<CreateSessionDialog {...defaultProps} />);
      
      const countInput = screen.getByLabelText('Number of Sessions');
      await user.clear(countInput);
      await user.type(countInput, '0');
      
      const promptInput = screen.getByTestId('file-path-autocomplete');
      await user.type(promptInput, 'Test prompt');
      
      const submitButton = screen.getByRole('button', { name: /Create Session/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(API.sessions.create).toHaveBeenCalledWith(
          expect.objectContaining({ count: 1 }) // Should default to 1
        );
      });
    });
  });
});