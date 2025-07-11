import React from 'react';
import { Session } from '../../types/session';
import { ViewMode } from '../../hooks/useSessionView';

interface SessionInputProps {
  activeSession: Session;
  viewMode: ViewMode;
  input: string;
  setInput: (input: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleTerminalCommand: () => void;
  handleSendInput: () => void;
  handleContinueConversation: () => void;
  ultrathink: boolean;
  setUltrathink: (ultra: boolean) => void;
  handleToggleAutoCommit: () => void;
}

export const SessionInput: React.FC<SessionInputProps> = ({
  activeSession,
  viewMode,
  input,
  setInput,
  textareaRef,
  handleTerminalCommand,
  handleSendInput,
  handleContinueConversation,
  ultrathink,
  setUltrathink,
  handleToggleAutoCommit,
}) => {
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const shouldSend = e.key === 'Enter' && (e.metaKey || e.ctrlKey);
    if (shouldSend) {
      e.preventDefault();
      if (viewMode === 'terminal' && !activeSession.isRunning && activeSession.status !== 'waiting') {
        handleTerminalCommand();
      } else if (activeSession.status === 'waiting') {
        handleSendInput();
      } else {
        handleContinueConversation();
      }
    }
  };
  
  const onClickSend = () => {
    if (viewMode === 'terminal' && !activeSession.isRunning && activeSession.status !== 'waiting') {
      handleTerminalCommand();
    } else if (activeSession.status === 'waiting') {
      handleSendInput();
    } else {
      handleContinueConversation();
    }
  };

  const placeholder = viewMode === 'terminal'
    ? (activeSession.isRunning ? "Script is running..." : (activeSession.status === 'waiting' ? "Enter your response... (⌘↵ to send)" : "Enter terminal command... (⌘↵ to send)"))
    : (activeSession.status === 'waiting' ? "Enter your response... (⌘↵ to send)" : "Continue conversation... (⌘↵ to send)");

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 flex-shrink-0">
      {viewMode === 'terminal' && !activeSession.isRunning && activeSession.status !== 'waiting' && (
        <div className="mb-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
          <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Terminal mode: Commands will execute in the worktree directory
        </div>
      )}
      <div className="flex items-start gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full px-3 py-2 pr-10 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none overflow-y-auto"
            placeholder={placeholder}
            style={{ minHeight: '42px', maxHeight: '200px' }}
          />
        </div>
        <button 
          onClick={onClickSend} 
          className="px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 min-w-[100px] font-medium transition-colors"
          style={{ height: '67px' }}
        >
          {viewMode === 'terminal' && !activeSession.isRunning && activeSession.status !== 'waiting' ? 'Run' : (activeSession.status === 'waiting' ? 'Send' : 'Continue')}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer group" title="Triggers Claude Code to use its maximum thinking token limit. Slower but better for difficult tasks.">
          <input type="checkbox" checked={ultrathink} onChange={(e) => setUltrathink(e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">ultrathink</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group" title="Automatically commit changes after each prompt">
          <input type="checkbox" checked={activeSession.autoCommit ?? true} onChange={handleToggleAutoCommit} className="h-4 w-4 text-green-600 rounded border-gray-300 dark:border-gray-600 focus:ring-green-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">auto-commit</span>
        </label>
      </div>
      {activeSession.status !== 'waiting' && !(viewMode === 'terminal' && !activeSession.isRunning) && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          This will interrupt the current session if running and restart with conversation history.
        </p>
      )}
    </div>
  );
}; 