import { Plus, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export function RealmsPage() {
  const realms = [
    { id: "1", name: "Career Development" },
    { id: "2", name: "Personal Growth" },
    { id: "3", name: "Health & Fitness" },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-semibold">Realms</h2>
        <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          New Realm
        </button>
      </header>
      <div className="flex-grow p-4 overflow-y-auto">
        <div className="space-y-3">
          {realms.map((realm) => (
            <Link
              key={realm.id}
              to={`/realms/${realm.id}`}
              className="flex items-center p-4 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <Shield className="w-6 h-6 mr-4 text-blue-500" />
              <span className="text-lg font-medium">{realm.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
} 