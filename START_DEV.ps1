# BabyCare Development Startup Script for Windows (PowerShell)
# Usage: .\START_DEV.ps1

Write-Host "`n" -ForegroundColor Green
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          BabyCare Development Environment Setup             ║" -ForegroundColor Cyan
Write-Host "║         Windows IPv4 Development Setup (127.0.0.1)         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
$nodeVersion = node --version
$npmVersion = npm --version

Write-Host "Node.js version: $nodeVersion" -ForegroundColor Blue
Write-Host "npm version: $npmVersion" -ForegroundColor Blue
Write-Host ""

# Check ports
function Test-Port {
    param([int]$Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient("127.0.0.1", $Port)
        if ($connection.Connected) {
            $connection.Close()
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

Write-Host "Checking port availability..." -ForegroundColor Blue
if (Test-Port 5173) {
    Write-Host "⚠ Port 5173 is already in use (will try 5174+)" -ForegroundColor Yellow
} else {
    Write-Host "✓ Port 5173 is available" -ForegroundColor Green
}

if (Test-Port 5000) {
    Write-Host "⚠ Port 5000 is already in use!" -ForegroundColor Red
    Write-Host "Please stop the service using port 5000 before starting" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✓ Port 5000 is available" -ForegroundColor Green
}
Write-Host ""

# Start Backend
Write-Host "Starting BabyCare Backend Server..." -ForegroundColor Blue
Write-Host "Location: C:\BabyCare\server" -ForegroundColor Gray

$backendScript = {
    Set-Location "C:\BabyCare\server"
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    npm install 2>&1 | Select-Object -First 5
    Write-Host "Starting server..." -ForegroundColor Green
    npm start
}

$backendJob = Start-Job -ScriptBlock $backendScript -Name "BabyCareBackend"
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "Starting BabyCare Frontend Server..." -ForegroundColor Blue
Write-Host "Location: C:\BabyCare\client" -ForegroundColor Gray

$frontendScript = {
    Set-Location "C:\BabyCare\client"
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    npm install 2>&1 | Select-Object -First 5
    Write-Host "Starting dev server..." -ForegroundColor Green
    npm run dev
}

$frontendJob = Start-Job -ScriptBlock $frontendScript -Name "BabyCareFrontend"
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                  DEVELOPMENT SERVERS STARTED                ║" -ForegroundColor Green
Write-Host "╠════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Backend:  http://127.0.0.1:5000                            ║" -ForegroundColor Green
Write-Host "║  Frontend: http://127.0.0.1:5173                            ║" -ForegroundColor Green
Write-Host "║  Health:   curl http://127.0.0.1:5000/health               ║" -ForegroundColor Green
Write-Host "╠════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  API Calls: /api/* → proxied to http://127.0.0.1:5000/api  ║" -ForegroundColor Green
Write-Host "║  CORS:      Enabled for frontend URL                        ║" -ForegroundColor Green
Write-Host "║  IPv4:      All services use 127.0.0.1 (no IPv6)           ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "Server status:" -ForegroundColor Blue
Get-Job | Format-Table Name, State, PSJobTypeName

Write-Host ""
Write-Host "To stop development:" -ForegroundColor Blue
Write-Host "  Stop-Job -Id 1, 2" -ForegroundColor Gray
Write-Host "  Remove-Job -Id 1, 2" -ForegroundColor Gray
Write-Host ""

Write-Host "To view server output:" -ForegroundColor Blue
Write-Host "  Receive-Job -Id 1 -Keep (Backend)" -ForegroundColor Gray
Write-Host "  Receive-Job -Id 2 -Keep (Frontend)" -ForegroundColor Gray
Write-Host ""

Write-Host "Waiting for servers to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

Write-Host "Checking server health..." -ForegroundColor Blue
$maxAttempts = 10
$attempt = 0

do {
    try {
        $healthCheck = Invoke-WebRequest -Uri "http://127.0.0.1:5000/health" -UseBasicParsing -ErrorAction Stop
        if ($healthCheck.StatusCode -eq 200) {
            Write-Host "✓ Backend is responding at http://127.0.0.1:5000/health" -ForegroundColor Green
            break
        }
    } catch {
        $attempt++
        if ($attempt -lt $maxAttempts) {
            Write-Host "  Waiting for backend... (attempt $attempt/$maxAttempts)" -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        } else {
            Write-Host "✗ Backend health check failed" -ForegroundColor Red
        }
    }
} while ($attempt -lt $maxAttempts)

Write-Host ""
Write-Host "✅ Development environment is ready!" -ForegroundColor Green
Write-Host ""
