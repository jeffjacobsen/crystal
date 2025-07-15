import { useState, useEffect } from 'react';
import { useIPCEvents } from './hooks/useIPCEvents';
import { useNotifications } from './hooks/useNotifications';
import { useResizable } from './hooks/useResizable';
import { Sidebar } from './components/Sidebar';
import { SessionView } from './components/SessionView';
import { PRPManagement } from './components/PRPManagement';
import { DocumentManagement } from './components/DocumentManagement';
import Help from './components/Help';
import Welcome from './components/Welcome';
import { AboutDialog } from './components/AboutDialog';
import { MainProcessLogger } from './components/MainProcessLogger';
import { ErrorDialog } from './components/ErrorDialog';
import { PermissionDialog } from './components/PermissionDialog';
import { useErrorStore } from './stores/errorStore';
import { useSessionStore } from './stores/sessionStore';
import { API } from './utils/api';

type ViewMode = 'sessions' | 'prompts' | 'documents';

interface PermissionRequest {
  id: string;
  sessionId: string;
  toolName: string;
  input: any;
  timestamp: number;
}

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('prompts');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showWelcomeManually, setShowWelcomeManually] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [currentPermissionRequest, setCurrentPermissionRequest] = useState<PermissionRequest | null>(null);
  const { currentError, clearError } = useErrorStore();
  const { sessions } = useSessionStore();
  
  const { width: sidebarWidth, startResize } = useResizable({
    defaultWidth: 320,  // Increased from 256px (w-64)
    minWidth: 200,
    maxWidth: 600,
    storageKey: 'crystal-sidebar-width'
  });
  
  useIPCEvents();
  useNotifications();

  // Add keyboard shortcut to show Welcome screen
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + W to show Welcome
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        setShowWelcomeManually(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
  
  useEffect(() => {
    // Set up permission request listener
    const handlePermissionRequest = (request: PermissionRequest) => {
      console.log('[App] Received permission request:', request);
      setCurrentPermissionRequest(request);
    };
    
    window.electron?.on('permission:request', handlePermissionRequest);
    
    return () => {
      window.electron?.off('permission:request', handlePermissionRequest);
    };
  }, []);

  
  const handlePermissionResponse = async (requestId: string, behavior: 'allow' | 'deny', updatedInput?: any, message?: string) => {
    try {
      await API.permissions.respond(requestId, {
        behavior,
        updatedInput,
        message
      });
      setCurrentPermissionRequest(null);
    } catch (error) {
      console.error('Failed to respond to permission request:', error);
    }
  };


  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-900">
      <MainProcessLogger />
      {/* Draggable title bar area */}
      <div 
        className="fixed top-0 left-0 right-0 h-8 z-50 flex items-center justify-end pr-4" 
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
      </div>
      <Sidebar 
        viewMode={viewMode} 
        onViewModeChange={setViewMode} 
        onHelpClick={() => setIsHelpOpen(true)}
        onAboutClick={() => setIsAboutOpen(true)}
        width={sidebarWidth}
        onResize={startResize}
      />
      {viewMode === 'sessions' ? <SessionView /> : viewMode === 'prompts' ? <PRPManagement /> : <DocumentManagement />}
      <Help 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
        onShowWelcome={() => setShowWelcomeManually(true)}
      />
      <Welcome showManually={showWelcomeManually} onClose={() => {
        setShowWelcomeManually(false);
      }} />
      <AboutDialog isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <ErrorDialog 
        isOpen={!!currentError}
        onClose={clearError}
        title={currentError?.title}
        error={currentError?.error || ''}
        details={currentError?.details}
        command={currentError?.command}
      />
      <PermissionDialog
        request={currentPermissionRequest}
        onRespond={handlePermissionResponse}
        session={currentPermissionRequest ? sessions.find(s => s.id === currentPermissionRequest.sessionId) : undefined}
      />
    </div>
  );
}

export default App;