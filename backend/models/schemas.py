from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

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

class ReflectionCreate(BaseModel):
    realm_id: str
    question: str
    answer: Optional[str] = None

class Reflection(BaseModel):
    id: uuid.UUID
    realm_id: uuid.UUID
    question: str
    answer: Optional[str] = None
    created_at: datetime

class ReflectionUpdate(BaseModel):
    answer: Optional[str] = None

class SynthesisRequest(BaseModel):
    realm_id: str

class Text(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    created_at: datetime

class TextCreate(BaseModel):
    title: str
    content: str

class TextUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class SynthesisResponse(BaseModel):
    synthesized_prompt: str 