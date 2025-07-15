import React, { useState, useEffect } from 'react';
import { API } from '../utils/api';
import { useErrorStore } from '../stores/errorStore';
import { 
  Globe, 
  FileText, 
  FolderTree,
  X,
  ChevronRight,
  CheckCircle,
  Loader2,
  Info,
  Link,
  Settings
} from 'lucide-react';

interface URLImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (documentData: any) => void;
}

type ImportStep = 'url' | 'options' | 'importing' | 'review';
type CrawlMode = 'single' | 'recursive' | 'auto';

interface CrawlOptions {
  mode: CrawlMode;
  maxDepth: number;
  maxPages: number;
  followInternalOnly: boolean;
}

interface ImportProgress {
  status: string;
  message: string;
  currentUrl?: string;
  pagesProcessed?: number;
  totalPages?: number;
  depth?: number;
}

export function URLImportDialog({ isOpen, onClose, onImportComplete }: URLImportDialogProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>('url');
  const [url, setUrl] = useState('');
  const [crawlOptions, setCrawlOptions] = useState<CrawlOptions>({
    mode: 'auto',
    maxDepth: 3,
    maxPages: 50,
    followInternalOnly: true
  });
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    status: 'idle',
    message: ''
  });
  const [importedData, setImportedData] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { showError } = useErrorStore();

  useEffect(() => {
    if (isOpen) {
      // Reset state when dialog opens
      setCurrentStep('url');
      setUrl('');
      setCrawlOptions({
        mode: 'auto',
        maxDepth: 3,
        maxPages: 50,
        followInternalOnly: true
      });
      setImportProgress({ status: 'idle', message: '' });
      setImportedData(null);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep === 'url' && url.trim()) {
      setCurrentStep('options');
    }
  };

  const handleBack = () => {
    if (currentStep === 'options') {
      setCurrentStep('url');
    } else if (currentStep === 'review') {
      setCurrentStep('options');
    }
  };

  const handleStartImport = async () => {
    setCurrentStep('importing');
    setIsImporting(true);
    setImportProgress({
      status: 'starting',
      message: 'Initializing web scraper...'
    });

    // Set up progress listener
    const unsubscribe = window.electronAPI.events.onDocumentScrapeProgress((progress: any) => {
      setImportProgress(progress);
    });

    try {
      const response = await API.documents.scrapeUrl(url, crawlOptions);
      
      if (response.success && response.data) {
        setImportedData(response.data);
        setCurrentStep('review');
      } else {
        throw new Error(response.error || 'Failed to import from URL');
      }
    } catch (err: any) {
      showError({
        title: 'Import Failed',
        error: err.message || 'Could not import content from the URL.'
      });
      setCurrentStep('options');
    } finally {
      setIsImporting(false);
      unsubscribe();
    }
  };

  const handleConfirmImport = () => {
    if (onImportComplete && importedData) {
      onImportComplete(importedData);
    }
    onClose();
  };

  const renderUrlStep = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Documentation URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          placeholder="https://docs.example.com/api-reference"
          autoFocus
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Enter a URL to documentation, API reference, tutorial, or any webpage
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Smart URL Detection</p>
            <p>The importer will automatically detect:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Sitemap files for comprehensive site crawling</li>
              <li>Documentation index pages for recursive crawling</li>
              <li>Single article pages for direct import</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOptionsStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Crawling Mode
        </h3>
        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
            <input
              type="radio"
              value="single"
              checked={crawlOptions.mode === 'single'}
              onChange={(e) => setCrawlOptions({ ...crawlOptions, mode: e.target.value as CrawlMode })}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-white">Single Page</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Import only the specified URL
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
            <input
              type="radio"
              value="recursive"
              checked={crawlOptions.mode === 'recursive'}
              onChange={(e) => setCrawlOptions({ ...crawlOptions, mode: e.target.value as CrawlMode })}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-white">Recursive Crawl</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Follow links to crawl multiple pages
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
            <input
              type="radio"
              value="auto"
              checked={crawlOptions.mode === 'auto'}
              onChange={(e) => setCrawlOptions({ ...crawlOptions, mode: e.target.value as CrawlMode })}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-white">Auto-detect</span>
                <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Automatically determine the best crawling strategy
              </p>
            </div>
          </label>
        </div>
      </div>

      {crawlOptions.mode !== 'single' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Depth
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={crawlOptions.maxDepth}
                onChange={(e) => setCrawlOptions({ ...crawlOptions, maxDepth: parseInt(e.target.value) || 3 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                How many levels deep to crawl
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Pages
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={crawlOptions.maxPages}
                onChange={(e) => setCrawlOptions({ ...crawlOptions, maxPages: parseInt(e.target.value) || 50 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Maximum number of pages to import
              </p>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={crawlOptions.followInternalOnly}
                onChange={(e) => setCrawlOptions({ ...crawlOptions, followInternalOnly: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Follow internal links only
              </span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
              Only crawl pages from the same domain
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderImportingStep = () => (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center py-8">
        <div className="mb-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
        
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {importProgress.status === 'starting' && 'Initializing...'}
          {importProgress.status === 'crawling' && 'Crawling Website...'}
          {importProgress.status === 'processing' && 'Processing Content...'}
          {importProgress.status === 'installing' && 'Installing Dependencies...'}
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
          {importProgress.message}
        </p>

        {importProgress.currentUrl && (
          <div className="mt-4 w-full max-w-md">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
                <Link className="w-3 h-3" />
                <span>Current URL:</span>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                {importProgress.currentUrl}
              </p>
            </div>
          </div>
        )}

        {importProgress.pagesProcessed !== undefined && (
          <div className="mt-4 w-full max-w-md">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span>Progress</span>
              <span>{importProgress.pagesProcessed} / {importProgress.totalPages || '?'} pages</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${importProgress.totalPages 
                    ? (importProgress.pagesProcessed / importProgress.totalPages) * 100 
                    : 0}%` 
                }}
              />
            </div>
            {importProgress.depth !== undefined && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                Depth: {importProgress.depth} / {crawlOptions.maxDepth}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-4">
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">
              Import Successful!
            </p>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              {importedData?.pagesCount 
                ? `Successfully imported ${importedData.pagesCount} pages`
                : 'Content imported successfully'}
            </p>
          </div>
        </div>
      </div>

      {importedData && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <p className="text-gray-900 dark:text-white">
              {importedData.title || 'Untitled Document'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <p className="text-gray-900 dark:text-white">
              {importedData.category || 'general'}
            </p>
          </div>

          {importedData.tags && importedData.tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-1">
                {importedData.tags.map((tag: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {importedData.excerpt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Preview
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                {importedData.excerpt}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 'url':
        return renderUrlStep();
      case 'options':
        return renderOptionsStep();
      case 'importing':
        return renderImportingStep();
      case 'review':
        return renderReviewStep();
      default:
        return null;
    }
  };

  const getStepNumber = (step: ImportStep) => {
    const steps: ImportStep[] = ['url', 'options', 'importing', 'review'];
    return steps.indexOf(step) + 1;
  };

  const isStepComplete = (step: ImportStep) => {
    const currentStepNumber = getStepNumber(currentStep);
    const stepNumber = getStepNumber(step);
    return stepNumber < currentStepNumber;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Globe className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Import from URL
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            disabled={isImporting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {(['url', 'options', 'importing', 'review'] as ImportStep[]).map((step, index) => (
              <React.Fragment key={step}>
                {index > 0 && (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <div
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                    currentStep === step
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : isStepComplete(step)
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {isStepComplete(step) ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <span className="w-4 h-4 flex items-center justify-center">
                      {getStepNumber(step)}
                    </span>
                  )}
                  <span className="capitalize">{step === 'url' ? 'URL' : step}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 'url' || currentStep === 'importing'}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          <div className="flex gap-3">
            {currentStep !== 'review' && currentStep !== 'importing' && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
            )}

            {currentStep === 'url' && (
              <button
                onClick={handleNext}
                disabled={!url.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            )}

            {currentStep === 'options' && (
              <button
                onClick={handleStartImport}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Start Import
              </button>
            )}

            {currentStep === 'review' && (
              <button
                onClick={handleConfirmImport}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Save Document
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}