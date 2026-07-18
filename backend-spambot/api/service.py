"""
Business logic wrapper for core spambot functionality

This service converts Pydantic models to core models and manages distribution processes.
"""
import asyncio
import sys
import json
import time
import tempfile
from pathlib import Path
from typing import Dict, Optional, Callable
from datetime import datetime

# Add core/ to Python path so 'from src.' imports work inside core modules
CORE_DIR = Path(__file__).parent.parent / "core"
if str(CORE_DIR) not in sys.path:
    sys.path.insert(0, str(CORE_DIR))

# Import core functionality
from core.src.process import DistributionProcess, extract_profiles
from core.src.models import Distribution, Profile, Message, MailMessage
from core.src.logger import logger

# Import API models
from api.models import (
    DistributionConfigInternal,
    DistributionStatus,
    ProfileInfo,
    ProfilesResponse
)

# Directory for status persistence (cross-platform)
STATUSES_DIR = Path(tempfile.gettempdir()) / "spambot_statuses"
STATUSES_DIR.mkdir(parents=True, exist_ok=True)


class SpambotService:
    """Service to manage spambot distributions"""
    
    def __init__(self):
        self.active_processes: Dict[str, DistributionProcess] = {}
        self.statuses: Dict[str, DistributionStatus] = {}
        self._should_stop: Dict[str, bool] = {}
        self._tasks: Dict[str, asyncio.Task] = {}
    
    async def get_profiles(self, username: str, password: str) -> ProfilesResponse:
        """
        Get list of profiles for a user
        
        This runs the synchronous extract_profiles in a thread pool
        to avoid blocking the async event loop.
        """
        try:
            logger.info(f"[Service] Getting profiles for user: {username}")
            
            # Run synchronous function in thread pool
            loop = asyncio.get_event_loop()
            profiles = await loop.run_in_executor(
                None, 
                extract_profiles, 
                username, 
                password
            )
            
            # Helper function to parse age from string
            def parse_age(age_str: str) -> int:
                """
                Extract numeric age from string.
                Supports: "25", "25 years", "", etc.
                Returns 0 if no valid number found.
                """
                if not age_str or not age_str.strip():
                    return 0
                
                # Try direct conversion first
                age_str = age_str.strip()
                if age_str.isdigit():
                    return int(age_str)
                
                # Try to extract first number from string (e.g., "25 years" -> 25)
                import re
                match = re.search(r'\d+', age_str)
                if match:
                    return int(match.group())
                
                return 0
            
            # Convert core Profile objects to Pydantic ProfileInfo
            profile_list = []
            for p in profiles:
                age_int = parse_age(p.age)
                
                # Debug log to see what we're getting
                logger.debug(f"[Profile Convert] {p.name}: age_str='{p.age}' -> age_int={age_int}")
                
                profile_list.append(ProfileInfo(
                    uid=str(p.uid) if p.uid else str(p.owner_uid),
                    owner_uid=str(p.owner_uid),
                    name=p.name,
                    age=age_int,
                    location=p.location,
                    image_url=p.image_url
                ))
            
            logger.info(f"[Service] Found {len(profile_list)} profiles")
            return ProfilesResponse(profiles=profile_list)
            
        except Exception as e:
            logger.error(f"[Service] Error getting profiles: {e}")
            raise
    
    def _update_distribution_status(
        self, 
        distribution_id: str, 
        sent_count: Optional[int] = None, 
        skipped_count: Optional[int] = None,
        current_client: Optional[str] = None
    ):
        """
        Thread-safe status update callable from executor thread.
        Also persists status to file for recovery after crashes.
        """
        if distribution_id not in self.statuses:
            return
        
        current = self.statuses[distribution_id]
        
        # Update only provided values
        self.statuses[distribution_id] = DistributionStatus(
            status=current.status,
            sent_messages_count=sent_count if sent_count is not None else current.sent_messages_count,
            skipped_clients=skipped_count if skipped_count is not None else current.skipped_clients,
            current_client=current_client if current_client is not None else current.current_client,
            error_message=current.error_message
        )
        
        logger.debug(
            f"[Service] Status updated for {distribution_id}: "
            f"sent={self.statuses[distribution_id].sent_messages_count}, "
            f"skipped={self.statuses[distribution_id].skipped_clients}"
        )
        
        # Persist to file for recovery
        try:
            status_file = STATUSES_DIR / f"{distribution_id}.json"
            status_data = {
                "distribution_id": distribution_id,
                "status": self.statuses[distribution_id].status,
                "sent_messages_count": self.statuses[distribution_id].sent_messages_count,
                "skipped_clients": self.statuses[distribution_id].skipped_clients,
                "current_client": self.statuses[distribution_id].current_client,
                "updated_at": time.time()
            }
            with open(status_file, 'w') as f:
                json.dump(status_data, f)
        except Exception as e:
            logger.warning(f"[Service] Failed to persist status to file: {e}")
            # Don't interrupt workflow if file save fails
    
    def _cleanup_status_file(self, distribution_id: str):
        """Remove status file after completion"""
        try:
            status_file = STATUSES_DIR / f"{distribution_id}.json"
            if status_file.exists():
                status_file.unlink()
                logger.debug(f"[Service] Cleaned up status file for {distribution_id}")
        except Exception as e:
            logger.warning(f"[Service] Failed to cleanup status file: {e}")
    
    async def start_distribution(
        self, 
        config: DistributionConfigInternal, 
        distribution_id: str
    ) -> dict:
        """
        Start a distribution in background
        
        Returns immediately with distribution_id and status.
        The actual distribution runs in a background task.
        """
        try:
            logger.info(f"[Service] Starting distribution {distribution_id}")
            
            # Initialize status
            self.statuses[distribution_id] = DistributionStatus(
                status="idle",
                sent_messages_count=0,
                skipped_clients=0
            )
            
            # Create background task
            task = asyncio.create_task(
                self._run_distribution(config, distribution_id)
            )
            self._tasks[distribution_id] = task
            
            return {
                "distribution_id": distribution_id,
                "status": "started"
            }
            
        except Exception as e:
            logger.error(f"[Service] Error starting distribution: {e}")
            self.statuses[distribution_id] = DistributionStatus(
                status="error",
                error_message=str(e)
            )
            raise
    
    async def _run_distribution(
        self, 
        config: DistributionConfigInternal, 
        distribution_id: str
    ):
        """
        Internal method to run distribution in background
        
        This converts Pydantic models to core models and runs the distribution.
        """
        try:
            logger.info(f"[Service] Running distribution {distribution_id}")
            
            # Update status to running
            self.statuses[distribution_id] = DistributionStatus(
                status="running",
                sent_messages_count=0,
                skipped_clients=0
            )
            
            # Convert Pydantic models to core models
            distribution = self._convert_to_core_distribution(config)
            
            # Create distribution process
            process = DistributionProcess()
            self.active_processes[distribution_id] = process
            
            # Create should_stop_callback for this distribution
            def should_stop_callback() -> bool:
                """Check if this distribution should stop"""
                return self._should_stop.get(distribution_id, False)
            
            # Create status_updater callback for real-time updates
            def status_updater(sent: Optional[int] = None, skipped: Optional[int] = None, client: Optional[str] = None):
                """Callback for real-time status updates from distribution process"""
                self._update_distribution_status(distribution_id, sent, skipped, client)
            
            # Run in thread pool (since it's synchronous and blocking)
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                process.start,
                distribution,
                config.username,
                config.password,
                should_stop_callback,
                status_updater
            )
            
            # Update status to completed
            self.statuses[distribution_id] = DistributionStatus(
                status="completed",
                sent_messages_count=distribution.sent_messages_count,
                skipped_clients=distribution.skipped_clients
            )
            
            logger.info(
                f"[Service] Distribution {distribution_id} completed. "
                f"Sent: {distribution.sent_messages_count}, "
                f"Skipped: {distribution.skipped_clients}"
            )
            
        except Exception as e:
            logger.error(f"[Service] Distribution {distribution_id} error: {e}")
            self.statuses[distribution_id] = DistributionStatus(
                status="error",
                error_message=str(e),
                sent_messages_count=0,
                skipped_clients=0
            )
        
        finally:
            # Cleanup status file
            self._cleanup_status_file(distribution_id)
            
            # Cleanup process
            if distribution_id in self.active_processes:
                try:
                    self.active_processes[distribution_id].finish()
                except Exception as e:
                    logger.error(f"[Service] Error finishing process: {e}")
                del self.active_processes[distribution_id]
    
    def _convert_to_core_distribution(
        self, 
        config: DistributionConfigInternal
    ) -> Distribution:
        """
        Convert Pydantic DistributionConfig to core Distribution model
        """
        # Create Profile object
        profile = Profile(
            name=config.profile_name,
            age="",  # Not needed for API
            location="",  # Not needed for API
            uid=config.profile_uid,
            image_url="",  # Not needed for API
            is_disabled=False
        )
        profile.uid = int(config.profile_uid)
        profile.owner_uid = int(config.profile_uid)
        
        # Convert messages
        messages = None
        mail_message = None
        
        if config.distribution_type == "chat" and config.messages:
            messages = [
                Message(text=msg.text, interval=msg.interval)
                for msg in config.messages
            ]
        elif config.distribution_type == "mail" and config.mail_message:
            mail_message = MailMessage(
                title=config.mail_message.title,
                text=config.mail_message.text,
                pictures_number=config.mail_message.pictures_number
            )
        
        # Create Distribution object
        distribution = Distribution(
            profile=profile,
            purchased=config.purchased,
            free=config.free,
            only_empty_chat=config.only_empty_chat,
            only_not_empty_chat=config.only_not_empty_chat,
            messages=messages,
            mail_message=mail_message,
            exclude=config.exclude_ids,
            limit=config.limit,
            filter_update_limit=config.filter_update_limit,
            max_time_minutes=config.max_time_minutes,
            specific_users=config.specific_users
        )
        
        return distribution
    
    async def stop_distribution(self, distribution_id: str) -> dict:
        """
        Stop a running distribution
        
        Note: Currently the core doesn't have a stop mechanism,
        so this just marks it for stopping.
        """
        logger.info(f"[Service] Stopping distribution {distribution_id}")
        
        self._should_stop[distribution_id] = True
        
        if distribution_id in self._tasks:
            self._tasks[distribution_id].cancel()
        
        if distribution_id in self.statuses:
            self.statuses[distribution_id].status = "stopped"
        
        return {"status": "stopped"}
    
    def get_status(self, distribution_id: str) -> DistributionStatus:
        """Get current status of a distribution"""
        status = self.statuses.get(
            distribution_id,
            DistributionStatus(status="idle")
        )
        
        # Update with current process stats if running
        if distribution_id in self.active_processes:
            process = self.active_processes[distribution_id]
            # Note: This won't work well because DistributionProcess 
            # doesn't expose the distribution object during execution.
            # For now, return stored status.
        
        return status


# Singleton instance
spambot_service = SpambotService()
