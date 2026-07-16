"""
FastAPI приложение для Spambot Service
Обертка над оригинальным spambot кодом
"""
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from src.api import distribution_router, auth_router
from src.services.context_manager import context_manager
from config import CONFIG

# Загрузка переменных окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(name)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle события FastAPI приложения"""
    # Startup
    logger.info("=" * 60)
    logger.info("🚀 Spambot Service Starting...")
    logger.info(f"Hidden Browser: {CONFIG.HIDDEN_BROWSER}")
    logger.info(f"Skip Sending Messages (Debug): {CONFIG.SKIP_SENDING_MESSAGE}")
    logger.info(f"Node Backend URL: {CONFIG.NODE_BACKEND_URL}")
    logger.info("=" * 60)
    
    yield
    
    # Shutdown
    logger.info("🛑 Spambot Service Shutting down...")
    logger.info("🧹 Closing all active contexts...")
    context_manager.close_all_contexts()
    logger.info("✅ Cleanup completed")


# Создание FastAPI приложения
app = FastAPI(
    title="Luxee Spambot Service",
    description="Python service для массовой рассылки сообщений на Luxee.io",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В production ограничить до Node.js backend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутов
app.include_router(distribution_router)
app.include_router(auth_router, prefix="/api/spambot", tags=["auth"])


@app.get("/")
async def root():
    """Корневой endpoint"""
    return {
        "service": "Luxee Spambot Service",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "spambot"
    }


if __name__ == "__main__":
    import uvicorn
    import os
    
    port = int(os.getenv("SPAMBOT_PORT", 8001))
    host = os.getenv("SPAMBOT_HOST", "0.0.0.0")
    
    logger.info(f"Starting Uvicorn server on {host}:{port}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,  # В production отключить reload
        log_level="info"
    )
