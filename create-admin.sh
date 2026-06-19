#!/bin/bash

# Скрипт для создания администратора в Docker
# Использование: ./create-admin.sh

set -e

echo "==================================="
echo "  Создание администратора Luxee"
echo "==================================="
echo ""

# Проверка что контейнеры запущены
if ! docker ps | grep -q luxee-mongodb; then
    echo "❌ Ошибка: MongoDB контейнер не запущен!"
    echo "Запустите: docker compose up -d"
    exit 1
fi

if ! docker ps | grep -q luxee-backend; then
    echo "❌ Ошибка: Backend контейнер не запущен!"
    echo "Запустите: docker compose up -d"
    exit 1
fi

# Получаем пароль MongoDB из .env
if [ -f .env ]; then
    MONGO_PASSWORD=$(grep MONGO_ROOT_PASSWORD .env | cut -d '=' -f2)
    if [ -z "$MONGO_PASSWORD" ]; then
        MONGO_PASSWORD="wE0iaG8dnX"
    fi
else
    echo "⚠️  Файл .env не найден, используем пароль по умолчанию: admin"
    MONGO_PASSWORD="wE0iaG8dnX"
fi

echo "📝 Генерация хеша пароля..."
echo ""

# Генерируем хеш пароля через backend
ADMIN_DATA=$(docker exec luxee-backend node createAdmin.js)

# Извлекаем хеш пароля из вывода
PASSWORD_HASH=$(echo "$ADMIN_DATA" | grep "Password (хеш):" | cut -d ':' -f2 | xargs)

if [ -z "$PASSWORD_HASH" ]; then
    echo "❌ Ошибка: Не удалось сгенерировать хеш пароля"
    exit 1
fi

echo "✅ Хеш пароля сгенерирован"
echo ""

# Создаем временный файл для MongoDB
cat > /tmp/create-admin-luxee.js << EOF
// Проверяем есть ли уже админ
const existingAdmin = db.users.findOne({email: 'admin@example.com'});

if (existingAdmin) {
    print('⚠️  Администратор уже существует!');
    print('Email: admin@example.com');
    print('Если хотите пересоздать, сначала удалите: db.users.deleteOne({email: "admin@example.com"})');
} else {
    // Создаем админа
    const result = db.users.insertOne({
        email: 'admin@example.com',
        password: '$PASSWORD_HASH',
        role: 'admin'
    });
    
    if (result.acknowledged) {
        print('✅ Администратор успешно создан!');
        print('');
        print('📧 Email: admin@example.com');
        print('🔑 Password: admin');
        print('');
        print('Теперь можете войти на сайт!');
    } else {
        print('❌ Ошибка при создании администратора');
    }
}
EOF

# Копируем скрипт в контейнер
docker cp /tmp/create-admin-luxee.js luxee-mongodb:/tmp/create-admin.js

# Выполняем скрипт
echo "📦 Создание администратора в базе данных..."
echo ""
docker exec luxee-mongodb mongo -u admin -p "$MONGO_PASSWORD" --authenticationDatabase admin luxee /tmp/create-admin.js

# Удаляем временные файлы
rm /tmp/create-admin-luxee.js
docker exec luxee-mongodb rm /tmp/create-admin.js

echo ""
echo "==================================="
echo "  Готово!"
echo "==================================="
