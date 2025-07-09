import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Text } from './TextPage'; // Reusing the interface
import { ArrowLeft, Trash2, Zap, Bold, Italic, Heading2, List, Link as LinkIcon, Code, Save, Check } from 'lucide-react';

interface Realm {
  id: string;
  name: string;
}

const FormattingToolbar = ({ onFormatClick }: { onFormatClick: (format: string) => void }) => {
    const formatButtons = [
        { type: 'bold', icon: Bold, tooltip: 'Bold' },
        { type: 'italic', icon: Italic, tooltip: 'Italic' },
        { type: 'heading', icon: Heading2, tooltip: 'Heading' },
        { type: 'list', icon: List, tooltip: 'List Item' },
        { type: 'link', icon: LinkIcon, tooltip: 'Link' },
        { type: 'code', icon: Code, tooltip: 'Code Block' },
    ];

    return (
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-2 rounded-t-lg border-b border-gray-200 dark:border-gray-700">
            {formatButtons.map(({ type, icon: Icon, tooltip }) => (
                <button
                    key={type}
                    onClick={() => onFormatClick(type)}
                    title={tooltip}
                    className="p-2 rounded-md text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                >
                    <Icon className="w-5 h-5" />
                </button>
            ))}
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

  useEffect(() => {
    fetchText();
    fetchRealms();
  }, [fetchText]);

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
    setContent(e.target.value);
    setHasUnsavedChanges(true);
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
      navigate('/texts');
    } catch (error) {
      console.error('Failed to delete text:', error);
    }
  };

  const handleSynthesize = async () => {
    if (!textId || !selectedRealm) {
      alert('Please select a realm to synthesize.');
      return;
    }
    
    // Auto-save before synthesizing
    if (hasUnsavedChanges) {
      await autoSave();
    }
    
    setIsSynthesizing(true);
    try {
      const response = await fetch(`http://localhost:8000/texts/${textId}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realm_id: selectedRealm }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Synthesis failed');
      }
      const data = await response.json();
      alert(`Synthesis successful! New prompt:\n\n${data.synthesized_prompt}`);
    } catch (error) {
      console.error('Failed to synthesize:', error);
      alert(`Synthesis failed: ${(error as Error).message}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <span className="flex items-center text-sm text-blue-600 dark:text-blue-400">
            <Save className="w-4 h-4 mr-1 animate-pulse" />
            Saving...
          </span>
        );
      case 'saved':
        return (
          <span className="flex items-center text-sm text-green-600 dark:text-green-400">
            <Check className="w-4 h-4 mr-1" />
            Saved
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center text-sm text-red-600 dark:text-red-400">
            Failed to save
          </span>
        );
      default:
        return hasUnsavedChanges ? (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Unsaved changes
          </span>
        ) : null;
    }
  };

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!text) return <div className="p-6">Note not found.</div>;

  return (
    <div className="p-4 md:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate(-1)} className="flex items-center text-sm text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Notes
            </button>
            {renderSaveStatus()}
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Realm Selection and Synthesize Button */}
            <div className="flex items-center space-x-2">
              <select
                value={selectedRealm}
                onChange={(e) => setSelectedRealm(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:outline-none"
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
                <Zap className="w-4 h-4 mr-1" />
                {isSynthesizing ? 'Synthesizing...' : 'Synthesize'}
              </button>
            </div>
            
            <button 
              onClick={handleDelete} 
              className="flex items-center text-red-600 hover:text-red-800 p-2 rounded-md hover:bg-red-100 dark:text-red-500 dark:hover:text-red-400 dark:hover:bg-gray-800"
              title="Delete note"
            >
              <Trash2 className="w-5 h-5"/>
            </button>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 md:p-8">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              className="w-full text-3xl md:text-4xl font-extrabold bg-transparent focus:outline-none mb-6 dark:text-gray-100 tracking-tight"
              placeholder="Note Title"
            />

            <FormattingToolbar onFormatClick={handleFormat} />

            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              className="w-full min-h-[500px] bg-transparent dark:bg-gray-800 focus:outline-none text-base md:text-lg resize-y dark:text-gray-300 p-4 rounded-b-lg font-serif"
              placeholder="Write something beautiful..."
            />
        </div>
      </div>
    </div>
  );
} 