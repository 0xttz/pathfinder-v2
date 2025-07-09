import { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles, Wand2, CheckCircle, Target, Brain, Lightbulb, Users, Heart, BookOpen } from 'lucide-react';

interface RealmTemplate {
  id: string;
  name: string;
  description: string;
  example_description: string;
  system_prompt_template: string;
  suggested_questions: string[];
  tags: string[];
}

interface GeneratePromptRequest {
  realm_name: string;
  realm_description: string;
  realm_type?: string;
  tone?: string;
  expertise_level?: string;
  additional_context?: string;
}

interface GeneratePromptResponse {
  system_prompt: string;
  suggested_improvements: string[];
  quality_score: number;
  estimated_effectiveness: string;
}

interface OnboardingResponse {
  realm: {
    id: string;
    name: string;
    description: string;
    system_prompt: string;
  };
  generated_prompt: string;
  suggested_questions: string[];
  next_steps: string[];
}

interface RealmOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (realmId: string) => void;
}

type Step = 'choose-method' | 'select-template' | 'custom-setup' | 'customize-prompt' | 'review' | 'complete';

const TEMPLATE_ICONS: Record<string, any> = {
  'personal-assistant': Target,
  'creative-collaborator': Lightbulb,
  'professional-advisor': Users,
  'learning-companion': BookOpen,
  'wellness-coach': Heart
};

