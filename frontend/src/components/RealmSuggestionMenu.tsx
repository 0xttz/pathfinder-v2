import type { Realm } from "../pages/RealmsPage";
import { Shield } from "lucide-react";

interface RealmSuggestionMenuProps {
  realms: Realm[];
  onSelectRealm: (realm: Realm) => void;
  searchTerm: string;
}

export function RealmSuggestionMenu({
  realms,
  onSelectRealm,
  searchTerm,
}: RealmSuggestionMenuProps) {
  const filteredRealms = realms.filter((realm) =>
    realm.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="absolute bottom-full mb-2 w-full rounded-lg border bg-white shadow-xl dark:border-gray-600 dark:bg-gray-800 z-10">
      <ul>
        {filteredRealms.length > 0 ? (
          filteredRealms.map((realm) => (
            <li
              key={realm.id}
              className="cursor-pointer p-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center dark:text-gray-200"
              onClick={() => onSelectRealm(realm)}
            >
              <Shield size={16} className="mr-2" />
              {realm.name}
            </li>
          ))
        ) : (
          <li className="p-3 text-gray-500 dark:text-gray-400">No realms found.</li>
        )}
      </ul>
    </div>
  );
} 