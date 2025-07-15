import { useState, useEffect } from 'react';
import { Zap, AlertCircle } from 'lucide-react';
import crystalLogo from '../assets/crystal-logo.svg';
import { API } from '../utils/api';

interface WelcomeProps {
  showManually?: boolean;
  onClose: () => void;
}

export default function Welcome({ showManually, onClose }: WelcomeProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [claudeExecutablePath, setClaudeExecutablePath] = useState('');
  const [claudeTestResult, setClaudeTestResult] = useState<{
    available: boolean;
    version?: string;
    path?: string;
    error?: string;
  } | null>(null);
  const [isTestingClaude, setIsTestingClaude] = useState(false);
  const [hasAutoTested, setHasAutoTested] = useState(false);



  // Auto-test Claude on component mount
  useEffect(() => {
    let mounted = true;
    
    const loadClaudeConfig = async () => {
      if (!mounted || hasAutoTested) return;
      
      console.log('[Welcome] Loading Claude config and auto-testing...');
      try {
        const response = await API.config.get();
        if (mounted && response.success && response.data) {
          setClaudeExecutablePath(response.data.claudeExecutablePath || '');
          // Auto-test Claude availability
          const testResult = await testClaude(response.data.claudeExecutablePath);
          // Only show dialog if Claude is not available
          if (mounted && !testResult?.available) {
            setIsVisible(true);
          }
          if (mounted) {
            setHasAutoTested(true);
          }
        }
      } catch (error) {
        console.error('Failed to load Claude config:', error);
        // Show dialog on error
        if (mounted) {
          setIsVisible(true);
          setHasAutoTested(true);
        }
      }
    };
    
    loadClaudeConfig();
    
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - only run once on mount

  // Show dialog when manually triggered
  useEffect(() => {
    if (showManually) {
      setIsVisible(true);
    }
  }, [showManually]);


  const testClaude = async (customPath?: string) => {
    setIsTestingClaude(true);
    setClaudeTestResult(null);
    
    try {
      const response = await API.config.testClaude(customPath);
      if (response.success && response.data) {
        setClaudeTestResult(response.data);
        return response.data;
      } else {
        const result = {
          available: false,
          error: response.error || 'Failed to test Claude'
        };
        setClaudeTestResult(result);
        return result;
      }
    } catch (err) {
      const result = {
        available: false,
        error: err instanceof Error ? err.message : 'Failed to test Claude'
      };
      setClaudeTestResult(result);
      return result;
    } finally {
      setIsTestingClaude(false);
    }
  };


  const saveClaudePath = async () => {
    try {
      const response = await API.config.update({ claudeExecutablePath });
      if (response.success) {
        // Re-test with the new path
        testClaude(claudeExecutablePath);
      }
    } catch (error) {
      console.error('Failed to save Claude path:', error);
    }
  };
  
  const handleClose = () => {
    setIsVisible(false);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img src={crystalLogo} alt="Crystal" className="h-10 w-10 mr-3" />
              <div>
                <h1 className="text-2xl font-bold">Welcome to Crystal</h1>
                <p className="text-blue-50">Multi-Session Claude Code Manager</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Quick Start Guide */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Zap className="h-6 w-6 mr-2 text-yellow-500" />
                Quick Start Guide
              </h2>
              
              {/* Claude Setup Section */}
              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2 text-blue-500" />
                  Claude Code Setup
                </h3>
                
                <div className="space-y-3">
                
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p className="font-medium">Requirements:</p>
                    <ul className="space-y-1 ml-4">
                      <li>• Claude Code must be installed with credentials configured</li>
                      <li>• We recommend using a <strong>MAX plan</strong> for best performance</li>
                      <li>• Crystal runs Claude Code with <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">--dangerously-ignore-permissions</code></li>
                    </ul>
                  </div>

                  <div>
                    <label htmlFor="claudePath" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Claude Executable Path (Optional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="claudePath"
                        type="text"
                        value={claudeExecutablePath}
                        onChange={(e) => setClaudeExecutablePath(e.target.value)}
                        onBlur={saveClaudePath}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                        placeholder="/usr/local/bin/claude"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await API.dialog.openFile({
                            title: 'Select Claude Executable',
                            buttonLabel: 'Select',
                            properties: ['openFile'],
                            filters: [
                              { name: 'Executables', extensions: ['*'] }
                            ]
                          });
                          if (result.success && result.data) {
                            setClaudeExecutablePath(result.data);
                            await saveClaudePath();
                          }
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Browse
                      </button>
                      <button
                        type="button"
                        onClick={() => testClaude(claudeExecutablePath)}
                        disabled={isTestingClaude}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {isTestingClaude ? 'Testing...' : 'Test'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Leave empty to use claude from PATH. This is useful if Claude is installed in a non-standard location.
                    </p>
                  </div>
                  
                  {/* Test Result */}
                  {claudeTestResult && (
                    <div className={`mt-2 p-3 rounded-md text-sm ${
                      claudeTestResult.available 
                        ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' 
                        : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
                    }`}>
                      {claudeTestResult.available ? (
                        <div className="text-green-800 dark:text-green-200">
                          <div className="font-medium mb-1">✓ Claude Code is available</div>
                          {claudeTestResult.version && (
                            <div className="text-xs">Version: {claudeTestResult.version}</div>
                          )}
                          {claudeTestResult.path && (
                            <div className="text-xs">Path: {claudeTestResult.path}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-red-800 dark:text-red-200">
                          <div className="font-medium mb-1">✗ Claude Code not found</div>
                          {claudeTestResult.error && (
                            <div className="text-xs">{claudeTestResult.error}</div>
                          )}
                          <div className="text-xs mt-1">
                            Please ensure Claude Code is installed and accessible from the command line.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  

                </div>
              </div>

              {/* Steps */}
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 dark:bg-blue-900 rounded-full flex items-center justify-center text-white dark:text-blue-300 font-semibold">
                    1
                  </div>
                  <div className="ml-4 flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Create a PRP</h4>
                    {/*}<ul className="text-gray-600 dark:text-gray-400 space-y-1 text-sm">
                      <li>• Point to a <strong>new directory</strong> - Crystal will create it and initialize git</li>
                      <li>• Or select an <strong>existing git repository</strong></li>
                    </ul>{*/}
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 dark:bg-blue-900 rounded-full flex items-center justify-center text-white dark:text-blue-300 font-semibold">
                    2
                  </div>
                  <div className="ml-4 flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Create or Select a Project</h4>

                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 dark:bg-blue-900 rounded-full flex items-center justify-center text-white dark:text-blue-300 font-semibold">
                    3
                  </div>
                  <div className="ml-4 flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Create Sessions</h4>

                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 dark:bg-blue-900 rounded-full flex items-center justify-center text-white dark:text-blue-300 font-semibold">
                    4
                  </div>
                  <div className="ml-4 flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Work with Results</h4>
                  </div>
                </div>
              </div>
            </section>

            {/* Key Features */}
            {/*}
            <section className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <GitBranch className="h-5 w-5 mr-2" />
                Key Features
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                  <span>Parallel sessions with git worktrees</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                  <span>Real-time status updates</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                  <span>Session persistence</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                  <span>Git integration</span>
                </div>
              </div>
            </section>
            {*/}
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}