export function RealmOnboardingModal({ isOpen, onClose, onComplete }: RealmOnboardingModalProps) {
  const [step, setStep] = useState<Step>('choose-method');
  const [templates, setTemplates] = useState<RealmTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<RealmTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form data
  const [realmName, setRealmName] = useState('');
  const [realmDescription, setRealmDescription] = useState('');
  const [realmType, setRealmType] = useState('general');
  const [tone, setTone] = useState('professional');
  const [expertiseLevel, setExpertiseLevel] = useState('intermediate');
  const [additionalContext, setAdditionalContext] = useState('');
  
  // Generated content
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [qualityScore, setQualityScore] = useState(0);
  const [effectiveness, setEffectiveness] = useState('');
  const [improvements, setImprovements] = useState<string[]>([]);
  const [finalResult, setFinalResult] = useState<OnboardingResponse | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    } else {
      // Reset state when modal closes
      setStep('choose-method');
      setSelectedTemplate(null);
      setRealmName('');
      setRealmDescription('');
      setGeneratedPrompt('');
      setFinalResult(null);
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('http://localhost:8000/realm-templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const handleGeneratePrompt = async () => {
    if (!realmName || !realmDescription) return;
    
    setIsLoading(true);
    try {
      const request: GeneratePromptRequest = {
        realm_name: realmName,
        realm_description: realmDescription,
        realm_type: realmType,
        tone,
        expertise_level: expertiseLevel,
        additional_context: additionalContext || undefined
      };

      const response = await fetch('http://localhost:8000/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (response.ok) {
        const data: GeneratePromptResponse = await response.json();
        setGeneratedPrompt(data.system_prompt);
        setQualityScore(data.quality_score);
        setEffectiveness(data.estimated_effectiveness);
        setImprovements(data.suggested_improvements);
        setStep('customize-prompt');
      }
    } catch (error) {
      console.error('Failed to generate prompt:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRealm = async () => {
    setIsLoading(true);
    try {
      const request = {
        name: realmName,
        description: realmDescription,
        template_id: selectedTemplate?.id,
        generation_config: selectedTemplate ? undefined : {
          realm_name: realmName,
          realm_description: realmDescription,
          realm_type: realmType,
          tone,
          expertise_level: expertiseLevel,
          additional_context: additionalContext || undefined
        }
      };

      const response = await fetch('http://localhost:8000/realms/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (response.ok) {
        const data: OnboardingResponse = await response.json();
        setFinalResult(data);
        setStep('complete');
      }
    } catch (error) {
      console.error('Failed to create realm:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = (template: RealmTemplate) => {
    setSelectedTemplate(template);
    setRealmName(template.name);
    setRealmDescription(template.example_description);
    setStep('review');
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getQualityBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create New Realm</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {step === 'choose-method' && 'Choose how you\'d like to create your realm'}
              {step === 'select-template' && 'Select a pre-designed template'}
              {step === 'custom-setup' && 'Describe your ideal AI assistant'}
              {step === 'customize-prompt' && 'Review and refine the generated context'}
              {step === 'review' && 'Review your realm configuration'}
              {step === 'complete' && 'Your realm has been created successfully!'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          
          {/* Choose Method Step */}
          {step === 'choose-method' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <Brain className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Let's create your perfect AI assistant
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Realms separate your AI's purpose from its technical implementation, making it smarter and more focused.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  onClick={() => setStep('select-template')}
                  className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-left group"
                >
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30 transition-colors">
                      <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="ml-4">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Use a Template</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Quick start with proven designs</p>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Choose from professionally designed realm templates for common use cases like personal assistance, creative collaboration, and more.
                  </p>
                </button>

                <button
                  onClick={() => setStep('custom-setup')}
                  className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-500 dark:hover:border-green-400 transition-colors text-left group"
                >
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/30 transition-colors">
                      <Wand2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="ml-4">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Custom Creation</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Build exactly what you need</p>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Describe your ideal AI assistant and we'll generate a custom realm with intelligent prompts tailored to your specific needs.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Template Selection Step */}
          {step === 'select-template' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => {
                  const IconComponent = TEMPLATE_ICONS[template.id] || Target;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-left group"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30 transition-colors">
                          <IconComponent className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            {template.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {template.description}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {template.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Setup Step */}
          {step === 'custom-setup' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Realm Name
                    </label>
                    <input
                      type="text"
                      value={realmName}
                      onChange={(e) => setRealmName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Writing Assistant, Study Buddy, Career Coach"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Realm Type
                    </label>
                    <select
                      value={realmType}
                      onChange={(e) => setRealmType(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="personal">Personal</option>
                      <option value="professional">Professional</option>
                      <option value="creative">Creative</option>
                      <option value="educational">Educational</option>
                      <option value="general">General Purpose</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Communication Tone
                    </label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="friendly">Friendly</option>
                      <option value="formal">Formal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Expertise Level
                    </label>
                    <select
                      value={expertiseLevel}
                      onChange={(e) => setExpertiseLevel(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description & Purpose
                    </label>
                    <textarea
                      rows={6}
                      value={realmDescription}
                      onChange={(e) => setRealmDescription(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Describe what you want this AI assistant to help you with. Be specific about your goals, preferences, and the kind of support you're looking for..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Additional Context (Optional)
                    </label>
                    <textarea
                      rows={4}
                      value={additionalContext}
                      onChange={(e) => setAdditionalContext(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Any specific requirements, constraints, or preferences..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                      What makes a good realm description?
                    </h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <li>• Specific goals and use cases</li>
                      <li>• Your communication preferences</li>
                      <li>• The type of help you're seeking</li>
                      <li>• Any domain expertise needed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Customize Prompt Step */}
          {step === 'customize-prompt' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Generated AI Context
                </h3>
                <div className={`flex items-center px-3 py-1 rounded-full ${getQualityBgColor(qualityScore)}`}>
                  <CheckCircle className={`w-4 h-4 mr-1 ${getQualityColor(qualityScore)}`} />
                  <span className={`text-sm font-medium ${getQualityColor(qualityScore)}`}>
                    {qualityScore}% Quality Score
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <textarea
                  rows={8}
                  value={generatedPrompt}
                  onChange={(e) => setGeneratedPrompt(e.target.value)}
                  className="w-full bg-transparent text-gray-900 dark:text-gray-100 border-none resize-none focus:outline-none font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Effectiveness Assessment
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {effectiveness}
                  </p>
                </div>

                {improvements.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Suggestions for Improvement
                    </h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {improvements.map((improvement, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                          <span>{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Review Step */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Realm Summary
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Name
                    </h4>
                    <p className="text-gray-900 dark:text-gray-100">{realmName}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Type
                    </h4>
                    <p className="text-gray-900 dark:text-gray-100">
                      {selectedTemplate ? 'Template-based' : 'Custom generated'}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </h4>
                  <p className="text-gray-900 dark:text-gray-100">{realmDescription}</p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  What happens next?
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Your realm will be created with an intelligent system prompt</li>
                  <li>• Personalized reflection questions will be generated</li>
                  <li>• You can immediately start chatting with your AI assistant</li>
                  <li>• The system will learn and improve over time through synthesis</li>
                </ul>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && finalResult && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Realm Created Successfully!
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  <strong>{finalResult.realm.name}</strong> is ready to assist you.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-left">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Next Steps
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                  {finalResult.next_steps.map((step, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          {index + 1}
                        </span>
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-700">
          <div>
            {step !== 'choose-method' && step !== 'complete' && (
              <button
                onClick={() => {
                  if (step === 'select-template') setStep('choose-method');
                  else if (step === 'custom-setup') setStep('choose-method');
                  else if (step === 'customize-prompt') setStep('custom-setup');
                  else if (step === 'review') {
                    if (selectedTemplate) setStep('select-template');
                    else setStep('customize-prompt');
                  }
                }}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {step === 'complete' && (
              <button
                onClick={() => {
                  onComplete(finalResult!.realm.id);
                  onClose();
                }}
                className="flex items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Realm
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            )}

            {step === 'custom-setup' && (
              <button
                onClick={handleGeneratePrompt}
                disabled={!realmName || !realmDescription || isLoading}
                className="flex items-center px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Generating...' : 'Generate AI Context'}
                <Wand2 className="w-4 h-4 ml-2" />
              </button>
            )}

            {(step === 'customize-prompt' || step === 'review') && (
              <button
                onClick={handleCreateRealm}
                disabled={isLoading}
                className="flex items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Creating...' : 'Create Realm'}
                <CheckCircle className="w-4 h-4 ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 