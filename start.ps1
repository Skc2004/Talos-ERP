# ╔══════════════════════════════════════════════════════════╗
# ║          TALOS ERP — One-Click Launcher (v3.0)          ║
# ╠══════════════════════════════════════════════════════════╣
# ║  Starts all 5 services in separate terminal windows:    ║
# ║    1. React Frontend       (localhost:5173)              ║
# ║    2. Spring Boot Backend  (localhost:8080)              ║
# ║    3. FastAPI AI Gateway   (localhost:8000)              ║
# ║    4. Celery Worker        (async task queue)            ║
# ║    5. IoT Simulator        (factory telemetry stream)    ║
# ╚══════════════════════════════════════════════════════════╝

$ErrorActionPreference = "SilentlyContinue"

# ─── Project Root ───
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

# ─── Environment Variables ───
$env:SUPABASE_URL          = "https://nkctzzerpcughgwhpduf.supabase.co"
$env:SUPABASE_ANON_KEY     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rY3R6emVycGN1Z2hnd2hwZHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Njg0NjEsImV4cCI6MjA5MTM0NDQ2MX0.b2M_zJurUb80IZprBuK56xCwQ5RGGl-bsfX4kz8rzJ0"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rY3R6emVycGN1Z2hnd2hwZHVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc2ODQ2MSwiZXhwIjoyMDkxMzQ0NDYxfQ.byIYdOFbjQz279Ci1PaF9ZSLUUwhKkHHyA0y95EfOzw"
$env:GEMINI_API_KEY        = "AIzaSyB0Mj341E-2TWOd_NsuvQumYH1ly8cYecI"

# ─── Maven Path ───
$MAVEN_BIN = "C:\Users\sudee\maven\apache-maven-3.9.14\bin"

# ─── Colors ───
function Write-Header { param($msg) Write-Host "`n  $msg" -ForegroundColor Cyan }
function Write-OK     { param($msg) Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Info   { param($msg) Write-Host "  ℹ️  $msg" -ForegroundColor DarkGray }

# ─── Kill existing processes ───
Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║     TALOS ERP — Starting All Services  ║" -ForegroundColor Magenta
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Magenta

Write-Header "Cleaning up old processes..."
Get-Process -Name node, java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
# Kill Python processes running on our ports
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Write-OK "Old processes cleaned"

# ═══════════════════════════════════════════
# 1. REACT FRONTEND (localhost:5173)
# ═══════════════════════════════════════════
Write-Header "Starting React Frontend..."
$frontendCmd = @"
`$Host.UI.RawUI.WindowTitle = 'TALOS — Frontend (5173)'
Write-Host '🌐 Starting React Frontend...' -ForegroundColor Cyan
Set-Location '$ROOT\WarehouseFrontend'
npm run dev
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
Write-OK "Frontend launching on http://localhost:5173"

# ═══════════════════════════════════════════
# 2. SPRING BOOT JAVA BACKEND (localhost:8080)
# ═══════════════════════════════════════════
Write-Header "Starting Java Backend (Spring Boot)..."
$javaCmd = @"
`$Host.UI.RawUI.WindowTitle = 'TALOS — Java Backend (8080)'
Write-Host '☕ Starting Spring Boot Backend...' -ForegroundColor Yellow
`$env:Path += ";$MAVEN_BIN"
Set-Location '$ROOT\InventoryMaintainer'
mvn spring-boot:run
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $javaCmd
Write-OK "Java Backend launching on http://localhost:8080"

# ═══════════════════════════════════════════
# 3. FASTAPI PYTHON AI GATEWAY (localhost:8000)
# ═══════════════════════════════════════════
Write-Header "Starting Python AI Gateway (FastAPI)..."
$pythonCmd = @"
`$Host.UI.RawUI.WindowTitle = 'TALOS — AI Gateway (8000)'
Write-Host '🤖 Starting FastAPI AI Gateway...' -ForegroundColor Magenta
`$env:SUPABASE_URL = '$($env:SUPABASE_URL)'
`$env:SUPABASE_SERVICE_ROLE_KEY = '$($env:SUPABASE_SERVICE_ROLE_KEY)'
`$env:GEMINI_API_KEY = '$($env:GEMINI_API_KEY)'
Set-Location '$ROOT\InsightMantra'
python main.py
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $pythonCmd
Write-OK "AI Gateway launching on http://localhost:8000"

# ═══════════════════════════════════════════
# 4. CELERY WORKER (async task queue)
# ═══════════════════════════════════════════
Write-Header "Starting Celery Worker..."
$celeryCmd = @"
`$Host.UI.RawUI.WindowTitle = 'TALOS — Celery Worker'
Write-Host '⚡ Starting Celery Worker...' -ForegroundColor Blue
`$env:SUPABASE_URL = '$($env:SUPABASE_URL)'
`$env:SUPABASE_SERVICE_ROLE_KEY = '$($env:SUPABASE_SERVICE_ROLE_KEY)'
Set-Location '$ROOT\InsightMantra'
python -m celery -A tasks worker --loglevel=info --pool=solo
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $celeryCmd
Write-OK "Celery Worker launching"

# ═══════════════════════════════════════════
# 5. IoT SIMULATOR (factory telemetry)
# ═══════════════════════════════════════════
Write-Header "Starting IoT Factory Simulator..."
$iotCmd = @"
`$Host.UI.RawUI.WindowTitle = 'TALOS — IoT Simulator'
Write-Host '🏭 Starting IoT Telemetry Simulator...' -ForegroundColor DarkYellow
`$env:SUPABASE_URL = '$($env:SUPABASE_URL)'
`$env:SUPABASE_SERVICE_ROLE_KEY = '$($env:SUPABASE_SERVICE_ROLE_KEY)'
Set-Location '$ROOT\IoTGateway'
python simulator.py
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $iotCmd
Write-OK "IoT Simulator launching"

# ═══════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════
Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║           ALL SERVICES LAUNCHED SUCCESSFULLY          ║" -ForegroundColor Green
Write-Host "  ╠═══════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "  ║  Frontend:      http://localhost:5173                 ║" -ForegroundColor White
Write-Host "  ║  Java API:      http://localhost:8080                 ║" -ForegroundColor White
Write-Host "  ║  AI Gateway:    http://localhost:8000                 ║" -ForegroundColor White
Write-Host "  ║  Swagger Docs:  http://localhost:8080/swagger-ui.html ║" -ForegroundColor White
Write-Host "  ║  Ask Talos:     Ctrl+K in the browser                ║" -ForegroundColor White
Write-Host "  ╠═══════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "  ║  Login:  admin@talos.com  /  TalosAdmin@2026         ║" -ForegroundColor Yellow
Write-Host "  ╚═══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Info "Each service runs in its own terminal window."
Write-Info "Close this window — the services will keep running."
Write-Info "To stop everything: run stop.ps1"
Write-Host ""

# Open browser after a short delay
Start-Sleep -Seconds 5
Start-Process "http://localhost:5173"
