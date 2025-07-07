from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import realms, chats, llm

app = FastAPI(
    title="Pathfinder API",
    description="Smart chat application for personal reflection with persistent storage",
    version="1.0.0"
)

# Configure CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(realms.router)
app.include_router(chats.router)
app.include_router(llm.router)

@app.get("/")
async def root():
    return {"message": "Pathfinder API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True) 