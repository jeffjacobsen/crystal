import { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import { API } from '../../utils/api';
import { useErrorStore } from '../../stores/errorStore';
import { 
  Save, 
  Eye, 
  FileText, 
  Edit3, 
  X, 
  Download,
  Copy
} from 'lucide-react';
import type { ProductRequirementPrompt } from '../../types/prp';

interface PRPEditorProps {
  prp: ProductRequirementPrompt | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (prp: ProductRequirementPrompt) => void;
  projectId: number;
  mode?: 'view' | 'edit' | 'create';
}

type ViewMode = 'editor' | 'preview' | 'split';

export function PRPEditor({ 
  prp, 
  isOpen, 
  onClose, 
  onSave, 
  projectId, 
  mode = 'edit' 
}: PRPEditorProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(mode === 'edit' || mode === 'create');
  const [wordCount, setWordCount] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const { showError } = useErrorStore();
  
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen && prp) {
      setContent(prp.content || '');
      setTitle(prp.title || '');
      setIsDirty(false);
      setIsEditMode(mode === 'edit');
    } else if (isOpen && mode === 'create') {
      // If we have initial content from PRP generation, use it
      if (prp?.content) {
        setContent(prp.content);
        setTitle(prp.title || '');
        setIsDirty(true); // Mark as dirty so Save button is enabled
      } else {
        setContent('');
        setTitle('');
        setIsDirty(false);
      }
      setIsEditMode(true);
    }
  }, [isOpen, prp, mode]);

  useEffect(() => {
    // Update word and line counts
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const lines = content.split('\n').length;
    setWordCount(words);
    setLineCount(lines);

    // Validate PRP content
    validateContent(content);
  }, [content]);

  const validateContent = (prpContent: string) => {
    const issues: string[] = [];
    
    // Check for required sections
    const requiredSections = ['## Goal', '## Why', '## What', '## Implementation', '## Validation'];
    requiredSections.forEach(section => {
      if (!prpContent.includes(section)) {
        issues.push(`Missing required section: ${section}`);
      }
    });

    // Check for success criteria
    if (!prpContent.includes('Success Criteria') && !prpContent.includes('- [ ]')) {
      issues.push('Missing success criteria checklist');
    }

    // Check for validation loops
    if (!prpContent.includes('```bash') && !prpContent.includes('```')) {
      issues.push('Missing code validation examples');
    }

    // Check for context section
    if (!prpContent.includes('Context') && !prpContent.includes('Documentation')) {
      issues.push('Missing context or documentation references');
    }

    setValidationIssues(issues);
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure Monaco for Markdown
    monaco.languages.setMonarchTokensProvider('markdown', {
      tokenizer: {
        root: [
          [/^#+.*$/, 'markup.heading'],
          [/^\s*-\s+\[[\sx]\].*$/, 'markup.list.checklist'],
          [/^\s*[-*+]\s+.*$/, 'markup.list'],
          [/```[^`]*```/, 'markup.code.block'],
          [/`[^`]+`/, 'markup.code.inline'],
          [/\*\*[^*]+\*\*/, 'markup.bold'],
          [/\*[^*]+\*/, 'markup.italic'],
          [/\[([^\]]+)\]\(([^)]+)\)/, 'markup.link'],
        ]
      }
    });

    // Add custom commands
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      setViewMode(viewMode === 'preview' ? 'split' : 'preview');
    });
  };

  const handleSave = async () => {
    console.log('[PRPEditor] handleSave called');
    console.log('[PRPEditor] Mode:', mode);
    console.log('[PRPEditor] Title:', title);
    console.log('[PRPEditor] Content length:', content.length);
    console.log('[PRPEditor] PRP ID:', prp?.id);
    console.log('[PRPEditor] Project ID:', projectId);
    
    if (!title.trim()) {
      showError({
        title: 'Missing Title',
        error: 'Please provide a title for the PRP'
      });
      return;
    }

    if (!content.trim()) {
      showError({
        title: 'Missing Content',
        error: 'Please provide content for the PRP'
      });
      return;
    }

    setIsSaving(true);
    try {
      let response;
      
      if (prp && mode !== 'create') {
        // Update existing PRP
        console.log('[PRPEditor] Updating existing PRP:', prp.id);
        response = await API.prp.update(prp.id, content, false);
      } else {
        // Create new PRP
        console.log('[PRPEditor] Creating new PRP');
        response = await API.prp.create(projectId, title, content);
      }

      console.log('[PRPEditor] Save response:', response);
      
      if (response.success) {
        setIsDirty(false);
        if (onSave && response.data) {
          console.log('[PRPEditor] Calling onSave with data:', response.data);
          onSave(response.data);
        }
        if (mode === 'create') {
          onClose();
        }
      } else {
        throw new Error(response.error || 'Failed to save PRP');
      }
    } catch (error: any) {
      console.error('[PRPEditor] Save error:', error);
      showError({
        title: 'Save Failed',
        error: error.message || 'Failed to save PRP'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleContentChange = (value: string | undefined) => {
    const newContent = value || '';
    setContent(newContent);
    if (!isDirty) {
      setIsDirty(true);
    }
  };

  const insertTemplate = (template: string) => {
    if (editorRef.current) {
      const position = editorRef.current.getPosition();
      editorRef.current.executeEdits('insert-template', [
        {
          range: new monacoRef.current.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          text: template
        }
      ]);
      editorRef.current.focus();
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      // Could show a toast notification here
    } catch (error) {
      showError({
        title: 'Copy Failed',
        error: 'Failed to copy content to clipboard'
      });
    }
  };

  const downloadAsFile = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderPreview = () => {
    // Using a simple markdown renderer for preview
    const htmlContent = content
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/^\s*- \[ \] (.*$)/gm, '<div class="checkbox unchecked">☐ $1</div>')
      .replace(/^\s*- \[x\] (.*$)/gm, '<div class="checkbox checked">☑ $1</div>')
      .replace(/^\s*- (.*$)/gm, '<li>$1</li>')
      .replace(/\n/g, '<br>');

    return (
      <div 
        className="prose prose-sm max-w-none dark:prose-invert p-4 overflow-auto h-full"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-7xl h-[90vh] shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isEditMode ? (
                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="PRP Title"
                    className="text-lg font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-500"
                  />
                ) : (
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {title || 'Untitled PRP'}
                  </h2>
                )}
                {isDirty && <span className="text-orange-500 text-sm">●</span>}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-4">
                <span>{wordCount} words</span>
                <span>{lineCount} lines</span>
                {validationIssues.length > 0 && (
                  <span className="text-red-500">{validationIssues.length} issues</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View mode toggles */}
            <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-md">
              <button
                onClick={() => setViewMode('editor')}
                className={`px-3 py-1 text-sm rounded-l-md transition-colors ${
                  viewMode === 'editor' 
                    ? 'bg-blue-600 text-white' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1 text-sm border-x border-gray-200 dark:border-gray-600 transition-colors ${
                  viewMode === 'split' 
                    ? 'bg-blue-600 text-white' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="w-4 h-4 flex">
                  <div className="w-2 h-4 border border-current"></div>
                  <div className="w-2 h-4 border border-current border-l-0"></div>
                </div>
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 text-sm rounded-r-md transition-colors ${
                  viewMode === 'preview' 
                    ? 'bg-blue-600 text-white' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>

            {/* Action buttons */}
            <button
              onClick={copyToClipboard}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Copy to clipboard"
            >
              <Copy className="w-4 h-4" />
            </button>
            
            <button
              onClick={downloadAsFile}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Download as file"
            >
              <Download className="w-4 h-4" />
            </button>

            {isEditMode && (
              <button
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Validation Issues */}
        {validationIssues.length > 0 && (
          <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 flex-shrink-0">
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Validation Issues:</strong>
              <ul className="mt-1 ml-4">
                {validationIssues.slice(0, 3).map((issue, index) => (
                  <li key={index} className="list-disc">{issue}</li>
                ))}
                {validationIssues.length > 3 && (
                  <li className="list-disc">And {validationIssues.length - 3} more...</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Editor */}
          {(viewMode === 'editor' || viewMode === 'split') && (
            <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} border-r border-gray-200 dark:border-gray-700 h-full`}>
              <Editor
                height="100%"
                language="markdown"
                value={content}
                onChange={handleContentChange}
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={{
                  minimap: { enabled: true },
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  fontSize: 14,
                  tabSize: 2,
                  insertSpaces: true,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  readOnly: !isEditMode,
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto'
                  }
                }}
              />
            </div>
          )}

          {/* Preview */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} bg-white dark:bg-gray-900 h-full`}>
              <div className="h-full overflow-auto">
                {renderPreview()}
              </div>
            </div>
          )}
        </div>

        {/* Quick Insert Toolbar */}
        {isEditMode && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Quick Insert:</span>
              <button
                onClick={() => insertTemplate('\n## Goal\n[Specific, measurable outcome]\n')}
                className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Goal
              </button>
              <button
                onClick={() => insertTemplate('\n### Success Criteria\n- [ ] [Specific measurable outcome]\n- [ ] [Another outcome]\n')}
                className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Checklist
              </button>
              <button
                onClick={() => insertTemplate('\n```bash\n# Validation command\npnpm typecheck\npnpm lint\n```\n')}
                className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Code Block
              </button>
              <button
                onClick={() => insertTemplate('\n```yaml\n- file: [path/to/file.ts]\n  why: [Specific pattern to follow]\n```\n')}
                className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Context
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}