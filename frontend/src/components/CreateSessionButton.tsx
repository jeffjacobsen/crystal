import { useState } from 'react';
import { CreateSessionDialog } from './CreateSessionDialog';
import { PRPGenerator } from './PRPGenerator/PRPGenerator';
import { API } from '../utils/api';
import { ChevronDown, Plus, Sparkles } from 'lucide-react';

export function CreateSessionButton() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPRPGeneratorOpen, setIsPRPGeneratorOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<any>(null);

  const checkActiveProject = async () => {
    try {
      const response = await API.projects.getActive();
      
      if (!response.success || !response.data) {
        alert('Please select or create a project first before creating a session.');
        return null;
      }
      
      setActiveProject(response.data);
      return response.data;
    } catch (error) {
      console.error('Error checking active project:', error);
      alert('Error checking project status. Please try again.');
      return null;
    }
  };

  const handleCreateSession = async () => {
    const project = await checkActiveProject();
    if (project) {
      setIsCreateOpen(true);
      setIsDropdownOpen(false);
    }
  };

  const handleGeneratePRP = async () => {
    const project = await checkActiveProject();
    if (project) {
      setIsPRPGeneratorOpen(true);
      setIsDropdownOpen(false);
    }
  };

  const handlePRPGenerated = (prpContent: string) => {
    // Optionally, could auto-open create session with the PRP content as prompt
    console.log('PRP generated:', prpContent);
  };
  
  return (
    <div className="relative">
      {/* Split button design */}
      <div className="flex w-full">
        {/* Main button */}
        <button
          onClick={handleCreateSession}
          data-testid="create-session-button"
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-l-md transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Session
        </button>
        
        {/* Dropdown button */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-2 rounded-r-md border-l border-blue-500 transition-colors"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown menu */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
          <button
            onClick={handleCreateSession}
            className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Session
          </button>
          <button
            onClick={handleGeneratePRP}
            className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-gray-700"
          >
            <Sparkles className="w-4 h-4" />
            Generate PRP
          </button>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
      
      <CreateSessionDialog 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)}
        projectId={activeProject?.id}
        projectName={activeProject?.name}
      />
      
      <PRPGenerator
        isOpen={isPRPGeneratorOpen}
        onClose={() => setIsPRPGeneratorOpen(false)}
        projectId={activeProject?.id}
        initialCodebasePath={activeProject?.path}
        onPRPGenerated={handlePRPGenerated}
      />
    </div>
  );
}