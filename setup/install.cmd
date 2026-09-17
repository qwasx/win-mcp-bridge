@echo off
setlocal enabledelayedexpansion
rem =====================================================================
rem  install.cmd  --  MCP Bridge installer for a NEW Windows PC
rem  ASCII ONLY. Run it straight from a clone of the repo:
rem      git clone https://github.com/qwasx/win-mcp-bridge
rem      cd win-mcp-bridge\setup
rem      install.cmd --id pc2 --sub pc2
rem
rem  What it does:
rem    1. copy src/ + patches/ out of the repo into C:\mcp-bridge
rem    2. unpack a private Python (no system install, no registry, no admin)
rem    3. install windows-mcp (pinned) into that Python
rem    4. apply the console-flash patch -- HARD FAILS if it does not stick
rem    5. create THIS PC's OWN Cloudflare tunnel + hostname   <-- key step
rem    6. write machine.json (UTF-8 *without BOM*) + register startup task
rem    7. start and print the machines.json entry for your fleet list
rem =====================================================================

rem  %~dp0 is <repo>\setup\ , so REPO is its parent.
set "SETUPDIR=%~dp0"
if "%SETUPDIR:~-1%"=="\" set "SETUPDIR=%SETUPDIR:~0,-1%"
for %%I in ("%SETUPDIR%\..") do set "REPO=%%~fI"
set "DEST=C:\mcp-bridge"
set "PYDIR=%DEST%\python"
set "WMC_VERSION=0.8.5"

