"""
Auth API - эндпоинты для авторизации Luxee аккаунтов
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from src.services.context_manager import context_manager

logger = logging.getLogger(__name__)

router = APIRouter()


class AuthRequest(BaseModel):
    """Запрос на авторизацию аккаунта"""
    luxee_account_id: str
    username: str
    password: str
    cookies: Optional[dict] = None


class AuthResponse(BaseModel):
    """Ответ после авторизации"""
    success: bool
    luxee_account_id: str
    status: str
    profiles_count: Optional[int] = None
    error: Optional[str] = None


class ProfilesResponse(BaseModel):
    """Ответ со списком профилей"""
    success: bool
    luxee_account_id: str
    profiles: list
    error: Optional[str] = None


class ContextStatusResponse(BaseModel):
    """Статус контекста"""
    success: bool
    luxee_account_id: str
    authenticated: bool
    active_contexts: int


@router.post("/auth", response_model=AuthResponse)
async def authenticate_account(request: AuthRequest):
    """
    Авторизовать Luxee аккаунт в spambot
    Создаёт браузерный контекст и авторизуется
    
    Args:
        request: Данные для авторизации (username, password)
        
    Returns:
        AuthResponse с статусом и количеством профилей
    """
    try:
        logger.info(f"[Auth API] Authentication request for account {request.luxee_account_id}")
        
        # Создаём контекст (или получаем существующий)
        luxee_instance = context_manager.create_context(
            luxee_account_id=request.luxee_account_id,
            username=request.username,
            password=request.password
        )
        
        # Получаем профили для подсчёта
        try:
            profiles = luxee_instance.get_profiles()
            profiles_count = len(profiles)
            logger.info(f"[Auth API] Account {request.luxee_account_id} authenticated. Found {profiles_count} profiles")
        except Exception as e:
            logger.warning(f"[Auth API] Could not get profiles count: {e}")
            profiles_count = None
        
        return AuthResponse(
            success=True,
            luxee_account_id=request.luxee_account_id,
            status="authenticated",
            profiles_count=profiles_count
        )
        
    except Exception as e:
        logger.error(f"[Auth API] Authentication failed for account {request.luxee_account_id}: {e}")
        return AuthResponse(
            success=False,
            luxee_account_id=request.luxee_account_id,
            status="error",
            error=str(e)
        )


@router.get("/profiles/{luxee_account_id}", response_model=ProfilesResponse)
async def get_account_profiles(luxee_account_id: str):
    """
    Получить список профилей для авторизованного аккаунта
    
    Args:
        luxee_account_id: ID аккаунта в MongoDB
        
    Returns:
        ProfilesResponse со списком профилей
    """
    try:
        logger.info(f"[Auth API] Get profiles request for account {luxee_account_id}")
        
        # Получаем существующий контекст
        luxee_instance = context_manager.get_context(luxee_account_id)
        
        if not luxee_instance:
            raise HTTPException(
                status_code=404,
                detail=f"Account {luxee_account_id} is not authenticated. Please authenticate first."
            )
        
        # Получаем профили
        profiles = luxee_instance.get_profiles()
        
        # Преобразуем в JSON-совместимый формат
        # uid - это то же что owner_uid (ID профиля для API)
        profiles_data = []
        for profile in profiles:
            profiles_data.append({
                "uid": str(profile.owner_uid),  # Frontend ожидает строку
                "name": profile.name,
                "age": profile.age,
                "location": profile.location,
                "image_url": profile.image_url,
                "owner_uid": profile.owner_uid,
                "apps": profile.apps,
                "is_disabled": profile.is_disabled
            })
        
        logger.info(f"[Auth API] Found {len(profiles_data)} profiles for account {luxee_account_id}")
        
        return ProfilesResponse(
            success=True,
            luxee_account_id=luxee_account_id,
            profiles=profiles_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Auth API] Error getting profiles for account {luxee_account_id}: {e}")
        return ProfilesResponse(
            success=False,
            luxee_account_id=luxee_account_id,
            profiles=[],
            error=str(e)
        )


@router.get("/status/{luxee_account_id}", response_model=ContextStatusResponse)
async def get_context_status(luxee_account_id: str):
    """
    Проверить статус контекста аккаунта
    
    Args:
        luxee_account_id: ID аккаунта в MongoDB
        
    Returns:
        ContextStatusResponse с информацией о контексте
    """
    authenticated = context_manager.has_context(luxee_account_id)
    active_contexts = context_manager.get_context_count()
    
    logger.info(f"[Auth API] Status check for account {luxee_account_id}: authenticated={authenticated}")
    
    return ContextStatusResponse(
        success=True,
        luxee_account_id=luxee_account_id,
        authenticated=authenticated,
        active_contexts=active_contexts
    )


@router.delete("/context/{luxee_account_id}")
async def close_account_context(luxee_account_id: str):
    """
    Закрыть браузерный контекст аккаунта
    
    Args:
        luxee_account_id: ID аккаунта в MongoDB
        
    Returns:
        Статус операции
    """
    try:
        logger.info(f"[Auth API] Close context request for account {luxee_account_id}")
        
        success = context_manager.close_context(luxee_account_id)
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Context not found for account {luxee_account_id}"
            )
        
        return {
            "success": True,
            "luxee_account_id": luxee_account_id,
            "message": "Context closed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Auth API] Error closing context for account {luxee_account_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contexts")
async def get_active_contexts():
    """
    Получить список всех активных контекстов
    
    Returns:
        Список ID активных аккаунтов
    """
    active_accounts = context_manager.get_active_accounts()
    context_count = context_manager.get_context_count()
    
    logger.info(f"[Auth API] Active contexts: {context_count}")
    
    return {
        "success": True,
        "active_contexts": context_count,
        "accounts": active_accounts
    }
