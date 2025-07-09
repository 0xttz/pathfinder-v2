import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Header } from "./components/Header";
import { ChatPage } from "./pages/ChatPage";
import { TextPage } from "./pages/TextPage";
import { TextDetailPage } from "./pages/TextDetailPage";
import { RealmsPage } from "./pages/RealmsPage";
import { RealmDetailPage } from "./pages/RealmDetailPage";
import { ArchivedReflectionsPage } from "./pages/ArchivedReflectionsPage";
import { LoadingProvider } from "./lib/LoadingContext";

function App() {
  return (
    <Router>
      <LoadingProvider>
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <Header />
          <main className="flex-1 overflow-y-auto">
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
      </LoadingProvider>
    </Router>
  );
}

export default App;
