"""
Pydantic models for API requests and responses

These models match the data structures used in the GUI application.
"""
from pydantic import BaseModel, Field
from typing import List, Optional


class MessageCreate(BaseModel):
    """Single chat message with interval"""
    text: str = Field(..., description="Message text")
    interval: int = Field(0, ge=0, description="Interval in seconds before sending this message")
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "Привет! Как дела?",
                "interval": 0
            }
        }


class MailMessageCreate(BaseModel):
    """Mail message with title, text and optional images"""
    title: str = Field(..., min_length=1, description="Mail title")
    text: str = Field(..., min_length=150, max_length=3500, description="Mail text (150-3500 characters)")
    pictures_number: List[int] = Field(default=[], description="List of picture numbers to attach")
    
    class Config:
        json_schema_extra = {
            "example": {
                "title": "Заголовок письма",
                "text": "Текст письма минимум 150 символов...",
                "pictures_number": [1, 2, 3]
            }
        }


class DistributionConfig(BaseModel):
    """
    Configuration for a distribution campaign (PUBLIC - from Frontend)
    
    NOTE: This model does NOT include credentials.
    Credentials are added by Node.js backend from MongoDB.
    """
    
    # Profile selection
    profile_uid: str = Field(..., description="Profile UID to send from")
    profile_name: str = Field(..., description="Profile name for display")
    
    # Distribution type
    distribution_type: str = Field(..., pattern="^(chat|mail)$", description="Type: 'chat' or 'mail'")
    
    # Filters - User type
    purchased: bool = Field(True, description="Include paid users")
    free: bool = Field(True, description="Include free users")
    
    # Filters - Chat condition
    only_empty_chat: bool = Field(False, description="Send only to users with empty chat")
    only_not_empty_chat: bool = Field(False, description="Send only to users with non-empty chat")
    
    # Messages (one of these must be provided based on distribution_type)
    messages: Optional[List[MessageCreate]] = Field(None, description="List of messages (for chat type)")
    mail_message: Optional[MailMessageCreate] = Field(None, description="Mail message (for mail type)")
    
    # Limits
    exclude_ids: List[int] = Field(default=[], description="List of user IDs to exclude")
    specific_users: List[int] = Field(default=[], description="List of specific user IDs to send to (overrides other filters)")
    limit: int = Field(..., gt=0, description="Maximum number of messages to send")
    filter_update_limit: int = Field(..., gt=0, description="Refresh user list after N messages")
    max_time_minutes: int = Field(180, gt=0, description="Maximum time for distribution in minutes")


class DistributionConfigInternal(DistributionConfig):
    """
    INTERNAL model with credentials (used only between Node.js and Python Service)
    
    This extends DistributionConfig and adds credentials that Node.js
    retrieves from MongoDB LuxeeAccount.
    
    Security: This model should NEVER be exposed to frontend!
    """
    
    # Credentials (added by Node.js backend from MongoDB)
    username: str = Field(..., description="Luxee account username (from MongoDB)")
    password: str = Field(..., description="Luxee account password (from MongoDB)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "username": "model@example.com",
                "password": "password123",
                "profile_uid": "123456",
                "profile_name": "Anna, 25",
                "distribution_type": "chat",
                "purchased": True,
                "free": True,
                "only_empty_chat": False,
                "only_not_empty_chat": False,
                "messages": [
                    {"text": "Привет!", "interval": 0},
                    {"text": "Как дела?", "interval": 2}
                ],
                "mail_message": None,
                "exclude_ids": [100, 200],
                "specific_users": [],
                "limit": 50,
                "filter_update_limit": 10,
                "max_time_minutes": 180
            }
        }


class DistributionStatus(BaseModel):
    """Current status of a distribution"""
    status: str = Field(..., description="Status: 'idle', 'running', 'completed', 'error', 'stopped'")
    sent_messages_count: int = Field(0, ge=0, description="Number of messages sent")
    skipped_clients: int = Field(0, ge=0, description="Number of clients skipped")
    current_client: Optional[str] = Field(None, description="Current client being processed")
    error_message: Optional[str] = Field(None, description="Error message if status is 'error'")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "running",
                "sent_messages_count": 25,
                "skipped_clients": 3,
                "current_client": "User123",
                "error_message": None
            }
        }


class DistributionStartResponse(BaseModel):
    """Response when starting a distribution"""
    distribution_id: str = Field(..., description="Unique ID for this distribution")
    status: str = Field(..., description="Initial status")
    
    class Config:
        json_schema_extra = {
            "example": {
                "distribution_id": "550e8400-e29b-41d4-a716-446655440000",
                "status": "started"
            }
        }


class ProfileInfo(BaseModel):
    """Profile information"""
    uid: str = Field(..., description="Profile UID")
    owner_uid: str = Field(..., description="Owner UID")
    name: str = Field(..., description="Profile name")
    age: int = Field(..., description="Profile age")
    location: str = Field(..., description="Profile location")
    image_url: str = Field(..., description="Profile image URL")
    limits: Optional[dict] = Field(None, description="Daily distribution limits per channel ({chat|mail}: {max, count})")
    
    class Config:
        json_schema_extra = {
            "example": {
                "uid": "123456",
                "owner_uid": "789012",
                "name": "Anna",
                "age": 25,
                "location": "Moscow",
                "image_url": "https://example.com/image.jpg"
            }
        }


class ProfilesResponse(BaseModel):
    """Response with list of profiles"""
    profiles: List[ProfileInfo] = Field(..., description="List of available profiles")
    
    class Config:
        json_schema_extra = {
            "example": {
                "profiles": [
                    {
                        "uid": "123456",
                        "owner_uid": "789012",
                        "name": "Anna",
                        "age": 25,
                        "location": "Moscow",
                        "image_url": "https://example.com/image.jpg"
                    }
                ]
            }
        }
