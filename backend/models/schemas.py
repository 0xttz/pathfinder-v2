from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RealmCreate(BaseModel):
    name: str
    system_prompt: Optional[str] = None

class RealmUpdate(BaseModel):
    name: Optional[str] = None
    system_prompt: Optional[str] = None

class Realm(BaseModel):
    id: str
    name: str
    system_prompt: Optional[str] = None
    created_at: datetime

class ChatCreate(BaseModel):
    realm_id: Optional[str] = None
    title: Optional[str] = None

class Chat(BaseModel):
    id: str
    realm_id: Optional[str] = None
    title: Optional[str] = None
    created_at: datetime

class ChatUpdate(BaseModel):
    title: str

class MessageCreate(BaseModel):
    content: str
    role: str = "user"

class Message(BaseModel):
    id: str
    chat_id: str
    role: str
    content: str
    created_at: datetime 