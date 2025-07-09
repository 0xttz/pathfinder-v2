import uuid
import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from supabase import Client
import google.generativeai as genai

from backend.db.supabase import get_db
from backend.models.schemas import Realm, RealmCreate, RealmUpdate, Reflection, SynthesisResponse
from backend.core.config import settings

# Configure the Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

DEFAULT_REALM_NAME = "About Me"
DEFAULT_REFLECTION_QUESTIONS = [
    "What are your core values and guiding principles?",
    "What are your greatest strengths and how do you leverage them?",
    "What are your areas for growth and how are you addressing them?",
    "What is your current professional situation and your career aspirations?",
    "Describe your key relationships and their significance in your life.",
    "What are your main hobbies and passions outside of work?",
    "What is your general life philosophy or worldview?",
]

@router.get("/realms", response_model=List[Realm])
async def get_realms(db: Client = Depends(get_db)):
    """
    Get all realms, ensuring the default 'About Me' realm exists and is first.
    If it doesn't exist, create it with default reflection questions.
    """
    response = db.table("realms").select("*").execute()
    realms = response.data or []

    about_me_realm = next((r for r in realms if r.get("name") == DEFAULT_REALM_NAME), None)

    if not about_me_realm:
        # Create "About Me" realm
        new_realm_id = str(uuid.uuid4())
        new_realm_data = {"id": new_realm_id, "name": DEFAULT_REALM_NAME, "system_prompt": "This realm contains general information about me to provide context for all my chats."}
        
        realm_insert_response = db.table("realms").insert(new_realm_data).execute()
        
        if not realm_insert_response.data:
            raise HTTPException(status_code=500, detail="Failed to create the 'About Me' realm.")
        
        created_realm = realm_insert_response.data[0]
        
        # Batch insert default reflection questions
        reflections_to_create = [
            {"realm_id": created_realm["id"], "question": q, "id": str(uuid.uuid4())}
            for q in DEFAULT_REFLECTION_QUESTIONS
        ]
        
        db.table("reflections").insert(reflections_to_create).execute()
        
        # Re-fetch realms to include the new one
        response = db.table("realms").select("*").execute()
        realms = response.data or []
        about_me_realm = created_realm

    # Sort to bring "About Me" to the front
    realms.sort(key=lambda r: r.get("name") != DEFAULT_REALM_NAME)
    
    return realms

