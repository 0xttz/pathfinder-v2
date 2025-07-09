import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from supabase import Client
import google.generativeai as genai

from backend.db.supabase import get_db
from backend.models.schemas import (
    ContentSource, ContentSourceCreate, ContentSourceUpdate, SourceType,
    Realm, Text, Reflection
)
from backend.core.config import settings
from backend.services.smart_synthesis_manager import SmartSynthesisManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure the Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)

router = APIRouter()

@router.get("/content-sources", response_model=List[ContentSource])
async def get_content_sources(
    realm_id: Optional[str] = Query(None, description="Filter by realm ID"),
    source_type: Optional[SourceType] = Query(None, description="Filter by source type"),
    db: Client = Depends(get_db)
):
    """Get all content sources with optional filtering."""
    query = db.table("content_sources").select("*")
    
    if realm_id:
        query = query.eq("realm_id", realm_id)
    if source_type:
        query = query.eq("source_type", source_type.value)
    
    response = query.order("created_at", desc=True).execute()
    
    if not response.data:
        return []
    
    return response.data

@router.get("/content-sources/{source_id}", response_model=ContentSource)
async def get_content_source(source_id: str, db: Client = Depends(get_db)):
    """Get a specific content source by ID."""
    response = db.table("content_sources").select("*").eq("id", source_id).single().execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Content source not found")
    
    return response.data

@router.post("/content-sources", response_model=ContentSource)
async def create_content_source(
    content_source: ContentSourceCreate,
    auto_synthesize: bool = Query(False, description="Whether to automatically trigger synthesis for this content"),
    db: Client = Depends(get_db)
):
    """
    Create a new content source with smart synthesis management.
    
    - auto_synthesize=false: Just adds content, maybe queues for batch processing
    - auto_synthesize=true: Uses intelligent triggers to decide if synthesis is needed
    """
    # Validate realm exists if provided
    if content_source.realm_id:
        realm_response = db.table("realms").select("id").eq("id", content_source.realm_id).single().execute()
        if not realm_response.data:
            raise HTTPException(status_code=404, detail="Realm not found")
    
    # Use SmartSynthesisManager for intelligent processing
    smart_manager = SmartSynthesisManager(db)
    
    content_data = {
        "source_type": content_source.source_type.value,
        "title": content_source.title,
        "content": content_source.content,
        "metadata": content_source.metadata or {},
        "weight": content_source.weight or 1.0
    }
    
    try:
        created_source, synthesis_triggered = await smart_manager.add_content_source(
            content_source.realm_id,
            content_data,
            auto_synthesize=auto_synthesize
        )
        
        response_data = created_source.model_dump()
        response_data["synthesis_triggered"] = synthesis_triggered
        
        if synthesis_triggered:
            logger.info(f"Content source {created_source.id} triggered automatic synthesis")
        else:
            logger.info(f"Content source {created_source.id} added without synthesis (queued or low priority)")
        
        return response_data
        
    except Exception as e:
        logger.error(f"Error creating content source: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create content source: {str(e)}")

