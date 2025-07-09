import { Brain, Plus, Shield, Edit, Settings, TrendingUp, FileText, MessageSquare, Calendar, ChevronRight, Sparkles, Target, BarChart3, Clock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { RealmEditModal } from "../components/RealmEditModal";
import { RealmOnboardingModal } from "../components/RealmOnboardingModal";

export interface Realm {
  id: string;
  name: string;
  description?: string | null;
  system_prompt: string | null;
  created_at: string;
  is_default: boolean;
}

export function RealmsPage() {
  const [realms, setRealms] = useState<Realm[]>([]);
  const [defaultRealm, setDefaultRealm] = useState<Realm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
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

  const handleSave = async (realm: { id?: string; name: string; description?: string; system_prompt: string }) => {
    const method = realm.id ? "PUT" : "POST";
    const url = realm.id ? `http://localhost:8000/realms/${realm.id}` : "http://localhost:8000/realms";
    
    const realmData = {
        name: realm.name,
        description: realm.description,
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

  const handleOpenModal = (realm: Realm | null) => {
    setEditingRealm(realm);
    setIsModalOpen(true);
  }

  const handleCreateRealm = () => {
    setIsOnboardingOpen(true);
  };

  const handleOnboardingComplete = (realmId: string) => {
    fetchRealms(); // Refresh the realms list
    navigate(`/realms/${realmId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getRealmQualityScore = (realm: Realm) => {
    // Mock quality score calculation - in real app this would come from backend
    const hasPrompt = realm.system_prompt && realm.system_prompt.length > 50;
    const promptLength = realm.system_prompt?.length || 0;
    let score = 0;
    
    if (hasPrompt) score += 40;
    if (promptLength > 200) score += 30;
    if (promptLength > 500) score += 20;
    if (realm.name && realm.name !== "New Realm") score += 10;
    
    return Math.min(score, 100);
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getQualityBgColor = (score: number) => {
    if (score >= 80) return "bg-green-100 dark:bg-green-900/20";
    if (score >= 60) return "bg-yellow-100 dark:bg-yellow-900/20";
    return "bg-red-100 dark:bg-red-900/20";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your realms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Your Realms</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Intelligent contexts that evolve with your conversations
              </p>
            </div>
            <button
              onClick={handleCreateRealm}
              className="flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Realm
            </button>
          </div>

          {/* Default Realm Section */}
          {defaultRealm && (
            <div className="mb-8">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Brain className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Core Identity</h2>
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Your Default Context</p>
                      </div>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                      This is your foundational context that shapes every conversation. Define your core traits, 
                      values, and preferences here to make every AI interaction deeply personal and relevant.
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <Link 
                        to={`/realms/${defaultRealm.id}`} 
                        className="inline-flex items-center font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      >
                        Configure Your Identity
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className={`flex items-center px-3 py-1 rounded-full ${getQualityBgColor(getRealmQualityScore(defaultRealm))}`}>
                          <BarChart3 className={`w-4 h-4 mr-1 ${getQualityColor(getRealmQualityScore(defaultRealm))}`} />
                          <span className={`font-medium ${getQualityColor(getRealmQualityScore(defaultRealm))}`}>
                            {getRealmQualityScore(defaultRealm)}% Complete
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Specialized Realms Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Specialized Contexts</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                  {realms.length === 0 ? "Create focused contexts for specific topics or roles" : `${realms.length} specialized ${realms.length === 1 ? 'context' : 'contexts'}`}
                </p>
              </div>
            </div>

            {realms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {realms.map((realm) => {
                  const qualityScore = getRealmQualityScore(realm);
                  return (
                    <div
                      key={realm.id}
                      onClick={() => navigate(`/realms/${realm.id}`)}
                      className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 cursor-pointer hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                            <Target className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                          </div>
                        </div>
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(realm.created_at)}
                        </div>
                      </div>
                      
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {realm.name}
                      </h3>
                      
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                          {realm.system_prompt 
                            ? realm.system_prompt.length > 100 
                              ? realm.system_prompt.substring(0, 100) + "..."
                              : realm.system_prompt
                            : "No context defined yet"
                          }
                        </p>
                        
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div className={`flex items-center px-2 py-1 rounded-md text-xs font-medium ${getQualityBgColor(qualityScore)}`}>
                            <Sparkles className={`w-3 h-3 mr-1 ${getQualityColor(qualityScore)}`} />
                            <span className={getQualityColor(qualityScore)}>
                              {qualityScore}% Ready
                            </span>
                          </div>
                          
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                            Configure →
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty State */
              <div className="text-center py-16">
                <div className="max-w-md mx-auto">
                  <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <Target className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    No specialized realms yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                    Create focused contexts for specific topics, roles, or goals. Each realm becomes 
                    a specialized AI companion that understands your unique needs in that area.
                  </p>
                  <button
                    onClick={handleCreateRealm}
                    className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create Your First Realm
                  </button>
                </div>
              </div>
            )}
          </div>
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

      <RealmOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={handleOnboardingComplete}
      />
    </div>
  );
} 