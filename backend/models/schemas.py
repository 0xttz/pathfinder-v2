from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
from enum import Enum

# Enums for better type safety
class SourceType(str, Enum):
    REFLECTION = "reflection"
    TEXT = "text"
    CONVERSATION = "conversation"
    DOCUMENT = "document"
    STRUCTURED = "structured"

class SynthesisMethod(str, Enum):
    QA_SYNTHESIS = "qa_synthesis"
    TEXT_INTEGRATION = "text_integration"
    HYBRID = "hybrid"
    ADVANCED = "advanced"
    LEGACY = "legacy"

class SynthesisJobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class SynthesisType(str, Enum):
    FULL = "full"
    INCREMENTAL = "incremental"
    QUALITY_IMPROVEMENT = "quality_improvement"

# Enhanced Realm Models
class RealmCreate(BaseModel):
    name: str
    description: Optional[str] = None
    system_prompt: Optional[str] = None

class RealmUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None

class Realm(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    current_version: Optional[int] = 1
    quality_score: Optional[float] = None
    last_synthesis_at: Optional[datetime] = None
    created_at: datetime

# Content Source Models
class ContentSourceCreate(BaseModel):
    realm_id: Optional[str] = None
    source_type: SourceType
    title: Optional[str] = None
    content: str
    metadata: Optional[Dict[str, Any]] = {}
    weight: Optional[float] = 1.0

class ContentSourceUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    weight: Optional[float] = None

class ContentSource(BaseModel):
    id: str
    realm_id: Optional[str] = None
    source_type: SourceType
    title: Optional[str] = None
    content: str
    metadata: Dict[str, Any] = {}
    weight: float = 1.0
    last_used_at: Optional[datetime] = None
    created_at: datetime

# Prompt Version Models
class PromptVersionCreate(BaseModel):
    realm_id: str
    version_number: int
    content: str
    synthesis_method: SynthesisMethod
    quality_score: Optional[float] = None
    effectiveness_metrics: Optional[Dict[str, Any]] = {}
    improvement_suggestions: Optional[List[str]] = []

class PromptVersion(BaseModel):
    id: str
    realm_id: str
    version_number: int
    content: str
    synthesis_method: SynthesisMethod
    quality_score: Optional[float] = None
    effectiveness_metrics: Optional[Dict[str, Any]] = {}
    improvement_suggestions: Optional[List[str]] = []
    created_at: datetime

# Synthesis Job Models
class SynthesisJobCreate(BaseModel):
    realm_id: str
    synthesis_type: SynthesisType = SynthesisType.FULL
    input_sources: List[str] = []  # List of content source IDs
    configuration: Dict[str, Any] = {}

class SynthesisJobUpdate(BaseModel):
    status: SynthesisJobStatus
    result_prompt: Optional[str] = None
    quality_analysis: Optional[Dict[str, Any]] = None
    processing_time_ms: Optional[int] = None
    error_message: Optional[str] = None

class SynthesisJob(BaseModel):
    id: str
    realm_id: str
    status: SynthesisJobStatus = SynthesisJobStatus.PENDING
    synthesis_type: SynthesisType
    input_sources: List[str] = []
    configuration: Dict[str, Any] = {}
    result_prompt: Optional[str] = None
    quality_analysis: Optional[Dict[str, Any]] = None
    processing_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime

# Conversation Metrics Models
class ConversationMetricsCreate(BaseModel):
    chat_id: str
    realm_id: str
    prompt_version: Optional[int] = None
    user_satisfaction_score: Optional[int] = None  # 1-5
    response_relevance_score: Optional[float] = None  # 0-1
    context_usage_analysis: Dict[str, Any] = {}
    improvement_suggestions: List[str] = []

class ConversationMetrics(BaseModel):
    id: str
    chat_id: str
    realm_id: str
    prompt_version: Optional[int] = None
    user_satisfaction_score: Optional[int] = None
    response_relevance_score: Optional[float] = None
    context_usage_analysis: Dict[str, Any] = {}
    improvement_suggestions: List[str] = []
    created_at: datetime

# Existing Models (Enhanced)
class ChatCreate(BaseModel):
    realm_id: Optional[str] = None
    title: Optional[str] = None

class Chat(BaseModel):
    id: str
    realm_id: Optional[str] = None
    title: Optional[str] = None
    created_at: datetime

class ChatUpdate(BaseModel):
    title: str

class MessageCreate(BaseModel):
    content: str
    role: str = "user"

class Message(BaseModel):
    id: str
    chat_id: str
    role: str
    content: str
    created_at: datetime

# Enhanced Reflection Models
class ReflectionCreate(BaseModel):
    realm_id: str
    question: str
    answer: Optional[str] = None
    category: Optional[str] = None
    importance_score: Optional[float] = 1.0

class ReflectionUpdate(BaseModel):
    answer: Optional[str] = None
    category: Optional[str] = None
    importance_score: Optional[float] = None

class Reflection(BaseModel):
    id: uuid.UUID
    realm_id: uuid.UUID
    question: str
    answer: Optional[str] = None
    category: Optional[str] = None
    importance_score: Optional[float] = 1.0
    last_synthesized_at: Optional[datetime] = None
    created_at: datetime

# Enhanced Text Models
class TextCreate(BaseModel):
    title: str
    content: str
    source_file_name: Optional[str] = None

class TextUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    source_file_name: Optional[str] = None
    processing_metadata: Optional[Dict[str, Any]] = None
    synthesis_history: Optional[List[str]] = None

class Text(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    source_file_name: Optional[str] = None
    processing_metadata: Optional[Dict[str, Any]] = {}
    synthesis_history: Optional[List[str]] = []
    created_at: datetime

# Synthesis and Analysis Response Models
class SynthesisRequest(BaseModel):
    realm_id: str

class SynthesisResponse(BaseModel):
    synthesized_prompt: str

class AdvancedSynthesisRequest(BaseModel):
    realm_id: str
    synthesis_type: SynthesisType = SynthesisType.FULL
    content_source_ids: Optional[List[str]] = None
    configuration: Dict[str, Any] = {}

class AdvancedSynthesisResponse(BaseModel):
    job_id: str
    status: SynthesisJobStatus
    estimated_completion_seconds: Optional[int] = None

class ContentAnalysisResponse(BaseModel):
    themes: List[str]
    persona_traits: List[str]
    content_gaps: List[str]
    quality_score: float
    suggestions: List[str]

class QualityAssessmentResponse(BaseModel):
    coherence_score: float
    completeness_score: float
    effectiveness_score: float
    overall_quality: float
    improvement_suggestions: List[str]
    strengths: List[str]
    weaknesses: List[str] 

# Realm Onboarding Models
class RealmTemplate(BaseModel):
    id: str
    name: str
    description: str
    example_description: str
    system_prompt_template: str
    suggested_questions: List[str]
    tags: List[str]

class GeneratePromptRequest(BaseModel):
    realm_name: str
    realm_description: str
    realm_type: Optional[str] = None  # e.g., "personal", "professional", "creative"
    tone: Optional[str] = "professional"  # "professional", "casual", "friendly"
    expertise_level: Optional[str] = "intermediate"  # "beginner", "intermediate", "expert"
    additional_context: Optional[str] = None

class GeneratePromptResponse(BaseModel):
    system_prompt: str
    suggested_improvements: List[str]
    quality_score: float
    estimated_effectiveness: str

class OnboardingRequest(BaseModel):
    name: str
    description: str
    template_id: Optional[str] = None
    generation_config: Optional[GeneratePromptRequest] = None

class OnboardingResponse(BaseModel):
    realm: Realm
    generated_prompt: str
    suggested_questions: List[str]
    next_steps: List[str] 