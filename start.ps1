# 理财时光机 - 启动脚本 (PowerShell)
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  理财时光机 - 启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Python 是否安装
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[✓] Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[错误] 未检测到 Python，请先安装 Python" -ForegroundColor Red
    Read-Host "按 Enter 键退出"
    exit 1
}

# 检查 Node.js 是否安装
try {
    $nodeVersion = node --version 2>&1
    Write-Host "[✓] Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[错误] 未检测到 Node.js，请先安装 Node.js" -ForegroundColor Red
    Read-Host "按 Enter 键退出"
    exit 1
}

Write-Host ""
Write-Host "[1/4] 检查后端依赖..." -ForegroundColor Yellow
Set-Location backend

# 检查虚拟环境
if (-not (Test-Path "venv")) {
    Write-Host "[提示] 创建 Python 虚拟环境..." -ForegroundColor Yellow
    python -m venv venv
}

# 激活虚拟环境
& "venv\Scripts\Activate.ps1"

# 检查依赖是否已安装
if (-not (Test-Path "requirements_installed.txt")) {
    Write-Host "[提示] 安装后端依赖..." -ForegroundColor Yellow
    pip install -r requirements.txt
    "installed" | Out-File -FilePath "requirements_installed.txt" -Encoding utf8
}

Set-Location ..

Write-Host "[2/4] 检查前端依赖..." -ForegroundColor Yellow
Set-Location front

if (-not (Test-Path "node_modules")) {
    Write-Host "[提示] 安装前端依赖（这可能需要几分钟）..." -ForegroundColor Yellow
    npm install
}

Set-Location ..

Write-Host "[3/4] 启动后端服务（端口 8000）..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; .\venv\Scripts\Activate.ps1; python main.py" -WindowStyle Normal

Write-Host "[4/4] 等待后端启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "[5/5] 启动前端服务（端口 3000）..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\front'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  后端 API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "  前端页面: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  服务已在新的窗口中运行" -ForegroundColor Yellow
Write-Host "  按 Enter 键关闭此窗口（服务将继续运行）" -ForegroundColor Yellow
Read-Host