echo(
echo ==============================================
echo   MCP Bridge - new machine setup
echo   source: %REPO%
echo   target: %DEST%
echo ==============================================
echo(

rem Fail fast if this is not actually a clone of the repo.
if not exist "%REPO%\src\supervisor.py" (
  echo    ERROR: %REPO%\src\supervisor.py not found.
  echo           Run this script from inside a clone of win-mcp-bridge,
  echo           i.e. ^<repo^>\setup\install.cmd
  pause & exit /b 1
)

rem ---------- 0. args ----------
set "SUBDOMAIN="
set "MID="
:args
if "%~1"=="" goto args_done
if /i "%~1"=="--sub" (set "SUBDOMAIN=%~2" & shift & shift & goto args)
if /i "%~1"=="--id"  (set "MID=%~2" & shift & shift & goto args)
shift
goto args
:args_done
if not defined MID set "MID=%COMPUTERNAME%"
if not defined SUBDOMAIN set "SUBDOMAIN=%MID%"

rem ---------- 1. copy program files ----------
echo [1/7] copying program files...
if not exist "%DEST%" mkdir "%DEST%"
copy /y "%REPO%\src\supervisor.py"    "%DEST%\" >nul || (echo    ERROR: copy supervisor.py failed & pause & exit /b 1)
copy /y "%REPO%\src\bridge_server.py" "%DEST%\" >nul || (echo    ERROR: copy bridge_server.py failed & pause & exit /b 1)
copy /y "%REPO%\src\launch.cmd"       "%DEST%\" >nul || (echo    ERROR: copy launch.cmd failed & pause & exit /b 1)
if not exist "%DEST%\patches" mkdir "%DEST%\patches"
copy /y "%REPO%\patches\*.py" "%DEST%\patches\" >nul || (echo    ERROR: copy patches failed & pause & exit /b 1)
echo       done.

rem ---------- 2. python ----------
echo [2/7] setting up private Python...
if exist "%PYDIR%\python.exe" (
  echo       already present, skipping.
) else (
  if exist "%SETUPDIR%\offline\python-embed.zip" (
    echo       unpacking bundled python-embed.zip
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "Expand-Archive -Path '%SETUPDIR%\offline\python-embed.zip' -DestinationPath '%PYDIR%' -Force"
  ) else (
    echo       downloading Python 3.13 embeddable...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$u='https://www.python.org/ftp/python/3.13.7/python-3.13.7-embed-amd64.zip';" ^
      "$z=\"$env:TEMP\pyemb.zip\"; Invoke-WebRequest $u -OutFile $z -UseBasicParsing;" ^
      "Expand-Archive -Path $z -DestinationPath '%PYDIR%' -Force; Remove-Item $z -Force"
  )
  if not exist "%PYDIR%\python.exe" (echo    ERROR: python setup failed & pause & exit /b 1)

  rem CRITICAL: embeddable ships with "#import site" commented out.
  rem Without enabling it, pip-installed packages are NOT importable.
  echo       enabling site-packages in python3xx._pth
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Get-ChildItem '%PYDIR%\python*._pth' | ForEach-Object {" ^
    "  $c = Get-Content $_.FullName;" ^
    "  $c = $c -replace '^#\s*import\s+site','import site';" ^
    "  if ($c -notcontains 'import site') { $c += 'import site' }" ^
    "  Set-Content $_.FullName $c }"

  rem bootstrap pip
  if exist "%SETUPDIR%\offline\get-pip.py" (
    "%PYDIR%\python.exe" "%SETUPDIR%\offline\get-pip.py" --no-warn-script-location >nul 2>&1
  ) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "Invoke-WebRequest 'https://bootstrap.pypa.io/get-pip.py' -OutFile \"$env:TEMP\get-pip.py\" -UseBasicParsing"
    "%PYDIR%\python.exe" "%TEMP%\get-pip.py" --no-warn-script-location >nul 2>&1
  )
  "%PYDIR%\python.exe" -m pip --version >nul 2>&1
  if errorlevel 1 (echo    ERROR: pip bootstrap failed & pause & exit /b 1)
)
echo       python ok.

rem ---------- 3. dependencies ----------
echo [3/7] installing dependencies...
set "PIPSRC="
if exist "%SETUPDIR%\offline\wheels" set "PIPSRC=--no-index --find-links=\"%SETUPDIR%\offline\wheels\""

"%PYDIR%\python.exe" -m pip install %PIPSRC% --quiet --no-warn-script-location mcp uvicorn starlette
if errorlevel 1 (echo    ERROR: bridge deps failed & pause & exit /b 1)

rem NOTE: the embeddable Python has NO venv module ("No module named venv").
rem Verified on 2026-09-16. So we install windows-mcp straight into it --
rem this was tested end to end: the server starts and answers MCP on
rem embeddable Python, with the console-flash patch applied.
rem Pinned: the patch in patches/ is written against this exact version's
rem powershell/utils.py. Bumping it without re-checking the patch will
rem silently bring the console flash back.
echo       installing windows-mcp==%WMC_VERSION%...
"%PYDIR%\python.exe" -m pip install %PIPSRC% --quiet --no-warn-script-location windows-mcp==%WMC_VERSION%
if errorlevel 1 (echo    ERROR: windows-mcp install failed & pause & exit /b 1)
echo       done.

rem ---------- 4. console-flash patch ----------
rem This used to only print a WARNING when it failed, so installs "succeeded"
rem with the flash still there. It is now a hard error: the whole point of
rem this project is that nothing pops up on screen.
echo [4/7] applying console-flash patch...
set "WMCDIR="
for /f "delims=" %%D in ('"%PYDIR%\python.exe" -c "import windows_mcp,os;print(os.path.dirname(windows_mcp.__file__))"') do set "WMCDIR=%%D"
if not defined WMCDIR (echo    ERROR: could not locate the windows_mcp package & pause & exit /b 1)

copy /y "%DEST%\patches\windows_mcp_powershell_utils.py" "!WMCDIR!\powershell\utils.py" >nul
if errorlevel 1 (echo    ERROR: could not write the patch & pause & exit /b 1)

rem Re-applying is safe: we overwrite the file wholesale rather than appending.
"%PYDIR%\python.exe" -c "import windows_mcp,os,sys;p=os.path.join(os.path.dirname(windows_mcp.__file__),'powershell','utils.py');s=open(p,encoding='utf-8').read();sys.exit(0 if 'CREATE_NO_WINDOW' in s else 1)"
if errorlevel 1 (
  echo    ERROR: patch did not stick - console windows would flash.
  echo           Aborting rather than shipping a broken install.
  pause & exit /b 1
)
echo       patch verified.

rem ---------- 5. cloudflare tunnel (unique per PC) ----------
echo [5/7] creating this PC's own Cloudflare tunnel...
echo(
echo       Two PCs must NEVER share one tunnel ID: Cloudflare treats them
echo       as replicas and routes each request to a RANDOM one of them.
echo       So this PC gets its own tunnel + its own hostname.
echo(

set "CF=%DEST%\cloudflared.exe"
if not exist "%CF%" (
  echo       downloading cloudflared...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%CF%' -UseBasicParsing"
)

if not exist "%USERPROFILE%\.cloudflared\cert.pem" (
  echo       A browser will open - pick your domain and click Authorize.
  echo(
  "%CF%" tunnel login
  if not exist "%USERPROFILE%\.cloudflared\cert.pem" (
    echo    ERROR: login did not produce cert.pem & pause & exit /b 1
  )
)

set "TNAME=mcp-%MID%"
echo       creating tunnel %TNAME%
"%CF%" tunnel create "%TNAME%" 2>nul

rem locate the credentials json and copy it in
for /f "delims=" %%U in ('"%CF%" tunnel list --output json ^| powershell -NoProfile -Command "($input | ConvertFrom-Json | Where-Object { $_.name -eq '%TNAME%' } | Select-Object -First 1).id"') do set "TID=%%U"
if not defined TID (echo    ERROR: could not resolve tunnel id & pause & exit /b 1)
copy /y "%USERPROFILE%\.cloudflared\%TID%.json" "%DEST%\tunnel.json" >nul

rem ask for the base domain to build the hostname
set "ZONE="
for /f "delims=" %%Z in ('powershell -NoProfile -Command "(Get-Content '%DEST%\_zone.txt' -ErrorAction SilentlyContinue)"') do set "ZONE=%%Z"
if not defined ZONE (
  set /p ZONE=      Base domain (e.g. example.com): 
)
set "FQDN=%SUBDOMAIN%.%ZONE%"
echo       routing %FQDN% -^> %TNAME%
"%CF%" tunnel route dns "%TNAME%" "%FQDN%"

rem write config.yml
> "%DEST%\config.yml" echo tunnel: %TID%
>>"%DEST%\config.yml" echo credentials-file: %DEST%\tunnel.json
>>"%DEST%\config.yml" echo ingress:
>>"%DEST%\config.yml" echo   - hostname: %FQDN%
>>"%DEST%\config.yml" echo     path: ^^/desktop
>>"%DEST%\config.yml" echo     service: http://127.0.0.1:8010
>>"%DEST%\config.yml" echo   - hostname: %FQDN%
>>"%DEST%\config.yml" echo     service: http://127.0.0.1:8000
>>"%DEST%\config.yml" echo   - service: http_status:404
echo       tunnel ready.

rem ---------- 6. identity + task ----------
rem machine.json MUST be UTF-8 WITHOUT BOM. Windows PowerShell 5.1's
rem "-Encoding utf8" writes a BOM, which made json.load() fail on the far
rem side; supervisor.py then quietly generated a fresh identity and the
rem hostname was lost. WriteAllText with a no-BOM UTF8Encoding is explicit
rem and behaves the same on PS 5.1 and PS 7.
echo [6/7] writing identity and registering startup task...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$o=[ordered]@{machine_id='%MID%';label='%MID%';hostname='%FQDN%';tunnel_name='%TNAME%';" ^
  "bridge_token=[Convert]::ToBase64String((1..32|%%{Get-Random -Max 256})).TrimEnd('=').Replace('+','-').Replace('/','_');" ^
  "desktop_token=[Convert]::ToBase64String((1..32|%%{Get-Random -Max 256})).TrimEnd('=').Replace('+','-').Replace('/','_');" ^
  "bound_computer=$env:COMPUTERNAME};" ^
  "$json=$o|ConvertTo-Json;" ^
  "[System.IO.File]::WriteAllText('%DEST%\machine.json',$json,(New-Object System.Text.UTF8Encoding($false)))"

rem Verify it round-trips through a strict JSON parser before continuing.
"%PYDIR%\python.exe" -c "import json;json.load(open(r'%DEST%\machine.json',encoding='utf-8'))"
if errorlevel 1 (echo    ERROR: machine.json is not valid UTF-8 JSON & pause & exit /b 1)

rem Point the task straight at pythonw.exe. Going through cmd.exe /c meant a
rem console window flashed at every logon -- the one thing we promise not to do.
schtasks /query /tn "MCP-Stack" >nul 2>&1
if not errorlevel 1 schtasks /delete /tn "MCP-Stack" /f >nul 2>&1
schtasks /create /tn "MCP-Stack" /tr "\"%PYDIR%\pythonw.exe\" \"%DEST%\supervisor.py\"" /sc onlogon /f >nul
if errorlevel 1 (echo    ERROR: could not register the scheduled task & pause & exit /b 1)
echo       done.

rem ---------- 7. start + report ----------
echo [7/7] starting...
call "%DEST%\launch.cmd"
timeout /t 25 /nobreak >nul
call "%DEST%\launch.cmd" status

echo(
echo ==============================================
echo   DONE.  Add this PC to your fleet list:
echo ==============================================
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$m=Get-Content '%DEST%\machine.json' -Raw|ConvertFrom-Json;" ^
  "[pscustomobject]@{id=$m.machine_id;label=$m.label;hostname=$m.hostname;" ^
  "bridge_token=$m.bridge_token;desktop_token=$m.desktop_token;enabled=$true}|ConvertTo-Json"
echo(
echo   Paste the block above into machines.json -^> "machines" array.
echo(
pause
exit /b 0
