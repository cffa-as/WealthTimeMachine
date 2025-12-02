@echo off
chcp 65001 >nul
echo ========================================
echo   理财时光机 - 启动脚本
echo ========================================
echo.

REM 检查 Python 是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python
    pause
    exit /b 1
)

REM 检查 Node.js 是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

echo [1/4] 检查后端依赖...
cd backend
if not exist "venv" (
    echo [提示] 创建 Python 虚拟环境...
    python -m venv venv
)
call venv\Scripts\activate.bat
if not exist "requirements_installed.txt" (
    echo [提示] 安装后端依赖...
    pip install -r requirements.txt
    echo installed > requirements_installed.txt
)
cd ..

echo [2/4] 检查前端依赖...
cd front
if not exist "node_modules" (
    echo [提示] 安装前端依赖（这可能需要几分钟）...
    call npm install
)
cd ..

echo [3/4] 启动后端服务（端口 8000）...
start "后端服务" cmd /k "cd backend && call venv\Scripts\activate.bat && python main.py"

echo [4/4] 等待后端启动...
timeout /t 3 /nobreak >nul

echo [5/5] 启动前端服务（端口 3000）...
start "前端服务" cmd /k "cd front && npm run dev"

echo.
echo ========================================
echo   启动完成！
echo ========================================
echo   后端 API: http://localhost:8000
echo   前端页面: http://localhost:3000
echo.
echo   按任意键关闭此窗口（服务将继续运行）
pause >nul

