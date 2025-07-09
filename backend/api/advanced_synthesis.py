import uuid
import asyncio
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Optional
from supabase import Client

from backend.db.supabase import get_db
from backend.models.schemas import (
    AdvancedSynthesisRequest, AdvancedSynthesisResponse,
    SynthesisJob, SynthesisJobCreate, SynthesisJobUpdate, SynthesisJobStatus,
    ContentAnalysisResponse, QualityAssessmentResponse,
    PromptVersionCreate, PromptVersion, SynthesisRequest, SynthesisResponse,
    ContentSource, SourceType
)
from backend.services.synthesis_engine import AdvancedSynthesisEngine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Background synthesis jobs storage (in production, use Redis/Celery)
synthesis_jobs_status = {}

# --- Helper Function ---
async def _get_or_create_content_source_from_text(
    text_id: str,
    realm_id: str,
    db: Client
) -> str:
    """
    Checks for an existing content source for a text, creates one if it doesn't exist,
    and ensures it's linked to the correct realm.
    """
    # 1. Fetch text details
    text_res = db.table("texts").select("id, title, content, created_at").eq("id", text_id).single().execute()
    if not text_res.data:
        raise HTTPException(status_code=404, detail=f"Text with id {text_id} not found.")
    text_data = text_res.data

    # 2. Check if a content source already exists for this text
    existing_source_res = db.table("content_sources").select("id, realm_id").eq("metadata->>original_text_id", str(text_id)).maybe_single().execute()
    
    if existing_source_res.data:
        source_id = existing_source_res.data['id']
        # If it exists but isn't linked to a realm, link it now.
        if existing_source_res.data.get('realm_id') is None:
            db.table("content_sources").update({"realm_id": realm_id}).eq("id", source_id).execute()
            logger.info(f"Linked existing content source {source_id} to realm {realm_id}")
        return source_id

    # 3. If not, create a new content source
    new_source_id = str(uuid.uuid4())
    new_source = {
        "id": new_source_id,
        "realm_id": realm_id,
        "source_type": SourceType.TEXT.value,
        "title": text_data["title"],
        "content": text_data["content"],
        "metadata": {
            "original_text_id": str(text_data["id"]),
            "migrated_at": datetime.utcnow().isoformat()
        },
        "weight": 1.0,
        "created_at": text_data["created_at"]
    }

    try:
        db.table("content_sources").insert(new_source).execute()
        logger.info(f"Created new content source {new_source_id} from text {text_id} for realm {realm_id}")
        return new_source_id
    except Exception as e:
        logger.error(f"Failed to create content source from text {text_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create content source for synthesis.")

@router.post("/texts/{text_id}/synthesize/advanced", response_model=SynthesisResponse, tags=["texts"])
async def synthesize_text_to_realm_advanced(text_id: str, req: SynthesisRequest, db: Client = Depends(get_db)):
    """
    Performs advanced synthesis of a text into a realm's system prompt using the multi-stage engine.
    """
    realm_id = req.realm_id
    logger.info(f"Starting ADVANCED synthesis for text_id: {text_id} into realm_id: {realm_id}")

    # 1. Get or create a content source from the text
    content_source_id = await _get_or_create_content_source_from_text(text_id, realm_id, db)

    # 2. Instantiate the synthesis engine
    synthesis_engine = AdvancedSynthesisEngine(db)

    # 3. Run the full synthesis process
    logger.info(f"Running full synthesis for realm {realm_id} using content source {content_source_id}")
    try:
        # The engine will fetch all sources for the realm, including the one we just made
        synthesized_prompt, _ = await synthesis_engine.run_full_synthesis(
            realm_id=realm_id, 
            content_source_ids=[content_source_id] # Pass the specific source to ensure it's prioritized
        )
        logger.info(f"Received advanced synthesized prompt for realm {realm_id}:\n{synthesized_prompt}")
    except Exception as e:
        logger.error(f"Error during advanced synthesis engine call: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to run advanced synthesis: {e}")

    # 4. Update the realm's system_prompt
    logger.info(f"Updating realm {realm_id} with new advanced system prompt.")
    update_res = db.from_("realms").update({"system_prompt": synthesized_prompt}).eq("id", realm_id).execute()

    if not update_res.data:
        logger.error(f"Failed to update realm {realm_id} with advanced prompt. Response: {update_res}")
        raise HTTPException(status_code=500, detail="Failed to update realm.")
    
    logger.info(f"Successfully updated realm {realm_id} with advanced prompt.")
        
    return SynthesisResponse(synthesized_prompt=synthesized_prompt)


