import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import google.generativeai as genai
from supabase import Client

from backend.models.schemas import (
    ContentSource, SynthesisMethod, SynthesisType, 
    ContentAnalysisResponse, QualityAssessmentResponse
)
from backend.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure the Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)

class AdvancedSynthesisEngine:
    """
    Multi-stage synthesis engine that transforms content sources into 
    sophisticated system prompts through intelligent analysis and engineering.
    """
    
    def __init__(self, db: Client):
        self.db = db
        self.model = genai.GenerativeModel('gemini-2.5-flash')
    
    async def analyze_content_sources(
        self, 
        content_sources: List[ContentSource],
        realm_name: str,
        existing_prompt: Optional[str] = None
    ) -> ContentAnalysisResponse:
        """
        Stage 1: Analyze content sources to extract themes, patterns, and insights.
        """
        logger.info(f"Analyzing {len(content_sources)} content sources for realm '{realm_name}'")
        
        # Prepare content for analysis
        content_analysis_input = self._prepare_content_for_analysis(content_sources)
        
        analysis_prompt = f"""
        You are an expert content analyst specializing in personal profiling and AI system design.
        
        Analyze the following content sources for the "{realm_name}" realm to extract:
        1. Major themes and topics
        2. Personal traits, characteristics, and behavioral patterns  
        3. Values, beliefs, and worldview elements
        4. Content gaps and missing information areas
        5. Quality assessment of the content collection
        
        Existing context: {existing_prompt or "No existing prompt"}
        
        Content Sources:
        {content_analysis_input}
        
        Return analysis as JSON with this exact structure:
        {{
            "themes": ["theme1", "theme2", ...],
            "persona_traits": ["trait1", "trait2", ...],
            "content_gaps": ["gap1", "gap2", ...],
            "quality_score": 0.85,
            "suggestions": ["suggestion1", "suggestion2", ...]
        }}
        
        Focus on actionable insights that would help an AI assistant provide more personalized responses.
        """
        
        try:
            response = await self.model.generate_content_async(analysis_prompt)
            analysis_text = response.text.strip()
            
            # Clean and parse JSON response
            cleaned_response = analysis_text.replace("```json", "").replace("```", "").strip()
            analysis_data = json.loads(cleaned_response)
            
            return ContentAnalysisResponse(**analysis_data)
            
        except Exception as e:
            logger.error(f"Error analyzing content sources: {e}")
            # Return fallback analysis
            return ContentAnalysisResponse(
                themes=["General information"],
                persona_traits=["User information available"],
                content_gaps=["Analysis failed - manual review needed"],
                quality_score=0.5,
                suggestions=["Re-run analysis with valid content"]
            )
    
    async def extract_persona_profile(
        self, 
        content_sources: List[ContentSource],
        analysis: ContentAnalysisResponse,
        realm_name: str
    ) -> Dict[str, Any]:
        """
        Stage 2: Extract detailed persona profile from analyzed content.
        """
        logger.info(f"Extracting persona profile for realm '{realm_name}'")
        
        # Weight content by importance and recency
        weighted_content = self._weight_content_sources(content_sources)
        
        persona_prompt = f"""
        Based on the content analysis, create a detailed persona profile for the "{realm_name}" realm.
        
        Analysis Results:
        - Themes: {', '.join(analysis.themes)}
        - Traits: {', '.join(analysis.persona_traits)}
        - Quality Score: {analysis.quality_score}
        
        Weighted Content Sources:
        {weighted_content}
        
        Extract a persona profile with these categories:
        1. Core Identity (who they are fundamentally)
        2. Values & Beliefs (what drives them)
        3. Communication Style (how they prefer to interact)
        4. Goals & Aspirations (what they're working toward)
        5. Context & Background (relevant life details)
        6. Preferences & Patterns (behavioral tendencies)
        
        Return as structured JSON:
        {{
            "core_identity": "description",
            "values_beliefs": ["value1", "value2"],
            "communication_style": "description",
            "goals_aspirations": ["goal1", "goal2"],
            "context_background": "description",
            "preferences_patterns": ["pattern1", "pattern2"]
        }}
        
        Be specific and actionable - focus on details that would help an AI provide better responses.
        """
        
        try:
            response = await self.model.generate_content_async(persona_prompt)
            persona_text = response.text.strip()
            
            cleaned_response = persona_text.replace("```json", "").replace("```", "").strip()
            persona_data = json.loads(cleaned_response)
            
            return persona_data
            
        except Exception as e:
            logger.error(f"Error extracting persona profile: {e}")
            return {
                "core_identity": "User profile extraction failed",
                "values_beliefs": ["Manual review needed"],
                "communication_style": "Standard interaction style",
                "goals_aspirations": ["Profile completion needed"],
                "context_background": "Limited information available",
                "preferences_patterns": ["Analysis incomplete"]
            }
    
    async def engineer_system_prompt(
        self,
        persona_profile: Dict[str, Any],
        analysis: ContentAnalysisResponse,
        realm_name: str,
        existing_prompt: Optional[str] = None
    ) -> str:
        """
        Stage 3: Engineer a sophisticated system prompt from the persona profile.
        """
        logger.info(f"Engineering system prompt for realm '{realm_name}'")
        
        prompt_engineering_prompt = f"""
        You are an expert prompt engineer specializing in creating personalized AI system prompts.
        
        Create a sophisticated system prompt for the "{realm_name}" realm using this persona profile:
        
        Core Identity: {persona_profile.get('core_identity', '')}
        Values & Beliefs: {persona_profile.get('values_beliefs', [])}
        Communication Style: {persona_profile.get('communication_style', '')}
        Goals & Aspirations: {persona_profile.get('goals_aspirations', [])}
        Context & Background: {persona_profile.get('context_background', '')}
        Preferences & Patterns: {persona_profile.get('preferences_patterns', [])}
        
        Quality Score: {analysis.quality_score}
        Content Gaps: {analysis.content_gaps}
        
        Existing Prompt: {existing_prompt or "None"}
        
        Engineering Guidelines:
        1. Write in a natural, conversational tone
        2. Include specific details that enable personalized responses
        3. Focus on actionable context, not generic statements
        4. Keep it concise but comprehensive (200-400 words)
        5. Avoid overly complimentary language
        6. Structure for easy AI comprehension
        
        The prompt should help an AI assistant:
        - Understand the user's context and background
        - Adapt communication style to user preferences  
        - Provide relevant and personalized responses
        - Recognize important themes and topics for this user
        
        Return ONLY the engineered system prompt text, no JSON or markup.
        """
        
        try:
            response = await self.model.generate_content_async(prompt_engineering_prompt)
            engineered_prompt = response.text.strip()
            
            # Clean up any unwanted formatting
            engineered_prompt = engineered_prompt.replace("```", "").strip()
            
            return engineered_prompt
            
        except Exception as e:
            logger.error(f"Error engineering system prompt: {e}")
            return f"This realm contains information about {realm_name}. The user's profile and preferences are being developed through ongoing interactions and content analysis."
    
    async def assess_prompt_quality(
        self,
        system_prompt: str,
        persona_profile: Dict[str, Any],
        content_sources: List[ContentSource],
        realm_name: str
    ) -> QualityAssessmentResponse:
        """
        Stage 4: Assess the quality of the generated system prompt.
        """
        logger.info(f"Assessing prompt quality for realm '{realm_name}'")
        
        quality_prompt = f"""
        Evaluate the quality of this system prompt for the "{realm_name}" realm:
        
        SYSTEM PROMPT:
        ---
        {system_prompt}
        ---
        
        ORIGINAL PERSONA PROFILE:
        {json.dumps(persona_profile, indent=2)}
        
        CONTENT SOURCES COUNT: {len(content_sources)}
        
        Assess the prompt on these dimensions (0.0 to 1.0):
        
        1. COHERENCE: Does the prompt flow well and make logical sense?
        2. COMPLETENESS: Does it capture the key aspects of the persona?
        3. EFFECTIVENESS: Would this help an AI provide better responses?
        4. SPECIFICITY: Are there concrete, actionable details?
        5. CONCISENESS: Is it well-structured and appropriately sized?
        
        Also identify:
        - Key strengths of the prompt
        - Areas for improvement
        - Specific suggestions for enhancement
        
        Return assessment as JSON:
        {{
            "coherence_score": 0.85,
            "completeness_score": 0.78,
            "effectiveness_score": 0.82,
            "overall_quality": 0.82,
            "improvement_suggestions": ["suggestion1", "suggestion2"],
            "strengths": ["strength1", "strength2"],
            "weaknesses": ["weakness1", "weakness2"]
        }}
        """
        
        try:
            response = await self.model.generate_content_async(quality_prompt)
            quality_text = response.text.strip()
            
            cleaned_response = quality_text.replace("```json", "").replace("```", "").strip()
            quality_data = json.loads(cleaned_response)
            
            return QualityAssessmentResponse(**quality_data)
            
        except Exception as e:
            logger.error(f"Error assessing prompt quality: {e}")
            return QualityAssessmentResponse(
                coherence_score=0.5,
                completeness_score=0.5,
                effectiveness_score=0.5,
                overall_quality=0.5,
                improvement_suggestions=["Quality assessment failed - manual review needed"],
                strengths=["Basic prompt structure"],
                weaknesses=["Assessment incomplete"]
            )
    
    async def run_full_synthesis(
        self,
        realm_id: str,
        content_source_ids: Optional[List[str]] = None,
        synthesis_type: SynthesisType = SynthesisType.FULL
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Run the complete multi-stage synthesis process.
        
        Returns: (synthesized_prompt, quality_analysis)
        """
        start_time = datetime.utcnow()
        
        # Get realm information
        realm_response = self.db.table("realms").select("*").eq("id", realm_id).single().execute()
        if not realm_response.data:
            raise ValueError(f"Realm {realm_id} not found")
        
        realm = realm_response.data
        realm_name = realm["name"]
        existing_prompt = realm.get("system_prompt")
        
        logger.info(f"Starting full synthesis for realm '{realm_name}' (ID: {realm_id})")
        
        # Get content sources
        if content_source_ids:
            # Use specific content sources
            content_sources = []
            for source_id in content_source_ids:
                source_response = self.db.table("content_sources").select("*").eq("id", source_id).single().execute()
                if source_response.data:
                    content_sources.append(ContentSource(**source_response.data))
        else:
            # Use all content sources for the realm
            sources_response = self.db.table("content_sources").select("*").eq("realm_id", realm_id).execute()
            content_sources = [ContentSource(**source) for source in (sources_response.data or [])]
        
        if not content_sources:
            raise ValueError(f"No content sources found for realm {realm_id}")
        
        # Stage 1: Content Analysis
        analysis = await self.analyze_content_sources(content_sources, realm_name, existing_prompt)
        
        # Stage 2: Persona Extraction
        persona_profile = await self.extract_persona_profile(content_sources, analysis, realm_name)
        
        # Stage 3: Prompt Engineering
        synthesized_prompt = await self.engineer_system_prompt(persona_profile, analysis, realm_name, existing_prompt)
        
        # Stage 4: Quality Assessment
        quality_assessment = await self.assess_prompt_quality(synthesized_prompt, persona_profile, content_sources, realm_name)
        
        # Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        # Compile comprehensive analysis
        comprehensive_analysis = {
            "content_analysis": analysis.model_dump(),
            "persona_profile": persona_profile,
            "quality_assessment": quality_assessment.model_dump(),
            "synthesis_metadata": {
                "method": SynthesisMethod.ADVANCED.value,
                "content_sources_count": len(content_sources),
                "content_source_ids": [cs.id for cs in content_sources],
                "processing_time_ms": int(processing_time),
                "synthesis_type": synthesis_type.value,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        logger.info(f"Completed synthesis for realm '{realm_name}' in {processing_time:.0f}ms")
        
        return synthesized_prompt, comprehensive_analysis
    
    def _prepare_content_for_analysis(self, content_sources: List[ContentSource]) -> str:
        """Prepare content sources for analysis with proper formatting and weighting."""
        formatted_content = []
        
        for source in content_sources:
            # Format each source with metadata
            source_text = f"""
            SOURCE: {source.source_type.upper()} (Weight: {source.weight})
            Title: {source.title or 'Untitled'}
            Content: {source.content}
            Metadata: {json.dumps(source.metadata, indent=2) if source.metadata else 'None'}
            ---
            """
            formatted_content.append(source_text)
        
        return "\n".join(formatted_content)
    
    def _weight_content_sources(self, content_sources: List[ContentSource]) -> str:
        """Apply weighting to content sources for persona extraction."""
        # Sort by weight (highest first) and format
        sorted_sources = sorted(content_sources, key=lambda x: x.weight, reverse=True)
        
        weighted_content = []
        for source in sorted_sources:
            importance_indicator = "🔥" if source.weight >= 3.0 else "⭐" if source.weight >= 2.0 else "📝"
            
            weighted_text = f"""
            {importance_indicator} {source.source_type.upper()} (Weight: {source.weight})
            {source.title or 'Untitled'}
            {source.content}
            """
            weighted_content.append(weighted_text)
        
        return "\n---\n".join(weighted_content) 