@router.put("/content-sources/{source_id}", response_model=ContentSource)
async def update_content_source(
    source_id: str,
    content_source: ContentSourceUpdate,
    trigger_incremental_synthesis: bool = Query(False, description="Whether to trigger incremental synthesis after update"),
    db: Client = Depends(get_db)
):
    """Update an existing content source with optional incremental synthesis."""
    # Check if source exists
    existing = db.table("content_sources").select("*").eq("id", source_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Content source not found")
    
    # Build update data
    update_data = {}
    if content_source.title is not None:
        update_data["title"] = content_source.title
    if content_source.content is not None:
        update_data["content"] = content_source.content
    if content_source.metadata is not None:
        update_data["metadata"] = content_source.metadata
    if content_source.weight is not None:
        update_data["weight"] = content_source.weight
    
    if not update_data:
        # No changes requested
        return existing.data
    
    response = db.table("content_sources").update(update_data).eq("id", source_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to update content source")
    
    # Optional incremental synthesis for significant updates
    if trigger_incremental_synthesis and existing.data.get("realm_id"):
        smart_manager = SmartSynthesisManager(db)
        try:
            await smart_manager._trigger_incremental_synthesis(
                existing.data["realm_id"], 
                [source_id]
            )
            logger.info(f"Triggered incremental synthesis for updated content source {source_id}")
        except Exception as e:
            logger.warning(f"Incremental synthesis failed after update: {e}")
    
    logger.info(f"Updated content source {source_id}")
    return response.data[0]

@router.put("/content-sources/{source_id}/weight")
async def update_content_source_weight(
    source_id: str,
    weight: float,
    auto_synthesize: bool = Query(False, description="Whether to trigger synthesis if weight becomes high"),
    db: Client = Depends(get_db)
):
    """Update the weight/importance of a content source."""
    if weight < 0 or weight > 5:
        raise HTTPException(status_code=400, detail="Weight must be between 0 and 5")
    
    # Get current source info
    existing = db.table("content_sources").select("*").eq("id", source_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Content source not found")
    
    old_weight = existing.data.get("weight", 1.0)
    
    response = db.table("content_sources").update({"weight": weight}).eq("id", source_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Content source not found")
    
    # If weight increased significantly and auto_synthesize is enabled
    if auto_synthesize and weight >= 3.0 and old_weight < 3.0 and existing.data.get("realm_id"):
        smart_manager = SmartSynthesisManager(db)
        try:
            await smart_manager._trigger_incremental_synthesis(
                existing.data["realm_id"], 
                [source_id]
            )
            logger.info(f"Weight increase to {weight} triggered synthesis for content source {source_id}")
        except Exception as e:
            logger.warning(f"Auto-synthesis failed after weight update: {e}")
    
    return {"message": f"Weight updated to {weight}", "source_id": source_id, "synthesis_triggered": auto_synthesize and weight >= 3.0 and old_weight < 3.0}

@router.delete("/content-sources/{source_id}")
async def delete_content_source(source_id: str, db: Client = Depends(get_db)):
    """Delete a content source."""
    response = db.table("content_sources").delete().eq("id", source_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Content source not found")
    
    logger.info(f"Deleted content source {source_id}")
    return {"message": "Content source deleted successfully"}

@router.get("/realms/{realm_id}/content-sources", response_model=List[ContentSource])
async def get_realm_content_sources(realm_id: str, db: Client = Depends(get_db)):
    """Get all content sources for a specific realm."""
    # Verify realm exists
    realm_response = db.table("realms").select("id").eq("id", realm_id).single().execute()
    if not realm_response.data:
        raise HTTPException(status_code=404, detail="Realm not found")
    
    response = db.table("content_sources").select("*").eq("realm_id", realm_id).order("weight", desc=True).execute()
    
    return response.data or []

@router.get("/realms/{realm_id}/content-map")
async def get_realm_content_map(realm_id: str, db: Client = Depends(get_db)):
    """Get a structured overview of all content sources for a realm."""
    # Verify realm exists
    realm_response = db.table("realms").select("*").eq("id", realm_id).single().execute()
    if not realm_response.data:
        raise HTTPException(status_code=404, detail="Realm not found")
    
    realm = realm_response.data
    
    # Get all content sources for the realm
    sources_response = db.table("content_sources").select("*").eq("realm_id", realm_id).execute()
    sources = sources_response.data or []
    
    # Get synthesis queue status
    smart_manager = SmartSynthesisManager(db)
    pending_batch_count = await smart_manager._get_pending_batch_size(realm_id)
    
    # Group by source type
    content_map = {
        "realm_info": {
            "id": realm["id"],
            "name": realm["name"],
            "current_version": realm.get("current_version", 1),
            "quality_score": realm.get("quality_score"),
            "last_synthesis_at": realm.get("last_synthesis_at"),
            "pending_batch_count": pending_batch_count
        },
        "content_sources": {
            "reflection": [],
            "text": [],
            "conversation": [],
            "document": [],
            "structured": []
        },
        "statistics": {
            "total_sources": len(sources),
            "by_type": {},
            "total_weight": 0,
            "average_weight": 0,
            "high_priority_count": len([s for s in sources if s.get("weight", 1.0) >= 3.0])
        }
    }
    
    # Process sources
    for source in sources:
        source_type = source["source_type"]
        
        # Extract lightweight analysis from metadata
        lightweight_analysis = source.get("metadata", {}).get("lightweight_analysis", {})
        
        content_map["content_sources"][source_type].append({
            "id": source["id"],
            "title": source["title"],
            "weight": source["weight"],
            "last_used_at": source["last_used_at"],
            "created_at": source["created_at"],
            "content_preview": source["content"][:200] + "..." if len(source["content"]) > 200 else source["content"],
            "themes": lightweight_analysis.get("themes", []),
            "traits": lightweight_analysis.get("traits", []),
            "importance_indicators": lightweight_analysis.get("importance_indicators", 0)
        })
        
        # Update statistics
        content_map["statistics"]["total_weight"] += source["weight"]
        source_type_count = content_map["statistics"]["by_type"].get(source_type, 0)
        content_map["statistics"]["by_type"][source_type] = source_type_count + 1
    
    # Calculate average weight
    if len(sources) > 0:
        content_map["statistics"]["average_weight"] = content_map["statistics"]["total_weight"] / len(sources)
    
    return content_map

@router.post("/realms/{realm_id}/process-batch-queue")
async def process_realm_batch_queue(realm_id: str, db: Client = Depends(get_db)):
    """Process any queued content sources for batch synthesis."""
    smart_manager = SmartSynthesisManager(db)
    
    try:
        processed = await smart_manager.process_batch_queue(realm_id)
        
        if processed:
            return {
                "message": "Batch queue processed successfully",
                "realm_id": realm_id,
                "synthesis_triggered": True
            }
        else:
            return {
                "message": "No batch processing needed (queue empty or too small)",
                "realm_id": realm_id,
                "synthesis_triggered": False
            }
    except Exception as e:
        logger.error(f"Batch processing failed for realm {realm_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")

@router.post("/realms/{realm_id}/force-full-synthesis")
async def force_full_synthesis(realm_id: str, db: Client = Depends(get_db)):
    """
    Force a full synthesis for a realm (expensive operation).
    This is the only endpoint that uses the full 4-stage synthesis process.
    """
    smart_manager = SmartSynthesisManager(db)
    
    try:
        synthesized_prompt = await smart_manager.force_full_synthesis(realm_id)
        
        return {
            "message": "Full synthesis completed",
            "realm_id": realm_id,
            "prompt_preview": synthesized_prompt[:300] + "..." if len(synthesized_prompt) > 300 else synthesized_prompt,
            "operation": "full_synthesis"
        }
    except Exception as e:
        logger.error(f"Full synthesis failed for realm {realm_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Full synthesis failed: {str(e)}")

# Lightweight insight extraction (keyword-based, no AI tokens)
@router.post("/content-sources/{source_id}/extract-lightweight-insights")
async def extract_lightweight_insights(source_id: str, db: Client = Depends(get_db)):
    """Extract insights from content using lightweight keyword analysis (no AI tokens used)."""
    source_response = db.table("content_sources").select("*").eq("id", source_id).single().execute()
    if not source_response.data:
        raise HTTPException(status_code=404, detail="Content source not found")
    
    source_data = source_response.data
    content_source = ContentSource(**source_data)
    
    smart_manager = SmartSynthesisManager(db)
    analysis = await smart_manager._lightweight_content_analysis(content_source)
    
    return {
        "source_id": source_id,
        "lightweight_analysis": analysis,
        "note": "This analysis uses keyword matching, not AI processing"
    }

# Migration utilities (unchanged but now using smart processing)
@router.post("/content-sources/migrate-from-reflections")
async def migrate_reflections_to_content_sources(
    realm_id: Optional[str] = None,
    db: Client = Depends(get_db)
):
    """Migrate existing reflections to content sources (no auto-synthesis)."""
    query = db.table("reflections").select("*")
    if realm_id:
        query = query.eq("realm_id", realm_id)
    
    reflections_response = query.execute()
    reflections = reflections_response.data or []
    
    migrated_count = 0
    
    for reflection in reflections:
        # Check if already migrated
        existing = db.table("content_sources").select("id").eq("source_type", "reflection").contains("metadata", {"original_reflection_id": reflection["id"]}).execute()
        
        if existing.data:
            continue  # Already migrated
        
        # Create content from Q&A
        content = f"Q: {reflection['question']}"
        if reflection.get('answer'):
            content += f"\nA: {reflection['answer']}"
        else:
            content += f"\nA: [Unanswered]"
        
        new_source = {
            "id": str(uuid.uuid4()),
            "realm_id": reflection["realm_id"],
            "source_type": "reflection",
            "title": reflection["question"][:100] + "..." if len(reflection["question"]) > 100 else reflection["question"],
            "content": content,
            "metadata": {
                "original_reflection_id": reflection["id"],
                "question": reflection["question"],
                "answer": reflection.get("answer"),
                "migrated_at": datetime.utcnow().isoformat()
            },
            "weight": reflection.get("importance_score", 1.0),
            "created_at": reflection["created_at"]
        }
        
        try:
            db.table("content_sources").insert(new_source).execute()
            migrated_count += 1
        except Exception as e:
            logger.error(f"Failed to migrate reflection {reflection['id']}: {e}")
    
    return {
        "message": f"Migrated {migrated_count} reflections to content sources",
        "migrated_count": migrated_count,
        "realm_id": realm_id,
        "note": "Migration completed without auto-synthesis. Use /process-batch-queue or /force-full-synthesis to update prompts."
    }

@router.post("/content-sources/migrate-from-texts")
async def migrate_texts_to_content_sources(db: Client = Depends(get_db)):
    """Migrate existing texts to content sources (no auto-synthesis)."""
    texts_response = db.table("texts").select("*").execute()
    texts = texts_response.data or []
    
    migrated_count = 0
    
    for text in texts:
        # Check if already migrated
        existing = db.table("content_sources").select("id").eq("source_type", "text").contains("metadata", {"original_text_id": str(text["id"])}).execute()
        
        if existing.data:
            continue  # Already migrated
        
        new_source = {
            "id": str(uuid.uuid4()),
            "realm_id": None,  # Texts don't have realm associations yet
            "source_type": "text",
            "title": text["title"],
            "content": text["content"],
            "metadata": {
                "original_text_id": str(text["id"]),
                "source_file_name": text.get("source_file_name"),
                "migrated_at": datetime.utcnow().isoformat()
            },
            "weight": 1.0,
            "created_at": text["created_at"]
        }
        
        try:
            db.table("content_sources").insert(new_source).execute()
            migrated_count += 1
        except Exception as e:
            logger.error(f"Failed to migrate text {text['id']}: {e}")
    
    return {
        "message": f"Migrated {migrated_count} texts to content sources",
        "migrated_count": migrated_count,
        "note": "Migration completed without auto-synthesis. Assign to realms and use synthesis endpoints to update prompts."
    } 