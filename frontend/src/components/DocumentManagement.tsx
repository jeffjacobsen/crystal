import { useState, useEffect, useRef } from 'react';
import { API } from '../utils/api';
import { FileText, Search, Plus, FileUp, Trash2, Edit, Tag, Calendar, Globe, Hash } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useErrorStore } from '../stores/errorStore';
import { URLImportDialog } from './URLImportDialog';

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

export function DocumentManagement() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showNewDocDialog, setShowNewDocDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('general');
  const [newDocTags, setNewDocTags] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showUrlImportDialog, setShowUrlImportDialog] = useState(false);
  const [scrapedData, setScrapedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { showError } = useErrorStore();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      // Pass null as projectId to get all documents (project-independent)
      const response = await API.documents.getAll(null);
      if (response.success && response.data) {
        setDocuments(response.data);
        
        // Extract unique categories
        const uniqueCategories = [...new Set(response.data.map((doc: Document) => doc.category))];
        setCategories(uniqueCategories as string[]);
      }
    } catch (err) {
      showError({
        title: 'Failed to Load Documents',
        error: 'Could not load documents from the database.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadDocuments();
      return;
    }

    setIsLoading(true);
    try {
      const response = await API.documents.search(0, searchQuery);
      if (response.success && response.data) {
        let results = response.data;
        
        // Apply category filter if selected
        if (selectedCategory !== 'all') {
          results = results.filter((doc: Document) => doc.category === selectedCategory);
        }
        
        setDocuments(results);
      }
    } catch (err) {
      showError({
        title: 'Search Failed',
        error: 'Could not search documents.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim() || !newDocContent.trim()) return;

    setIsCreating(true);
    try {
      const tags = newDocTags.split(',').map(tag => tag.trim()).filter(tag => tag);
      
      const response = await API.documents.create(
        null, // Project-independent
        newDocTitle,
        newDocContent,
        newDocCategory,
        tags,
        undefined, // filePath
        scrapedData?.url // URL from scraped data if available
      );

      if (response.success) {
        setShowNewDocDialog(false);
        setNewDocTitle('');
        setNewDocContent('');
        setNewDocCategory('general');
        setNewDocTags('');
        setScrapedData(null); // Clear scraped data
        loadDocuments();
      }
    } catch (err) {
      showError({
        title: 'Failed to Create Document',
        error: 'Could not create the document.'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateDocument = async () => {
    if (!selectedDocument || !newDocTitle.trim() || !newDocContent.trim()) return;

    setIsCreating(true);
    try {
      const tags = newDocTags.split(',').map(tag => tag.trim()).filter(tag => tag);
      
      const response = await API.documents.update(selectedDocument.id, {
        title: newDocTitle,
        content: newDocContent,
        category: newDocCategory,
        tags
      });

      if (response.success) {
        setShowEditDialog(false);
        setSelectedDocument(null);
        setNewDocTitle('');
        setNewDocContent('');
        setNewDocCategory('general');
        setNewDocTags('');
        loadDocuments();
      }
    } catch (err) {
      showError({
        title: 'Failed to Update Document',
        error: 'Could not update the document.'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await API.documents.delete(docId);
      if (response.success) {
        loadDocuments();
      }
    } catch (err) {
      showError({
        title: 'Failed to Delete Document',
        error: 'Could not delete the document.'
      });
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const title = file.name.replace(/\.[^/.]+$/, ''); // Remove file extension
      
      try {
        const response = await API.documents.create(
          0, // Project-independent
          title,
          content,
          'imported',
          []
        );

        if (response.success) {
          loadDocuments();
        }
      } catch (err) {
        showError({
          title: 'Failed to Import Document',
          error: 'Could not import the document file.'
        });
      }
    };
    
    reader.readAsText(file);
  };

  const openEditDialog = (doc: Document) => {
    setSelectedDocument(doc);
    setNewDocTitle(doc.title);
    setNewDocContent(doc.content || '');
    setNewDocCategory(doc.category);
    setNewDocTags(doc.tags.join(', '));
    setShowEditDialog(true);
  };

  const handleUrlImportComplete = (documentData: any) => {
    setScrapedData(documentData);
    setNewDocTitle(documentData.title || 'Untitled Document');
    setNewDocContent(documentData.content || '');
    setNewDocCategory(documentData.category || 'general');
    setNewDocTags(documentData.tags?.join(', ') || '');
    setShowUrlImportDialog(false);
    setShowNewDocDialog(true);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Documents</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUrlImportDialog(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Globe className="w-4 h-4" />
              Import URL
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <FileUp className="w-4 h-4" />
              Import File
            </button>
            <button
              onClick={() => setShowNewDocDialog(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Document
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.markdown"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search documents..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 dark:text-gray-400">Loading documents...</div>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No documents found</p>
              <p className="text-sm mt-2">Create or import documents to get started</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map(doc => (
              <div
                key={doc.id}
                className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2">
                    {doc.title}
                  </h3>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditDialog(doc)}
                      className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {doc.excerpt && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                    {doc.excerpt}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {doc.category}
                  </span>
                  {doc.word_count && (
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      {doc.word_count} words
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}
                  </span>
                </div>

                {doc.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {doc.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New/Edit Document Dialog */}
      {(showNewDocDialog || showEditDialog) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {showEditDialog ? 'Edit Document' : 'New Document'}
              </h2>
              <button
                onClick={() => {
                  setShowNewDocDialog(false);
                  setShowEditDialog(false);
                  setSelectedDocument(null);
                  setNewDocTitle('');
                  setNewDocContent('');
                  setNewDocCategory('general');
                  setNewDocTags('');
                }}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Document title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newDocCategory}
                    onChange={(e) => setNewDocCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., general, api, architecture"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newDocTags}
                    onChange={(e) => setNewDocTags(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., backend, authentication, security"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Content
                  </label>
                  <textarea
                    value={newDocContent}
                    onChange={(e) => setNewDocContent(e.target.value)}
                    className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                    placeholder="Document content (Markdown supported)"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewDocDialog(false);
                  setShowEditDialog(false);
                  setSelectedDocument(null);
                  setNewDocTitle('');
                  setNewDocContent('');
                  setNewDocCategory('general');
                  setNewDocTags('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={showEditDialog ? handleUpdateDocument : handleCreateDocument}
                disabled={!newDocTitle.trim() || !newDocContent.trim() || isCreating}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
              >
                {isCreating ? 'Saving...' : (showEditDialog ? 'Update' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* URL Import Dialog */}
      <URLImportDialog
        isOpen={showUrlImportDialog}
        onClose={() => setShowUrlImportDialog(false)}
        onImportComplete={handleUrlImportComplete}
      />
    </div>
  );
}