import { X, Save, Brain, Sparkles, AlertCircle, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { Realm } from "../pages/RealmsPage";

interface RealmEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (realm: { id?: string; name: string; system_prompt: string }) => void;
  realm: Realm | null;
}

export function RealmEditModal({ isOpen, onClose, onSave, realm }: RealmEditModalProps) {
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (realm) {
      setName(realm.name);
      setSystemPrompt(realm.system_prompt || "");
    } else {
      setName("");
      setSystemPrompt("");
    }
  }, [realm]);

  const getQualityScore = () => {
    const hasName = name && name.trim() !== "" && name !== "New Realm";
    const hasPrompt = systemPrompt && systemPrompt.length > 50;
    const promptLength = systemPrompt?.length || 0;
    let score = 0;
    
    if (hasName) score += 10;
    if (hasPrompt) score += 40;
    if (promptLength > 200) score += 30;
    if (promptLength > 500) score += 20;
    
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const realmData: { id?: string; name: string; system_prompt: string } = {
        name: name.trim(),
        system_prompt: systemPrompt.trim(),
      };
      if (realm?.id) {
        realmData.id = realm.id;
      }
      await onSave(realmData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  const isFormValid = name.trim() !== "";
  const qualityScore = getQualityScore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {realm ? "Edit Realm" : "Create New Realm"}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {realm ? "Refine your context for better conversations" : "Define a specialized context for focused interactions"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Quality Score */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={getQualityColor(qualityScore)}>
                  {getQualityIcon(qualityScore)}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Context Quality
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      qualityScore >= 80 ? 'bg-green-500' : 
                      qualityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${qualityScore}%` }}
                  />
                </div>
                <span className={`text-sm font-semibold ${getQualityColor(qualityScore)}`}>
                  {qualityScore}%
                </span>
              </div>
            </div>
          </div>

          {/* Name Field */}
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Realm Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Career Coach, Creative Writing, Technical Advisor"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder-gray-400 dark:placeholder-gray-500 transition-all"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Choose a clear, descriptive name that reflects the realm's purpose
            </p>
          </div>

          {/* System Prompt Field */}
          <div className="space-y-2">
            <label htmlFor="system_prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Context Definition
            </label>
            <textarea
              id="system_prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={12}
              placeholder="Define the AI's role, expertise, personality, and approach for this realm...

Example:
You are an experienced career coach with expertise in tech leadership. You provide thoughtful, strategic advice on career growth, team management, and professional development. Your responses are practical, encouraging, and based on real-world experience. You ask clarifying questions to better understand my situation and goals."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder-gray-400 dark:placeholder-gray-500 transition-all resize-none"
            />
            <div className="flex items-center justify-between text-xs">
              <p className="text-gray-500 dark:text-gray-400">
                Define role, expertise, personality, and approach for best results
              </p>
              <span className={`font-medium ${
                systemPrompt.length < 50 ? 'text-red-500' :
                systemPrompt.length < 200 ? 'text-yellow-500' : 'text-green-500'
              }`}>
                {systemPrompt.length} characters
              </span>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              💡 Tips for Effective Contexts
            </h4>
            <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Be specific about the AI's role and expertise area</li>
              <li>• Include personality traits and communication style preferences</li>
              <li>• Mention your goals and what kind of help you're seeking</li>
              <li>• Add any constraints or preferences for responses</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {realm ? "Updating" : "Creating"} realm • Press Esc to cancel • ⌘⏎ to save
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                       bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 
                       rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isFormValid || isSaving}
              className="flex items-center px-6 py-2 text-sm font-medium text-white 
                       bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 
                       disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {realm ? "Update Realm" : "Create Realm"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 