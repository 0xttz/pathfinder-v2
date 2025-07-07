# Pathfinder

A smart chat application for personal reflection with persistent storage. Create structured "Realms" for different life areas and engage in focused conversations with AI that remember your context.

## Project Overview

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Python + FastAPI + Supabase + Google Gemini API
- **Database**: Supabase (PostgreSQL)
- **Architecture**: Single-user model with simplified persistence

## Project Structure

```
pathfinder/
├── frontend/           # React frontend application
├── backend/           # FastAPI backend application
├── PROJECT_SUMMARY.md # Feature specifications and architecture
├── .cursorrules      # Project-specific development guidelines
├── .gitignore        # Git exclusions
└── README.md         # This file
```

## Setup Instructions

### Prerequisites

- Node.js (v18+ recommended)
- Python (v3.9+ recommended)
- Git

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Activate virtual environment:
   ```bash
   # On macOS/Linux
   source venv/bin/activate
   
   # On Windows
   venv\Scripts\activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   ```bash
   # Create .env file in backend directory
   # Add your Supabase and Google Gemini API credentials
   ```

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Dependencies are already installed. If you need to reinstall:
   ```bash
   npm install
   ```

## Development Commands

### Backend Commands

```bash
# From project root
cd backend

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate     # Windows

# Start development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Commands

```bash
# From project root
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run tsc

# Linting
npm run lint
```

## Testing Commands

### Test Backend Setup
```bash
cd backend
source venv/bin/activate
python -c "import fastapi; import supabase; import google.generativeai; print('All backend dependencies installed successfully!')"
```

### Test Frontend Setup
```bash
cd frontend
npm run tsc --noEmit
echo "Frontend TypeScript compilation successful!"
```

### Verify Project Structure
```bash
# From project root
find . -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" | grep -E "(requirements\.txt|package\.json|tsconfig\.json)" | head -10
```

## Development Workflow

1. **Phase 1**: Core Chat & Persistence
   - Basic chat interface with message history
   - Supabase integration for data persistence
   - Single-user data model

2. **Phase 2**: Persistent Realms
   - CRUD operations for Realms
   - System prompt management
   - Realm-scoped conversations

3. **Phase 3**: Guided Synthesis
   - AI-generated reflection questions
   - Answer synthesis into system prompts
   - Enhanced context for conversations

## Key Features

- **Single-User Model**: Simplified architecture without user account complexity
- **Persistent Storage**: All data saved to Supabase database
- **Real-time Chat**: Streaming responses from Google Gemini API
- **Structured Reflection**: Guided questions and synthesis for deeper insights
- **Clean UI**: Minimalistic interface built with Tailwind CSS

## Environment Variables

### Backend (.env)
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
```

## Database Schema

- `realms`: User-created life areas with system prompts
- `reflections`: Q&A pairs for guided synthesis
- `chats`: Chat sessions linked to realms
- `chat_messages`: Individual messages in conversations

Single-user data model with simplified table relationships.

## Development Guidelines

- Follow `.cursorrules` for project-specific conventions
- Use TypeScript for frontend development
- Include type hints in Python backend code
- Maintain separation between frontend/backend
- Test changes manually before committing
- Single-user architecture with persistent storage

## Git Workflow

```bash
# Initial commit
git add .
git commit -m "Initial project setup: frontend, backend, and configuration"

# Create GitHub repository (replace with your username)
gh repo create pathfinder --public --source=. --remote=origin --push
``` 