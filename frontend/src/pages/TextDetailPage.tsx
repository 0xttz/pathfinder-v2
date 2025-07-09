import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Text } from './TextPage'; // Reusing the interface
import { ArrowLeft, Trash2, Zap, Bold, Italic, Heading2, List, Link as LinkIcon, Code, Save, Check, FileText, AlertCircle, Type, Clock, Calendar, Sparkles, Activity, Brain } from 'lucide-react';

interface Realm {
  id: string;
  name: string;
}

interface SynthesisResult {
  message: string;
  type: 'success' | 'error';
}

const FormattingToolbar = ({ onFormatClick }: { onFormatClick: (format: string) => void }) => {
    const formatButtons = [
        { type: 'bold', icon: Bold, tooltip: 'Bold (Ctrl+B)', shortcut: 'Ctrl+B' },
        { type: 'italic', icon: Italic, tooltip: 'Italic (Ctrl+I)', shortcut: 'Ctrl+I' },
        { type: 'heading', icon: Heading2, tooltip: 'Heading (Ctrl+H)', shortcut: 'Ctrl+H' },
        { type: 'list', icon: List, tooltip: 'List Item (Ctrl+L)', shortcut: 'Ctrl+L' },
        { type: 'link', icon: LinkIcon, tooltip: 'Link (Ctrl+K)', shortcut: 'Ctrl+K' },
        { type: 'code', icon: Code, tooltip: 'Code Block (Ctrl+`)', shortcut: 'Ctrl+`' },
    ];

    return (
        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-t-lg border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mr-4">
                <Type className="w-3 h-3 mr-1" />
                <span>Format:</span>
            </div>
            {formatButtons.map(({ type, icon: Icon, tooltip }) => (
                <button
                    key={type}
                    onClick={() => onFormatClick(type)}
                    title={tooltip}
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100 transition-colors"
                >
                    <Icon className="w-4 h-4" />
                </button>
            ))}
        </div>
    );
};

