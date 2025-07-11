import { useState, useEffect } from 'react';
import { NotificationSettings } from './NotificationSettings';
import { useNotifications } from '../hooks/useNotifications';
import { API } from '../utils/api';
import type { AppConfig } from '../types/config';
import { Shield, ShieldOff } from 'lucide-react';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const [_config, setConfig] = useState<AppConfig | null>(null);
  const [verbose, setVerbose] = useState(false);
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState('');
  const [claudeExecutablePath, setClaudeExecutablePath] = useState('');
  const [defaultPermissionMode, setDefaultPermissionMode] = useState<'approve' | 'ignore'>('ignore');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'notifications'>('general');
  const { settings, updateSettings } = useNotifications();
  const [claudeTestResult, setClaudeTestResult] = useState<{
    available: boolean;
    version?: string;
    path?: string;
    error?: string;
  } | null>(null);
  const [isTestingClaude, setIsTestingClaude] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      const response = await API.config.get();
      if (!response.success) throw new Error(response.error || 'Failed to fetch config');
      const data = response.data;
      setConfig(data);
      setVerbose(data.verbose || false);
      setAnthropicApiKey(data.anthropicApiKey || '');
      setGlobalSystemPrompt(data.systemPromptAppend || '');
      setClaudeExecutablePath(data.claudeExecutablePath || '');
      setDefaultPermissionMode(data.defaultPermissionMode || 'ignore');
    } catch (err) {
      setError('Failed to load configuration');
    }
  };

  const testClaude = async (customPath?: string) => {
    setIsTestingClaude(true);
    setClaudeTestResult(null);
    
    try {
      const response = await API.config.testClaude(customPath);
      if (response.success && response.data) {
        setClaudeTestResult(response.data);
      } else {
        setClaudeTestResult({
          available: false,
          error: response.error || 'Failed to test Claude'
        });
      }
    } catch (err) {
      setClaudeTestResult({
        available: false,
        error: err instanceof Error ? err.message : 'Failed to test Claude'
      });
    } finally {
      setIsTestingClaude(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await API.config.update({ 
        verbose, 
        anthropicApiKey, 
        systemPromptAppend: globalSystemPrompt, 
        claudeExecutablePath,
        defaultPermissionMode,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to update configuration');
      }

      // Refresh config from server
      await fetchConfig();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'general'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'notifications'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Notifications
          </button>
        </div>

        {activeTab === 'general' && (
          <form id="settings-form" onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={verbose}
                onChange={(e) => setVerbose(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable verbose logging</span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Shows detailed logs for debugging session creation and Claude Code execution
            </p>
          </div>

          {/* Theme toggle disabled - dark mode only */}
          {/* <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Theme
            </label>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center space-x-3 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              {theme === 'light' ? (
                <>
                  <Sun className="w-5 h-5 text-yellow-400" />
                  <span className="text-gray-700 dark:text-gray-100">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-5 h-5 text-blue-400" />
                  <span className="text-gray-700 dark:text-gray-100">Dark Mode</span>
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Toggle between light and dark theme
            </p>
          </div> */}

          <div>
            <label htmlFor="anthropicApiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Anthropic API Key (Optional)
            </label>
            <input
              id="anthropicApiKey"
              type="password"
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
              placeholder="sk-ant-..."
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Used for auto-generating session names with AI (NOT for Claude Code itself). If not provided, fallback names will be used.
            </p>
          </div>

          <div>
            <label htmlFor="globalSystemPrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Global System Prompt (Optional)
            </label>
            <textarea
              id="globalSystemPrompt"
              value={globalSystemPrompt}
              onChange={(e) => setGlobalSystemPrompt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
              placeholder="Additional instructions to append to every prompt..."
              rows={3}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This text will be automatically appended to every initial prompt sent to Claude Code across ALL projects. For project-specific prompts, use the project settings.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Permission Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="defaultPermissionMode"
                  value="ignore"
                  checked={defaultPermissionMode === 'ignore'}
                  onChange={(e) => setDefaultPermissionMode(e.target.value as 'ignore' | 'approve')}
                  className="text-blue-600"
                />
                <div className="flex items-center gap-2">
                  <ShieldOff className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-200">Skip Permissions</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">(faster, less secure)</span>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="defaultPermissionMode"
                  value="approve"
                  checked={defaultPermissionMode === 'approve'}
                  onChange={(e) => setDefaultPermissionMode(e.target.value as 'ignore' | 'approve')}
                  className="text-blue-600"
                />
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-200">Manual Approval</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">(safer, interactive)</span>
                </div>
              </label>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-500 mt-2">
              When enabled, Claude will ask for permission before performing potentially dangerous actions. This sets the default for new sessions.
            </p>
          </div>

          <div>
            <label htmlFor="claudeExecutablePath" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Claude Executable Path (Optional)
            </label>
            <div className="flex gap-2">
              <input
                id="claudeExecutablePath"
                type="text"
                value={claudeExecutablePath}
                onChange={(e) => setClaudeExecutablePath(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
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
              Full path to the claude executable. Leave empty to use the claude command from PATH. This is useful if Claude is installed in a non-standard location.
            </p>
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



          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
          </form>
        )}
        
        {activeTab === 'notifications' && (
          <NotificationSettings
            settings={settings}
            onUpdateSettings={updateSettings}
          />
        )}
        </div>

        {/* Footer */}
        {activeTab === 'general' && (
          <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="settings-form"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}