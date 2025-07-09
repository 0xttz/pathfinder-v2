from fastapi import APIRouter, HTTPException, Depends
from typing import List
import uuid
from pydantic import BaseModel
import google.generativeai as genai
from supabase import Client
import logging

from backend.db.supabase import supabase_client, get_db
from backend.models.schemas import Text, TextCreate, TextUpdate, SynthesisRequest, SynthesisResponse
from backend.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure the Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)

router = APIRouter()

class TextCreate(BaseModel):
    title: str
    content: str

class TextUpdate(BaseModel):
    title: str
    content: str

@router.get("/texts", response_model=List[Text])
async def get_texts(db: Client = Depends(get_db)):
    """Get all text entries."""
    response = supabase_client.table("texts").select("*").order("created_at", desc=True).execute()
    if response.data is None:
        return []
    return response.data

@router.post("/texts", response_model=Text)
async def create_text(text_create: TextCreate):
    """Create a new text entry."""
    response = supabase_client.table("texts").insert(text_create.dict()).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Error creating text entry")
    return response.data[0]

@router.get("/texts/{text_id}", response_model=Text)
async def get_text(text_id: str):
    """Get a single text entry by ID."""
    response = supabase_client.table("texts").select("*").eq("id", text_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Text not found")
    return response.data

@router.put("/texts/{text_id}", response_model=Text)
async def update_text(text_id: str, text_update: TextUpdate, db: Client = Depends(get_db)):
    """Update a text entry."""
    update_data = text_update.dict()
    response = db.table("texts").update(update_data).eq("id", text_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Text not found or error updating")
    return response.data[0]

@router.delete("/texts/{text_id}", status_code=204)
async def delete_text(text_id: str):
    """Delete a text entry."""
    response = supabase_client.table("texts").delete().eq("id", text_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Text not found")
    return 

# --- Logic moved from synthesis.py ---

class SynthesizeRequest(BaseModel):
    realm_id: str

async def generate_insight_from_text(text_content: str, realm_name: str, realm_prompt: str) -> str:
    """
    Uses the LLM to generate a concise insight from text for a specific realm.
    """
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""
    Given the following text and the context of the '{realm_name}' realm, which is about '{realm_prompt}', 
    extract a single, concise insight. The insight should be a statement or observation that fits into the realm's theme.

    Text:
    ---
    {text_content}
    ---

    Realm: {realm_name}
    Insight:
    """

    try:
        response = await model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate insight from text: {e}")

@router.post("/texts/{text_id}/synthesize", response_model=SynthesisResponse)
async def synthesize_text_to_realm(text_id: str, req: SynthesisRequest, db: Client = Depends(get_db)):
    """
    Synthesizes the content of a text and updates the system prompt of a specified realm.
    """
    realm_id = req.realm_id
    logger.info(f"Starting synthesis for text_id: {text_id} into realm_id: {realm_id}")

    # 1. Fetch text content
    text_res = db.from_("texts").select("content").eq("id", text_id).single().execute()
    if not text_res.data:
        raise HTTPException(status_code=404, detail="Text not found")
    text_content = text_res.data['content']
    logger.info("Successfully fetched text content.")

    # 2. Fetch realm name and existing prompt
    realm_res = db.from_("realms").select("name, system_prompt").eq("id", realm_id).single().execute()
    if not realm_res.data:
        raise HTTPException(status_code=404, detail="Realm not found")
    realm_name = realm_res.data['name']
    existing_prompt = realm_res.data.get('system_prompt', '')
    logger.info(f"Target realm found: '{realm_name}' with existing prompt.")

    if not text_content.strip():
        raise HTTPException(status_code=400, detail="Text content is empty, nothing to synthesize.")

    # 3. Call Gemini to synthesize the prompt
    synthesis_prompt_template = f"""
    You are an AI assistant helping a user refine their personal profile.
    The user's current profile about '{realm_name}' is:
    ---
    {existing_prompt or "No existing prompt."}
    ---
    
    Now, augment and refine this profile using the following new text.
    Create a concise system prompt that provides BACKGROUND CONTEXT for an AI assistant.
    
    IMPORTANT GUIDELINES:
    - Write instructions for the AI on how to use this information as context
    - The AI should NOT mention or recite this information unless directly relevant
    - Focus on key traits, goals, and preferences that inform better responses
    - Include instructions to be natural, helpful, and appropriately brief
    - Avoid overly complimentary language in the prompt itself
    
    Use this format:
    "You are an AI assistant helping [user description]. Use the following as background context to inform your responses, but only mention specific details when directly relevant:
    
    [Background context about the user]
    
    Be natural, helpful, and appropriately brief in your responses. Don't recite this information unless it's specifically relevant to the user's question."

    New Text:
    {text_content}
    
    Updated Synthesized Prompt:
    """
    logger.info(f"Sending synthesis prompt to Gemini for text '{text_id}' into realm '{realm_name}'.")
    model = genai.GenerativeModel('gemini-2.5-flash')
    try:
        response = await model.generate_content_async(synthesis_prompt_template)
        synthesized_prompt = response.text.strip()
        logger.info(f"Received synthesized prompt from Gemini:\\n{synthesized_prompt}")
    except Exception as e:
        logger.error(f"Error during Gemini API call: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to synthesize prompt: {e}")

    # 4. Update the realm's system_prompt
    logger.info(f"Updating realm {realm_id} with new system prompt from text {text_id}.")
    update_res = db.from_("realms").update({"system_prompt": synthesized_prompt}).eq("id", realm_id).execute()

    if not update_res.data:
        logger.error(f"Failed to update realm {realm_id} in Supabase. Response: {update_res}")
        raise HTTPException(status_code=500, detail="Failed to update realm with synthesized prompt.")
    
    logger.info(f"Successfully updated realm {realm_id}.")
        
    return SynthesisResponse(synthesized_prompt=synthesized_prompt) 