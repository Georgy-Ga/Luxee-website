# Script for creating admin user in Docker (Windows PowerShell)
# Usage: .\create-admin.ps1

$ErrorActionPreference = "Stop"

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  Creating Luxee Administrator" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Check if containers are running
$mongoRunning = docker ps | Select-String "luxee-mongodb"
if (-not $mongoRunning) {
    Write-Host "Error: MongoDB container is not running!" -ForegroundColor Red
    Write-Host "Start with: docker compose up -d" -ForegroundColor Yellow
    exit 1
}

$backendRunning = docker ps | Select-String "luxee-backend"
if (-not $backendRunning) {
    Write-Host "Error: Backend container is not running!" -ForegroundColor Red
    Write-Host "Start with: docker compose up -d" -ForegroundColor Yellow
    exit 1
}

# Get MongoDB password from .env
$mongoPassword = "changeme"
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    $passwordLine = $envContent | Select-String "MONGO_ROOT_PASSWORD"
    if ($passwordLine) {
        $mongoPassword = ($passwordLine -split "=")[1].Trim()
    }
}

if (-not $mongoPassword) {
    $mongoPassword = "changeme"
    Write-Host "Using default password: changeme" -ForegroundColor Yellow
}

Write-Host "Generating password hash..." -ForegroundColor Green
Write-Host ""

# Generate password hash through backend
$adminData = docker exec luxee-backend node createAdmin.js 2>&1

# Debug: Show output
Write-Host "DEBUG: Output from createAdmin.js:" -ForegroundColor Yellow
$adminData | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
Write-Host ""

# Extract password hash from output
# Looking for FIRST line that contains bcrypt hash ($2b$)
$passwordHashLine = ($adminData | Where-Object { $_ -match '\$2b\$' } | Select-Object -First 1)
if ($passwordHashLine) {
    Write-Host "DEBUG: Found line with hash:" -ForegroundColor Cyan
    Write-Host "  $passwordHashLine" -ForegroundColor Gray
    
    # Extract hash - bcrypt format: $2b$rounds$salthash
    # More flexible regex to capture the full hash including slashes
    if ($passwordHashLine -match '(\$2b\$\d+\$[A-Za-z0-9./]+)') {
        $passwordHash = $matches[1]
        Write-Host "DEBUG: Extracted hash: $passwordHash" -ForegroundColor Cyan
    } else {
        Write-Host "Error: Could not extract hash from line with regex" -ForegroundColor Red
        Write-Host "Line content: $passwordHashLine" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "Error: Could not find bcrypt hash (\$2b\$) in output" -ForegroundColor Red
    Write-Host "Output received:" -ForegroundColor Yellow
    $adminData | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    exit 1
}

if (-not $passwordHash -or $passwordHash -eq "") {
    Write-Host "Error: Password hash is empty after extraction" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: Found hash: $passwordHash" -ForegroundColor Green

Write-Host "Password hash generated" -ForegroundColor Green
Write-Host ""

# Create temporary file for MongoDB
$mongoScript = @"
// Check if admin already exists
const existingAdmin = db.users.findOne({email: 'admin@example.com'});

if (existingAdmin) {
    print('Admin already exists!');
    print('Email: admin@example.com');
    print('To recreate, first delete: db.users.deleteOne({email: "admin@example.com"})');
} else {
    // Create admin
    const result = db.users.insertOne({
        email: 'admin@example.com',
        password: '$passwordHash',
        role: 'admin',
        isAdmin: true,
        createdAt: new Date()
    });
    
    if (result.acknowledged) {
        print('Admin successfully created!');
        print('');
        print('Email: admin@example.com');
        print('Password: admin');
        print('');
        print('You can now login!');
    } else {
        print('Error creating administrator');
    }
}
"@

# Save script to temporary file
$tempFile = [System.IO.Path]::GetTempFileName()
$mongoScript | Out-File -FilePath $tempFile -Encoding UTF8

# Copy script to container
docker cp $tempFile luxee-mongodb:/tmp/create-admin.js | Out-Null

# Execute script
Write-Host "Creating administrator in database..." -ForegroundColor Green
Write-Host ""
docker exec luxee-mongodb mongo -u admin -p $mongoPassword --authenticationDatabase admin luxee /tmp/create-admin.js

# Clean up temporary files
Remove-Item $tempFile -Force
docker exec luxee-mongodb rm /tmp/create-admin.js | Out-Null

Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  Done!" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