@router.get("/realms/{realm_id}", response_model=Realm)
async def get_realm(realm_id: str, db: Client = Depends(get_db)):
    """Get a single realm by its ID"""
    response = db.table("realms").select("*").eq("id", realm_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Realm not found")
    return response.data

@router.post("/realms", response_model=Realm)
async def create_realm(realm: RealmCreate, db: Client = Depends(get_db)):
    """Create a new realm"""
    if realm.name == DEFAULT_REALM_NAME:
        raise HTTPException(status_code=400, detail=f"A realm named '{DEFAULT_REALM_NAME}' already exists and is protected.")

    realm_id = str(uuid.uuid4())
    new_realm = {
        "id": realm_id,
        "name": realm.name,
        "system_prompt": realm.system_prompt
    }
    response = db.table("realms").insert(new_realm).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Error creating realm")
    return response.data[0]

@router.put("/realms/{realm_id}", response_model=Realm)
async def update_realm(realm_id: str, realm_update: RealmUpdate, db: Client = Depends(get_db)):
    """Update an existing realm, protecting the default realm."""
    
    # First, check if the realm being updated is the default one
    target_realm_response = db.table("realms").select("name").eq("id", realm_id).single().execute()
    if not target_realm_response.data:
        raise HTTPException(status_code=404, detail="Realm not found.")

    if target_realm_response.data['name'] == DEFAULT_REALM_NAME and 'name' in realm_update.dict(exclude_unset=True):
         if realm_update.name != DEFAULT_REALM_NAME:
            raise HTTPException(status_code=400, detail=f"Cannot rename the '{DEFAULT_REALM_NAME}' realm.")

    update_data = realm_update.dict(exclude_unset=True)
    response = db.table("realms").update(update_data).eq("id", realm_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Realm not found or error updating")
        
    return response.data[0]

@router.delete("/realms/{realm_id}")
async def delete_realm(realm_id: str, db: Client = Depends(get_db)):
    """Delete a realm, protecting the default one."""
    
    target_realm_response = db.table("realms").select("name").eq("id", realm_id).single().execute()
    if not target_realm_response.data:
        # Allows for idempotent deletion
        return {"message": "Realm not found or already deleted."}

    if target_realm_response.data['name'] == DEFAULT_REALM_NAME:
        raise HTTPException(status_code=400, detail=f"Cannot delete the default '{DEFAULT_REALM_NAME}' realm.")

    response = db.table("realms").delete().eq("id", realm_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Realm not found or error deleting")
        
    return {"message": "Realm deleted successfully"} 

# --- Logic moved from llm.py ---

@router.post("/realms/{realm_id}/generate-questions", response_model=List[Reflection])
async def generate_questions(realm_id: str, db: Client = Depends(get_db)):
    """Generate reflection questions for a realm and save them."""
    # 1. Fetch the realm name
    realm_res = db.from_("realms").select("name").eq("id", realm_id).single().execute()
    if not realm_res.data:
        raise HTTPException(status_code=404, detail="Realm not found")
    realm_name = realm_res.data['name']

    # 2. Generate questions using Gemini
    prompt = f"Generate 3-5 simple, open-ended reflection questions about '{realm_name}'. Return as a JSON list. Example: [\"What is...\", \"How does...\"]"
    model = genai.GenerativeModel('gemini-2.5-flash')
    try:
        response = await model.generate_content_async(prompt)
        # Clean the response to extract the JSON part
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "").strip()
        questions = json.loads(cleaned_response)
    except (json.JSONDecodeError, Exception) as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate or parse questions: {e}")

    # 3. Save questions to the 'reflections' table
    reflections_to_insert = [
        {"realm_id": realm_id, "question": q} for q in questions
    ]
    
    insert_res = db.table("reflections").insert(reflections_to_insert).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to save generated questions.")

    return insert_res.data

@router.post("/realms/{realm_id}/synthesize", response_model=SynthesisResponse)
async def synthesize_realm(realm_id: str, db: Client = Depends(get_db)):
    """Synthesize Q&A pairs into a system prompt and update the realm."""
    logger.info(f"Starting synthesis for realm_id: {realm_id}")

    # 1. Fetch realm name and existing prompt
    realm_res = db.from_("realms").select("name, system_prompt").eq("id", realm_id).single().execute()
    if not realm_res.data:
        raise HTTPException(status_code=404, detail="Realm not found")
    realm_name = realm_res.data['name']
    existing_prompt = realm_res.data.get('system_prompt', '')
    logger.info(f"Found realm: '{realm_name}' with existing prompt.")

    # 2. Fetch all reflections for the realm
    reflections_res = db.from_("reflections").select("question, answer").eq("realm_id", realm_id).execute()
    if not reflections_res.data:
        raise HTTPException(status_code=404, detail="No reflections found for this realm.")

    # 3. Format Q&A for the prompt
    qa_pairs = ""
    answered_reflections = 0
    for reflection in reflections_res.data:
        if reflection.get('answer'): # Only include answered questions
            qa_pairs += f"Q: {reflection['question']}\\nA: {reflection['answer']}\\n\\n"
            answered_reflections += 1
    
    logger.info(f"Found {answered_reflections} answered reflections for synthesis.")

    if not qa_pairs:
        raise HTTPException(status_code=400, detail="No answered reflections to synthesize.")

    # 4. Call Gemini to synthesize the prompt
    synthesis_prompt = f"""
    You are an AI assistant helping a user refine their personal profile.
    The user's current profile about '{realm_name}' is:
    ---
    {existing_prompt or "No existing prompt."}
    ---

    Now, augment and refine this profile using the following new questions and answers.
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

    New Q&A:
    {qa_pairs}
    
    Updated Synthesized Prompt:
    """
    logger.info(f"Sending synthesis prompt to Gemini for realm '{realm_name}'.")
    model = genai.GenerativeModel('gemini-2.5-flash')
    try:
        response = await model.generate_content_async(synthesis_prompt)
        synthesized_prompt = response.text.strip()
        logger.info(f"Received synthesized prompt from Gemini:\\n{synthesized_prompt}")
    except Exception as e:
        logger.error(f"Error during Gemini API call: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to synthesize prompt: {e}")

    # 5. Update the realm's system_prompt
    logger.info(f"Updating realm {realm_id} with new system prompt.")
    update_res = db.from_("realms").update({"system_prompt": synthesized_prompt}).eq("id", realm_id).execute()

    if not update_res.data:
        logger.error(f"Failed to update realm {realm_id} in Supabase. Response: {update_res}")
        raise HTTPException(status_code=500, detail="Failed to update realm with synthesized prompt.")
    
    logger.info(f"Successfully updated realm {realm_id}.")
        
    return SynthesisResponse(synthesized_prompt=synthesized_prompt) 