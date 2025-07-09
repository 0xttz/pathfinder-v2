import { useParams, useNavigate, Link } from "react-router-dom";
import { Save, Trash2, ArrowLeft, Wand2, Sparkles, Archive } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import UserProfile from "../components/UserProfile";
import { DiffViewerModal } from "../components/DiffViewerModal";

interface Realm {
  id: string;
  name: string;
  system_prompt: string;
  is_default?: boolean;
}

interface Reflection {
  id: string;
  realm_id: string;
  question: string;
  answer: string | null;
  created_at: string;
}

export function RealmDetailPage() {
  const { realmId } = useParams();
  const navigate = useNavigate();
  const [realm, setRealm] = useState<Realm | null>(null);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [previousPrompt, setPreviousPrompt] = useState("");

  const fetchRealmAndReflections = useCallback(async () => {
    if (!realmId) return;
    setIsLoading(true);
    try {
      // Fetch realm details
      const realmResponse = await fetch(`http://localhost:8000/realms/${realmId}`);
      if (!realmResponse.ok) throw new Error("Realm not found");
      const realmData = await realmResponse.json();
      setRealm(realmData);
      setName(realmData.name);
      setSystemPrompt(realmData.system_prompt || "");
      setPreviousPrompt(realmData.system_prompt || ""); // Store initial prompt

      // Fetch reflections
      const reflectionsResponse = await fetch(`http://localhost:8000/realms/${realmId}/reflections`);
      if (!reflectionsResponse.ok) throw new Error("Could not fetch reflections");
      const reflectionsData = await reflectionsResponse.json();
      setReflections(reflectionsData);

    } catch (error) {
      console.error(error);
      navigate("/realms");
    } finally {
      setIsLoading(false);
    }
  }, [realmId, navigate]);

  useEffect(() => {
    fetchRealmAndReflections();
  }, [fetchRealmAndReflections]);

  const handleSave = async () => {
    if (!realmId) return;
    await fetch(`http://localhost:8000/realms/${realmId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, system_prompt: systemPrompt })
    });
    alert("Realm saved!");
  };

  const handleDelete = async () => {
    if (!realmId) return;
    if (window.confirm("Are you sure you want to delete this realm?")) {
        await fetch(`http://localhost:8000/realms/${realmId}`, { method: 'DELETE' });
        navigate("/realms");
    }
  };

  const handleGenerateQuestions = async () => {
    if (!realmId) return;
    setIsGenerating(true);
    try {
        const response = await fetch(`http://localhost:8000/realms/${realmId}/generate-questions`, { method: 'POST' });
        if (!response.ok) {
            throw new Error('Failed to generate questions');
        }
        const newReflections = await response.json();
        setReflections(prev => [...prev, ...newReflections]);
    } catch (error) {
        console.error(error);
        alert('Error generating questions.');
    } finally {
        setIsGenerating(false);
    }
  };

  const handleSynthesize = async () => {
    if (!realmId) return;
    
    setPreviousPrompt(systemPrompt); // Capture the prompt state right before synthesis
    setIsSynthesizing(true);

    try {
        const response = await fetch(`http://localhost:8000/realms/${realmId}/synthesize`, { method: 'POST' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to synthesize');
        }
        const synthesisResponse = await response.json();
        const newPrompt = synthesisResponse.synthesized_prompt;
        
        setSystemPrompt(newPrompt);
        setIsDiffModalOpen(true); // Open the diff modal instead of alerting
        
    } catch (error) {
        console.error(error);
        alert(`Error synthesizing: ${(error as Error).message}`);
    } finally {
        setIsSynthesizing(false);
    }
  };

  const handleAnswerChange = async (reflectionId: string, answer: string) => {
    // Optimistic update
    setReflections(prev => 
        prev.map(r => r.id === reflectionId ? { ...r, answer } : r)
    );

    try {
        await fetch(`http://localhost:8000/reflections/${reflectionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer })
        });
    } catch (error) {
        console.error("Failed to save answer:", error);
        // Optionally revert state here
        alert("Failed to save your answer. Please try again.");
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full dark:bg-gray-900"><p className="text-gray-500 dark:text-gray-400">Loading Realm...</p></div>;
  }
  
  if (!realm) {
    return <div className="flex justify-center items-center h-full dark:bg-gray-900"><p className="text-red-500">Realm not found.</p></div>
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <div>
          <h2 className="text-xl font-semibold">{realm.name}</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={handleDelete} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
          <button onClick={handleSave} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </button>
        </div>
      </header>

      <div className="flex-grow p-4 overflow-y-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div>
              <label
                htmlFor="realm-name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Realm Name
              </label>
              <input
                id="realm-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 mt-1 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600"
              />
            </div>

            <div>
              <label
                htmlFor="system-prompt"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                System Prompt
              </label>
              <textarea
                id="system-prompt"
                rows={10}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full p-2 mt-1 border rounded-lg font-mono text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
            {realm.name === "About Me" && <UserProfile />}
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Guided Reflection</h3>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={handleGenerateQuestions}
                        disabled={isGenerating}
                        className="flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-purple-400"
                    >
                        <Wand2 className="w-4 h-4 mr-2" />
                        {isGenerating ? 'Generating...' : 'Generate Questions'}
                    </button>
                    <button 
                        onClick={handleSynthesize}
                        disabled={isSynthesizing}
                        className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {isSynthesizing ? 'Synthesizing...' : 'Synthesize'}
                    </button>
                </div>
            </div>
            <div className="space-y-4">
              {reflections.length > 0 ? (
                reflections.map((reflection) => (
                  <div key={reflection.id}>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                      {reflection.question}
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Your thoughts..."
                      defaultValue={reflection.answer || ""}
                      className="w-full p-2 mt-1 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600"
                      onChange={(e) => handleAnswerChange(reflection.id, e.target.value)}
                    />
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No reflection questions yet. Generate some to get started!</p>
              )}
            </div>
            <div className="mt-6 text-center">
                <Link to={`/realms/${realmId}/archive`} className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800">
                    <Archive className="w-4 h-4 mr-2" />
                    View Answered Reflections
                </Link>
            </div>
          </div>
        </div>
      </div>
      <DiffViewerModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        oldText={previousPrompt}
        newText={systemPrompt}
      />
    </div>
  );
} 