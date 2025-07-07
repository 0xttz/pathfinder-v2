import { useParams, useNavigate } from "react-router-dom";
import { Bot, Save, Trash2, Wand2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import type { Realm } from "./RealmsPage";

export function RealmDetailPage() {
  const { realmId } = useParams();
  const navigate = useNavigate();
  const [realm, setRealm] = useState<Realm | null>(null);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchRealm = useCallback(async () => {
    if (!realmId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/realms/${realmId}`);
      if (!response.ok) {
        throw new Error("Realm not found");
      }
      const data = await response.json();
      setRealm(data);
      setName(data.name);
      setSystemPrompt(data.system_prompt);
    } catch (error) {
      console.error(error);
      navigate("/realms");
    } finally {
      setIsLoading(false);
    }
  }, [realmId, navigate]);

  useEffect(() => {
    fetchRealm();
  }, [fetchRealm]);

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

  const reflections = [
    {
      question: "What has been your most significant professional achievement?",
      answer: "Leading the 'Phoenix' project from conception to launch.",
    },
    {
      question: "What professional skill do you most want to develop?",
      answer: "I want to become more proficient in public speaking.",
    },
  ];

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
            rows={5}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full p-2 mt-1 border rounded-lg font-mono text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
          />
        </div>

        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-lg font-semibold">Guided Reflection</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Answer these questions to help the AI build a better profile for this realm.
          </p>
          <div className="flex items-center space-x-2 mt-4">
            <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
              <Bot className="w-4 h-4 mr-2" />
              Generate Questions
            </button>
            <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">
              <Wand2 className="w-4 h-4 mr-2" />
              Synthesize
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {reflections.map((r, i) => (
              <div key={i}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {r.question}
                </label>
                <textarea
                  rows={3}
                  defaultValue={r.answer}
                  className="w-full p-2 mt-1 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600"
                  placeholder="Your answer..."
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 