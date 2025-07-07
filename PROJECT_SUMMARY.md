Pathfinder: MVP Plan (Single User with Supabase DB)
This document outlines a refined plan for building the Pathfinder MVP. This version uses a single-user model, removing the complexity of user accounts and session management while leveraging a persistent Supabase database for storing all data.

1. Elevator Pitch
Pathfinder is a smart chat application for personal reflection. It lets you define different "Realms" for your life (e.g., 'Career', 'Personal Growth'). By answering guided questions, Pathfinder synthesizes a rich context, enabling more focused and insightful conversations with the Gemini AI that are automatically saved and persist across sessions.

2. The Core Problem
Standard LLM chats are stateless and impersonal. Valuable reflections are often lost. Pathfinder solves this by creating a persistent, structured memory, making interactions with AI deeply personal and effective without the friction of user accounts.

3. The Vision & Solution
The solution is a React single-page application (SPA) with a Python (FastAPI) backend. It's architected for persistent data storage with a simplified single-user model.

Core Chat: Build a clean chat interface that works immediately. All chat conversations are saved to a Supabase database for persistence across sessions.

Persistent Context Realms: Users can create and manage Realms. Each Realm and its System Prompt are saved persistently in the database. In the chat, a user can load a Realm to provide deep context for the conversation.

Guided Synthesis: Within each Realm, users can answer AI-generated questions. A "Synthesize" feature uses an AI call to transform these Q&As into a powerful, narrative System Prompt, which is then saved to the database.

4. Feature Scope: A 3-Phase MVP
Phase 1: Core Chat & Persistence
Frontend (React):

A primary chat view that fetches and displays message history.

Input for sending new messages with real-time API communication.

Renders streaming responses from the AI in real-time.

Backend (FastAPI):

Endpoints to manage chat history: create a new chat, send a message, and retrieve messages for a specific chat.

Secure integration with the Google Gemini API.

Phase 2: Add Persistent Realms
Frontend (React):

A "Realms" management view.

Full CRUD interface for Realms.

Backend (FastAPI):

Full CRUD API endpoints for /realms.

Phase 3: Add Guided Synthesis
Frontend (React):

In the Realm view, a "Guided Reflection" section.

Buttons to "Generate Reflection Questions" and "Synthesize" answers.

Backend (FastAPI):

POST /realms/{realm_id}/generate-questions: Calls Gemini to create questions.

POST /realms/{realm_id}/synthesize: Calls Gemini to synthesize Q&A pairs and updates the realm's system_prompt in the database.

5. Tech Stack
Frontend Framework: React (with Vite)

Styling: Tailwind CSS

Database: Supabase (PostgreSQL)

Backend Framework: Python with FastAPI

LLM Provider: Google Gemini API

6. High-Level Architecture Flow
graph TD
    subgraph "User's Browser"
        A[React Frontend]
    end

    subgraph "Backend (FastAPI)"
        C[API Endpoints]
        D[LLM Service Module]
        E[Supabase Client]
    end

    A -->|API Requests| C;
    C -->|CRUD Operations| E;
    C -->|LLM Tasks| D;
    D -->|Calls Gemini API| F[Google Gemini API];
    E -->|Talks to DB| G[Supabase PostgreSQL];
    F -->|Response| D;
    G -->|Data| E;

7. Database Schema (Supabase/Postgres)
Data is stored in a relational database with a simplified single-user model.

realms table

id (uuid, primary key)

name (text, not null)

system_prompt (text, nullable)

created_at (timestamp with time zone)

reflections table (The Q&A)

id (uuid, primary key)

realm_id (uuid, foreign key to realms.id)

question (text, not null)

answer (text, nullable)

created_at (timestamp with time zone)

chats table

id (uuid, primary key)

realm_id (uuid, foreign key to realms.id, nullable)

title (text, nullable)

created_at (timestamp with time zone)

chat_messages table

id (uuid, primary key)

chat_id (uuid, foreign key to chats.id)

role (text, 'user' or 'model')

content (text, not null)

created_at (timestamp with time zone)

8. Core API Endpoints
All endpoints operate on the single-user data model.

Realms

GET /realms: Get all realms.

POST /realms: Create a new realm.

PUT /realms/{realm_id}: Update a realm.

DELETE /realms/{realm_id}: Delete a realm.

Chats & Messages

GET /chats: Get all chat sessions.

GET /chats/{chat_id}/messages: Retrieve all messages for a specific chat.

POST /chats/{chat_id}/messages: Send a new message to a chat.

LLM Services

POST /realms/{realm_id}/generate-questions: Trigger question generation.

POST /realms/{realm_id}/synthesize: Trigger profile synthesis from reflections.