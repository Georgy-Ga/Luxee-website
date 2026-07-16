"""
Pydantic схемы для Status API
"""
from typing import Optional
from pydantic import BaseModel, Field


class ProgressUpdate(BaseModel):
    """Обновление прогресса рассылки"""
    distribution_id: str
    sent_count: int = 0
    skipped_count: int = 0
    total_processed: int = 0
    current_profile: Optional[str] = None
    message: Optional[str] = None


class ErrorUpdate(BaseModel):
    """Обновление об ошибке"""
    distribution_id: str
    error: str
    traceback: Optional[str] = None


class StatusUpdate(BaseModel):
    """Обновление статуса рассылки"""
    distribution_id: str
    status: str  # 'running', 'completed', 'stopped', 'error'
    progress: Optional[ProgressUpdate] = None
    error: Optional[str] = None
