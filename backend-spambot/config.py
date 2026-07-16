"""
Конфигурация spambot service
Копия из оригинального spambot/config.py с адаптацией для веб-сервиса
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Режим отладки - не отправлять сообщения
    SKIP_SENDING_MESSAGE = os.getenv('SKIP_SENDING_MESSAGE', 'false').lower() == 'true'
    
    # Скрытый режим браузера
    HIDDEN_BROWSER = os.getenv('HIDDEN_BROWSER', 'true').lower() == 'true'
    
    # Задержка между профилями (минуты)
    WAIT_MINUTES_BETWEEN_PROFILES = int(os.getenv('WAIT_MINUTES_BETWEEN_PROFILES', '0'))
    
    # URL Node.js backend для webhooks/callbacks
    NODE_BACKEND_URL = os.getenv('NODE_BACKEND_URL', 'http://luxee-backend:5000')
    
    # Для localhost разработки
    if os.getenv('DOCKER') != 'true':
        NODE_BACKEND_URL = os.getenv('NODE_BACKEND_URL', 'http://localhost:5001')


CONFIG = Config()
