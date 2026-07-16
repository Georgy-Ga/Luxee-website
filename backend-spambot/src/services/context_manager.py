"""
ContextManager - управление множественными контекстами Luxee аккаунтов
Каждый аккаунт получает свой отдельный браузерный контекст
"""
import logging
from typing import Dict, Optional
from src.core.luxee_site.luxee_browser import Luxee

logger = logging.getLogger(__name__)


class ContextManager:
    """
    Управление контекстами для множественных Luxee аккаунтов
    Хранит активные браузерные сессии
    """
    
    def __init__(self):
        # Словарь: luxee_account_id -> Luxee instance
        self._contexts: Dict[str, Luxee] = {}
        logger.info("[ContextManager] Initialized")
    
    def create_context(self, luxee_account_id: str, username: str, password: str) -> Luxee:
        """
        Создать новый контекст для аккаунта
        
        Args:
            luxee_account_id: ID аккаунта в MongoDB
            username: Email для входа в Luxee
            password: Пароль для входа в Luxee
            
        Returns:
            Luxee: Авторизованный экземпляр браузера
        """
        # Проверяем, существует ли уже контекст
        if luxee_account_id in self._contexts:
            logger.info(f"[ContextManager] Context already exists for account {luxee_account_id}")
            return self._contexts[luxee_account_id]
        
        try:
            logger.info(f"[ContextManager] Creating new context for account {luxee_account_id}")
            
            # Создаём новый экземпляр Luxee (автоматически логинится в __init__)
            luxee_instance = Luxee(username=username, password=password)
            
            # Сохраняем контекст
            self._contexts[luxee_account_id] = luxee_instance
            
            logger.info(f"[ContextManager] Context created successfully for account {luxee_account_id}")
            return luxee_instance
            
        except Exception as e:
            logger.error(f"[ContextManager] Error creating context for account {luxee_account_id}: {e}")
            raise
    
    def get_context(self, luxee_account_id: str) -> Optional[Luxee]:
        """
        Получить существующий контекст
        
        Args:
            luxee_account_id: ID аккаунта в MongoDB
            
        Returns:
            Luxee или None если контекст не существует
        """
        context = self._contexts.get(luxee_account_id)
        if context:
            logger.debug(f"[ContextManager] Context found for account {luxee_account_id}")
        else:
            logger.warning(f"[ContextManager] Context not found for account {luxee_account_id}")
        return context
    
    def has_context(self, luxee_account_id: str) -> bool:
        """
        Проверить существование контекста
        
        Args:
            luxee_account_id: ID аккаунта в MongoDB
            
        Returns:
            bool: True если контекст существует
        """
        return luxee_account_id in self._contexts
    
    def close_context(self, luxee_account_id: str) -> bool:
        """
        Закрыть и удалить контекст
        
        Args:
            luxee_account_id: ID аккаунта в MongoDB
            
        Returns:
            bool: True если контекст был закрыт
        """
        if luxee_account_id not in self._contexts:
            logger.warning(f"[ContextManager] Cannot close: context not found for account {luxee_account_id}")
            return False
        
        try:
            logger.info(f"[ContextManager] Closing context for account {luxee_account_id}")
            
            luxee_instance = self._contexts[luxee_account_id]
            
            # Закрываем браузер
            try:
                luxee_instance.logout()
            except Exception as e:
                logger.warning(f"[ContextManager] Error during logout: {e}")
            
            # Удаляем из словаря
            del self._contexts[luxee_account_id]
            
            logger.info(f"[ContextManager] Context closed for account {luxee_account_id}")
            return True
            
        except Exception as e:
            logger.error(f"[ContextManager] Error closing context for account {luxee_account_id}: {e}")
            return False
    
    def close_all_contexts(self):
        """
        Закрыть все контексты
        """
        logger.info(f"[ContextManager] Closing all contexts ({len(self._contexts)} total)")
        
        account_ids = list(self._contexts.keys())
        for account_id in account_ids:
            self.close_context(account_id)
        
        logger.info("[ContextManager] All contexts closed")
    
    def get_active_accounts(self) -> list[str]:
        """
        Получить список активных аккаунтов
        
        Returns:
            list[str]: Список ID активных аккаунтов
        """
        return list(self._contexts.keys())
    
    def get_context_count(self) -> int:
        """
        Получить количество активных контекстов
        
        Returns:
            int: Количество контекстов
        """
        return len(self._contexts)


# Singleton instance
context_manager = ContextManager()
