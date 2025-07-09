import { useState, useEffect, useCallback } from "react";
import { FileText, MessageSquare, Upload, Trash2, Edit3, Star, StarOff, Plus, BarChart3, Target, Brain, Lightbulb } from "lucide-react";

interface ContentSource {
  id: string;
  realm_id: string | null;
  source_type: 'reflection' | 'text' | 'conversation' | 'document' | 'structured';
  title: string | null;
  content: string;
  metadata: Record<string, any>;
  weight: number;
  last_used_at: string | null;
  created_at: string;
}

interface ContentSourcesManagerProps {
  realmId: string;
  onContentChange?: () => void;
}

export function ContentSourcesManager({ realmId, onContentChange }: ContentSourcesManagerProps) {
  const [contentSources, setContentSources] = useState<ContentSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [showAdvancedSynthesis, setShowAdvancedSynthesis] = useState(false);
  const [synthesisStatus, setSynthesisStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [synthesisJobId, setSynthesisJobId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [newWeight, setNewWeight] = useState<number>(1.0);

  const fetchContentSources = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/realms/${realmId}/content-sources`);
      if (!response.ok) throw new Error('Failed to fetch content sources');
      const data = await response.json();
      setContentSources(data);
    } catch (error) {
      console.error('Error fetching content sources:', error);
    } finally {
      setIsLoading(false);
    }
  }, [realmId]);

  useEffect(() => {
    fetchContentSources();
  }, [fetchContentSources]);

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'reflection':
        return <MessageSquare className="w-4 h-4" />;
      case 'text':
        return <FileText className="w-4 h-4" />;
      case 'document':
        return <Upload className="w-4 h-4" />;
      case 'conversation':
        return <Brain className="w-4 h-4" />;
      case 'structured':
        return <Target className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getSourceTypeColor = (sourceType: string) => {
    switch (sourceType) {
      case 'reflection':
        return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20';
      case 'text':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20';
      case 'document':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
      case 'conversation':
        return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20';
      case 'structured':
        return 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getWeightColor = (weight: number) => {
    if (weight >= 4.0) return 'text-red-600 dark:text-red-400';
    if (weight >= 3.0) return 'text-orange-600 dark:text-orange-400';
    if (weight >= 2.0) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const handleWeightUpdate = async (sourceId: string, weight: number) => {
    try {
      const response = await fetch(`http://localhost:8000/content-sources/${sourceId}/weight?auto_synthesize=true`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight })
      });
      
      if (!response.ok) throw new Error('Failed to update weight');
      
      // Update local state
      setContentSources(prev => 
        prev.map(source => 
          source.id === sourceId ? { ...source, weight } : source
        )
      );
      
      onContentChange?.();
    } catch (error) {
      console.error('Error updating weight:', error);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!window.confirm('Are you sure you want to delete this content source?')) return;
    
    try {
      const response = await fetch(`http://localhost:8000/content-sources/${sourceId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete content source');
      
      setContentSources(prev => prev.filter(source => source.id !== sourceId));
      onContentChange?.();
    } catch (error) {
      console.error('Error deleting content source:', error);
    }
  };

  const handleAdvancedSynthesis = async () => {
    setSynthesisStatus('processing');
    setShowAdvancedSynthesis(false);
    
    try {
      const response = await fetch(`http://localhost:8000/realms/${realmId}/synthesize/advanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          synthesis_type: 'full',
          content_source_ids: selectedSources.length > 0 ? selectedSources : undefined,
          configuration: {
            include_quality_assessment: true,
            generate_suggestions: true
          }
        })
      });
      
      if (!response.ok) throw new Error('Failed to start synthesis');
      
      const data = await response.json();
      setSynthesisJobId(data.job_id);
      
      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`http://localhost:8000/synthesis-jobs/${data.job_id}`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            if (statusData.status === 'completed') {
              setSynthesisStatus('completed');
              clearInterval(pollInterval);
              onContentChange?.();
            } else if (statusData.status === 'failed') {
              setSynthesisStatus('error');
              clearInterval(pollInterval);
            }
          }
        } catch (error) {
          console.error('Error polling synthesis status:', error);
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error starting synthesis:', error);
      setSynthesisStatus('error');
    }
  };

  const handleBatchProcessing = async () => {
    try {
      const response = await fetch(`http://localhost:8000/realms/${realmId}/process-batch-queue`, {
        method: 'POST'
      });
      
      if (response.ok) {
        onContentChange?.();
      }
    } catch (error) {
      console.error('Error processing batch queue:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with synthesis controls */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Content Sources</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {contentSources.length} sources • {selectedSources.length} selected
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBatchProcessing}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Process Queue
            </button>
            
            <button
              onClick={() => setShowAdvancedSynthesis(true)}
              disabled={synthesisStatus === 'processing'}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-purple-400 transition-colors"
            >
              <Brain className="w-4 h-4 mr-2" />
              {synthesisStatus === 'processing' ? 'Synthesizing...' : 'Advanced Synthesis'}
            </button>
          </div>
        </div>
        
        {/* Synthesis status */}
        {synthesisStatus !== 'idle' && (
          <div className={`p-3 rounded-lg text-sm ${
            synthesisStatus === 'processing' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200' :
            synthesisStatus === 'completed' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200' :
            'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}>
            {synthesisStatus === 'processing' && 'Running advanced synthesis...'}
            {synthesisStatus === 'completed' && 'Synthesis completed successfully!'}
            {synthesisStatus === 'error' && 'Synthesis failed. Please try again.'}
          </div>
        )}
      </div>

      {/* Content sources list */}
      <div className="space-y-3">
        {contentSources.length > 0 ? (
          contentSources.map((source) => (
            <div key={source.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
              <div className="flex items-start space-x-4">
                {/* Selection checkbox */}
                <input
                  type="checkbox"
                  checked={selectedSources.includes(source.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSources(prev => [...prev, source.id]);
                    } else {
                      setSelectedSources(prev => prev.filter(id => id !== source.id));
                    }
                  }}
                  className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                
                {/* Source icon and type */}
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${getSourceTypeColor(source.source_type)}`}>
                  {getSourceIcon(source.source_type)}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {source.title || `${source.source_type.charAt(0).toUpperCase() + source.source_type.slice(1)} Content`}
                    </h4>
                    
                    <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatDate(source.created_at)}</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {truncateContent(source.content)}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getSourceTypeColor(source.source_type)}`}>
                        {source.source_type}
                      </span>
                      
                      {/* Weight control */}
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Weight:</span>
                        {editingSource === source.id ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              min="0"
                              max="5"
                              step="0.1"
                              value={newWeight}
                              onChange={(e) => setNewWeight(parseFloat(e.target.value))}
                              className="w-16 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                            />
                            <button
                              onClick={() => {
                                handleWeightUpdate(source.id, newWeight);
                                setEditingSource(null);
                              }}
                              className="text-green-600 hover:text-green-700"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setEditingSource(null)}
                              className="text-gray-500 hover:text-gray-600"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingSource(source.id);
                              setNewWeight(source.weight);
                            }}
                            className={`text-xs font-medium ${getWeightColor(source.weight)} hover:underline`}
                          >
                            {source.weight.toFixed(1)}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDeleteSource(source.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="Delete source"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No content sources yet
            </h4>
            <p className="text-gray-600 dark:text-gray-400">
              Content sources will be automatically created when you add reflections or synthesize texts.
            </p>
          </div>
        )}
      </div>

      {/* Advanced synthesis modal */}
      {showAdvancedSynthesis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Advanced Synthesis
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Synthesis Mode
                </label>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input type="radio" name="mode" value="full" defaultChecked className="mr-2" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Full Synthesis (All Sources)</span>
                  </div>
                  <div className="flex items-center">
                    <input type="radio" name="mode" value="selected" disabled={selectedSources.length === 0} className="mr-2" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Selected Sources Only ({selectedSources.length})</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowAdvancedSynthesis(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                
                <button
                  onClick={handleAdvancedSynthesis}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Start Synthesis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 