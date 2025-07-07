from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import google.generativeai as genai
from backend.core.config import settings
from backend.db.supabase import supabase_client
from typing import Optional
import uuid

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

@router.post("/realms/{realm_id}/generate-questions")
async def generate_questions(realm_id: str):
    """Generate reflection questions for a realm"""
    # This check is temporary and will be replaced
    if realm_id not in realms_store:
        # In a real scenario, we'd check the DB.
        # For now, we allow it to proceed to show the endpoint works.
        pass
    
    # Placeholder - will integrate with Google Gemini API
    return {"message": f"Question generation for realm {realm_id} - coming soon"}

@router.post("/realms/{realm_id}/synthesize")
async def synthesize_realm(realm_id: str):
    """Synthesize Q&A pairs into a system prompt"""
    # This check is temporary and will be replaced
    if realm_id not in realms_store:
        # In a real scenario, we'd check the DB.
        # For now, we allow it to proceed to show the endpoint works.
        pass
        
    # Placeholder - will integrate with Google Gemini API
    return {"message": f"Synthesis for realm {realm_id} - coming soon"} 