const SynthesisNotification = ({ result, onClose }: { result: SynthesisResult | null; onClose: () => void }) => {
  if (!result) return null;

  return (
    <div className={`fixed top-20 right-4 max-w-md p-4 rounded-lg shadow-lg z-50 border ${
      result.type === 'success' 
        ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300' 
        : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300'
    }`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {result.type === 'success' ? (
            <Check className="w-5 h-5 text-green-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium">
            {result.type === 'success' ? 'Synthesis Successful!' : 'Synthesis Failed'}
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap">{result.message}</p>
        </div>
        <button 
          onClick={onClose}
          className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export function TextDetailPage() {
  const { textId } = useParams<{ textId: string }>();
  const navigate = useNavigate();
  const [text, setText] = useState<Text | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [selectedRealm, setSelectedRealm] = useState<string>('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<SynthesisResult | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchText = useCallback(async () => {
    if (!textId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/texts/${textId}`);
      if (!response.ok) throw new Error('Failed to fetch text');
      const data = await response.json();
      setText(data);
      setTitle(data.title);
      setContent(data.content);
      setHasUnsavedChanges(false);
      setWordCount(countWords(data.content));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [textId]);

  const fetchRealms = async () => {
    try {
      const response = await fetch('http://localhost:8000/realms');
      if (!response.ok) throw new Error('Failed to fetch realms');
      const data = await response.json();
      setRealms(data);
      if (data.length > 0) {
        setSelectedRealm(data[0].id); // Default to the first realm
      }
    } catch (error) {
      console.error(error);
    }
  };

  const countWords = (text: string): number => {
    return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getRelativeTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return "Yesterday";
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return formatDate(dateString);
  };

  const getTextQualityScore = () => {
    const hasTitle = title && title.trim() !== "" && title !== "New Note";
    const hasContent = content && content.length > 0;
    const contentLength = content?.length || 0;
    let score = 0;
    
    if (hasTitle) score += 20;
    if (hasContent) score += 30;
    if (contentLength > 100) score += 25;
    if (contentLength > 500) score += 25;
    
    return Math.min(score, 100);
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 40) return "text-blue-600 dark:text-blue-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getQualityBgColor = (score: number) => {
    if (score >= 80) return "bg-green-100 dark:bg-green-900/20";
    if (score >= 60) return "bg-yellow-100 dark:bg-yellow-900/20";
    if (score >= 40) return "bg-blue-100 dark:bg-blue-900/20";
    return "bg-gray-100 dark:bg-gray-900/20";
  };

  const getQualityLabel = (score: number) => {
    if (score >= 80) return "Complete";
    if (score >= 60) return "Detailed";
    if (score >= 40) return "Draft";
    return "Started";
  };

  useEffect(() => {
    fetchText();
    fetchRealms();
  }, [fetchText]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            if (hasUnsavedChanges) autoSave();
            break;
          case 'b':
            e.preventDefault();
            handleFormat('bold');
            break;
          case 'i':
            e.preventDefault();
            handleFormat('italic');
            break;
          case 'h':
            e.preventDefault();
            handleFormat('heading');
            break;
          case 'l':
            e.preventDefault();
            handleFormat('list');
            break;
          case 'k':
            e.preventDefault();
            handleFormat('link');
            break;
          case '`':
            e.preventDefault();
            handleFormat('code');
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges]);

  // Auto-save functionality with debouncing
  const autoSave = useCallback(async () => {
    if (!textId || !hasUnsavedChanges) return;
    
    setSaveStatus('saving');
    try {
      const updatedText = { title, content };
      await fetch(`http://localhost:8000/texts/${textId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedText),
      });
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      
      // Reset status after 2 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Failed to auto-save text:', error);
      setSaveStatus('error');
    }
  }, [textId, title, content, hasUnsavedChanges]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (2 seconds after last change)
    saveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [autoSave, hasUnsavedChanges]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setHasUnsavedChanges(true);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setHasUnsavedChanges(true);
    setWordCount(countWords(newContent));
  };

  const handleFormat = (type: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    let newContent: string | undefined;
    let newCursorPos: number | undefined;

    const wrapWith = (prefix: string, suffix: string) => {
        newContent = `${content.substring(0, start)}${prefix}${selectedText}${suffix}${content.substring(end)}`;
        newCursorPos = start + prefix.length + selectedText.length + suffix.length;
    };
    
    const insertAtLineStart = (prefix: string) => {
        const lineStart = content.lastIndexOf('\n', start - 1) + 1;
        newContent = `${content.substring(0, lineStart)}${prefix}${content.substring(lineStart)}`;
        newCursorPos = start + prefix.length;
    }

    switch (type) {
        case 'bold':
            wrapWith('**', '**');
            break;
        case 'italic':
            wrapWith('*', '*');
            break;
        case 'heading':
            insertAtLineStart('## ');
            break;
        case 'list':
            insertAtLineStart('- ');
            break;
        case 'link':
            wrapWith('[', '](url)');
            break;
        case 'code':
            wrapWith('`', '`');
            break;
        default:
            return;
    }

    if (newContent !== undefined) {
      setContent(newContent);
      setHasUnsavedChanges(true);
      setWordCount(countWords(newContent));
    }

    setTimeout(() => {
        if(textareaRef.current && newCursorPos !== undefined) {
            textareaRef.current.focus();
            if (type === 'link' && selectedText.length > 0) {
                 textareaRef.current.setSelectionRange(newCursorPos - 4, newCursorPos - 1);
            } else {
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }
    }, 0);
  };

  const handleDelete = async () => {
    if (!textId || !window.confirm('Are you sure you want to delete this note?')) return;
    try {
      await fetch(`http://localhost:8000/texts/${textId}`, {
        method: 'DELETE',
      });
      navigate('/text');
    } catch (error) {
      console.error('Failed to delete text:', error);
    }
  };

  const handleSynthesize = async () => {
    if (!textId || !selectedRealm) {
      setSynthesisResult({
        type: 'error',
        message: 'Please select a realm to synthesize.'
      });
      return;
    }
    
    // Auto-save before synthesizing
    if (hasUnsavedChanges) {
      await autoSave();
    }
    
    setIsSynthesizing(true);
    try {
      // Use the new advanced synthesis endpoint
      const response = await fetch(`http://localhost:8000/texts/${textId}/synthesize/advanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          realm_id: selectedRealm,
          synthesis_type: 'incremental',
          configuration: {
            include_quality_assessment: true,
            generate_suggestions: true
          }
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Synthesis failed');
      }
      const data = await response.json();
      
      if (data.job_id) {
        // Poll for completion
        setSynthesisResult({
          type: 'success',
          message: 'Advanced synthesis started successfully! Processing content...'
        });
        
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`http://localhost:8000/synthesis-jobs/${data.job_id}`);
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              
              if (statusData.status === 'completed') {
                clearInterval(pollInterval);
                setSynthesisResult({
                  type: 'success',
                  message: `Advanced synthesis completed! Quality score: ${statusData.results?.quality_score || 'N/A'}\n\nNew synthesis insights have been integrated into the realm.`
                });
              } else if (statusData.status === 'failed') {
                clearInterval(pollInterval);
                setSynthesisResult({
                  type: 'error',
                  message: `Synthesis failed: ${statusData.error_message || 'Unknown error'}`
                });
              }
            }
          } catch (error) {
            console.error('Error polling synthesis status:', error);
          }
        }, 2000);
      } else {
        // Fallback to simple synthesis result
        setSynthesisResult({
          type: 'success',
          message: `Content successfully synthesized with ${selectedRealm}`
        });
      }
    } catch (error) {
      console.error('Failed to synthesize:', error);
      setSynthesisResult({
        type: 'error',
        message: `Synthesis failed: ${(error as Error).message}`
      });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span>Saving...</span>
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center text-sm text-green-600 dark:text-green-400">
            <Check className="w-4 h-4 mr-2" />
            <span>Saved</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span>Failed to save</span>
          </div>
        );
      default:
        return hasUnsavedChanges ? (
          <div className="flex items-center text-sm text-amber-600 dark:text-amber-400">
            <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
            <span>Unsaved changes</span>
          </div>
        ) : null;
    }
  };

  const qualityScore = getTextQualityScore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your note...</p>
        </div>
      </div>
    );
  }

  if (!text) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Note not found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            The note you're looking for doesn't exist or may have been deleted.
          </p>
          <button
            onClick={() => navigate('/text')}
            className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Notes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SynthesisNotification 
        result={synthesisResult} 
        onClose={() => setSynthesisResult(null)} 
      />
      
      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-8 gap-4">
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-4">
                <button 
                  onClick={() => navigate('/text')} 
                  className="flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Notes
                </button>
                
                {/* Save Status */}
                {renderSaveStatus()}
              </div>

              {/* Stats Row */}
              <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                <div className={`flex items-center px-3 py-1 rounded-full ${getQualityBgColor(qualityScore)}`}>
                  <Sparkles className={`w-4 h-4 mr-1 ${getQualityColor(qualityScore)}`} />
                  <span className={`font-medium ${getQualityColor(qualityScore)}`}>
                    {getQualityLabel(qualityScore)}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <Activity className="w-4 h-4" />
                  <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>Last edited {getRelativeTime(text.created_at)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
               {/* Realm Selection and Synthesize Button */}
              <div className="flex items-center space-x-2">
                <select
                  value={selectedRealm}
                  onChange={(e) => setSelectedRealm(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors"
                  disabled={isSynthesizing}
                >
                  <option value="">Select Realm</option>
                  {realms.map(realm => (
                    <option key={realm.id} value={realm.id}>{realm.name}</option>
                  ))}
                </select>
                
                <button
                  onClick={handleSynthesize}
                  className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-purple-400 transition-colors"
                  disabled={isSynthesizing || !selectedRealm}
                  title="Synthesize with selected realm"
                >
                  <Brain className="w-4 h-4 mr-1" />
                  {isSynthesizing ? 'Synthesizing...' : 'Synthesize'}
                </button>
              </div>

              <button 
                onClick={handleDelete} 
                className="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 md:p-8">
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                className="w-full text-3xl md:text-4xl font-extrabold bg-transparent focus:outline-none mb-6 text-gray-900 dark:text-gray-100 tracking-tight placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Note Title"
              />

              <FormattingToolbar onFormatClick={handleFormat} />

              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                className="w-full min-h-[500px] bg-transparent focus:outline-none text-base md:text-lg resize-y text-gray-900 dark:text-gray-300 p-4 rounded-b-lg font-serif placeholder-gray-400 dark:placeholder-gray-500 leading-relaxed"
                placeholder="Write something beautiful..."
              />
            </div>
            
            {/* Footer with shortcuts hint */}
            <div className="px-6 md:px-8 pb-6">
              <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-4">
                <div className="flex flex-wrap gap-4">
                  <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+S</kbd> Save</span>
                  <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+B</kbd> Bold</span>
                  <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+I</kbd> Italic</span>
                  <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+H</kbd> Heading</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 