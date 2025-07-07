import { useState } from "react";
import { NavLink } from "react-router-dom";
import { MessageSquare, Shield } from "lucide-react";
import { cn } from "../lib/utils";

export function Header() {
  const [status, setStatus] = useState("Click to test connection");

  const checkBackendStatus = async () => {
    setStatus("Connecting...");
    try {
      const response = await fetch("http://localhost:8000/health");
      if (response.ok) {
        const data = await response.json();
        setStatus(`Backend: ${data.status}`);
      } else {
        setStatus(`Error: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to connect to backend:", error);
      setStatus("Backend: Failed to connect");
    }
  };

  return (
    <header className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
      <h1 className="text-2xl font-bold">Pathfinder</h1>
      <nav>
        <ul className="flex items-center space-x-4">
          <li>
            <NavLink
              to="/"
              className={({ isActive }) =>
                cn(
                  "flex items-center px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors",
                  isActive ? "bg-gray-200 font-semibold" : "text-gray-600"
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
                  "flex items-center px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors",
                  isActive ? "bg-gray-200 font-semibold" : "text-gray-600"
                )
              }
            >
              <Shield className="w-5 h-5 mr-2" />
              Realms
            </NavLink>
          </li>
          <li className="flex items-center space-x-4">
            <button
              onClick={checkBackendStatus}
              className="px-3 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Test Backend
            </button>
            <span className="text-sm text-gray-500 min-w-[150px]">{status}</span>
          </li>
        </ul>
      </nav>
    </header>
  );
} 