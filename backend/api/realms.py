import uuid
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from supabase import Client

from backend.db.supabase import supabase_client
from backend.models.schemas import Realm, RealmCreate, RealmUpdate

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

def get_supabase_client():
    return supabase_client

@router.get("/realms", response_model=List[Realm])
async def get_realms(db: Client = Depends(get_supabase_client)):
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
async def get_realm(realm_id: str, db: Client = Depends(get_supabase_client)):
    """Get a single realm by its ID"""
    response = db.table("realms").select("*").eq("id", realm_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Realm not found")
    return response.data

@router.post("/realms", response_model=Realm)
async def create_realm(realm: RealmCreate, db: Client = Depends(get_supabase_client)):
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
async def update_realm(realm_id: str, realm_update: RealmUpdate, db: Client = Depends(get_supabase_client)):
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
async def delete_realm(realm_id: str, db: Client = Depends(get_supabase_client)):
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