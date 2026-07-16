"""
Pydantic схемы для Distribution API
"""
from typing import Optional, List
from pydantic import BaseModel, Field


class ProfileSchema(BaseModel):
    """Профиль девушки для рассылки"""
    name: str
    age: str
    location: str
    owner_uid: int
    uid: Optional[int] = None
    image_url: Optional[str] = None
    is_disabled: bool = False
    apps: List[str] = Field(default_factory=list)


class MessageSchema(BaseModel):
    """Сообщение для отправки в чат"""
    text: str = Field(..., min_length=1, max_length=5000)
    interval: int = Field(default=10, ge=0, le=300)  # Интервал в секундах


class MailMessageSchema(BaseModel):
    """Письмо для отправки"""
    title: str = Field(..., min_length=1, max_length=200)
    text: str = Field(..., min_length=1, max_length=5000)
    pictures_number: List[int] = Field(default_factory=list)


class DistributionConfigSchema(BaseModel):
    """Конфигурация рассылки"""
    # ID в MongoDB (для связи с Node.js backend)
    distribution_id: str
    luxee_account_id: str
    user_id: str
    
    # Профиль для рассылки
    profile: ProfileSchema
    
    # Credentials для авторизации (автоматически из MongoDB)
    username: str
    password: str
    
    # Фильтры
    purchased: bool = True
    free: bool = True
    only_empty_chat: bool = False
    only_not_empty_chat: bool = False
    
    # Исключения и конкретные пользователи
    exclude: List[int] = Field(default_factory=list)
    specific_users: List[int] = Field(default_factory=list)
    
    # Лимиты
    limit: int = Field(default=9999, ge=1, le=10000)
    filter_update_limit: int = Field(default=100, ge=1, le=500)
    max_time_minutes: int = Field(default=99999, ge=0)
    
    # Сообщения (чат или mail, но не оба)
    messages: Optional[List[MessageSchema]] = None
    mail_message: Optional[MailMessageSchema] = None
    
    # Cookies для дополнительной авторизации (опционально)
    cookies: dict = Field(default_factory=dict)


class DistributionStartRequest(BaseModel):
    """Запрос на запуск рассылки"""
    config: DistributionConfigSchema


class DistributionStopRequest(BaseModel):
    """Запрос на остановку рассылки"""
    luxee_account_id: str


class DistributionStatusResponse(BaseModel):
    """Ответ с статусом рассылки"""
    distribution_id: str
    status: str  # 'idle', 'running', 'completed', 'stopped', 'error'
    progress: dict = Field(default_factory=dict)
    error: Optional[str] = None


class ValidateConfigRequest(BaseModel):
    """Запрос на валидацию конфигурации"""
    config: DistributionConfigSchema


class ValidateConfigResponse(BaseModel):
    """Ответ валидации конфигурации"""
    valid: bool
    errors: List[str] = Field(default_factory=list)
