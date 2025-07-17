import React, { useState, useEffect } from 'react';
import { API } from '../../utils/api';
import { useErrorStore } from '../../stores/errorStore';
import { 
  Sparkles, 
  FileText, 
  Code, 
  Bug, 
  Layers, 
  ChevronRight, 
  Wand2,
  CheckCircle,
  Clock,
  FolderOpen
} from 'lucide-react';
import type { PRPTemplate } from '../../types/prp';
import { TelemetryView } from './TelemetryView';
import type { TelemetryData } from '../../../../shared/types/telemetry';

interface PRPGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: number;
  initialCodebasePath?: string;
  onPRPGenerated?: (prpContent: string) => void;
}

type GenerationStep = 'template' | 'details' | 'generating' | 'review';

export function PRPGenerator({ isOpen, onClose, projectId: _projectId, initialCodebasePath, onPRPGenerated }: PRPGeneratorProps) {
  const [currentStep, setCurrentStep] = useState<GenerationStep>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<PRPTemplate | null>(null);
  const [prpName, setPrpName] = useState('');
  const [featureRequest, setFeatureRequest] = useState('');
  const [codebasePath, setCodebasePath] = useState(initialCodebasePath || '');
  const [generatedPRP, setGeneratedPRP] = useState('');
  const [templates, setTemplates] = useState<PRPTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [generationProgress, setGenerationProgress] = useState<{
    stage: 'starting' | 'processing' | 'finalizing' | 'complete' | 'error';
    message: string;
    progress: number;
    telemetry?: TelemetryData;
    metadata?: any;
  }>({
    stage: 'starting',
    message: 'Initializing...',
    progress: 0
  });
  const [isCancelling, setIsCancelling] = useState(false);
  const { showError } = useErrorStore();

  // Template icons mapping by category
  const categoryIcons: Record<string, any> = {
    'general': Layers,
    'frontend': Code,
    'backend': FileText,
    'maintenance': Bug
  };
  
  // Legacy template icon mapping
  const templateIcons = {
    'base': Layers,
    'web_feature': Code,
    'web-react': Code,
    'backend_service': FileText,
    'backend-node': FileText,
    'bug_fix': Bug,
    'bug-fix': Bug
  };

  // Complexity colors
  const complexityColors: Record<string, string> = {
    'low': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'high': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      // Reset state when dialog opens
      setCurrentStep('template');
      setSelectedTemplate(null);
      setFeatureRequest('');
      setCodebasePath(initialCodebasePath || '');
      setGeneratedPRP('');
    }
  }, [isOpen, initialCodebasePath]);

  const loadTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const response = await API.prp.getTemplates();
      
      if (response.success && response.data) {
        setTemplates(response.data);
      } else {
        throw new Error(response.error || 'Failed to load templates');
      }
    } catch (error: any) {
      showError({
        title: 'Failed to Load Templates',
        error: error.message || 'Could not load PRP templates'
      });
      
      // Fallback to basic templates if loading fails
      setTemplates([
        {
          id: 'base',
          name: 'Base PRP Template',
          description: 'General-purpose template for any feature development',
          category: 'general',
          tags: ['general'],
          complexity: 'medium',
          useCase: 'Any feature development requiring comprehensive planning',
          version: '1.0.0',
          isCustom: false,
          path: ''
        }
      ]);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const cancelGeneration = async () => {
    setIsCancelling(true);
    try {
      await API.prp.cancelGeneration();
      // Close the dialog instead of going back to details
      onClose();
    } catch (error: any) {
      console.error('Failed to cancel generation:', error);
      // Even if cancel fails, close the dialog
      onClose();
    } finally {
      setIsCancelling(false);
    }
  };

  const generatePRP = async () => {
    if (!selectedTemplate || !featureRequest.trim()) {
      showError({
        title: 'Missing Information',
        error: 'Please select a template and provide a feature description'
      });
      return;
    }

    setCurrentStep('generating');
    setGenerationProgress({
      stage: 'starting',
      message: 'Initializing Claude Code...',
      progress: 0
    });

    // Set up progress listener
    let removeListener: (() => void) | undefined;
    
    // Check if the new event API is available
    if (window.electronAPI.events.onPRPGenerationProgress) {
      removeListener = window.electronAPI.events.onPRPGenerationProgress((progress) => {
        console.log('Progress update received:', progress);
        setGenerationProgress(progress);
      });
    } else if (window.electron) {
      // Fallback to the generic event listener
      console.log('Using fallback electron event listener');
      const progressHandler = (progress: any) => {
        console.log('Progress update received (fallback):', JSON.stringify(progress));
        setGenerationProgress(progress);
      };
      window.electron.on('prp:generation-progress', progressHandler);
      removeListener = () => window.electron?.off('prp:generation-progress', progressHandler);
    } else {
      console.error('No event listener available for PRP generation progress');
    }

    try {
      const response = await API.prp.generateFromTemplate({
        templateId: selectedTemplate.id,
        featureRequest,
        codebasePath: codebasePath || undefined,
        streamProgress: true
      });

      if (response.success && response.data) {
        setGeneratedPRP(response.data.content);
        // Don't automatically go to review - let user click Next
        setGenerationProgress(prev => ({
          ...prev,
          stage: 'complete',
          message: 'Generation complete!'
        }));
      } else {
        throw new Error(response.error || 'Failed to generate PRP');
      }
    } catch (error: any) {
      showError({
        title: 'PRP Generation Failed',
        error: error.message || 'An error occurred while generating the PRP'
      });
      setCurrentStep('details');
    } finally {
      // Clean up listener
      if (removeListener) {
        removeListener();
      }
    }
  };

  const savePRP = async () => {
    console.log('[PRPGenerator] savePRP called');
    console.log('[PRPGenerator] generatedPRP length:', generatedPRP?.length);
    
    try {
      // Use the user-provided PRP name
      const prpTitle = prpName.trim() || `PRP: ${featureRequest.substring(0, 50)}${featureRequest.length > 50 ? '...' : ''}`;
      
      console.log('[PRPGenerator] Saving PRP with title:', prpTitle);
      
      // Save directly to database
      const response = await API.prp.create(1, prpTitle, generatedPRP); // projectId=1 for compatibility
      
      console.log('[PRPGenerator] Save response:', response);
      
      if (response.success) {
        // Notify parent that PRP was generated/saved
        if (onPRPGenerated) {
          console.log('[PRPGenerator] Notifying parent of successful save');
          onPRPGenerated(generatedPRP);
        }
        // Close the dialog
        onClose();
      } else {
        throw new Error(response.error || 'Failed to save PRP');
      }
    } catch (error: any) {
      console.error('[PRPGenerator] Save error:', error);
      showError({
        title: 'Failed to Save PRP',
        error: error.message
      });
    }
  };

  const renderTemplateSelection = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Choose a Template
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select the template that best matches your development task
        </p>
      </div>

      {templatesLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-600 dark:text-gray-400">Loading templates...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {templates.map((template) => {
            const IconComponent = templateIcons[template.id as keyof typeof templateIcons] || 
                                categoryIcons[template.category] || 
                                FileText;
            const isSelected = selectedTemplate?.id === template.id;
            
            return (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <IconComponent className={`w-6 h-6 mt-0.5 ${
                    isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium ${
                          isSelected ? 'text-blue-900 dark:text-blue-200' : 'text-gray-900 dark:text-white'
                        }`}>
                          {template.name}
                        </h4>
                        {template.isCustom && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                            Custom
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        complexityColors[template.complexity as keyof typeof complexityColors]
                      }`}>
                        {template.complexity}
                      </span>
                    </div>
                    <p className={`text-sm mb-2 ${
                      isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {template.description}
                    </p>
                    <div className={`text-xs space-y-1 ${
                      isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500'
                    }`}>
                      <p>Best for: {template.useCase}</p>
                      {template.tags && template.tags.length > 0 && (
                        <p>Tags: {template.tags.join(', ')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => setCurrentStep('details')}
          disabled={!selectedTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium transition-colors"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderDetailsInput = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Feature Details
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Provide details about what you want to build. Be as specific as possible.
        </p>
      </div>

      <div>
        <label htmlFor="prpName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          PRP Name *
        </label>
        <input
          type="text"
          id="prpName"
          value={prpName}
          onChange={(e) => setPrpName(e.target.value)}
          placeholder="Give this PRP a meaningful name..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400"
        />
      </div>

      <div>
        <label htmlFor="featureRequest" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Feature Description *
        </label>
        <textarea
          id="featureRequest"
          value={featureRequest}
          onChange={(e) => setFeatureRequest(e.target.value)}
          placeholder="Describe what you want to build, including specific requirements, user interactions, and expected behavior..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400"
        />
      </div>

      <div>
        <label htmlFor="codebasePath" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Codebase Path (Optional)
          </div>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            id="codebasePath"
            value={codebasePath}
            onChange={(e) => setCodebasePath(e.target.value)}
            placeholder="/path/to/your/project (leave empty for new projects)"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400"
          />
          <button
            type="button"
            onClick={async () => {
              const result = await API.dialog.openDirectory({
                title: 'Select Codebase Directory',
                buttonLabel: 'Select',
              });
              if (result.success && result.data) {
                setCodebasePath(result.data);
              }
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Browse
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {codebasePath ? 'Claude will analyze this codebase to generate context-aware PRP' : 'Claude will generate PRP for a new project with suggested conventions'}
        </p>
      </div>


      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
        <div className="flex items-start space-x-2">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Selected Template: {selectedTemplate?.name}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {selectedTemplate?.description}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={() => setCurrentStep('template')}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={generatePRP}
          disabled={!prpName.trim() || !featureRequest.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium transition-colors"
        >
          <Wand2 className="w-4 h-4" />
          Generate PRP
        </button>
      </div>
    </div>
  );

  const renderGenerating = () => {
    const getStageIcon = (stage: string, currentStage: string) => {
      const stages = ['starting', 'processing', 'finalizing', 'complete'];
      const currentIndex = stages.indexOf(currentStage);
      const stageIndex = stages.indexOf(stage);
      
      if (currentStage === 'error') {
        return <Clock className="w-4 h-4 text-red-600" />;
      }
      
      if (stageIndex < currentIndex || (stage === currentStage && currentStage !== 'complete')) {
        return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      } else if (stageIndex === currentIndex && currentStage === 'complete') {
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      } else if (stage === 'complete' && stages.indexOf(currentStage) >= 3) {
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      } else {
        return <Clock className="w-4 h-4 text-gray-400" />;
      }
    };
    
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
          <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Generating PRP with Claude Code
        </h3>
        
        {/* Telemetry View - moved to where progress bar was */}
        {generationProgress.telemetry && (
          <div className="w-full max-w-md mx-auto mb-6">
            <TelemetryView telemetry={generationProgress.telemetry} />
          </div>
        )}
        
        <div className="space-y-2 text-left max-w-md mx-auto">
          <div className={`flex items-center gap-2 text-sm p-2 rounded-md transition-all ${
            generationProgress.stage === 'starting' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : ''
          }`}>
            {getStageIcon('starting', generationProgress.stage)}
            <span className={generationProgress.stage === 'starting' ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-600 dark:text-gray-300'}>Initializing Claude Code</span>
          </div>
          <div className={`flex items-center gap-2 text-sm p-2 rounded-md transition-all ${
            generationProgress.stage === 'processing' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : ''
          }`}>
            {getStageIcon('processing', generationProgress.stage)}
            <span className={generationProgress.stage === 'processing' ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-600 dark:text-gray-300'}>Analyzing requirements and codebase</span>
          </div>
          <div className={`flex items-center gap-2 text-sm p-2 rounded-md transition-all ${
            generationProgress.stage === 'finalizing' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : ''
          }`}>
            {getStageIcon('finalizing', generationProgress.stage)}
            <span className={generationProgress.stage === 'finalizing' ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-600 dark:text-gray-300'}>Finalizing PRP generation</span>
          </div>
          <div className={`flex items-center gap-2 text-sm p-2 rounded-md transition-all ${
            generationProgress.stage === 'complete' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : ''
          }`}>
            {getStageIcon('complete', generationProgress.stage)}
            <span className={generationProgress.stage === 'complete' ? 'text-green-900 dark:text-green-200 font-semibold' : 'text-gray-600 dark:text-gray-300'}>Generation complete</span>
          </div>
        </div>
        
        {generationProgress.metadata && (
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            {generationProgress.metadata.duration_ms && (
              <p>Processing time: {(generationProgress.metadata.duration_ms / 1000).toFixed(1)}s</p>
            )}
            {generationProgress.metadata.num_turns && (
              <p>Claude turns: {generationProgress.metadata.num_turns}</p>
            )}
          </div>
        )}
        
        {generationProgress.stage === 'error' && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">
              {generationProgress.message}
            </p>
          </div>
        )}
        
        {/* Cancel/Next button */}
        <div className="mt-6">
          {generationProgress.stage === 'complete' ? (
            <button
              onClick={() => setCurrentStep('review')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Next
            </button>
          ) : generationProgress.stage !== 'error' ? (
            <button
              onClick={cancelGeneration}
              disabled={isCancelling}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const renderReview = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Generated PRP
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Review the generated Product Requirement Prompt and save it to your project.
        </p>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Generated PRP Preview
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {generatedPRP.length} characters
            </span>
          </div>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto">
          <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-mono">
            {generatedPRP || 'No content generated yet...'}
          </pre>
        </div>
      </div>

      {generatedPRP && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
          <div className="flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                PRP Generated Successfully
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                The PRP includes comprehensive context, implementation blueprint, and validation loops.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={() => setCurrentStep('details')}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium transition-colors"
        >
          Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={generatePRP}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
          >
            Regenerate
          </button>
          <button
            onClick={savePRP}
            disabled={!generatedPRP}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Save PRP
          </button>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                PRP Generator
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Create comprehensive Product Requirement Prompts with AI assistance
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              // Cancel generation if in progress
              if (currentStep === 'generating' && generationProgress.stage !== 'complete' && generationProgress.stage !== 'error') {
                await cancelGeneration();
              }
              onClose();
            }}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[
              { key: 'template', label: 'Template', icon: FileText },
              { key: 'details', label: 'Details', icon: Code },
              { key: 'generating', label: 'Generate', icon: Wand2 },
              { key: 'review', label: 'Review', icon: CheckCircle }
            ].map((step, index) => {
              const isActive = currentStep === step.key;
              const stepOrder = ['template', 'details', 'generating', 'review'];
              const currentStepIndex = stepOrder.indexOf(currentStep);
              const stepIndex = stepOrder.indexOf(step.key);
              const isCompleted = stepIndex < currentStepIndex;
              const IconComponent = step.icon;
              
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive 
                        ? 'bg-blue-600 text-white' 
                        : isCompleted
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className={`text-xs mt-1 ${
                      isActive 
                        ? 'text-blue-600 dark:text-blue-400 font-medium' 
                        : isCompleted
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {index < 3 && (
                    <div className={`w-8 h-0.5 ${
                      isCompleted ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 'template' && renderTemplateSelection()}
        {currentStep === 'details' && renderDetailsInput()}
        {currentStep === 'generating' && renderGenerating()}
        {currentStep === 'review' && renderReview()}
      </div>
    </div>
  );
}