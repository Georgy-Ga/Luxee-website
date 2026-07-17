"""
Luxee Spambot Service Runner

Simplified runner for FastAPI service.
Python path management handled in api/service.py to avoid conflicts.
"""
import os

if __name__ == "__main__":
    import uvicorn
    from main import app  # Direct import to avoid reload conflicts
    
    port = int(os.getenv("PORT", "8001"))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"🚀 Starting Luxee Spambot Service")
    print(f"📍 Address: http://{host}:{port}")
    print(f"📖 API Docs: http://localhost:{port}/docs")
    print(f"❤️  Health Check: http://localhost:{port}/health")
    
    uvicorn.run(
        app,  # Direct app reference, not string
        host=host,
        port=port,
        reload=False  # Reload=True causes core/main.py conflict
    )
