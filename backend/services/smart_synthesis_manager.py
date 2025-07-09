import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from supabase import Client
import json
import uuid

from backend.models.schemas import ContentSource, SynthesisType, SourceType
from backend.services.synthesis_engine import AdvancedSynthesisEngine

logger = logging.getLogger(__name__)

class SmartSynthesisManager:
    """
    Intelligent synthesis manager that minimizes token usage through:
    1. Incremental content processing
    2. Smart trigger detection
    3. Batch processing
    4. Change impact analysis
    """
    
    def __init__(self, db: Client):
        self.db = db
        self.synthesis_engine = AdvancedSynthesisEngine(db)
        
        # Thresholds for triggering re-synthesis
        self.SIGNIFICANT_CONTENT_THRESHOLD = 0.3  # 30% content change
        self.HIGH_WEIGHT_THRESHOLD = 3.0  # High-importance content
        self.BATCH_SIZE_THRESHOLD = 5  # Process in batches of 5+ changes
        self.TIME_THRESHOLD_HOURS = 24  # Auto-synthesis every 24 hours max
    
    async def add_content_source(
        self, 
        realm_id: str, 
        content_source_data: dict,
        auto_synthesize: bool = False
    ) -> Tuple[ContentSource, bool]:
        """
        Add content source with intelligent synthesis triggering.
        
        Returns: (content_source, synthesis_triggered)
        """
        # Check if synthesis is disabled for this realm (prevents recursion)
        realm_check = self.db.table("realms").select("synthesis_disabled").eq("id", realm_id).single().execute()
        if realm_check.data and realm_check.data.get("synthesis_disabled"):
            logger.info(f"Synthesis disabled for realm {realm_id} - preventing auto-synthesis")
            auto_synthesize = False
        
        # Create the content source
        source_id = str(uuid.uuid4())
        new_source_data = {
            "id": source_id,
            "realm_id": realm_id,
            "source_type": content_source_data["source_type"],
            "title": content_source_data.get("title"),
            "content": content_source_data["content"],
            "metadata": content_source_data.get("metadata", {}),
            "weight": content_source_data.get("weight", 1.0),
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Store in database
        response = self.db.table("content_sources").insert(new_source_data).execute()
        content_source = ContentSource(**response.data[0])
        
        # Lightweight content analysis (not full synthesis)
        await self._lightweight_content_analysis(content_source)
        
        # Check if synthesis should be triggered
        synthesis_triggered = False
        if auto_synthesize:
            should_synthesize = await self._should_trigger_synthesis(realm_id, content_source)
            if should_synthesize:
                # Use incremental synthesis instead of full
                await self._trigger_incremental_synthesis(realm_id, [source_id])
                synthesis_triggered = True
            else:
                # Queue for batch processing
                await self._queue_for_batch_processing(realm_id, source_id)
        
        logger.info(f"Added content source {source_id} to realm {realm_id}. Synthesis triggered: {synthesis_triggered}")
        return content_source, synthesis_triggered
    
    async def _lightweight_content_analysis(self, content_source: ContentSource) -> Dict[str, Any]:
        """
        Perform lightweight analysis of individual content without full synthesis.
        Uses simple heuristics instead of expensive AI calls.
        """
        content = content_source.content.lower()
        
        # Simple keyword-based analysis (no AI tokens used)
        themes = []
        if any(word in content for word in ["work", "job", "career", "professional"]):
            themes.append("professional")
        if any(word in content for word in ["learn", "study", "education", "knowledge"]):
            themes.append("learning")
        if any(word in content for word in ["goal", "aspiration", "dream", "want to"]):
            themes.append("goals")
        if any(word in content for word in ["value", "believe", "principle", "important"]):
            themes.append("values")
        
        # Simple persona trait detection
        traits = []
        if any(word in content for word in ["detail", "precise", "accurate", "careful"]):
            traits.append("detail-oriented")
        if any(word in content for word in ["creative", "innovative", "artistic", "design"]):
            traits.append("creative")
        if any(word in content for word in ["help", "support", "assist", "collaborate"]):
            traits.append("collaborative")
        
        analysis = {
            "themes": themes,
            "traits": traits,
            "content_length": len(content_source.content),
            "importance_indicators": len([w for w in ["important", "key", "essential", "critical"] if w in content]),
            "analyzed_at": datetime.utcnow().isoformat()
        }
        
        # Store lightweight analysis in metadata
        update_data = {
            "metadata": {**content_source.metadata, "lightweight_analysis": analysis}
        }
        self.db.table("content_sources").update(update_data).eq("id", content_source.id).execute()
        
        return analysis
    
    async def _should_trigger_synthesis(self, realm_id: str, new_content: ContentSource) -> bool:
        """
        Determine if new content warrants immediate synthesis.
        Uses heuristics to avoid unnecessary AI calls.
        """
        # Always synthesize high-weight content
        if new_content.weight >= self.HIGH_WEIGHT_THRESHOLD:
            logger.info(f"Triggering synthesis for high-weight content (weight: {new_content.weight})")
            return True
        
        # Check when last synthesis occurred
        realm = self.db.table("realms").select("last_synthesis_at").eq("id", realm_id).single().execute()
        if realm.data and realm.data.get("last_synthesis_at"):
            last_synthesis = datetime.fromisoformat(realm.data["last_synthesis_at"].replace("Z", "+00:00"))
            hours_since_last = (datetime.utcnow() - last_synthesis.replace(tzinfo=None)).total_seconds() / 3600
            
            # Don't trigger if synthesized recently (unless high importance)
            if hours_since_last < 1 and new_content.weight < 2.5:
                logger.info("Skipping synthesis - too recent and content not high priority")
                return False
        
        # Check content change significance
        total_content_length = await self._get_total_content_length(realm_id)
        new_content_ratio = len(new_content.content) / max(total_content_length, 1)
        
        if new_content_ratio >= self.SIGNIFICANT_CONTENT_THRESHOLD:
            logger.info(f"Triggering synthesis for significant content change ({new_content_ratio:.2%})")
            return True
        
        # Check pending changes
        pending_changes = await self._get_pending_batch_size(realm_id)
        if pending_changes >= self.BATCH_SIZE_THRESHOLD:
            logger.info(f"Triggering synthesis for batch threshold ({pending_changes} pending)")
            return True
        
        return False
    
    async def _trigger_incremental_synthesis(self, realm_id: str, new_source_ids: List[str]) -> str:
        """
        Run incremental synthesis focusing only on new content.
        Much more efficient than full synthesis.
        """
        logger.info(f"Running incremental synthesis for realm {realm_id}")
        
        # Get existing prompt
        realm = self.db.table("realms").select("system_prompt, current_version").eq("id", realm_id).single().execute()
        existing_prompt = realm.data.get("system_prompt", "") if realm.data else ""
        current_version = realm.data.get("current_version", 1) if realm.data else 1
        
        # Get only the new content sources
        new_sources = []
        for source_id in new_source_ids:
            source_response = self.db.table("content_sources").select("*").eq("id", source_id).single().execute()
            if source_response.data:
                new_sources.append(ContentSource(**source_response.data))
        
        if not new_sources:
            return existing_prompt
        
        # Use AI only for integrating new content into existing prompt (much cheaper)
        integration_prompt = f"""
        You are updating an existing AI assistant system prompt by integrating new content.
        
        EXISTING PROMPT:
        {existing_prompt}
        
        NEW CONTENT TO INTEGRATE:
        {self._format_sources_for_integration(new_sources)}
        
        Instructions:
        1. Identify key information from the new content
        2. Seamlessly integrate it into the existing prompt
        3. Maintain the original tone and structure
        4. Don't repeat existing information
        5. Keep the update concise
        
        Return only the updated system prompt.
        """
        
        try:
            response = await self.synthesis_engine.model.generate_content_async(integration_prompt)
            updated_prompt = response.text.strip()
            
            # Update realm
            update_data = {
                "system_prompt": updated_prompt,
                "last_synthesis_at": datetime.utcnow().isoformat(),
                "current_version": current_version + 1
            }
            self.db.table("realms").update(update_data).eq("id", realm_id).execute()
            
            # Clear pending batch for this realm
            await self._clear_batch_queue(realm_id)
            
            logger.info(f"Incremental synthesis completed for realm {realm_id}")
            return updated_prompt
            
        except Exception as e:
            logger.error(f"Incremental synthesis failed: {e}")
            return existing_prompt
    
    async def _queue_for_batch_processing(self, realm_id: str, source_id: str):
        """Queue content for batch processing instead of immediate synthesis."""
        # Store in a simple queue table or Redis in production
        queue_entry = {
            "id": str(uuid.uuid4()),
            "realm_id": realm_id,
            "content_source_id": source_id,
            "queued_at": datetime.utcnow().isoformat(),
            "processed": False
        }
        
        # For now, store in a simple table
        try:
            self.db.table("synthesis_queue").insert(queue_entry).execute()
            logger.info(f"Queued content source {source_id} for batch processing")
        except Exception as e:
            logger.warning(f"Could not queue for batch processing: {e}")
    
    async def process_batch_queue(self, realm_id: str) -> bool:
        """Process queued content sources in batches."""
        logger.info(f"Processing batch queue for realm {realm_id}")
        
        # Get pending items
        pending = self.db.table("synthesis_queue").select("*").eq("realm_id", realm_id).eq("processed", False).execute()
        
        if not pending.data or len(pending.data) < 2:  # No point batching small changes
            return False
        
        source_ids = [item["content_source_id"] for item in pending.data]
        
        # Run incremental synthesis
        await self._trigger_incremental_synthesis(realm_id, source_ids)
        
        # Mark as processed
        queue_ids = [item["id"] for item in pending.data]
        for queue_id in queue_ids:
            self.db.table("synthesis_queue").update({"processed": True}).eq("id", queue_id).execute()
        
        return True
    
    async def force_full_synthesis(self, realm_id: str) -> str:
        """
        Force a full synthesis when explicitly requested.
        This is the expensive operation that users trigger manually.
        """
        logger.info(f"Running FULL synthesis for realm {realm_id} (user-triggered)")
        
        # Get all content sources
        sources_response = self.db.table("content_sources").select("*").eq("realm_id", realm_id).execute()
        if not sources_response.data:
            raise ValueError("No content sources found for full synthesis")
        
        content_sources = [ContentSource(**source) for source in sources_response.data]
        
        # Run the full 4-stage synthesis (expensive)
        synthesized_prompt, analysis = await self.synthesis_engine.run_full_synthesis(
            realm_id, 
            synthesis_type=SynthesisType.FULL
        )
        
        return synthesized_prompt
    
    # Helper methods
    async def _get_total_content_length(self, realm_id: str) -> int:
        """Get total character count of all content in realm."""
        response = self.db.table("content_sources").select("content").eq("realm_id", realm_id).execute()
        return sum(len(item.get("content", "")) for item in (response.data or []))
    
    async def _get_pending_batch_size(self, realm_id: str) -> int:
        """Get count of pending items in batch queue."""
        try:
            response = self.db.table("synthesis_queue").select("id").eq("realm_id", realm_id).eq("processed", False).execute()
            return len(response.data or [])
        except:
            return 0
    
    async def _clear_batch_queue(self, realm_id: str):
        """Clear processed items from batch queue."""
        try:
            self.db.table("synthesis_queue").update({"processed": True}).eq("realm_id", realm_id).execute()
        except Exception as e:
            logger.warning(f"Could not clear batch queue: {e}")
    
    def _format_sources_for_integration(self, sources: List[ContentSource]) -> str:
        """Format sources for incremental integration."""
        formatted = []
        for source in sources:
            formatted.append(f"""
            {source.source_type.upper()} (Weight: {source.weight})
            {source.title or 'Untitled'}
            {source.content}
            """)
        return "\n---\n".join(formatted) 