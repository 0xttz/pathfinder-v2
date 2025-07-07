import { PlusCircle } from "lucide-react";
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

  if (isLoading) {
    return <div className="p-4"><p>Loading texts...</p></div>;
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Your Notes & Reflections</h1>
          <button
            onClick={handleCreateText}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Create New
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {texts.map((text) => (
            <Link
              key={text.id}
              to={`/texts/${text.id}`}
              className="block p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg cursor-pointer hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate">{text.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">{text.content || "No content"}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
} 