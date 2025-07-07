import { Plus, Shield, Trash2, Edit } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { RealmEditModal } from "../components/RealmEditModal";

export interface Realm {
  id: string;
  name: string;
  system_prompt: string;
}

export function RealmsPage() {
  const [realms, setRealms] = useState<Realm[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRealm, setEditingRealm] = useState<Realm | null>(null);

  const fetchRealms = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:8000/realms");
      if (!response.ok) {
        throw new Error("Failed to fetch realms");
      }
      const data = await response.json();
      setRealms(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRealms();
  }, [fetchRealms]);

  const handleSave = async (realm: Omit<Realm, 'id'> & { id?: string }) => {
    const method = realm.id ? "PUT" : "POST";
    const url = realm.id ? `http://localhost:8000/realms/${realm.id}` : "http://localhost:8000/realms";
    
    const realmData = {
        name: realm.name,
        system_prompt: realm.system_prompt
    };

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(realmData),
    });
    fetchRealms();
    setIsModalOpen(false);
    setEditingRealm(null);
  };

  const handleDelete = async (realmId: string) => {
    if (window.confirm("Are you sure you want to delete this realm?")) {
      await fetch(`http://localhost:8000/realms/${realmId}`, {
        method: "DELETE",
      });
      fetchRealms();
    }
  };

  const handleOpenModal = (realm: Realm | null) => {
    setEditingRealm(realm);
    setIsModalOpen(true);
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <header className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <h2 className="text-xl font-semibold dark:text-gray-100">Realms</h2>
        <button 
          onClick={() => handleOpenModal(null)}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          New Realm
        </button>
      </header>
      <div className="flex-grow p-4 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <p className="text-gray-500 dark:text-gray-400">Loading realms...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {realms.map((realm) => (
              <div
                key={realm.id}
                className="flex items-center p-4 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                <Link to={`/realms/${realm.id}`} className="flex items-center flex-grow">
                  <Shield className="w-6 h-6 mr-4 text-blue-500 dark:text-blue-400" />
                  <span className="text-lg font-medium dark:text-gray-200">{realm.name}</span>
                </Link>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => handleOpenModal(realm)}
                    className="p-2 text-gray-500 hover:text-blue-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(realm.id)}
                    className="p-2 text-gray-500 hover:text-red-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <RealmEditModal
        isOpen={isModalOpen}
        onClose={() => {
            setIsModalOpen(false);
            setEditingRealm(null);
        }}
        onSave={handleSave}
        realm={editingRealm}
      />
    </div>
  );
} 