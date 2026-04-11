# ╔═══════════════════════════════════════╗
# ║   TALOS ERP — Stop All Services       ║
# ╚═══════════════════════════════════════╝

Write-Host ""
Write-Host "  Stopping all Talos ERP services..." -ForegroundColor Red

# Kill by process name
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name java -ErrorAction SilentlyContinue | Stop-Process -Force

# Kill Python on known ports
@(5173, 8000, 8080) | ForEach-Object {
    Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

# Kill any remaining python processes with our scripts
Get-Process python -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "main.py|celery|simulator.py"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "  ✅ All services stopped." -ForegroundColor Green
Write-Host ""
