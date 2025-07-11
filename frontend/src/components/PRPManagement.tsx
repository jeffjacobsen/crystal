import { useEffect, useState } from 'react';
import { API } from '../utils/api';
import { PRPGenerator } from './PRPGenerator/PRPGenerator';
import { PRPEditor } from './PRPEditor';
import { useErrorStore } from '../stores/errorStore';
import { 
  FileText, 
  Plus, 
  Search,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import type { ProductRequirementPrompt } from '../types/prp';

type ViewMode = 'list' | 'generate';
type SortBy = 'updated' | 'created' | 'title' | 'version';

export function PRPManagement() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [allPRPs, setAllPRPs] = useState<ProductRequirementPrompt[]>([]);
  const [filteredPRPs, setFilteredPRPs] = useState<ProductRequirementPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('updated');
  const [selectedPRP, setSelectedPRP] = useState<ProductRequirementPrompt | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'view' | 'edit' | 'create'>('view');
  const { showError } = useErrorStore();

  // Load PRPs on mount
  useEffect(() => {
    fetchPRPs();
  }, []);

  // Filter and sort PRPs when dependencies change
  useEffect(() => {
    filterAndSortPRPs();
  }, [allPRPs, searchQuery, sortBy]);

  const fetchPRPs = async () => {
    try {
      setLoading(true);
      
      // Get all PRPs (now project-independent)
      const allResponse = await API.prp.getAll(0); // projectId parameter ignored in backend
      if (allResponse.success && allResponse.data) {
        setAllPRPs(allResponse.data);
      }
    } catch (error) {
      console.error('Error fetching PRPs:', error);
      setAllPRPs([]);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortPRPs = () => {
    let filtered = [...allPRPs];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(prp => 
        prp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prp.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'version':
          return b.version - a.version;
        default:
          return 0;
      }
    });

    setFilteredPRPs(filtered);
  };

  const handlePRPGenerated = () => {
    console.log('[PRPManagement] PRP generated and saved, returning to list');
    // Return to list view and refresh PRPs
    setViewMode('list');
    fetchPRPs();
  };

  const handleView = (prp: ProductRequirementPrompt) => {
    setSelectedPRP(prp);
    setEditorMode('view');
    setIsEditorOpen(true);
  };

  const handleEdit = (prp: ProductRequirementPrompt) => {
    setSelectedPRP(prp);
    setEditorMode('edit');
    setIsEditorOpen(true);
  };

  const handleDelete = async (prp: ProductRequirementPrompt) => {
    if (!confirm(`Are you sure you want to delete "${prp.title}"?`)) {
      return;
    }

    try {
      const response = await API.prp.delete(prp.id);
      
      if (response.success) {
        setAllPRPs(prev => prev.filter(p => p.id !== prp.id));
      } else {
        throw new Error(response.error || 'Failed to delete PRP');
      }
    } catch (error: any) {
      showError({
        title: 'Delete Failed',
        error: error.message
      });
    }
  };

  const handlePRPSaved = (savedPRP: ProductRequirementPrompt) => {
    setAllPRPs(prev => {
      const existing = prev.find(p => p.id === savedPRP.id);
      if (existing) {
        return prev.map(p => p.id === savedPRP.id ? savedPRP : p);
      } else {
        return [...prev, savedPRP];
      }
    });
    setIsEditorOpen(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getWordCount = (content: string) => {
    return content.trim() ? content.trim().split(/\s+/).length : 0;
  };

  if (viewMode === 'generate') {
    return (
      <PRPGenerator
        isOpen={true}
        onClose={() => setViewMode('list')}
        onPRPGenerated={handlePRPGenerated}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Product Requirement Prompts
          </h1>
          <button
            onClick={() => setViewMode('generate')}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Generate PRP</span>
          </button>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            PRPs can be used with any project. Copy them to use in any AI coding tool, or select one when creating a Crystal session.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      {allPRPs.length > 0 && (
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search PRPs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="updated">Last Updated</option>
              <option value="created">Date Created</option>
              <option value="title">Title</option>
              <option value="version">Version</option>
            </select>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-600 dark:text-gray-400">Loading PRPs...</div>
          </div>
        ) : allPRPs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6">
            <FileText className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No PRPs Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
              Create Product Requirement Prompts to guide your AI-assisted development sessions
            </p>
            <button
              onClick={() => setViewMode('generate')}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Generate Your First PRP</span>
            </button>
          </div>
        ) : filteredPRPs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400 p-6">
            <FileText className="w-12 h-12 mb-2" />
            <p>No PRPs found</p>
            {searchQuery && (
              <p className="text-sm">Try adjusting your search or filters</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredPRPs.map((prp) => (
              <div
                key={prp.id}
                className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                        {prp.title}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        v{prp.version}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                      {prp.content.substring(0, 200)}...
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{getWordCount(prp.content)} words</span>
                      <span>Updated {formatDate(prp.updated_at)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleView(prp)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(prp)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(prp)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PRP Editor */}
      {isEditorOpen && selectedPRP && (
        <PRPEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          prp={selectedPRP}
          mode={editorMode}
          onSave={handlePRPSaved}
          projectId={1}
        />
      )}
    </div>
  );
}