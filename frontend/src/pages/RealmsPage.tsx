import { Plus, Shield, Trash2, Edit } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { RealmEditModal } from "../components/RealmEditModal";
import { PlusCircle, ChevronsRight } from "lucide-react";

export interface Realm {
  id: string;
  name: string;
  system_prompt: string | null;
  created_at: string;
  is_default: boolean;
}

export function RealmsPage() {
  const [realms, setRealms] = useState<Realm[]>([]);
  const [defaultRealm, setDefaultRealm] = useState<Realm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRealm, setEditingRealm] = useState<Realm | null>(null);
  const navigate = useNavigate();

  const fetchRealms = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:8000/realms");
      if (!response.ok) {
        throw new Error("Failed to fetch realms");
      }
      const data: Realm[] = await response.json();
      const defaultRealm = data.find(r => r.is_default) || null;
      const otherRealms = data.filter(r => !r.is_default);
      
      setDefaultRealm(defaultRealm);
      setRealms(otherRealms);
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

  const handleCreateRealm = async () => {
    const newRealm = { name: "New Realm", system_prompt: "" };
    const response = await fetch("http://localhost:8000/realms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRealm),
    });
    const createdRealm = await response.json();
    navigate(`/realms/${createdRealm.id}`);
  };

  if (isLoading) {
    return <div className="p-4"><p>Loading realms...</p></div>;
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      <div className="max-w-4xl mx-auto">
        {/* Default Realm Section */}
        {defaultRealm && (
            <div className="mb-8 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg p-6 shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">About Me</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    This is your global context. Define your core traits, goals, and preferences here to make every conversation smarter.
                </p>
                <Link to={`/realms/${defaultRealm.id}`} className="inline-flex items-center font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                    Configure Your Core Context
                    <ChevronsRight className="w-5 h-5 ml-1" />
                </Link>
            </div>
        )}
        
        {/* Other Realms Section */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Your Realms</h1>
          <button
            onClick={handleCreateRealm}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Realm
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {realms.map((realm) => (
            <div
              key={realm.id}
              onClick={() => navigate(`/realms/${realm.id}`)}
              className="p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg cursor-pointer hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{realm.name}</h3>
            </div>
          ))}
        </div>
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