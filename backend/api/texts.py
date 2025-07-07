from fastapi import APIRouter, HTTPException
from typing import List
import uuid
from pydantic import BaseModel

from backend.db.supabase import supabase_client
from backend.models.schemas import Text

router = APIRouter()

class TextCreate(BaseModel):
    title: str
    content: str

class TextUpdate(BaseModel):
    title: str
    content: str

@router.get("/texts", response_model=List[Text])
async def get_texts():
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
async def update_text(text_id: str, text_update: TextUpdate):
    """Update a text entry."""
    update_data = text_update.dict()
    response = supabase_client.table("texts").update(update_data).eq("id", text_id).select().execute()
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