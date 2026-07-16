# Dockerfile для Spambot Python Service
FROM python:3.11-slim

# Установка системных зависимостей для RPA Framework / Selenium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    # Для Chromium
    chromium \
    chromium-driver \
    # Для X virtual framebuffer (headless browser)
    xvfb \
    # Очистка кэша
    && rm -rf /var/lib/apt/lists/*

# Установка рабочей директории
WORKDIR /app

# Копирование requirements
COPY requirements.txt .

# Установка Python зависимостей
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода приложения
COPY . .

# Создание директории для логов
RUN mkdir -p /app/logs

# Переменные окружения
ENV PYTHONUNBUFFERED=1
ENV DISPLAY=:99

# Expose порт
EXPOSE 8001

# Запуск с xvfb (для headless браузера)
CMD ["sh", "-c", "rm -f /tmp/.X99-lock && Xvfb :99 -screen 0 1920x1080x24 & python main.py"]
