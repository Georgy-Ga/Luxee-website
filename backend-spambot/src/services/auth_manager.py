"""
AuthManager - управление авторизацией через cookies из Node.js
"""
import logging
from typing import Dict

logger = logging.getLogger(__name__)


class AuthManager:
    """
    Управление авторизацией в Luxee через cookies
    Получает cookies от Node.js backend (из Playwright контекстов)
    """
    
    @staticmethod
    def prepare_cookies_for_selenium(cookies: Dict) -> Dict:
        """
        Преобразует cookies из формата Playwright в формат Selenium
        
        Args:
            cookies: Dict с cookies от Node.js (из Playwright контекста)
            
        Returns:
            Dict готовый для использования в RPA Framework/Selenium
        """
        if not cookies:
            logger.warning("No cookies provided for authentication")
            return {}
        
        # Cookies уже в нужном формате от Playwright
        # Luxee browser использует метод authorize() который принимает cookies as_dict=True
        logger.info(f"Prepared {len(cookies)} cookies for authentication")
        return cookies
    
    @staticmethod
    def validate_cookies(cookies: Dict) -> bool:
        """
        Проверяет что cookies содержат необходимые данные для авторизации
        
        Args:
            cookies: Dict с cookies
            
        Returns:
            bool: True если cookies валидны
        """
        if not cookies:
            logger.error("Cookies are empty")
            return False
        
        # Проверяем наличие критичных cookies для Luxee
        # (можно добавить проверку конкретных cookie names если известны)
        required_cookies = ['PHPSESSID']  # Пример, нужно уточнить для Luxee
        
        # Пока просто проверяем что cookies не пустые
        if len(cookies) == 0:
            logger.error("No cookies found")
            return False
        
        logger.info(f"Cookies validation passed ({len(cookies)} cookies)")
        return True
