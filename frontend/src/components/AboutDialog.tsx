import { X, ExternalLink } from 'lucide-react';


interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <img 
              src="/crystal-logo.svg" 
              alt="Crystal" 
              className="w-8 h-8"
              onError={(e) => {
                // Fallback if logo not found
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              About
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* App Info */}
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Crystal
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Multi-Session Development Environment for Claude Code
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-300">
              with Product Requirement Prompts support
            </p>
          </div>
      

          {/* Links */}
          <div className="space-y-2">
            <a
              href="https://github.com/crystal-dev/crystal"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <span>Crystal - View on GitHub</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <a
              href="https://docs.anthropic.com/en/docs/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <span>Claude Code Documentation</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <a
              href="https://github.com/Wirasm/PRPs-agentic-eng"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <span>PRP Concept - View on GitHub</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Disclaimer */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">
              Crystal is an independent open-source project. Claude™ is a trademark of Anthropic, PBC. 
              Crystal is not affiliated with, endorsed by, or sponsored by Anthropic.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}