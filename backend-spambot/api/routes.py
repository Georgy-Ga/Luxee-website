"""
API routes for spambot service
"""
import uuid
from fastapi import APIRouter, HTTPException, Query
from api.models import (
    DistributionConfig,
    DistributionConfigInternal,
    DistributionStatus,
    DistributionStartResponse,
    ProfilesResponse
)
from api.service import spambot_service

router = APIRouter()


@router.post("/distribution/start", response_model=DistributionStartResponse)
async def start_distribution(config: DistributionConfigInternal):
    """
    Start a new distribution
    
    This will:
    1. Validate the configuration
    2. Start the distribution in background
    3. Return immediately with distribution_id
    
    Use /distribution/{id}/status to check progress.
    """
    try:
        # Generate unique ID
        distribution_id = str(uuid.uuid4())
        
        # Start distribution (returns immediately, runs in background)
        result = await spambot_service.start_distribution(config, distribution_id)
        
        return DistributionStartResponse(
            distribution_id=result["distribution_id"],
            status=result["status"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/distribution/{distribution_id}/stop")
async def stop_distribution(distribution_id: str):
    """
    Stop a running distribution
    
    Note: The core doesn't support graceful stopping yet,
    so this will cancel the background task.
    """
    try:
        result = await spambot_service.stop_distribution(distribution_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/distribution/{distribution_id}/status", response_model=DistributionStatus)
async def get_distribution_status(distribution_id: str):
    """
    Get current status of a distribution
    
    Returns:
    - status: 'idle', 'running', 'completed', 'error', 'stopped'
    - sent_messages_count: Number of messages sent
    - skipped_clients: Number of clients skipped
    - error_message: Error message if status is 'error'
    """
    try:
        status = spambot_service.get_status(distribution_id)
        
        if status.status == "idle" and distribution_id not in spambot_service.statuses:
            raise HTTPException(
                status_code=404,
                detail=f"Distribution {distribution_id} not found"
            )
        
        return status
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profiles", response_model=ProfilesResponse)
async def get_profiles(
    username: str = Query(..., description="Luxee username"),
    password: str = Query(..., description="Luxee password")
):
    """
    Get list of profiles for a user
    
    This will:
    1. Login to Luxee
    2. Extract all profiles
    3. Logout
    4. Return profile list
    
    Note: This operation may take 10-30 seconds.
    """
    try:
        profiles = await spambot_service.get_profiles(username, password)
        return profiles
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get profiles: {str(e)}"
        )


@router.get("/limits")
async def get_profile_limits(
    username: str = Query(..., description="Luxee username"),
    password: str = Query(..., description="Luxee password")
):
    """
    Get daily distribution limits per profile (анкета).

    Returns { data: { str(owner_uid): {"chat": {max, count}, "mail": {max, count}} } }

    Lightweight - used to refresh limits without re-fetching all profiles.
    """
    try:
        return await spambot_service.get_profile_limits(username, password)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get profile limits: {str(e)}"
        )
