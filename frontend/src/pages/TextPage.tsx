import { PlusCircle, FileText, Calendar, Clock, BarChart3, Sparkles, BookOpen, Edit3, TrendingUp, Activity } from "lucide-react";
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
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getRelativeTime = (dateString: string) => {
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

  const truncateContent = (content: string, maxLength: number = 120) => {
    if (!content || content.length <= maxLength) return content || "No content yet";
    return content.substring(0, maxLength) + "...";
  };

  const getTextQualityScore = (text: Text) => {
    const hasTitle = text.title && text.title.trim() !== "" && text.title !== "New Note";
    const hasContent = text.content && text.content.length > 0;
    const contentLength = text.content?.length || 0;
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

  const totalWords = texts.reduce((sum, text) => sum + (text.content?.split(' ').length || 0), 0);
  const averageQuality = texts.length > 0 
    ? Math.round(texts.reduce((sum, text) => sum + getTextQualityScore(text), 0) / texts.length)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-8 gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">Notes & Reflections</h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Capture thoughts, insights, and ideas that matter to you
              </p>
              
              {/* Stats Row */}
              {texts.length > 0 && (
                <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center space-x-1">
                    <FileText className="w-4 h-4" />
                    <span>{texts.length} {texts.length === 1 ? 'note' : 'notes'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <BookOpen className="w-4 h-4" />
                    <span>{totalWords.toLocaleString()} words</span>
                  </div>
                  <div className={`flex items-center px-3 py-1 rounded-full ${getQualityBgColor(averageQuality)}`}>
                    <BarChart3 className={`w-4 h-4 mr-1 ${getQualityColor(averageQuality)}`} />
                    <span className={`font-medium ${getQualityColor(averageQuality)}`}>
                      {averageQuality}% avg quality
                    </span>
                  </div>
                </div>
              )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {texts.map((text) => {
                const qualityScore = getTextQualityScore(text);
                const wordCount = text.content?.split(' ').length || 0;
                
                return (
                  <Link
                    key={text.id}
                    to={`/texts/${text.id}`}
                    className="group block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                          <Edit3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3 mr-1" />
                        {getRelativeTime(text.created_at)}
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-3 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {text.title || "Untitled Note"}
                    </h3>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed mb-4">
                      {truncateContent(text.content)}
                    </p>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center space-x-3">
                        <div className={`flex items-center px-2 py-1 rounded-md text-xs font-medium ${getQualityBgColor(qualityScore)}`}>
                          <Sparkles className={`w-3 h-3 mr-1 ${getQualityColor(qualityScore)}`} />
                          <span className={getQualityColor(qualityScore)}>
                            {getQualityLabel(qualityScore)}
                          </span>
                        </div>
                        
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <Activity className="w-3 h-3 mr-1" />
                          <span>{wordCount} words</span>
                        </div>
                      </div>
                      
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                        Read →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full flex items-center justify-center">
                  <FileText className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Start your reflection journey
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                  Capture your thoughts, document insights, and build a personal knowledge base. 
                  Every great idea starts with a single note.
                </p>
                <div className="space-y-4">
                  <button
                    onClick={handleCreateText}
                    className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" />
                    Create Your First Note
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Start writing, and watch your ideas evolve
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 