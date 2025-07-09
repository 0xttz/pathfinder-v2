import uuid
import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from supabase import Client
import google.generativeai as genai

from backend.db.supabase import get_db
from backend.models.schemas import (
    Realm, RealmCreate, RealmUpdate, Reflection, SynthesisResponse,
    RealmTemplate, GeneratePromptRequest, GeneratePromptResponse,
    OnboardingRequest, OnboardingResponse
)
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
        # Create "About Me" realm with synthesis disabled to prevent recursion
        new_realm_id = str(uuid.uuid4())
        new_realm_data = {
            "id": new_realm_id, 
            "name": DEFAULT_REALM_NAME,
            "description": "Your core personal context and identity. This realm contains fundamental information about who you are, your values, preferences, and background to provide personalized context for all conversations.",
            "system_prompt": "This realm contains general information about me to provide context for all my chats. It serves as a foundational profile that helps the AI understand my background, preferences, and context for more personalized interactions.",
            "synthesis_disabled": True  # Prevent recursive synthesis
        }
        
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
        logger.info(f"Created About Me realm {new_realm_id} with synthesis disabled")
        
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
        "description": realm.description,
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
    Create a concise background profile that captures key traits, goals, preferences, and relevant context about the user.
    
    Focus on factual information that would help an AI assistant provide better, more contextually relevant responses.
    Write this as background information about the user, not as instructions.
    Keep it concise and avoid overly complimentary language.

    New Q&A:
    {qa_pairs}
    
    Updated Profile:
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

# --- New Onboarding and Smart Creation Endpoints ---

# Predefined realm templates
REALM_TEMPLATES = [
    {
        "id": "personal-assistant",
        "name": "Personal Assistant",
        "description": "A helpful assistant for daily tasks, reminders, and general support",
        "example_description": "I want an AI that helps me manage my daily tasks, provides gentle reminders about important deadlines, and offers practical advice for personal productivity. It should understand my work-life balance priorities.",
        "system_prompt_template": "You are a personal assistant for {name}. Help with daily tasks, provide reminders, and offer practical advice. Be supportive, organized, and respectful of work-life balance.",
        "suggested_questions": [
            "What are your main daily responsibilities?",
            "How do you prefer to be reminded about deadlines?",
            "What time management challenges do you face?",
            "What are your work-life balance priorities?"
        ],
        "tags": ["productivity", "organization", "daily-life"]
    },
    {
        "id": "creative-collaborator",
        "name": "Creative Collaborator", 
        "description": "A creative partner for brainstorming, writing, and artistic projects",
        "example_description": "I need a creative partner who can help brainstorm ideas for my writing projects, provide feedback on creative work, and help me overcome creative blocks. They should understand my artistic style and preferences.",
        "system_prompt_template": "You are a creative collaborator for {name}. Help with brainstorming, provide constructive feedback, and support creative exploration. Be imaginative, encouraging, and understand {name}'s artistic vision.",
        "suggested_questions": [
            "What type of creative work do you do?",
            "How do you prefer to brainstorm ideas?",
            "What creative challenges do you often face?",
            "Describe your artistic style or preferences"
        ],
        "tags": ["creativity", "writing", "art", "brainstorming"]
    },
    {
        "id": "professional-advisor",
        "name": "Professional Advisor",
        "description": "A career-focused advisor for professional development and industry insights",
        "example_description": "I want an AI advisor who understands my career goals, can provide industry insights, help with professional development, and offer guidance on workplace challenges in my field.",
        "system_prompt_template": "You are a professional advisor for {name}. Provide career guidance, industry insights, and professional development advice. Be knowledgeable, strategic, and supportive of {name}'s career goals.",
        "suggested_questions": [
            "What is your current role and industry?", 
            "What are your career goals for the next 5 years?",
            "What professional skills do you want to develop?",
            "What workplace challenges do you face?"
        ],
        "tags": ["career", "professional", "development", "workplace"]
    },
    {
        "id": "learning-companion",
        "name": "Learning Companion",
        "description": "A study partner and tutor for educational goals and skill development",
        "example_description": "I need a learning companion who can help me study specific subjects, explain complex concepts in ways I understand, create practice questions, and keep me motivated in my learning journey.",
        "system_prompt_template": "You are a learning companion for {name}. Help with studying, explain concepts clearly, create practice materials, and provide educational support. Be patient, encouraging, and adapt to {name}'s learning style.",
        "suggested_questions": [
            "What subjects or skills are you currently learning?",
            "How do you learn best (visual, auditory, hands-on)?",
            "What learning challenges do you face?",
            "What are your educational or skill development goals?"
        ],
        "tags": ["education", "learning", "study", "skills"]
    },
    {
        "id": "wellness-coach",
        "name": "Wellness Coach",
        "description": "A supportive coach for health, fitness, and well-being goals",
        "example_description": "I want a wellness coach who can provide motivation for my fitness goals, suggest healthy habits, help me track progress, and offer encouragement during challenging times while being sensitive to my wellness journey.",
        "system_prompt_template": "You are a wellness coach for {name}. Provide motivation, suggest healthy habits, and support {name}'s wellness journey. Be encouraging, non-judgmental, and sensitive to individual health needs.",
        "suggested_questions": [
            "What are your current wellness or fitness goals?",
            "What healthy habits do you want to develop?",
            "What wellness challenges do you face?",
            "How do you prefer to track progress?"
        ],
        "tags": ["health", "fitness", "wellness", "motivation"]
    }
]

