"""
FastAPI endpoints для управления рассылками
"""
import logging
from fastapi import APIRouter, HTTPException, status
from typing import Dict

from src.schemas.distribution import (
    DistributionStartRequest,
    DistributionStopRequest,
    DistributionStatusResponse,
    ValidateConfigRequest,
    ValidateConfigResponse
)
from src.services.distribution_manager import distribution_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/distribution", tags=["distribution"])


@router.post("/start", status_code=status.HTTP_200_OK)
async def start_distribution(request: DistributionStartRequest) -> Dict:
    """
    Запуск рассылки
    
    Args:
        request: Конфигурация рассылки
        
    Returns:
        dict: Результат запуска
    """
    try:
        logger.info(f"[Distribution API] 🚀 START request received")
        logger.info(f"[Distribution API] Distribution ID: {request.config.distribution_id}")
        logger.info(f"[Distribution API] Account ID: {request.config.luxee_account_id}")
        logger.info(f"[Distribution API] Profile: {request.config.profile}")
        logger.info(f"[Distribution API] Messages: {len(request.config.messages) if request.config.messages else 0}")
        logger.info(f"[Distribution API] Mail: {bool(request.config.mail_message)}")
        
        result = await distribution_manager.start_distribution(request.config)
        
        logger.info(f"[Distribution API] Result: {result}")
        
        if not result['success']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get('error', 'Failed to start distribution')
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] Error starting distribution: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/stop", status_code=status.HTTP_200_OK)
async def stop_distribution(request: DistributionStopRequest) -> Dict:
    """
    Остановка рассылки
    
    Args:
        request: Luxee account ID для остановки рассылки
        
    Returns:
        dict: Результат остановки
    """
    try:
        logger.info(f"[Distribution API] 🛑 STOP request received")
        logger.info(f"[Distribution API] Luxee Account ID: {request.luxee_account_id}")
        
        result = await distribution_manager.stop_distribution(request.luxee_account_id)
        
        if not result['success']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get('error', 'Failed to stop distribution')
            )
        
        logger.info(f"[Distribution API] ✅ Distribution stopped successfully")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Distribution API] ❌ Error stopping distribution: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/status/{luxee_account_id}", response_model=DistributionStatusResponse)
async def get_status(luxee_account_id: str) -> DistributionStatusResponse:
    """
    Получить статус рассылки для Luxee аккаунта
    
    Args:
        luxee_account_id: ID Luxee аккаунта
        
    Returns:
        DistributionStatusResponse: Статус рассылки
    """
    try:
        status_data = distribution_manager.get_status(luxee_account_id)
        
        if not status_data:
            # Нет активной рассылки
            return DistributionStatusResponse(
                distribution_id="",
                status="idle",
                progress={}
            )
        
        return DistributionStatusResponse(
            distribution_id=status_data.get('distribution_id', ''),
            status=status_data.get('status', 'unknown'),
            progress=status_data.get('progress', {}),
            error=status_data.get('error')
        )
        
    except Exception as e:
        logger.error(f"[API] Error getting status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/context/{luxee_account_id}", status_code=status.HTTP_200_OK)
async def close_context(luxee_account_id: str) -> Dict:
    """
    Закрыть браузерный контекст для Luxee аккаунта
    
    Args:
        luxee_account_id: ID Luxee аккаунта
        
    Returns:
        dict: Результат закрытия
    """
    try:
        logger.info(f"[API] Closing context for account {luxee_account_id}")
        result = await distribution_manager.close_context(luxee_account_id)
        
        if not result['success']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get('error', 'Failed to close context')
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] Error closing context: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/validate", response_model=ValidateConfigResponse)
async def validate_config(request: ValidateConfigRequest) -> ValidateConfigResponse:
    """
    Валидация конфигурации рассылки
    
    Args:
        request: Конфигурация для валидации
        
    Returns:
        ValidateConfigResponse: Результат валидации
    """
    errors = []
    
    # Проверка наличия сообщений
    if not request.config.messages and not request.config.mail_message:
        errors.append("No messages or mail message provided")
    
    # Проверка что не указаны оба типа сообщений
    if request.config.messages and request.config.mail_message:
        errors.append("Cannot send both messages and mail in one distribution")
    
    # Проверка лимитов
    if request.config.limit <= 0:
        errors.append("Limit must be greater than 0")
    
    # Проверка фильтров
    if not request.config.purchased and not request.config.free:
        errors.append("At least one of 'purchased' or 'free' must be true")
    
    # Проверка конфликтующих фильтров чата
    if request.config.only_empty_chat and request.config.only_not_empty_chat:
        errors.append("Cannot filter for both empty and not empty chats")
    
    # Проверка профиля
    if not request.config.profile.name:
        errors.append("Profile name is required")
    
    if not request.config.profile.owner_uid:
        errors.append("Profile owner_uid is required")
    
    return ValidateConfigResponse(
        valid=len(errors) == 0,
        errors=errors
    )


@router.get("/health")
async def health_check() -> Dict:
    """Проверка здоровья сервиса"""
    return {
        "status": "ok",
        "service": "spambot",
        "active_distributions": len(distribution_manager.active_distributions)
    }
