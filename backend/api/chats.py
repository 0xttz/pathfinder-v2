import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from typing import List

from backend.models.schemas import Chat, ChatCreate, Message, MessageCreate

router = APIRouter()

# In-memory storage for testing (will be replaced with Supabase)
chats_store = {}
messages_store = {}

@router.get("/chats", response_model=List[Chat])
async def get_chats():
    """Get all chat sessions"""
    return list(chats_store.values())

@router.post("/chats", response_model=Chat)
async def create_chat(chat: ChatCreate):
    """Create a new chat session"""
    chat_id = str(uuid.uuid4())
    new_chat = Chat(
        id=chat_id,
        realm_id=chat.realm_id,
        title=chat.title,
        created_at=datetime.now()
    )
    chats_store[chat_id] = new_chat
    return new_chat

@router.get("/chats/{chat_id}/messages", response_model=List[Message])
async def get_chat_messages(chat_id: str):
    """Get all messages for a specific chat"""
    if chat_id not in chats_store:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    chat_messages = [msg for msg in messages_store.values() if msg.chat_id == chat_id]
    return sorted(chat_messages, key=lambda x: x.created_at)

@router.post("/chats/{chat_id}/messages", response_model=Message)
async def create_message(chat_id: str, message: MessageCreate):
    """Send a new message to a chat"""
    if chat_id not in chats_store:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    message_id = str(uuid.uuid4())
    new_message = Message(
        id=message_id,
        chat_id=chat_id,
        role=message.role,
        content=message.content,
        created_at=datetime.now()
    )
    messages_store[message_id] = new_message
    return new_message 