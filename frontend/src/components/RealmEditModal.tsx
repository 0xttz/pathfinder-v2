import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Realm } from "../pages/RealmsPage";

interface RealmEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (realm: Omit<Realm, 'id'> & { id?: string }) => void;
  realm: Realm | null;
}

export function RealmEditModal({ isOpen, onClose, onSave, realm }: RealmEditModalProps) {
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    if (realm) {
      setName(realm.name);
      setSystemPrompt(realm.system_prompt || "");
    } else {
      setName("");
      setSystemPrompt("");
    }
  }, [realm]);

  const handleSave = () => {
    const realmData: Omit<Realm, 'id'> & { id?: string } = {
      name,
      system_prompt: systemPrompt,
    };
    if (realm?.id) {
      realmData.id = realm.id;
    }
    onSave(realmData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-gray-100">{realm ? "Edit Realm" : "New Realm"}</h2>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
            <X size={20} className="dark:text-gray-300" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="system_prompt"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              System Prompt
            </label>
            <textarea
              id="system_prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g., You are a helpful assistant for career coaching..."
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-white bg-blue-500 hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
} 