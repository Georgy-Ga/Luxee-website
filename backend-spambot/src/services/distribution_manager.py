"""
DistributionManager - управление рассылками
Singleton для управления активными рассылками и предотвращения конфликтов
"""
import asyncio
import logging
import threading
import traceback
import httpx
from typing import Dict, Optional
from datetime import datetime

from src.core.models import Profile, Distribution, Message, MailMessage
from src.core.process import DistributionProcess
from src.schemas.distribution import DistributionConfigSchema
from src.services.auth_manager import AuthManager
from config import CONFIG

logger = logging.getLogger(__name__)


class DistributionManager:
    """
    Singleton менеджер для управления рассылками
    
    Основные функции:
    1. Контроль одной активной рассылки на один Luxee аккаунт
    2. Управление жизненным циклом рассылок
    3. Отслеживание прогресса
    4. Отправка обновлений в Node.js backend через HTTP
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        # Map: luxee_account_id -> DistributionProcess
        self.active_distributions: Dict[str, DistributionProcess] = {}
        
        # Map: luxee_account_id -> thread
        self.distribution_threads: Dict[str, threading.Thread] = {}
        
        # Map: luxee_account_id -> статус
        self.distribution_status: Dict[str, dict] = {}
        
        # Map: luxee_account_id -> флаг остановки
        self.stop_flags: Dict[str, threading.Event] = {}
        
        self._initialized = True
        logger.info("[DistributionManager] Initialized")
        logger.info(f"[DistributionManager] Node.js backend URL: {CONFIG.NODE_BACKEND_URL}")
    
    async def _send_progress_to_backend(self, distribution_id: str, progress: dict):
        """
        Отправка прогресса в Node.js backend через HTTP
        
        Args:
            distribution_id: ID рассылки
            progress: Данные прогресса
        """
        try:
            url = f"{CONFIG.NODE_BACKEND_URL}/api/distributions/webhook/progress"
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json={
                    'distribution_id': distribution_id,
                    'progress': progress
                })
                
                if response.status_code == 200:
                    logger.debug(f"[DistributionManager] Progress sent to backend for {distribution_id}")
                else:
                    logger.warning(f"[DistributionManager] Failed to send progress: {response.status_code}")
                    
        except Exception as e:
            logger.error(f"[DistributionManager] Error sending progress to backend: {e}")
    
    async def _send_completion_to_backend(self, distribution_id: str, status: str, error: str = None):
        """
        Отправка завершения в Node.js backend через HTTP
        
        Args:
            distribution_id: ID рассылки
            status: Финальный статус
            error: Сообщение об ошибке (опционально)
        """
        try:
            url = f"{CONFIG.NODE_BACKEND_URL}/api/distributions/webhook/complete"
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json={
                    'distribution_id': distribution_id,
                    'status': status,
                    'error': error
                })
                
                if response.status_code == 200:
                    logger.info(f"[DistributionManager] Completion sent to backend for {distribution_id}")
                else:
                    logger.warning(f"[DistributionManager] Failed to send completion: {response.status_code}")
                    
        except Exception as e:
            logger.error(f"[DistributionManager] Error sending completion to backend: {e}")
    
    def is_account_busy(self, luxee_account_id: str) -> bool:
        """
        Проверка, занят ли Luxee аккаунт рассылкой
        
        Args:
            luxee_account_id: ID Luxee аккаунта
            
        Returns:
            bool: True если аккаунт занят
        """
        return luxee_account_id in self.active_distributions
    
    def get_status(self, luxee_account_id: str) -> Optional[dict]:
        """
        Получить статус рассылки для аккаунта
        
        Args:
            luxee_account_id: ID Luxee аккаунта
            
        Returns:
            dict: Статус рассылки или None
        """
        return self.distribution_status.get(luxee_account_id)
    
    def _convert_config_to_distribution(self, config: DistributionConfigSchema) -> Distribution:
        """
        Конвертирует DistributionConfigSchema в Distribution (оригинальная модель spambot)
        
        Args:
            config: Конфигурация из FastAPI
            
        Returns:
            Distribution: Объект для spambot
        """
        # Создаем Profile
        profile = Profile(
            name=config.profile.name,
            age=config.profile.age,
            location=config.profile.location,
            uid=str(config.profile.owner_uid),
            image_url=config.profile.image_url,
            is_disabled=config.profile.is_disabled
        )
        profile.uid = config.profile.uid
        profile.apps = config.profile.apps
        
        # Создаем Messages или MailMessage
        messages = None
        mail_message = None
        
        if config.messages:
            messages = [
                Message(text=msg.text, interval=msg.interval)
                for msg in config.messages
            ]
        
        if config.mail_message:
            mail_message = MailMessage(
                title=config.mail_message.title,
                text=config.mail_message.text,
                pictures_number=config.mail_message.pictures_number
            )
        
        # Создаем Distribution
        distribution = Distribution(
            profile=profile,
            purchased=config.purchased,
            free=config.free,
            only_empty_chat=config.only_empty_chat,
            only_not_empty_chat=config.only_not_empty_chat,
            exclude=config.exclude,
            limit=config.limit,
            filter_update_limit=config.filter_update_limit,
            messages=messages,
            mail_message=mail_message,
            max_time_minutes=config.max_time_minutes,
            specific_users=config.specific_users
        )
        
        return distribution
    
    def _run_distribution(
        self, 
        config: DistributionConfigSchema,
        username: str,
        password: str
    ):
        """
        Запускает рассылку в отдельном потоке
        
        Args:
            config: Конфигурация рассылки
            username: Логин Luxee
            password: Пароль Luxee
        """
        luxee_account_id = config.luxee_account_id
        distribution_id = config.distribution_id
        
        try:
            logger.info(f"[Distribution {distribution_id}] Starting for account {luxee_account_id}")
            
            # Обновляем статус
            self.distribution_status[luxee_account_id] = {
                'distribution_id': distribution_id,
                'status': 'running',
                'progress': {
                    'sent_count': 0,
                    'skipped_count': 0,
                    'current_profile': config.profile.name
                },
                'started_at': datetime.now().isoformat()
            }
            
            # Создаем Distribution объект
            distribution = self._convert_config_to_distribution(config)
            
            # Передаём stop_flag в distribution для graceful shutdown
            distribution.stop_flag = self.stop_flags[luxee_account_id]
            
            # Создаем DistributionProcess
            process = DistributionProcess()
            self.active_distributions[luxee_account_id] = process
            
            # Запускаем рассылку
            # TODO: Передать cookies для авторизации
            process.start(distribution, username, password)
            
            # Обновляем прогресс
            progress = {
                'sent_count': distribution.sent_messages_count,
                'skipped_count': distribution.skipped_clients,
                'total_processed': distribution.sent_messages_count + distribution.skipped_clients
            }
            self.distribution_status[luxee_account_id]['progress'].update(progress)
            
            # Отправляем финальный прогресс в backend
            asyncio.run(self._send_progress_to_backend(distribution_id, progress))
            
            # Проверяем флаг остановки
            if luxee_account_id in self.stop_flags and self.stop_flags[luxee_account_id].is_set():
                logger.info(f"[Distribution {distribution_id}] Stopped by user")
                self.distribution_status[luxee_account_id]['status'] = 'stopped'
                final_status = 'stopped'
            else:
                logger.info(f"[Distribution {distribution_id}] Completed successfully")
                self.distribution_status[luxee_account_id]['status'] = 'completed'
                final_status = 'completed'
            
            self.distribution_status[luxee_account_id]['completed_at'] = datetime.now().isoformat()
            
            # Отправляем завершение в backend
            asyncio.run(self._send_completion_to_backend(distribution_id, final_status))
            
        except Exception as e:
            logger.error(f"[Distribution {distribution_id}] Error: {e}")
            logger.error(traceback.format_exc())
            
            error_msg = str(e)
            self.distribution_status[luxee_account_id].update({
                'status': 'error',
                'error': error_msg,
                'completed_at': datetime.now().isoformat()
            })
            
            # Отправляем ошибку в backend
            asyncio.run(self._send_completion_to_backend(distribution_id, 'error', error_msg))
        
        finally:
            # Очистка
            process.finish()
            
            if luxee_account_id in self.active_distributions:
                del self.active_distributions[luxee_account_id]
            
            if luxee_account_id in self.distribution_threads:
                del self.distribution_threads[luxee_account_id]
            
            if luxee_account_id in self.stop_flags:
                del self.stop_flags[luxee_account_id]
            
            logger.info(f"[Distribution {distribution_id}] Cleanup completed")
    
    async def start_distribution(
        self,
        config: DistributionConfigSchema
    ) -> dict:
        """
        Запускает рассылку для Luxee аккаунта
        
        Args:
            config: Конфигурация рассылки
            
        Returns:
            dict: Результат запуска
        """
        luxee_account_id = config.luxee_account_id
        distribution_id = config.distribution_id
        
        logger.info(f"[DistributionManager] 🚀 START DISTRIBUTION")
        logger.info(f"[DistributionManager]   Distribution ID: {distribution_id}")
        logger.info(f"[DistributionManager]   Account ID: {luxee_account_id}")
        logger.info(f"[DistributionManager]   Username: {config.username}")
        logger.info(f"[DistributionManager]   Profile: {config.profile.name} (UID: {config.profile.owner_uid})")
        logger.info(f"[DistributionManager]   Messages: {len(config.messages) if config.messages else 0}")
        logger.info(f"[DistributionManager]   Mail: {bool(config.mail_message)}")
        
        # Проверка что аккаунт не занят
        if self.is_account_busy(luxee_account_id):
            logger.warning(f"[Distribution {distribution_id}] Account {luxee_account_id} is busy")
            return {
                'success': False,
                'error': 'Account is already running a distribution'
            }
        
        # Валидация конфигурации
        if not config.messages and not config.mail_message:
            return {
                'success': False,
                'error': 'No messages or mail message provided'
            }
        
        # Валидация username/password
        if not config.username or not config.password:
            return {
                'success': False,
                'error': 'Username and password are required'
            }
        
        # Используем username/password из config (автоматически из MongoDB)
        username = config.username
        password = config.password
        
        logger.info(f"[DistributionManager] Using credentials for account: {username}")
        
        # Создаем флаг остановки
        self.stop_flags[luxee_account_id] = threading.Event()
        
        logger.info(f"[DistributionManager] ⚙️ Creating thread for distribution")
        
        # Запускаем в отдельном потоке
        thread = threading.Thread(
            target=self._run_distribution,
            args=(config, username, password),
            daemon=True
        )
        
        self.distribution_threads[luxee_account_id] = thread
        thread.start()
        
        logger.info(f"[DistributionManager] ✅ Thread started: {thread.name}")
        logger.info(f"[DistributionManager] Active distributions: {len(self.active_distributions)}")
        
        return {
            'success': True,
            'distribution_id': distribution_id,
            'message': 'Distribution started'
        }
    
    async def stop_distribution(self, luxee_account_id: str) -> dict:
        """
        Останавливает рассылку для Luxee аккаунта
        
        Args:
            luxee_account_id: ID Luxee аккаунта
            
        Returns:
            dict: Результат остановки
        """
        if not self.is_account_busy(luxee_account_id):
            return {
                'success': False,
                'error': 'No active distribution for this account'
            }
        
        # Устанавливаем флаг остановки
        if luxee_account_id in self.stop_flags:
            self.stop_flags[luxee_account_id].set()
        
        # TODO: Реализовать graceful shutdown для DistributionProcess
        # Сейчас просто завершаем процесс
        
        logger.info(f"[DistributionManager] Stop requested for account {luxee_account_id}")
        
        return {
            'success': True,
            'message': 'Stop signal sent'
        }
    
    async def close_context(self, luxee_account_id: str) -> dict:
        """
        Закрывает браузерный контекст для Luxee аккаунта
        
        Args:
            luxee_account_id: ID Luxee аккаунта
            
        Returns:
            dict: Результат закрытия
        """
        if self.is_account_busy(luxee_account_id):
            return {
                'success': False,
                'error': 'Cannot close context while distribution is running'
            }
        
        # TODO: Реализовать закрытие контекста
        # Сейчас просто заглушка
        
        logger.info(f"[DistributionManager] Context closed for account {luxee_account_id}")
        
        return {
            'success': True,
            'message': 'Context closed'
        }


# Singleton instance
distribution_manager = DistributionManager()
