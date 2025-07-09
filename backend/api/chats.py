import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import google.generativeai as genai

from backend.models.schemas import Chat, ChatCreate, Message, MessageCreate, ChatUpdate
from backend.db.supabase import supabase_client
from backend.core.config import settings

# Configure the Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)

router = APIRouter()

# --- Existing Endpoints ---

@router.get("/chats", tags=["Chats"])
async def get_chats():
    """Gets all chat sessions."""
    res = supabase_client.from_("chats").select("id, title, created_at, realm_id").order("created_at", desc=True).execute()
    if res.data is None:
        return []
    return res.data

@router.post("/chats", response_model=Chat)
async def create_chat(chat: ChatCreate):
    """Create a new chat session"""
    response = supabase_client.from_("chats").insert(chat.model_dump()).select("*").execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create chat")
    return response.data[0]

@router.put("/chats/{chat_id}", response_model=Chat, tags=["Chats"])
async def update_chat_title(chat_id: str, chat_update: ChatUpdate):
    """Update a chat's title."""
    response = supabase_client.from_("chats").update({"title": chat_update.title}).eq("id", chat_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Chat not found")
    return response.data[0]

@router.get("/chats/{chat_id}/messages", tags=["Chats"])
async def get_chat_messages(chat_id: str):
    """Retrieves all messages for a specific chat."""
    res = supabase_client.from_("messages").select("role, content").eq("chat_id", chat_id).order("created_at").execute()
    if res.data is None:
        return []
    return res.data

@router.post("/chats/{chat_id}/messages", response_model=Message)
async def create_message(chat_id: str, message: MessageCreate):
    """Send a new message to a chat"""
    message_data = {
        "chat_id": chat_id,
        "role": message.role,
        "content": message.content,
    }
    response = supabase_client.from_("messages").insert(message_data).select("*").execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create message")
    return response.data[0]

@router.delete("/chats/{chat_id}", tags=["Chats"])
async def delete_chat(chat_id: str):
    """Deletes a chat and all its messages."""
    # First, delete all messages associated with the chat to uphold foreign key constraints.
    messages_res = supabase_client.from_("messages").delete().eq("chat_id", chat_id).execute()
    
    # Then, delete the chat itself.
    chat_res = supabase_client.from_("chats").delete().eq("id", chat_id).execute()

    if not chat_res.data:
         raise HTTPException(status_code=404, detail="Chat not found or could not be deleted.")

    return {"message": "Chat deleted successfully"}

# --- Logic moved from llm.py ---

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
        default_realm_res = supabase_client.from_("realms").select("system_prompt").eq("name", "About Me").single().execute()
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

@router.post("/chats/stream", tags=["Chats"])
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