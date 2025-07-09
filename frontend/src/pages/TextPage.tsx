import { PlusCircle, FileText, Calendar } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";

export interface Text {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export function TextPage() {
  const [texts, setTexts] = useState<Text[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchTexts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:8000/texts");
      if (!response.ok) {
        throw new Error("Failed to fetch texts");
      }
      const data: Text[] = await response.json();
      setTexts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTexts();
  }, [fetchTexts]);

  const handleCreateText = async () => {
    const newText = { title: "New Note", content: "" };
    try {
        const response = await fetch("http://localhost:8000/texts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newText),
        });
        if (!response.ok) {
            throw new Error('Failed to create text');
        }
        const createdText = await response.json();
        navigate(`/texts/${createdText.id}`);
    } catch (error) {
        console.error("Error creating text:", error)
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const truncateContent = (content: string, maxLength: number = 120) => {
    if (!content || content.length <= maxLength) return content || "No content";
    return content.substring(0, maxLength) + "...";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-full bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900">
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Notes & Reflections</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {texts.length === 0 ? "Start writing your first note" : `${texts.length} ${texts.length === 1 ? 'note' : 'notes'}`}
              </p>
            </div>
            <button
              onClick={handleCreateText}
              className="flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <PlusCircle className="w-5 h-5 mr-2" />
              Create New Note
            </button>
          </div>

          {/* Notes Grid */}
          {texts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {texts.map((text) => (
                <Link
                  key={text.id}
                  to={`/texts/${text.id}`}
                  className="group block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-shrink-0">
                      <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatDate(text.created_at)}
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-3 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {text.title || "Untitled Note"}
                  </h3>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
                    {truncateContent(text.content)}
                  </p>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                      Read more →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                  <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  No notes yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  Start your reflection journey by creating your first note. Capture your thoughts, ideas, and insights.
                </p>
                <button
                  onClick={handleCreateText}
                  className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <PlusCircle className="w-5 h-5 mr-2" />
                  Create Your First Note
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 