import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Text } from './TextPage'; // Reusing the interface
import { ArrowLeft, Trash2 } from 'lucide-react';

export function TextDetailPage() {
  const { textId } = useParams<{ textId: string }>();
  const navigate = useNavigate();
  const [text, setText] = useState<Text | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchText = useCallback(async () => {
    if (!textId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/texts/${textId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch text');
      }
      const data = await response.json();
      setText(data);
      setTitle(data.title);
      setContent(data.content);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [textId]);

  useEffect(() => {
    fetchText();
  }, [fetchText]);

  const handleSave = async () => {
    if (!textId) return;
    const updatedText = { title, content };
    try {
      await fetch(`http://localhost:8000/texts/${textId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedText),
      });
      navigate(-1);
    } catch (error) {
      console.error('Failed to save text:', error);
    }
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
  
  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!text) return <div className="p-6">Note not found.</div>;

  return (
    <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => navigate(-1)} className="flex items-center text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to all notes
          </button>
          <button onClick={handleDelete} className="flex items-center text-red-600 hover:text-red-800 p-2 rounded-md hover:bg-red-100 dark:text-red-500 dark:hover:text-red-400 dark:hover:bg-gray-800">
            <Trash2 className="w-5 h-5"/>
          </button>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-4xl font-bold bg-transparent focus:outline-none mb-4 dark:text-gray-100"
          placeholder="Your Title Here"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-96 bg-transparent focus:outline-none text-lg resize-none dark:text-gray-100"
          placeholder="Start writing..."
        />
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
} 