@router.post("/realms/{realm_id}/synthesize/advanced", response_model=AdvancedSynthesisResponse)
async def start_advanced_synthesis(
    realm_id: str,
    synthesis_request: AdvancedSynthesisRequest,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_db)
):
    """Start an advanced synthesis job for a realm."""
    # Verify realm exists
    realm_response = db.table("realms").select("*").eq("id", realm_id).single().execute()
    if not realm_response.data:
        raise HTTPException(status_code=404, detail="Realm not found")
    
    # Create synthesis job record
    job_id = str(uuid.uuid4())
    job_create = SynthesisJobCreate(
        realm_id=realm_id,
        synthesis_type=synthesis_request.synthesis_type,
        input_sources=synthesis_request.content_source_ids or [],
        configuration=synthesis_request.configuration
    )
    
    job_data = {
        "id": job_id,
        "realm_id": job_create.realm_id,
        "status": SynthesisJobStatus.PENDING.value,
        "synthesis_type": job_create.synthesis_type.value,
        "input_sources": job_create.input_sources,
        "configuration": job_create.configuration,
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Store job in database
    job_response = db.table("synthesis_jobs").insert(job_data).execute()
    if not job_response.data:
        raise HTTPException(status_code=500, detail="Failed to create synthesis job")
    
    # Initialize job status tracking
    synthesis_jobs_status[job_id] = {
        "status": SynthesisJobStatus.PENDING,
        "estimated_completion": 30  # seconds
    }
    
    # Start background synthesis task
    background_tasks.add_task(
        process_synthesis_job,
        job_id, 
        realm_id,
        synthesis_request.content_source_ids,
        synthesis_request.synthesis_type,
        db
    )
    
    logger.info(f"Started advanced synthesis job {job_id} for realm {realm_id}")
    
    return AdvancedSynthesisResponse(
        job_id=job_id,
        status=SynthesisJobStatus.PENDING,
        estimated_completion_seconds=30
    )

@router.get("/synthesis-jobs/{job_id}", response_model=SynthesisJob)
async def get_synthesis_job_status(job_id: str, db: Client = Depends(get_db)):
    """Get the status and results of a synthesis job."""
    response = db.table("synthesis_jobs").select("*").eq("id", job_id).single().execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Synthesis job not found")
    
    return response.data

@router.get("/realms/{realm_id}/synthesis-jobs", response_model=List[SynthesisJob])
async def get_realm_synthesis_jobs(realm_id: str, db: Client = Depends(get_db)):
    """Get all synthesis jobs for a realm."""
    response = db.table("synthesis_jobs").select("*").eq("realm_id", realm_id).order("created_at", desc=True).execute()
    
    return response.data or []

@router.post("/content-sources/{source_id}/analyze", response_model=ContentAnalysisResponse)
async def analyze_single_content_source(
    source_id: str,
    target_realm_id: Optional[str] = None,
    db: Client = Depends(get_db)
):
    """Analyze a single content source to extract insights."""
    # Get the content source
    source_response = db.table("content_sources").select("*").eq("id", source_id).single().execute()
    if not source_response.data:
        raise HTTPException(status_code=404, detail="Content source not found")
    
    source_data = source_response.data
    
    # Get realm context if provided
    realm_name = "Unknown Realm"
    existing_prompt = None
    if target_realm_id:
        realm_response = db.table("realms").select("name, system_prompt").eq("id", target_realm_id).single().execute()
        if realm_response.data:
            realm_name = realm_response.data["name"]
            existing_prompt = realm_response.data.get("system_prompt")
    
    # Create synthesis engine and analyze
    synthesis_engine = AdvancedSynthesisEngine(db)
    
    # Convert to ContentSource model
    content_source = ContentSource(
        id=source_data["id"],
        realm_id=source_data["realm_id"],
        source_type=SourceType(source_data["source_type"]),
        title=source_data["title"],
        content=source_data["content"],
        metadata=source_data.get("metadata", {}),
        weight=source_data.get("weight", 1.0),
        last_used_at=source_data.get("last_used_at"),
        created_at=source_data["created_at"]
    )
    
    analysis = await synthesis_engine.analyze_content_sources([content_source], realm_name, existing_prompt)
    
    return analysis

@router.post("/prompts/{prompt_id}/assess-quality", response_model=QualityAssessmentResponse)
async def assess_prompt_quality(
    prompt_id: str,
    db: Client = Depends(get_db)
):
    """Assess the quality of a specific prompt version."""
    # Get the prompt version
    prompt_response = db.table("prompt_versions").select("*").eq("id", prompt_id).single().execute()
    if not prompt_response.data:
        raise HTTPException(status_code=404, detail="Prompt version not found")
    
    prompt_data = prompt_response.data
    realm_id = prompt_data["realm_id"]
    
    # Get realm info
    realm_response = db.table("realms").select("name").eq("id", realm_id).single().execute()
    if not realm_response.data:
        raise HTTPException(status_code=404, detail="Realm not found")
    
    realm_name = realm_response.data["name"]
    
    # Get associated content sources
    sources_response = db.table("content_sources").select("*").eq("realm_id", realm_id).execute()
    content_sources = []
    
    for source_data in (sources_response.data or []):
        content_source = ContentSource(
            id=source_data["id"],
            realm_id=source_data["realm_id"],
            source_type=SourceType(source_data["source_type"]),
            title=source_data["title"],
            content=source_data["content"],
            metadata=source_data.get("metadata", {}),
            weight=source_data.get("weight", 1.0),
            last_used_at=source_data.get("last_used_at"),
            created_at=source_data["created_at"]
        )
        content_sources.append(content_source)
    
    # Create synthesis engine and assess quality
    synthesis_engine = AdvancedSynthesisEngine(db)
    
    # Mock persona profile for quality assessment
    persona_profile = {
        "core_identity": "Profile from content analysis",
        "values_beliefs": ["Extracted from content"],
        "communication_style": "Analyzed from interactions",
        "goals_aspirations": ["Identified from content"],
        "context_background": "Built from content sources",
        "preferences_patterns": ["Extracted patterns"]
    }
    
    quality_assessment = await synthesis_engine.assess_prompt_quality(
        prompt_data["content"],
        persona_profile,
        content_sources,
        realm_name
    )
    
    return quality_assessment

@router.get("/realms/{realm_id}/content-analysis")
async def analyze_realm_content(realm_id: str, db: Client = Depends(get_db)):
    """Get comprehensive content analysis for a realm."""
    # Verify realm exists
    realm_response = db.table("realms").select("*").eq("id", realm_id).single().execute()
    if not realm_response.data:
        raise HTTPException(status_code=404, detail="Realm not found")
    
    realm = realm_response.data
    realm_name = realm["name"]
    
    # Get all content sources for the realm
    sources_response = db.table("content_sources").select("*").eq("realm_id", realm_id).execute()
    
    if not sources_response.data:
        return {
            "realm_id": realm_id,
            "realm_name": realm_name,
            "message": "No content sources found for analysis",
            "content_sources_count": 0
        }
    
    content_sources = []
    for source_data in sources_response.data:
        content_source = ContentSource(
            id=source_data["id"],
            realm_id=source_data["realm_id"],
            source_type=SourceType(source_data["source_type"]),
            title=source_data["title"],
            content=source_data["content"],
            metadata=source_data.get("metadata", {}),
            weight=source_data.get("weight", 1.0),
            last_used_at=source_data.get("last_used_at"),
            created_at=source_data["created_at"]
        )
        content_sources.append(content_source)
    
    # Create synthesis engine and analyze
    synthesis_engine = AdvancedSynthesisEngine(db)
    existing_prompt = realm.get("system_prompt")
    
    analysis = await synthesis_engine.analyze_content_sources(content_sources, realm_name, existing_prompt)
    
    return {
        "realm_id": realm_id,
        "realm_name": realm_name,
        "content_sources_count": len(content_sources),
        "analysis": analysis.model_dump(),
        "analyzed_at": datetime.utcnow().isoformat()
    }

async def process_synthesis_job(
    job_id: str,
    realm_id: str,
    content_source_ids: Optional[List[str]],
    synthesis_type,
    db: Client
):
    """Background task to process synthesis jobs."""
    try:
        # Update job status to processing
        synthesis_jobs_status[job_id] = {"status": SynthesisJobStatus.PROCESSING}
        
        update_data = {
            "status": SynthesisJobStatus.PROCESSING.value
        }
        db.table("synthesis_jobs").update(update_data).eq("id", job_id).execute()
        
        logger.info(f"Processing synthesis job {job_id}")
        
        # Create synthesis engine and run synthesis
        synthesis_engine = AdvancedSynthesisEngine(db)
        
        synthesized_prompt, quality_analysis = await synthesis_engine.run_full_synthesis(
            realm_id,
            content_source_ids,
            synthesis_type
        )
        
        # Update the realm with the new prompt
        realm_update_data = {
            "system_prompt": synthesized_prompt,
            "quality_score": quality_analysis["quality_assessment"]["overall_quality"],
            "last_synthesis_at": datetime.utcnow().isoformat(),
            "current_version": 1  # Will be incremented in versioning system
        }
        
        db.table("realms").update(realm_update_data).eq("id", realm_id).execute()
        
        # Create prompt version record
        realm_response = db.table("realms").select("current_version").eq("id", realm_id).single().execute()
        current_version = realm_response.data.get("current_version", 1) if realm_response.data else 1
        
        version_data = {
            "id": str(uuid.uuid4()),
            "realm_id": realm_id,
            "version_number": current_version,
            "content": synthesized_prompt,
            "synthesis_method": "advanced",
            "quality_score": quality_analysis["quality_assessment"]["overall_quality"],
            "effectiveness_metrics": quality_analysis["quality_assessment"],
            "improvement_suggestions": quality_analysis["quality_assessment"]["improvement_suggestions"],
            "created_at": datetime.utcnow().isoformat()
        }
        
        db.table("prompt_versions").insert(version_data).execute()
        
        # Update job with completion status
        job_completion_data = {
            "status": SynthesisJobStatus.COMPLETED.value,
            "result_prompt": synthesized_prompt,
            "quality_analysis": quality_analysis,
            "processing_time_ms": quality_analysis["synthesis_metadata"]["processing_time_ms"]
        }
        
        db.table("synthesis_jobs").update(job_completion_data).eq("id", job_id).execute()
        
        # Update in-memory status
        synthesis_jobs_status[job_id] = {"status": SynthesisJobStatus.COMPLETED}
        
        logger.info(f"Completed synthesis job {job_id} successfully")
        
    except Exception as e:
        logger.error(f"Error processing synthesis job {job_id}: {e}")
        
        # Update job with failure status
        error_data = {
            "status": SynthesisJobStatus.FAILED.value,
            "error_message": str(e)
        }
        
        db.table("synthesis_jobs").update(error_data).eq("id", job_id).execute()
        
        # Update in-memory status
        synthesis_jobs_status[job_id] = {"status": SynthesisJobStatus.FAILED}

@router.delete("/synthesis-jobs/{job_id}")
async def cancel_synthesis_job(job_id: str, db: Client = Depends(get_db)):
    """Cancel a pending or processing synthesis job."""
    # Check if job exists
    response = db.table("synthesis_jobs").select("status").eq("id", job_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Synthesis job not found")
    
    current_status = response.data["status"]
    
    if current_status in [SynthesisJobStatus.COMPLETED.value, SynthesisJobStatus.FAILED.value]:
        raise HTTPException(status_code=400, detail="Cannot cancel completed or failed job")
    
    # Update status to cancelled
    db.table("synthesis_jobs").update({"status": "cancelled"}).eq("id", job_id).execute()
    
    # Update in-memory status
    if job_id in synthesis_jobs_status:
        synthesis_jobs_status[job_id] = {"status": "cancelled"}
    
    return {"message": f"Synthesis job {job_id} cancelled successfully"} 