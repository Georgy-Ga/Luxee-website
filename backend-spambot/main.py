"""
Luxee Spambot Service - FastAPI Entry Point

This service wraps the existing spambot core functionality with a REST API.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Import API routes
from api.routes import router

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Luxee Spambot Service",
    description="REST API wrapper for Luxee Spambot core functionality",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api", tags=["spambot"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "luxee-spambot",
        "version": "1.0.0"
    }


@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "message": "Luxee Spambot Service API",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8001"))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"🚀 Starting Luxee Spambot Service on {host}:{port}")
    print(f"📖 API Docs: http://localhost:{port}/docs")
    
    # Use app object directly (not string) to avoid import confusion
    uvicorn.run(
        app,  # Direct reference, not "main:app" string
        host=host,
        port=port,
        reload=False  # Reload causes core/main.py conflict
    )
