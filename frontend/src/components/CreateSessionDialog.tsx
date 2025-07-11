import React, { useState, useEffect } from 'react';
import { API } from '../utils/api';
import type { CreateSessionRequest } from '../types/session';
import { useErrorStore } from '../stores/errorStore';
import { Shield, ShieldOff, Sparkles, GitBranch, FileText, FileCheck, X } from 'lucide-react';
import FilePathAutocomplete from './FilePathAutocomplete';
import { DocumentSearchDialog } from './DocumentSearchDialog';
import { PRPSearchDialog } from './PRPSearchDialog';

interface CreateSessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  projectId?: number;
}

export function CreateSessionDialog({ isOpen, onClose, projectName, projectId }: CreateSessionDialogProps) {
  const [formData, setFormData] = useState<CreateSessionRequest>({
    prompt: '',
    worktreeTemplate: '',
    count: 1,
    permissionMode: 'ignore'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [worktreeError, setWorktreeError] = useState<string | null>(null);
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [branches, setBranches] = useState<Array<{ name: string; isCurrent: boolean; hasWorktree: boolean }>>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [autoCommit, setAutoCommit] = useState(true); // Default to true
  const [showDocumentSearch, setShowDocumentSearch] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Array<{id: number; title: string}>>([]);
  const [showPRPSearch, setShowPRPSearch] = useState(false);
  const [selectedPRP, setSelectedPRP] = useState<{id: number; title: string} | null>(null);
  const { showError } = useErrorStore();
  
  useEffect(() => {
    if (isOpen) {
      // Fetch the default permission mode and check for API key when dialog opens
      API.config.get().then(response => {
        if (response.success) {
          if (response.data?.defaultPermissionMode) {
            setFormData(prev => ({
              ...prev,
              permissionMode: response.data.defaultPermissionMode
            }));
          }
          // Check if API key exists
          setHasApiKey(!!response.data?.anthropicApiKey);
        }
      }).catch(err => {
        console.error('Failed to fetch config:', err);
      });
      
      // Fetch branches if projectId is provided
      if (projectId) {
        setIsLoadingBranches(true);
        API.projects.listBranches(projectId.toString()).then(response => {
          if (response.success && response.data) {
            setBranches(response.data);
            // Set the current branch as default if available
            const currentBranch = response.data.find((b: any) => b.isCurrent);
            if (currentBranch && !formData.baseBranch) {
              setFormData(prev => ({ ...prev, baseBranch: currentBranch.name }));
            }
          }
        }).catch(err => {
          console.error('Failed to fetch branches:', err);
        }).finally(() => {
          setIsLoadingBranches(false);
        });

      }
    }
  }, [isOpen, projectId]);
  
  // Pre-fill prompt when PRP is selected
  useEffect(() => {
    if (selectedPRP) {
      // Get default prompt template from config, with fallback
      const getDefaultPRPPrompt = async () => {
        try {
          const response = await API.config.get();
          if (response.success && response.data?.defaultPRPPromptTemplate) {
            return response.data.defaultPRPPromptTemplate;
          }
        } catch (error) {
          console.warn('Failed to get config for PRP prompt template:', error);
        }
        
        // Fallback default template
        return `## Execution Process

1. **Load PRP**
   - Read the PRP
   - Understand all context and requirements
   - Follow all instructions in the PRP and extend the research if needed
   - Ensure you have all needed context to implement the PRP fully
   - Do more web searches and codebase exploration as needed

2. **THINK**
   - Think hard before you execute the plan. Create a comprehensive plan addressing all requirements.
   - Break down complex tasks into smaller, manageable steps using your todos tools.
   - Use the TodoWrite tool to create and track your implementation plan.
   - Identify implementation patterns from existing code to follow.

3. **Execute the plan**
   - Execute the PRP
   - Implement all the code

4. **Validate**
   - Run each validation command
   - Fix any failures
   - Re-run until all pass

5. **Complete**
   - Ensure all checklist items done
   - Run final validation suite
   - Report completion status
   - Read the PRP again to ensure you have implemented everything

6. **Reference the PRP**
   - You can always reference the PRP again if needed

Note: If validation fails, use error patterns in PRP to fix and retry.`;
      };
      
      getDefaultPRPPrompt().then(promptTemplate => {
        setFormData(prev => ({
          ...prev,
          prompt: promptTemplate
        }));
      });
    }
  }, [selectedPRP]);
  
  if (!isOpen) return null;
  
  const validateWorktreeName = (name: string): string | null => {
    if (!name) return null; // Empty is allowed
    
    // Check for spaces
    if (name.includes(' ')) {
      return 'Session name cannot contain spaces';
    }
    
    // Check for invalid git characters
    const invalidChars = /[~^:?*\[\]\\]/;
    if (invalidChars.test(name)) {
      return 'Session name contains invalid characters (~^:?*[]\\)';
    }
    
    // Check if it starts or ends with dot
    if (name.startsWith('.') || name.endsWith('.')) {
      return 'Session name cannot start or end with a dot';
    }
    
    // Check if it starts or ends with slash
    if (name.startsWith('/') || name.endsWith('/')) {
      return 'Session name cannot start or end with a slash';
    }
    
    // Check for consecutive dots
    if (name.includes('..')) {
      return 'Session name cannot contain consecutive dots';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate worktree name
    const validationError = validateWorktreeName(formData.worktreeTemplate || '');
    if (validationError) {
      showError({
        title: 'Invalid Session Name',
        error: validationError
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const finalPrompt = formData.prompt;
      
      const response = await API.sessions.create({
        ...formData,
        prompt: finalPrompt,
        projectId,
        autoCommit,
        documentIds: selectedDocuments.map(doc => doc.id),
        prpId: selectedPRP?.id
      });
      
      if (!response.success) {
        showError({
          title: 'Failed to Create Session',
          error: response.error || 'An error occurred while creating the session.',
          details: response.details,
          command: response.command
        });
        return;
      }
      
      onClose();
      // Reset form but fetch the default permission mode again
      const configResponse = await API.config.get();
      const defaultPermissionMode = configResponse.success && configResponse.data?.defaultPermissionMode 
        ? configResponse.data.defaultPermissionMode 
        : 'ignore';
      setFormData({ prompt: '', worktreeTemplate: '', count: 1, permissionMode: defaultPermissionMode as 'ignore' | 'approve' });
      setWorktreeError(null);
      setAutoCommit(true); // Reset to default
      setSelectedDocuments([]);
      setSelectedPRP(null);
    } catch (error: any) {
      console.error('Error creating session:', error);
      showError({
        title: 'Failed to Create Session',
        error: error.message || 'An error occurred while creating the session.',
        details: error.stack || error.toString()
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div data-testid="create-session-dialog" className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Create New Session{projectName && ` in ${projectName}`}
          </h2>
          <button
            onClick={() => {
              setWorktreeError(null);
              onClose();
            }}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="create-session-form" onSubmit={handleSubmit} className="space-y-4">
            {/* PRP Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Use PRP
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPRPSearch(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600"
                >
                  <FileText className="w-4 h-4" />
                  {selectedPRP ? selectedPRP.title : 'Select PRP'}
                </button>
                
                {selectedPRP && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPRP(null);
                      // Clear the auto-filled prompt
                      setFormData({ ...formData, prompt: '' });
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                PRPs provide structured requirements and validation gates for Claude
              </p>
            </div>
            
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Prompt
            </label>
            <FilePathAutocomplete
              value={formData.prompt}
              onChange={(value) => setFormData({ ...formData, prompt: value })}
              projectId={projectId?.toString()}
              placeholder="Enter the prompt for Claude Code... (use @ to reference files)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400"
              isTextarea={true}
              rows={4}
            />
            <div className="mt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={autoCommit}
                  onChange={(e) => setAutoCommit(e.target.checked)}
                  className="h-4 w-4 text-green-600 rounded border-gray-300 dark:border-gray-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Enable auto-commit
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                Automatically commit changes after each prompt. Can be toggled later during the session.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="worktreeTemplate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Session Name (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  id="worktreeTemplate"
                  type="text"
                  value={formData.worktreeTemplate}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, worktreeTemplate: value });
                    // Real-time validation
                    const error = validateWorktreeName(value);
                    setWorktreeError(error);
                  }}
                  className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 ${
                    worktreeError 
                      ? 'border-red-400 focus:ring-red-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }`}
                  placeholder="Leave empty for AI-generated name"
                  disabled={isGeneratingName}
                />
                {hasApiKey && formData.prompt.trim() && (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsGeneratingName(true);
                      try {
                        const response = await API.sessions.generateName(formData.prompt);
                        if (response.success && response.data) {
                          setFormData({ ...formData, worktreeTemplate: response.data });
                          setWorktreeError(null);
                        } else {
                          showError({
                            title: 'Failed to Generate Name',
                            error: response.error || 'Could not generate session name'
                          });
                        }
                      } catch (error) {
                        showError({
                          title: 'Failed to Generate Name',
                          error: 'An error occurred while generating the name'
                        });
                      } finally {
                        setIsGeneratingName(false);
                      }
                    }}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-gray-300 dark:border-gray-600"
                    disabled={isGeneratingName || !formData.prompt.trim()}
                    title="Generate name from prompt"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isGeneratingName ? 'Generating...' : 'Generate'}
                  </button>
                )}
              </div>
              {worktreeError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{worktreeError}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {!worktreeError && 'The name that will be used to label your session and create your worktree folder.'}
              </p>
            </div>
            
            <div>
              <label htmlFor="count" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Number of Sessions
              </label>
              <input
                id="count"
                type="number"
                min="1"
                max="10"
                value={formData.count}
                onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Creates multiple sessions with numbered suffixes
              </p>
            </div>
          </div>
          
          {branches.length > 0 && (
            <div>
              <label htmlFor="baseBranch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Base Branch
              </label>
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-gray-400" />
                <select
                  id="baseBranch"
                  value={formData.baseBranch || ''}
                  onChange={(e) => setFormData({ ...formData, baseBranch: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  disabled={isLoadingBranches}
                >
                  {branches.map((branch, index) => {
                    // Check if this is the first non-worktree branch after worktree branches
                    const isFirstNonWorktree = index > 0 && 
                      !branch.hasWorktree && 
                      branches[index - 1].hasWorktree;
                    
                    return (
                      <React.Fragment key={branch.name}>
                        {isFirstNonWorktree && (
                          <option disabled value="">
                            ──────────────
                          </option>
                        )}
                        <option value={branch.name}>
                          {branch.name} {branch.isCurrent ? '(current)' : ''}
                        </option>
                      </React.Fragment>
                    );
                  })}
                </select>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Create the new session branch from this existing branch
              </p>
            </div>
          )}
          
          
          {/* Document Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Include Documents
            </label>
            <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDocumentSearch(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600"
                >
                  <FileText className="w-4 h-4" />
                  Select Documents
                  {selectedDocuments.length > 0 && (
                    <span className="ml-1 bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs">
                      {selectedDocuments.length}
                    </span>
                  )}
                </button>
                
                {selectedDocuments.length > 0 && (
                  <div className="flex-1 flex flex-wrap gap-1">
                    {selectedDocuments.slice(0, 3).map(doc => (
                      <span key={doc.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs">
                        <FileCheck className="w-3 h-3" />
                        {doc.title}
                      </span>
                    ))}
                    {selectedDocuments.length > 3 && (
                      <span className="inline-flex items-center px-2 py-1 text-gray-500 dark:text-gray-400 text-xs">
                        +{selectedDocuments.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Selected documents provide Claude with project context and requirements
              </p>
          </div>
          
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Permission Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="permissionMode"
                  value="ignore"
                  checked={formData.permissionMode === 'ignore' || !formData.permissionMode}
                  onChange={(e) => setFormData({ ...formData, permissionMode: e.target.value as 'ignore' | 'approve' })}
                  className="text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <ShieldOff className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-200">Skip Permissions</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">(recommended)</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-6 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                    Claude runs with full permissions. Ideal for trusted environments and faster workflows.
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="permissionMode"
                  value="approve"
                  checked={formData.permissionMode === 'approve'}
                  onChange={(e) => setFormData({ ...formData, permissionMode: e.target.value as 'ignore' | 'approve' })}
                  className="text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-600 dark:text-green-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-200">Manual Approval</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">(safer)</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-6 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                    Claude asks permission for file operations. Use this for sensitive projects or when learning.
                  </p>
                </div>
              </label>
            </div>
          </div>
          </form>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => {
              setWorktreeError(null);
              onClose();
            }}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-session-form"
            disabled={isSubmitting || !formData.prompt || !!worktreeError}
            className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium transition-colors shadow-sm hover:shadow"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              `Create ${(formData.count || 1) > 1 ? (formData.count || 1) + ' Sessions' : 'Session'}`
            )}
          </button>
        </div>
      </div>
      
      {/* Document Search Dialog */}
      {showDocumentSearch && projectId && (
        <DocumentSearchDialog
          isOpen={showDocumentSearch}
          onClose={() => setShowDocumentSearch(false)}
          projectId={projectId}
          selectionMode="multiple"
          onDocumentSelect={() => {}} // Not used in multiple mode
          onMultipleSelect={(docs) => {
            setSelectedDocuments(docs.map(d => ({ id: d.id, title: d.title })));
            setShowDocumentSearch(false);
          }}
        />
      )}
      
      {/* PRP Search Dialog */}
      {showPRPSearch && (
        <PRPSearchDialog
          isOpen={showPRPSearch}
          onClose={() => setShowPRPSearch(false)}
          onPRPSelect={(prp) => {
            setSelectedPRP({ id: prp.id, title: prp.title });
            setShowPRPSearch(false);
          }}
        />
      )}
    </div>
  );
}