@router.get("/realm-templates", response_model=List[RealmTemplate])
async def get_realm_templates():
    """Get available realm templates for guided creation"""
    return REALM_TEMPLATES

@router.post("/generate-prompt", response_model=GeneratePromptResponse)
async def generate_prompt(request: GeneratePromptRequest):
    """Generate an initial system prompt from a realm description"""
    
    # Create prompt based on user input
    generation_prompt = f"""
    Create a system prompt for an AI assistant based on the following information:
    
    Realm Name: {request.realm_name}
    Description: {request.realm_description}
    Type: {request.realm_type or 'general'}
    Tone: {request.tone}
    Expertise Level: {request.expertise_level}
    Additional Context: {request.additional_context or 'None provided'}
    
    Guidelines:
    1. Write the prompt as background information about the user, not as instructions to the AI
    2. Focus on factual information that helps provide contextually relevant responses
    3. Keep it concise but comprehensive (200-400 words)
    4. Include personality traits, preferences, communication style if relevant
    5. Avoid overly complimentary language
    6. Make it practical and actionable for an AI assistant
    
    Write a system prompt that captures the essence of this realm:
    """
    
    model = genai.GenerativeModel('gemini-2.5-flash')
    try:
        response = await model.generate_content_async(generation_prompt)
        system_prompt = response.text.strip()
        
        # Generate quality assessment
        quality_prompt = f"""
        Assess the quality of this system prompt on a scale of 0-100:
        
        {system_prompt}
        
        Consider: clarity, specificity, usefulness, and completeness.
        Respond with just a number between 0-100.
        """
        
        quality_response = await model.generate_content_async(quality_prompt)
        quality_score = float(quality_response.text.strip())
        
        # Generate improvement suggestions
        suggestions_prompt = f"""
        Provide 2-3 brief suggestions to improve this system prompt:
        
        {system_prompt}
        
        Return as a JSON array of strings.
        """
        
        suggestions_response = await model.generate_content_async(suggestions_prompt)
        suggestions_text = suggestions_response.text.strip().replace("```json", "").replace("```", "").strip()
        suggested_improvements = json.loads(suggestions_text)
        
        # Determine effectiveness level
        if quality_score >= 80:
            effectiveness = "Excellent - Ready to use"
        elif quality_score >= 60:
            effectiveness = "Good - Minor improvements recommended"
        elif quality_score >= 40:
            effectiveness = "Fair - Consider revisions"
        else:
            effectiveness = "Needs improvement - Major revisions recommended"
            
        return GeneratePromptResponse(
            system_prompt=system_prompt,
            suggested_improvements=suggested_improvements,
            quality_score=quality_score,
            estimated_effectiveness=effectiveness
        )
        
    except Exception as e:
        logger.error(f"Error generating prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate prompt: {e}")

@router.post("/realms/onboard", response_model=OnboardingResponse)
async def onboard_new_realm(request: OnboardingRequest, db: Client = Depends(get_db)):
    """Complete guided onboarding for a new realm"""
    
    if request.name == DEFAULT_REALM_NAME:
        raise HTTPException(status_code=400, detail=f"A realm named '{DEFAULT_REALM_NAME}' already exists and is protected.")
    
    # Generate system prompt if not provided
    system_prompt = ""
    suggested_questions = []
    
    if request.template_id:
        # Use template
        template = next((t for t in REALM_TEMPLATES if t["id"] == request.template_id), None)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
            
        system_prompt = template["system_prompt_template"].format(name="the user")
        suggested_questions = template["suggested_questions"]
        
    elif request.generation_config:
        # Generate from description
        gen_response = await generate_prompt(request.generation_config)
        system_prompt = gen_response.system_prompt
        
        # Generate relevant questions
        questions_prompt = f"""
        Based on this realm description: {request.description}
        
        Generate 4-5 thoughtful reflection questions that would help personalize this realm.
        Return as a JSON array of strings.
        """
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        try:
            questions_response = await model.generate_content_async(questions_prompt)
            questions_text = questions_response.text.strip().replace("```json", "").replace("```", "").strip()
            suggested_questions = json.loads(questions_text)
        except Exception as e:
            logger.warning(f"Failed to generate questions: {e}")
            suggested_questions = [
                "What are your main goals with this realm?",
                "How do you prefer the AI to communicate with you?",
                "What specific areas should the AI focus on?",
                "What outcomes are you hoping to achieve?"
            ]
    
    # Create the realm
    realm_id = str(uuid.uuid4())
    new_realm = {
        "id": realm_id,
        "name": request.name,
        "description": request.description,
        "system_prompt": system_prompt
    }
    
    response = db.table("realms").insert(new_realm).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Error creating realm")
    
    created_realm = response.data[0]
    
    # Create initial reflection questions
    if suggested_questions:
        reflections_to_create = [
            {"realm_id": realm_id, "question": q, "id": str(uuid.uuid4())}
            for q in suggested_questions
        ]
        db.table("reflections").insert(reflections_to_create).execute()
    
    next_steps = [
        "Answer the reflection questions to personalize your realm",
        "Try a conversation to test the AI's understanding",
        "Use the synthesis feature to improve the context over time",
        "Add content sources if you have relevant documents or notes"
    ]
    
    return OnboardingResponse(
        realm=created_realm,
        generated_prompt=system_prompt,
        suggested_questions=suggested_questions,
        next_steps=next_steps
    ) 