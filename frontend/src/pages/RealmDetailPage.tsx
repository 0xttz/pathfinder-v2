import { useParams } from "react-router-dom";
import { Bot, Save, Trash2, Wand2 } from "lucide-react";

export function RealmDetailPage() {
  const { realmId } = useParams();

  const realm = {
    id: realmId,
    name: "Career Development",
    system_prompt:
      "You are an expert career coach. Your goal is to help me identify my strengths, weaknesses, and passions to guide my professional growth. Be direct, insightful, and encouraging.",
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

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-xl font-semibold">{realm.name}</h2>
          <p className="text-sm text-gray-500">Realm ID: {realm.id}</p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
          <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600">
            <Save className="w-4 h-4 mr-2" />
            Save
          </button>
        </div>
      </header>

      <div className="flex-grow p-4 overflow-y-auto space-y-6">
        <div>
          <label
            htmlFor="realm-name"
            className="block text-sm font-medium text-gray-700"
          >
            Realm Name
          </label>
          <input
            id="realm-name"
            type="text"
            defaultValue={realm.name}
            className="w-full p-2 mt-1 border rounded-lg"
          />
        </div>

        <div>
          <label
            htmlFor="system-prompt"
            className="block text-sm font-medium text-gray-700"
          >
            System Prompt
          </label>
          <textarea
            id="system-prompt"
            rows={5}
            defaultValue={realm.system_prompt}
            className="w-full p-2 mt-1 border rounded-lg font-mono text-sm"
          />
        </div>

        <div className="p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold">Guided Reflection</h3>
          <p className="text-sm text-gray-600 mt-1">
            Answer these questions to help the AI build a better profile for this realm.
          </p>
          <div className="flex items-center space-x-2 mt-4">
            <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600">
              <Bot className="w-4 h-4 mr-2" />
              Generate Questions
            </button>
            <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-500 rounded-lg hover:bg-purple-600">
              <Wand2 className="w-4 h-4 mr-2" />
              Synthesize
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {reflections.map((r, i) => (
              <div key={i}>
                <label className="block text-sm font-medium text-gray-700">
                  {r.question}
                </label>
                <textarea
                  rows={3}
                  defaultValue={r.answer}
                  className="w-full p-2 mt-1 border rounded-lg"
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