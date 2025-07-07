import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Header } from "./components/Header";
import { ChatPage } from "./pages/ChatPage";
import { RealmsPage } from "./pages/RealmsPage";
import { RealmDetailPage } from "./pages/RealmDetailPage";
import { ArchivedReflectionsPage } from "./pages/ArchivedReflectionsPage";

function App() {
  return (
    <Router>
      <div className="flex flex-col h-screen bg-white text-gray-800">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/realms" element={<RealmsPage />} />
            <Route path="/realms/:realmId" element={<RealmDetailPage />} />
            <Route path="/realms/:realmId/archive" element={<ArchivedReflectionsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
