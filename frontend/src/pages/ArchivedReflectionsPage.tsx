import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface Reflection {
  id: string;
  question: string;
  answer: string;
}

export function ArchivedReflectionsPage() {
  const { realmId } = useParams();
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArchivedReflections() {
      if (!realmId) return;
      setIsLoading(true);
      try {
        const response = await fetch(`http://localhost:8000/realms/${realmId}/reflections/archived`);
        if (!response.ok) {
          throw new Error('Failed to fetch reflections.');
        }
        const data: Reflection[] = await response.json();
        setReflections(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchArchivedReflections();
  }, [realmId]);

  return (
    <div className="p-4 md:p-6 dark:bg-gray-900 min-h-full">
        <header className="flex items-center mb-4">
            <Link to={`/realms/${realmId}`} className="flex items-center text-blue-600 hover:underline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Realm
            </Link>
        </header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Archived Reflections</h1>

      {isLoading && <p className="text-gray-500 dark:text-gray-400">Loading archived reflections...</p>}
      {error && <p className="text-red-500">{error}</p>}
      
      {!isLoading && !error && (
        <div className="space-y-4">
          {reflections.length > 0 ? (
            reflections.map(reflection => (
              <div key={reflection.id} className="p-4 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
                <p className="font-semibold text-gray-700 dark:text-gray-300">{reflection.question}</p>
                <p className="mt-2 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{reflection.answer}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No answered reflections found for this realm.</p>
          )}
        </div>
      )}
    </div>
  );
} 