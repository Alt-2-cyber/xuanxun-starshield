@echo off
setlocal EnableExtensions

rem ZhiXun Fire local launcher.
rem DeepSeek credentials are intentionally read from the Windows user environment.

set "PROJECT_ROOT=%~dp0"
set "EDGE_DIR=%PROJECT_ROOT%edge-service"
set "WEB_DIR=%PROJECT_ROOT%web-console"
set "EDGE_PY=%EDGE_DIR%\.venv\Scripts\python.exe"
set "EDGE_PORT=8787"
set "WEB_PORT=5173"
set "LAN_IP="

for /f "delims=" %%I in ('powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notlike '*VMware*' -and $_.InterfaceAlias -notlike '*vEthernet*' } | Select-Object -First 1 -ExpandProperty IPAddress"') do if not defined LAN_IP set "LAN_IP=%%I"
if not defined LAN_IP set "LAN_IP=127.0.0.1"

if not exist "%EDGE_PY%" (
  echo [ERROR] Missing edge-service virtual environment: "%EDGE_PY%"
  echo Run: cd /d "%EDGE_DIR%" ^&^& uv sync --extra test
  exit /b 1
)

if not exist "%WEB_DIR%\node_modules" (
  echo [ERROR] Missing web-console dependencies: "%WEB_DIR%\node_modules"
  echo Run: cd /d "%WEB_DIR%" ^&^& npm install
  exit /b 1
)

if not defined DEEPSEEK_API_KEY (
  for /f "usebackq delims=" %%K in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetEnvironmentVariable('DEEPSEEK_API_KEY','User')"`) do set "DEEPSEEK_API_KEY=%%K"
)
if not defined DEEPSEEK_API_KEY (
  echo [WARN] DEEPSEEK_API_KEY is not available in this Windows process or user environment.
)

set "STARSHIELD_SERIAL_PORTS=COM14:C-SF,COM16:C-WIFI"
set "STARSHIELD_SERIAL_BAUDRATE=115200"
set "EDGE_ROS_ENABLE=0"
set "ROS_BRIDGE_URL="
set "EDGE_DB_PATH=data\live-httpbridge.db"
set "EDGE_RAW_LOG_PATH=data\live-httpbridge.jsonl"
set "DEEPSEEK_BASE_URL=https://api.deepseek.com"
set "DEEPSEEK_MODEL=deepseek-chat"

if /I "%XUANXUN_VALIDATE_ONLY%"=="1" goto validate

call :port_check %EDGE_PORT% "Edge service"
if errorlevel 1 (
  echo [INFO] Edge service port %EDGE_PORT% is already in use. Existing process was kept.
) else (
  echo [START] Edge service: http://0.0.0.0:%EDGE_PORT%
  start "ZhiXun Fire Edge Service" /D "%EDGE_DIR%" "%ComSpec%" /k ""%EDGE_PY%" -m uvicorn fire_edge.app:app --host 0.0.0.0 --port %EDGE_PORT%"
)

call :port_check %WEB_PORT% "Web console"
if errorlevel 1 (
  echo [INFO] Web console port %WEB_PORT% is already in use. Existing process was kept.
) else (
  echo [START] Web console: http://0.0.0.0:%WEB_PORT%
  start "ZhiXun Fire Web Console" /D "%WEB_DIR%" "%ComSpec%" /k "npm run dev -- --host 0.0.0.0 --port %WEB_PORT%"
)

echo.
echo [READY] Browser: http://127.0.0.1:%WEB_PORT%
echo [READY] LAN:     http://%LAN_IP%:%WEB_PORT%
echo [READY] API:     http://127.0.0.1:%EDGE_PORT%
echo [INFO] Ubuntu ROS bridge must use XUANXUN_EDGE_URL pointing to this PC.
exit /b 0

:validate
echo [OK] Project root: %PROJECT_ROOT%
echo [OK] Edge command: "%EDGE_PY%" -m uvicorn fire_edge.app:app --host 0.0.0.0 --port %EDGE_PORT%
echo [OK] Web command:  npm run dev -- --host 0.0.0.0 --port %WEB_PORT%
echo [OK] Serial ports: %STARSHIELD_SERIAL_PORTS%
if defined DEEPSEEK_API_KEY (echo [OK] DeepSeek key: configured) else (echo [WARN] DeepSeek key: missing)
exit /b 0

:port_check
set "CHECK_PORT=%~1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -State Listen -LocalPort %CHECK_PORT% -ErrorAction SilentlyContinue; if($c){exit 1}else{exit 0}"
exit /b %errorlevel%
