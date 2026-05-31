# Скрипт для создания администратора в Docker (Windows PowerShell)
# Использование: .\create-admin.ps1

$ErrorActionPreference = "Stop"

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  Создание администратора Luxee" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Проверка что контейнеры запущены
$mongoRunning = docker ps | Select-String "luxee-mongodb"
if (-not $mongoRunning) {
    Write-Host "❌ Ошибка: MongoDB контейнер не запущен!" -ForegroundColor Red
    Write-Host "Запустите: docker compose up -d" -ForegroundColor Yellow
    exit 1
}

$backendRunning = docker ps | Select-String "luxee-backend"
if (-not $backendRunning) {
    Write-Host "❌ Ошибка: Backend контейнер не запущен!" -ForegroundColor Red
    Write-Host "Запустите: docker compose up -d" -ForegroundColor Yellow
    exit 1
}

# Получаем пароль MongoDB из .env
$mongoPassword = "admin"
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    $passwordLine = $envContent | Select-String "MONGO_ROOT_PASSWORD"
    if ($passwordLine) {
        $mongoPassword = ($passwordLine -split "=")[1].Trim()
    }
}

if (-not $mongoPassword) {
    $mongoPassword = "admin"
    Write-Host "⚠️  Используем пароль по умолчанию: admin" -ForegroundColor Yellow
}

Write-Host "📝 Генерация хеша пароля..." -ForegroundColor Green
Write-Host ""

# Генерируем хеш пароля через backend
$adminData = docker exec luxee-backend node createAdmin.js

# Извлекаем хеш пароля из вывода
$passwordHash = ($adminData | Select-String "Password \(хеш\):").ToString() -replace ".*Password \(хеш\):\s*", ""

if (-not $passwordHash) {
    Write-Host "❌ Ошибка: Не удалось сгенерировать хеш пароля" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Хеш пароля сгенерирован" -ForegroundColor Green
Write-Host ""

# Создаем временный файл для MongoDB
$mongoScript = @"
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
        password: '$passwordHash',
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
"@

# Сохраняем скрипт во временный файл
$tempFile = [System.IO.Path]::GetTempFileName()
$mongoScript | Out-File -FilePath $tempFile -Encoding UTF8

# Копируем скрипт в контейнер
docker cp $tempFile luxee-mongodb:/tmp/create-admin.js | Out-Null

# Выполняем скрипт
Write-Host "📦 Создание администратора в базе данных..." -ForegroundColor Green
Write-Host ""
docker exec luxee-mongodb mongosh -u admin -p $mongoPassword --authenticationDatabase admin luxee /tmp/create-admin.js

# Удаляем временные файлы
Remove-Item $tempFile -Force
docker exec luxee-mongodb rm /tmp/create-admin.js | Out-Null

Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  Готово!" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
