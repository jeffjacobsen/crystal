import { useState, useEffect, useRef } from 'react';
import { API } from '../utils/api';
import { FileText, Search, Tag, Calendar, Hash, X, Plus, FileUp, Link } from 'lucide-react';

interface Document {
  id: number;
  title: string;
  excerpt?: string;
  content?: string;
  category: string;
  tags: string[];
  word_count?: number;
  created_at: string;
  updated_at: string;
}

interface DocumentSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentSelect: (document: Document) => void;
  projectId?: number;
  selectionMode?: 'single' | 'multiple';
  onMultipleSelect?: (documents: Document[]) => void;
}

export function DocumentSearchDialog({ 
  isOpen, 
  onClose, 
  onDocumentSelect,
  projectId,
  selectionMode = 'single',
  onMultipleSelect
}: DocumentSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Document[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(new Set());
  const [isLoadingContent, setIsLoadingContent] = useState<number | null>(null);
  const [showNewDocDialog, setShowNewDocDialog] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('general');
  const [newDocTags, setNewDocTags] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && projectId) {
      loadDocuments();
    }
  }, [isOpen, projectId]);

  const loadDocuments = async () => {
    if (!projectId) return;

    try {
      const response = await API.documents.getAll(projectId);
      if (response.success && response.data) {
        setAllDocuments(response.data);
        setSearchResults(response.data);
        
        // Extract unique categories
        const uniqueCategories = [...new Set(response.data.map((doc: Document) => doc.category))];
        setCategories(uniqueCategories as string[]);
      }
    } catch (err) {
      setError('Failed to load documents');
      console.error('Failed to load documents:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(allDocuments);
      return;
    }

    if (!projectId) return;

    setIsSearching(true);
    setError(null);

    try {
      const response = await API.documents.search(projectId, searchQuery);
      if (response.success && response.data) {
        let results = response.data;
        
        // Apply category filter if selected
        if (selectedCategory !== 'all') {
          results = results.filter((doc: Document) => doc.category === selectedCategory);
        }
        
        setSearchResults(results);
      }
    } catch (err) {
      setError('Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category);
    
    if (category === 'all') {
      setSearchResults(allDocuments);
    } else {
      setSearchResults(allDocuments.filter(doc => doc.category === category));
    }
  };

  const handleDocumentClick = async (document: Document) => {
    if (selectionMode === 'multiple') {
      const newSelected = new Set(selectedDocuments);
      if (newSelected.has(document.id)) {
        newSelected.delete(document.id);
      } else {
        newSelected.add(document.id);
      }
      setSelectedDocuments(newSelected);
    } else {
      // Single selection mode
      setIsLoadingContent(document.id);
      try {
        const response = await API.documents.get(document.id);
        if (response.success && response.data) {
          onDocumentSelect(response.data);
          onClose();
        }
      } catch (err) {
        setError('Failed to load document content');
      } finally {
        setIsLoadingContent(null);
      }
    }
  };

  const handleMultipleSubmit = () => {
    if (selectionMode === 'multiple' && onMultipleSelect) {
      const selected = allDocuments.filter(doc => selectedDocuments.has(doc.id));
      onMultipleSelect(selected);
      onClose();
    }
  };

  const formatWordCount = (count?: number): string => {
    if (!count) return '0 words';
    return `${count.toLocaleString()} words`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'api': return <Hash className="w-4 h-4" />;
      case 'guide': return <FileText className="w-4 h-4" />;
      case 'reference': return <Link className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const handleNewDocument = async () => {
    if (!projectId || !newDocTitle.trim()) return;
    
    setIsCreating(true);
    setError(null);
    
    try {
      const tags = newDocTags.split(',').map(tag => tag.trim()).filter(tag => tag);
      const response = await API.documents.create(
        projectId,
        newDocTitle.trim(),
        newDocContent,
        newDocCategory,
        tags
      );
      
      if (response.success) {
        // Reset form
        setNewDocTitle('');
        setNewDocContent('');
        setNewDocCategory('general');
        setNewDocTags('');
        setShowNewDocDialog(false);
        
        // Reload documents
        await loadDocuments();
      }
    } catch (err) {
      setError('Failed to create document');
      console.error('Failed to create document:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleImportDocument = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !projectId) return;
    
    setIsCreating(true);
    setError(null);
    
    try {
      const content = await file.text();
      const response = await API.documents.create(
        projectId,
        file.name,
        content,
        'imported',
        ['imported']
      );
      
      if (response.success) {
        await loadDocuments();
      }
    } catch (err) {
      setError('Failed to import document');
      console.error('Failed to import document:', err);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            {selectionMode === 'multiple' ? 'Select Documents' : 'Search Project Documents'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-gray-700 space-y-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search documents..."
              className="flex-1 px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 bg-gray-700 placeholder-gray-400"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">Category:</span>
            <button
              onClick={() => handleCategoryFilter('all')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                selectedCategory === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => handleCategoryFilter(category)}
                className={`px-3 py-1 rounded-md text-sm transition-colors flex items-center space-x-1 ${
                  selectedCategory === category 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {getCategoryIcon(category)}
                <span className="capitalize">{category}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-md p-3 mb-4">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {searchResults.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-400 mb-3">
                {searchResults.length} document{searchResults.length !== 1 ? 's' : ''} found
              </p>
              {searchResults.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc)}
                  className={`p-4 border rounded-md cursor-pointer transition-all ${
                    selectedDocuments.has(doc.id)
                      ? 'border-blue-600 bg-blue-900/20'
                      : 'border-gray-700 hover:bg-gray-700'
                  } ${isLoadingContent === doc.id ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        {getCategoryIcon(doc.category)}
                        <h3 className="font-medium text-white">{doc.title}</h3>
                        {selectionMode === 'multiple' && selectedDocuments.has(doc.id) && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Selected</span>
                        )}
                      </div>
                      
                      {doc.excerpt && (
                        <p className="text-sm text-gray-400 mt-1">{doc.excerpt}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(doc.updated_at)}</span>
                        </span>
                        <span>{formatWordCount(doc.word_count)}</span>
                        {doc.tags.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <Tag className="w-3 h-3" />
                            {doc.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="bg-gray-700 px-2 py-0.5 rounded text-xs">
                                {tag}
                              </span>
                            ))}
                            {doc.tags.length > 3 && (
                              <span>+{doc.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                {searchQuery ? `No documents found for "${searchQuery}"` : 'No documents in this project'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-700">
          <div className="flex space-x-2">
            <button
              onClick={handleImportDocument}
              disabled={isCreating}
              className="px-4 py-2 text-gray-300 hover:text-white flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              <FileUp className="w-4 h-4" />
              <span>Import Document</span>
            </button>
            <button
              onClick={() => setShowNewDocDialog(true)}
              disabled={isCreating}
              className="px-4 py-2 text-gray-300 hover:text-white flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>New Document</span>
            </button>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            {selectionMode === 'multiple' && (
              <button
                onClick={handleMultipleSubmit}
                disabled={selectedDocuments.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Select {selectedDocuments.size} Document{selectedDocuments.size !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".txt,.md,.json,.xml,.csv"
        style={{ display: 'none' }}
      />

      {/* New Document Dialog */}
      {showNewDocDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-gray-800 rounded-lg w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">New Document</h3>
              <button
                onClick={() => setShowNewDocDialog(false)}
                className="text-gray-400 hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Enter document title"
                  className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 bg-gray-700"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={newDocCategory}
                  onChange={(e) => setNewDocCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 bg-gray-700"
                >
                  <option value="general">General</option>
                  <option value="api">API</option>
                  <option value="guide">Guide</option>
                  <option value="reference">Reference</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={newDocTags}
                  onChange={(e) => setNewDocTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 bg-gray-700"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Content
                </label>
                <textarea
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  placeholder="Enter document content"
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 bg-gray-700"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-700">
              <button
                onClick={() => setShowNewDocDialog(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNewDocument}
                disabled={isCreating || !newDocTitle.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}