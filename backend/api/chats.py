import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from typing import List

from backend.models.schemas import Chat, ChatCreate, Message, MessageCreate, ChatUpdate
from backend.db.supabase import supabase_client

router = APIRouter()

@router.get("/chats", tags=["Chats"])
async def get_chats():
    """Gets all chat sessions."""
    res = supabase_client.from_("chats").select("id, title, created_at").order("created_at", desc=True).execute()
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