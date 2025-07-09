import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { NavLink, Link } from "react-router-dom";
import { MessageSquare, Shield, FileText } from "lucide-react";
import { ChatPage } from "./pages/ChatPage";
import { TextPage } from "./pages/TextPage";
import { TextDetailPage } from "./pages/TextDetailPage";
import { RealmsPage } from "./pages/RealmsPage";
import { RealmDetailPage } from "./pages/RealmDetailPage";
import { ArchivedReflectionsPage } from "./pages/ArchivedReflectionsPage";
import { LoadingProvider } from "./lib/LoadingContext";
import { cn } from "./lib/utils";

function GlobalHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Pathfinder
        </Link>
        
        {/* Navigation */}
        <nav>
          <ul className="flex items-center space-x-1">
            <li>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  cn(
                    "flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm",
                    isActive
                      ? "bg-gray-100 dark:bg-gray-800 font-medium text-gray-900 dark:text-gray-100"
                      : "text-gray-600 dark:text-gray-400"
                  )
                }
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/text"
                className={({ isActive }) =>
                  cn(
                    "flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm",
                    isActive
                      ? "bg-gray-100 dark:bg-gray-800 font-medium text-gray-900 dark:text-gray-100"
                      : "text-gray-600 dark:text-gray-400"
                  )
                }
              >
                <FileText className="w-4 h-4 mr-2" />
                Text
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/realms"
                className={({ isActive }) =>
                  cn(
                    "flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm",
                    isActive
                      ? "bg-gray-100 dark:bg-gray-800 font-medium text-gray-900 dark:text-gray-100"
                      : "text-gray-600 dark:text-gray-400"
                  )
                }
              >
                <Shield className="w-4 h-4 mr-2" />
                Realms
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

function AppContent() {
  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <GlobalHeader />
      <main className="flex-1 pt-16 overflow-auto">
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/text" element={<TextPage />} />
          <Route path="/texts/:textId" element={<TextDetailPage />} />
          <Route path="/realms" element={<RealmsPage />} />
          <Route path="/realms/:realmId" element={<RealmDetailPage />} />
          <Route path="/realms/:realmId/archive" element={<ArchivedReflectionsPage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <LoadingProvider>
        <AppContent />
      </LoadingProvider>
    </Router>
  );
}

export default App;
