from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import google.generativeai as genai
from backend.core.config import settings
from backend.db.supabase import supabase_client
from typing import Optional, List
import uuid
import json

from backend.models.schemas import Reflection, Realm

# Configure the Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)

router = APIRouter()

# This is a temporary dependency, will be removed
realms_store = {} 

class ChatRequest(BaseModel):
    message: str
    chat_id: Optional[str] = None
    realm_id: Optional[str] = None

async def gemini_llm_streamer(message: str, chat_id: str, realm_id: Optional[str] = None):
    """Streams a response from the Gemini API and saves messages."""
    # 1. Fetch chat history
    messages_res = supabase_client.from_("messages").select("role, content").eq("chat_id", chat_id).order("created_at").execute()
    
    history = []
    if messages_res.data:
        for record in messages_res.data:
            history.append({
                "role": record["role"],
                "parts": [record["content"]]
            })

    # 2. Save user message before sending to LLM
    supabase_client.from_("messages").insert({
        "chat_id": chat_id,
        "role": "user",
        "content": message
    }).execute()

    # Add the new user message to the history for the API call
    history.append({"role": "user", "parts": [message]})

    system_prompt = None
    if realm_id:
        realm_res = supabase_client.from_("realms").select("system_prompt").eq("id", realm_id).single().execute()
        if realm_res.data and realm_res.data.get("system_prompt"):
            system_prompt = realm_res.data["system_prompt"]
    else:
        # If no realm is specified, try to use the default "About Me" realm's prompt
        default_realm_res = supabase_client.from_("realms").select("system_prompt").eq("is_default", True).single().execute()
        if default_realm_res.data and default_realm_res.data.get("system_prompt"):
            system_prompt = default_realm_res.data["system_prompt"]

    # KEEP THIS AS 2.5-flash !!!!
    model = genai.GenerativeModel('gemini-2.5-flash', system_instruction=system_prompt)
    
    # 3. Send the entire conversation history to the model
    response = await model.generate_content_async(history, stream=True)
    
    full_model_response = ""
    async for chunk in response:
        if chunk.text:
            full_model_response += chunk.text
            yield chunk.text
    
    # 4. Save model message
    supabase_client.from_("messages").insert({
        "chat_id": chat_id,
        "role": "model",
        "content": full_model_response
    }).execute()

@router.post("/llm/chat/stream",)
async def stream_chat(chat_request: ChatRequest):
    """Streams a chat response back to the client."""
    chat_id = chat_request.chat_id
    realm_id = chat_request.realm_id

    if not chat_id:
        # Create a new chat session
        new_chat_id = str(uuid.uuid4())
        title = chat_request.message[:50] # Simple title from first 50 chars
        
        chat_data = { "id": new_chat_id, "title": title }
        if realm_id:
            chat_data["realm_id"] = realm_id

        insert_res = supabase_client.from_("chats").insert(chat_data).execute()
        if not insert_res.data:
             raise HTTPException(status_code=500, detail="Failed to create new chat session.")
        chat_id = insert_res.data[0]['id']


    response = StreamingResponse(
        gemini_llm_streamer(chat_request.message, chat_id, realm_id), 
        media_type="text/event-stream"
    )
    response.headers["X-Chat-Id"] = chat_id
    return response

class QuestionsResponse(BaseModel):
    questions: List[str]

@router.post("/realms/{realm_id}/generate-questions", response_model=List[Reflection])
async def generate_questions(realm_id: str):
    """Generate reflection questions for a realm and save them."""
    # 1. Fetch the realm name
    realm_res = supabase_client.from_("realms").select("name").eq("id", realm_id).single().execute()
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
    
    insert_res = supabase_client.table("reflections").insert(reflections_to_insert).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to save generated questions.")

    return insert_res.data

@router.post("/realms/{realm_id}/synthesize", response_model=Realm)
async def synthesize_realm(realm_id: str):
    """Synthesize Q&A pairs into a system prompt and update the realm."""
    # 1. Fetch realm name
    realm_res = supabase_client.from_("realms").select("name").eq("id", realm_id).single().execute()
    if not realm_res.data:
        raise HTTPException(status_code=404, detail="Realm not found")
    realm_name = realm_res.data['name']

    # 2. Fetch all reflections for the realm
    reflections_res = supabase_client.from_("reflections").select("question, answer").eq("realm_id", realm_id).execute()
    if not reflections_res.data:
        raise HTTPException(status_code=404, detail="No reflections found for this realm.")

    # 3. Format Q&A for the prompt
    qa_pairs = ""
    for reflection in reflections_res.data:
        if reflection['answer']: # Only include answered questions
            qa_pairs += f"Q: {reflection['question']}\nA: {reflection['answer']}\n\n"

    if not qa_pairs:
        raise HTTPException(status_code=400, detail="No answered reflections to synthesize.")

    # 4. Call Gemini to synthesize the prompt
    synthesis_prompt = f"""
    Based on the following questions and answers about '{realm_name}', synthesize a concise, first-person system prompt for an AI.
    This prompt should capture the user's key traits, goals, and core values as reflected in their answers.
    Speak as the user ('I am...', 'My goal is...').

    Q&A:
    {qa_pairs}
    
    Synthesized Prompt:
    """
    model = genai.GenerativeModel('gemini-2.5-flash')
    try:
        response = await model.generate_content_async(synthesis_prompt)
        synthesized_prompt = response.text.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to synthesize prompt: {e}")

    # 5. Update the realm's system_prompt
    update_res = supabase_client.from_("realms").update({"system_prompt": synthesized_prompt}).eq("id", realm_id).execute()

    if not update_res.data:
        raise HTTPException(status_code=500, detail="Failed to update realm with synthesized prompt.")
        
    return update_res.data[0] 