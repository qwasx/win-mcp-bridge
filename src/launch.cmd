@echo off
setlocal enabledelayedexpansion
rem ===================================================================
rem  launch.cmd  --  MCP Bridge one-click launcher   (ASCII ONLY)
rem  Auto-detects python. NEVER calls its own scheduled task --
rem  doing so caused an infinite self-recursion on 2026-09-16.
rem  Usage:  launch.cmd | status | stop | restart
rem ===================================================================
set "BASE=%~dp0"
if "%BASE:~-1%"=="\" set "BASE=%BASE:~0,-1%"

set "PYW="
call :probe "%BASE%\python\pythonw.exe"
call :probe "%BASE%\python\python.exe"
if defined MCP_EXTRA_PYTHON call :probe "%MCP_EXTRA_PYTHON%"
call :probe "%BASE%\venv-desktop\Scripts\pythonw.exe"
if not defined PYW for %%P in (pythonw.exe python.exe) do (
  if not defined PYW for /f "delims=" %%F in ('where %%P 2^>nul') do (
    if not defined PYW call :probe "%%F"
  )
)
if not defined PYW (
  echo [ERROR] No usable Python found.
  echo         Put a Python 3.11+ embeddable build in "%BASE%\python\"
  pause
  exit /b 1
)

if /i "%~1"=="status"  goto :status
if /i "%~1"=="stop"    goto :stop
if /i "%~1"=="restart" goto :restart
goto :start

:probe
if defined PYW exit /b 0
if not exist "%~1" exit /b 0
"%~1" -c "import mcp,uvicorn,starlette" >nul 2>&1
if errorlevel 1 exit /b 0
set "PYW=%~1"
exit /b 0

:start
call :count
if not "%SUPN%"=="0" (
  echo [OK] supervisor already running ^(%SUPN% proc^)
  exit /b 0
)
start "" /b "%PYW%" "%BASE%\supervisor.py"
echo [OK] started: %PYW%
exit /b 0

:stop
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'supervisor\.py|bridge_server\.py|windows_mcp|cloudflared' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo [OK] stopped
exit /b 0

:restart
call "%~f0" stop
timeout /t 3 /nobreak >nul
call "%~f0" start
exit /b 0

:count
set "SUPN=0"
for /f "delims=" %%N in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "@(Get-CimInstance Win32_Process ^| Where-Object { $_.CommandLine -match 'supervisor\.py' }).Count" 2^>nul') do set "SUPN=%%N"
exit /b 0

:status
echo python : %PYW%
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach($x in 8000,8010){$u=(Test-NetConnection 127.0.0.1 -Port $x -InformationLevel Quiet -WarningAction SilentlyContinue); ('port {0,-5}: {1}' -f $x, $(if($u){'UP'}else{'DOWN'}))}; 'supervisor : ' + @(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'supervisor\.py' }).Count + ' proc'; $t=Get-ScheduledTask -TaskName 'MCP-Stack' -ErrorAction SilentlyContinue; 'task       : ' + $(if($t){$t.State}else{'MISSING'})"
exit /b 0
