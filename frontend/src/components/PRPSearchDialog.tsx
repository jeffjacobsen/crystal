import { useState, useEffect } from 'react';
import { API } from '../utils/api';
import { FileText, Search, Calendar, Tag, X } from 'lucide-react';
import type { ProductRequirementPrompt } from '../types/prp';

interface PRPSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPRPSelect: (prp: ProductRequirementPrompt) => void;
}

export function PRPSearchDialog({ 
  isOpen, 
  onClose, 
  onPRPSelect
}: PRPSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductRequirementPrompt[]>([]);
  const [allPRPs, setAllPRPs] = useState<ProductRequirementPrompt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPRPContent, setSelectedPRPContent] = useState<string | null>(null);
  const [selectedPRPId, setSelectedPRPId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPRPs();
    }
  }, [isOpen]);

  const loadPRPs = async () => {
    try {
      const response = await API.prp.getAll();
      if (response.success && response.data) {
        setAllPRPs(response.data);
        setSearchResults(response.data);
      }
    } catch (err) {
      setError('Failed to load PRPs');
      console.error('Failed to load PRPs:', err);
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults(allPRPs);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allPRPs.filter(prp => 
      prp.title.toLowerCase().includes(query) ||
      (prp.content && prp.content.toLowerCase().includes(query))
    );
    
    setSearchResults(filtered);
  };

  useEffect(() => {
    handleSearch();
  }, [searchQuery, allPRPs]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePRPClick = (prp: ProductRequirementPrompt) => {
    if (selectedPRPId === prp.id) {
      // If clicking the same PRP, select it
      onPRPSelect(prp);
    } else {
      // Show preview
      setSelectedPRPId(prp.id);
      setSelectedPRPContent(prp.content);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl h-[600px] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Search PRPs</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search PRPs by title or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            {error && (
              <div className="p-4 text-red-600 dark:text-red-400">{error}</div>
            )}
            
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No PRPs found matching your search' : 'No PRPs available'}
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {searchResults.map((prp) => (
                  <div
                    key={prp.id}
                    onClick={() => handlePRPClick(prp)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedPRPId === prp.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {prp.title}
                        </h3>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            Version {prp.version}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(prp.updated_at)}
                          </span>
                        </div>
                        {prp.content && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                            {prp.content.substring(0, 150)}...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="w-1/2 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
            {selectedPRPContent ? (
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Preview</h3>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm font-normal text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-4 rounded-lg">
                    {selectedPRPContent}
                  </pre>
                </div>
                <button
                  onClick={() => {
                    const selectedPRP = searchResults.find(p => p.id === selectedPRPId);
                    if (selectedPRP) onPRPSelect(selectedPRP);
                  }}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Select This PRP
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                Click on a PRP to preview its content
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}