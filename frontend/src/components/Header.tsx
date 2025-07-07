import { NavLink } from "react-router-dom";
import { MessageSquare, Shield } from "lucide-react";
import { cn } from "../lib/utils";

export function Header() {
  return (
    <header className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700">
      <h1 className="text-2xl font-bold dark:text-gray-100">Pathfinder</h1>
      <nav>
        <ul className="flex items-center space-x-4">
          <li>
            <NavLink
              to="/"
              className={({ isActive }) =>
                cn(
                  "flex items-center px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors",
                  isActive
                    ? "bg-gray-200 dark:bg-gray-800 font-semibold text-gray-900 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-300"
                )
              }
            >
              <MessageSquare className="w-5 h-5 mr-2" />
              Chat
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/realms"
              className={({ isActive }) =>
                cn(
                  "flex items-center px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors",
                  isActive
                    ? "bg-gray-200 dark:bg-gray-800 font-semibold text-gray-900 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-300"
                )
              }
            >
              <Shield className="w-5 h-5 mr-2" />
              Realms
            </NavLink>
          </li>
        </ul>
      </nav>
    </header>
  );
} 