import { useParams, useNavigate, Link } from "react-router-dom";
import { Save, Trash2, ArrowLeft, Wand2, Sparkles, Archive, Brain, Target, BarChart3, Clock, AlertCircle, CheckCircle, FileText, MessageSquare, TrendingUp, Activity, Calendar, Database } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import UserProfile from "../components/UserProfile";
import { DiffViewerModal } from "../components/DiffViewerModal";
import { ContentSourcesManager } from "../components/ContentSourcesManager";

interface Realm {
  id: string;
  name: string;
  description?: string;
  system_prompt: string;
  is_default?: boolean;
  created_at?: string;
}

interface Reflection {
  id: string;
  realm_id: string;
  question: string;
  answer: string | null;
  created_at: string;
}

export function RealmDetailPage() {
  const { realmId } = useParams();
  const navigate = useNavigate();
  const [realm, setRealm] = useState<Realm | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [previousPrompt, setPreviousPrompt] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'reflections' | 'content-sources'>('reflections');

  const fetchRealmAndReflections = useCallback(async () => {
    if (!realmId) return;
    setIsLoading(true);
    try {
      // Fetch realm details
      const realmResponse = await fetch(`http://localhost:8000/realms/${realmId}`);
      if (!realmResponse.ok) throw new Error("Realm not found");
      const realmData = await realmResponse.json();
      setRealm(realmData);
      setName(realmData.name);
      setDescription(realmData.description || "");
      setSystemPrompt(realmData.system_prompt || "");
      setPreviousPrompt(realmData.system_prompt || ""); // Store initial prompt

      // Fetch reflections
      const reflectionsResponse = await fetch(`http://localhost:8000/realms/${realmId}/reflections`);
      if (!reflectionsResponse.ok) throw new Error("Could not fetch reflections");
      const reflectionsData = await reflectionsResponse.json();
      setReflections(reflectionsData);

    } catch (error) {
      console.error(error);
      navigate("/realms");
    } finally {
      setIsLoading(false);
    }
  }, [realmId, navigate]);

  useEffect(() => {
    fetchRealmAndReflections();
  }, [fetchRealmAndReflections]);

  const getRealmQualityScore = () => {
    const hasName = name && name.trim() !== "" && name !== "New Realm";
    const hasPrompt = systemPrompt && systemPrompt.length > 50;
    const promptLength = systemPrompt?.length || 0;
    const hasReflections = reflections.length > 0;
    const answeredReflections = reflections.filter(r => r.answer && r.answer.trim() !== "").length;
    let score = 0;
    
    if (hasName) score += 10;
    if (hasPrompt) score += 30;
    if (promptLength > 200) score += 20;
    if (promptLength > 500) score += 15;
    if (hasReflections) score += 10;
    if (answeredReflections > 0) score += 15;
    
    return Math.min(score, 100);
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getQualityIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="w-4 h-4" />;
    if (score >= 60) return <Sparkles className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  const getQualityBgColor = (score: number) => {
    if (score >= 80) return "bg-green-100 dark:bg-green-900/20";
    if (score >= 60) return "bg-yellow-100 dark:bg-yellow-900/20";
    return "bg-red-100 dark:bg-red-900/20";
  };

  const handleSave = async () => {
    if (!realmId) return;
    setSaveStatus('saving');
    try {
      await fetch(`http://localhost:8000/realms/${realmId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, system_prompt: systemPrompt })
      });
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      console.error('Save failed:', error);
    }
  };

  const handleDelete = async () => {
    if (!realmId) return;
    if (window.confirm("Are you sure you want to delete this realm? This action cannot be undone.")) {
        await fetch(`http://localhost:8000/realms/${realmId}`, { method: 'DELETE' });
        navigate("/realms");
    }
  };

  const handleGenerateQuestions = async () => {
    if (!realmId) return;
    setIsGenerating(true);
    try {
        const response = await fetch(`http://localhost:8000/realms/${realmId}/generate-questions`, { method: 'POST' });
        if (!response.ok) {
            throw new Error('Failed to generate questions');
        }
        const newReflections = await response.json();
        setReflections(newReflections);
    } catch (error) {
        console.error(error);
        alert('Error generating questions.');
    } finally {
        setIsGenerating(false);
    }
  };

  const handleSynthesize = async () => {
    if (!realmId) return;
    
    setPreviousPrompt(systemPrompt); // Capture the prompt state right before synthesis
    setIsSynthesizing(true);

    try {
        const response = await fetch(`http://localhost:8000/realms/${realmId}/synthesize`, { method: 'POST' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to synthesize');
        }
        const synthesisResponse = await response.json();
        const newPrompt = synthesisResponse.synthesized_prompt;
        
        setSystemPrompt(newPrompt);
        setHasUnsavedChanges(true);
        setIsDiffModalOpen(true); // Open the diff modal instead of alerting
        
    } catch (error) {
        console.error(error);
        alert(`Error synthesizing: ${(error as Error).message}`);
    } finally {
        setIsSynthesizing(false);
    }
  };

  const handleAnswerChange = async (reflectionId: string, answer: string) => {
    // Optimistic update
    setReflections(prev => 
        prev.map(r => r.id === reflectionId ? { ...r, answer } : r)
    );

    try {
        await fetch(`http://localhost:8000/reflections/${reflectionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer })
        });
    } catch (error) {
        console.error("Failed to save answer:", error);
        // Optionally revert state here
        alert("Failed to save your answer. Please try again.");
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setHasUnsavedChanges(true);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    setHasUnsavedChanges(true);
  };

  const handleSystemPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSystemPrompt(e.target.value);
    setHasUnsavedChanges(true);
  };

  const handleContentSourcesChange = () => {
    // Refresh data when content sources change
    fetchRealmAndReflections();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const answeredReflections = reflections.filter(r => r.answer && r.answer.trim() !== "");
  const unansweredReflections = reflections.filter(r => !r.answer || r.answer.trim() === "");
  const qualityScore = getRealmQualityScore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-full bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading realm...</p>
        </div>
      </div>
    );
  }
  
  if (!realm) {
    return (
      <div className="flex items-center justify-center min-h-full bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <Target className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Realm not found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            The realm you're looking for doesn't exist or may have been deleted.
          </p>
          <button
            onClick={() => navigate('/realms')}
            className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Realms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900">
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-8 gap-4">
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-4">
                <button 
                  onClick={() => navigate('/realms')} 
                  className="flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Realms
                </button>
                
                {/* Save Status */}
                {saveStatus !== 'idle' && (
                  <div className="flex items-center space-x-2 text-sm">
                    {saveStatus === 'saving' && (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-gray-600 dark:text-gray-400">Saving...</span>
                      </>
                    )}
                    {saveStatus === 'saved' && (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-green-600 dark:text-green-400">Saved</span>
                      </>
                    )}
                    {saveStatus === 'error' && (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="text-red-600 dark:text-red-400">Save failed</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  realm.is_default ? 'bg-blue-600' : 'bg-gray-600 dark:bg-gray-500'
                }`}>
                  {realm.is_default ? (
                    <Brain className="w-6 h-6 text-white" />
                  ) : (
                    <Target className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{realm.name}</h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    {realm.is_default ? 'Your core identity context' : 'Specialized context for focused interactions'}
                  </p>
                </div>
              </div>

              {/* Quality and Stats */}
              <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                <div className={`flex items-center px-3 py-1 rounded-full ${getQualityBgColor(qualityScore)}`}>
                  <div className={getQualityColor(qualityScore)}>
                    {getQualityIcon(qualityScore)}
                  </div>
                  <span className={`ml-1 font-medium ${getQualityColor(qualityScore)}`}>
                    {qualityScore}% Complete
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <MessageSquare className="w-4 h-4" />
                  <span>{reflections.length} reflections</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Created {formatDate(realm.created_at)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleDelete} 
                className="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </button>
              <button 
                onClick={handleSave}
                disabled={!hasUnsavedChanges || saveStatus === 'saving'}
                className="flex items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Configuration */}
            <div className="space-y-6">
              {/* Realm Configuration Card */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Configuration</h2>
                
                <div className="space-y-6">
                  <div>
                    <label htmlFor="realm-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Realm Name
                    </label>
                    <input
                      id="realm-name"
                      type="text"
                      value={name}
                      onChange={handleNameChange}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter a descriptive name for this realm"
                    />
                  </div>

                  <div>
                    <label htmlFor="realm-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Purpose & Description
                    </label>
                    <textarea
                      id="realm-description"
                      rows={4}
                      value={description}
                      onChange={handleDescriptionChange}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                      placeholder="What is this realm for? Describe its purpose and what kind of assistance you're seeking..."
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      This is your high-level description of what this realm is for and how you want it to help you.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="system-prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        AI Context (System Prompt)
                      </label>
                      <span className={`text-xs font-medium ${
                        systemPrompt.length < 50 ? 'text-red-500' :
                        systemPrompt.length < 200 ? 'text-yellow-500' : 'text-green-500'
                      }`}>
                        {systemPrompt.length} characters
                      </span>
                    </div>
                    <textarea
                      id="system-prompt"
                      rows={10}
                      value={systemPrompt}
                      onChange={handleSystemPromptChange}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none font-mono text-sm"
                      placeholder="This is the technical context that the AI uses. It's often generated from your description and reflections..."
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      This is the detailed context that guides the AI's behavior. It's usually synthesized from your description and reflections.
                    </p>
                  </div>
                </div>
              </div>

              {/* Special Profile Section for "About Me" */}
              {realm.name === "About Me" && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Personal Profile</h2>
                  <UserProfile />
                </div>
              )}
            </div>

            {/* Right Column - Synthesis & Content */}
            <div className="space-y-6">
              {/* Tab Navigation */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setActiveTab('reflections')}
                    className={`flex-1 px-6 py-4 text-sm font-medium rounded-tl-xl transition-colors ${
                      activeTab === 'reflections'
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <MessageSquare className="w-4 h-4" />
                      <span>Reflections</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('content-sources')}
                    className={`flex-1 px-6 py-4 text-sm font-medium rounded-tr-xl transition-colors ${
                      activeTab === 'content-sources'
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Database className="w-4 h-4" />
                      <span>Content Sources</span>
                    </div>
                  </button>
                </div>
                
                <div className="p-6">
                  {activeTab === 'reflections' && (
                    <div>
                      <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Intelligent Synthesis</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Generate insights and improve your context through reflection
                        </p>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button 
                          onClick={handleGenerateQuestions}
                          disabled={isGenerating}
                          className="flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-purple-400 transition-colors"
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          {isGenerating ? 'Generating...' : 'Generate Questions'}
                        </button>
                        <button 
                          onClick={handleSynthesize}
                          disabled={isSynthesizing || answeredReflections.length === 0}
                          className="flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                          title={answeredReflections.length === 0 ? "Answer some reflections first" : "Synthesize improvements"}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          {isSynthesizing ? 'Synthesizing...' : 'Synthesize'}
                        </button>
                      </div>
                      
                      {answeredReflections.length > 0 && (
                        <div className="mt-4 text-center">
                          <Link 
                            to={`/realms/${realmId}/archive`} 
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            <Archive className="w-4 h-4 mr-2" />
                            View Answered Reflections ({answeredReflections.length})
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'content-sources' && (
                    <ContentSourcesManager 
                      realmId={realmId!} 
                      onContentChange={handleContentSourcesChange}
                    />
                  )}
                </div>
              </div>

              {/* Active Reflections Card - Only show in reflections tab */}
              {activeTab === 'reflections' && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Current Reflections
                  </h3>
                  
                  <div className="space-y-4">
                    {unansweredReflections.length > 0 ? (
                      unansweredReflections.map((reflection) => (
                        <div key={reflection.id} className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {reflection.question}
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Share your thoughts..."
                            defaultValue={reflection.answer || ""}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            onChange={(e) => handleAnswerChange(reflection.id, e.target.value)}
                          />
                        </div>
                      ))
                    ) : reflections.length > 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                          All caught up!
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          You've answered all current reflection questions.
                        </p>
                        <button
                          onClick={handleGenerateQuestions}
                          disabled={isGenerating}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-purple-400 transition-colors"
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          Generate More Questions
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                          No reflections yet
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          Generate thoughtful questions to deepen your realm's understanding.
                        </p>
                        <button
                          onClick={handleGenerateQuestions}
                          disabled={isGenerating}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-purple-400 transition-colors"
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          {isGenerating ? 'Generating...' : 'Generate First Questions'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <DiffViewerModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        oldText={previousPrompt}
        newText={systemPrompt}
      />
    </div>
  );
} 