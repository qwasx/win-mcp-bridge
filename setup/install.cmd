@echo off
setlocal enabledelayedexpansion
rem =====================================================================
rem  install.cmd  --  MCP Bridge installer for a NEW Windows PC
rem  ASCII ONLY. Run from the MCP-Bridge-Setup folder.
rem
rem  What it does:
rem    1. unpack a private Python (no system install, no registry, no admin)
rem    2. install windows-mcp into that Python (offline if wheels exist)
rem    3. re-apply the wmc-patch (console-flash fix etc.)
rem    4. create THIS PC's OWN Cloudflare tunnel + hostname   <-- key step
rem    5. write machine.json (identity, unique per PC)
rem    6. register the MCP-Stack scheduled task and start it
rem    7. print the machines.json entry to paste into your fleet list
rem =====================================================================

set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"
set "DEST=C:\mcp-bridge"
set "PYDIR=%DEST%\python"

echo(
echo ==============================================
echo   MCP Bridge - new machine setup
echo   target: %DEST%
echo ==============================================
echo(

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
rem lowercase-ish id for convenience
if not defined SUBDOMAIN set "SUBDOMAIN=%MID%"

rem ---------- 1. copy payload ----------
echo [1/7] copying files...
if not exist "%DEST%" mkdir "%DEST%"
xcopy "%SRC%\payload\*" "%DEST%\" /E /I /Y /Q >nul
if errorlevel 1 (echo    ERROR: copy failed & pause & exit /b 1)
echo       done.

rem ---------- 2. python ----------
echo [2/7] setting up private Python...
if exist "%PYDIR%\python.exe" (
  echo       already present, skipping.
) else (
  if exist "%SRC%\offline\python-embed.zip" (
    echo       unpacking bundled python-embed.zip
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "Expand-Archive -Path '%SRC%\offline\python-embed.zip' -DestinationPath '%PYDIR%' -Force"
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
  if exist "%SRC%\offline\get-pip.py" (
    "%PYDIR%\python.exe" "%SRC%\offline\get-pip.py" --no-warn-script-location >nul 2>&1
  ) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "Invoke-WebRequest 'https://bootstrap.pypa.io/get-pip.py' -OutFile \"$env:TEMP\get-pip.py\" -UseBasicParsing"
    "%PYDIR%\python.exe" "%TEMP%\get-pip.py" --no-warn-script-location >nul 2>&1
  )
  "%PYDIR%\python.exe" -m pip --version >nul 2>&1
  if errorlevel 1 (echo    ERROR: pip bootstrap failed & pause & exit /b 1)
)
echo       python ok.

rem ---------- 3. bridge deps + venv ----------
echo [3/7] installing dependencies...
set "PIPSRC="
if exist "%SRC%\offline\wheels" set "PIPSRC=--no-index --find-links=\"%SRC%\offline\wheels\""

"%PYDIR%\python.exe" -m pip install %PIPSRC% --quiet --no-warn-script-location mcp uvicorn starlette
if errorlevel 1 (echo    ERROR: bridge deps failed & pause & exit /b 1)

rem NOTE: the embeddable Python has NO venv module ("No module named venv").
rem Verified on 2026-09-16. So we install windows-mcp straight into it --
rem this was tested end to end: the server starts and answers MCP on
rem embeddable Python, with the console-flash patch applied.
echo       installing windows-mcp...
"%PYDIR%\python.exe" -m pip install %PIPSRC% --quiet --no-warn-script-location windows-mcp
if errorlevel 1 (echo    ERROR: windows-mcp install failed & pause & exit /b 1)
echo       done.

rem ---------- 4. re-apply patches ----------
echo [4/7] applying wmc-patch (console-flash fix)...
if exist "%DEST%\wmc-patch\files" (
  for /f "delims=" %%D in ('"%PYDIR%\python.exe" -c "import windows_mcp,os;print(os.path.dirname(windows_mcp.__file__))"') do set "WMCDIR=%%D"
  if defined WMCDIR (
    xcopy "%DEST%\wmc-patch\files\*" "!WMCDIR!\" /E /I /Y /Q >nul
    "%PYDIR%\python.exe" -c "import windows_mcp,os;p=os.path.join(os.path.dirname(windows_mcp.__file__),'powershell','utils.py');print('       patch verified' if 'CREATE_NO_WINDOW' in open(p,encoding='utf-8').read() else '       WARNING: patch NOT applied')"
  ) else (
    echo       WARNING: could not locate windows_mcp package.
  )
) else (
  echo       WARNING: wmc-patch not found, console windows may flash.
)

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
echo [6/7] writing identity and registering startup task...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$o=[ordered]@{machine_id='%MID%';label='%MID%';hostname='%FQDN%';tunnel_name='%TNAME%';" ^
  "bridge_token=[Convert]::ToBase64String((1..32|%%{Get-Random -Max 256})).TrimEnd('=').Replace('+','-').Replace('/','_');" ^
  "desktop_token=[Convert]::ToBase64String((1..32|%%{Get-Random -Max 256})).TrimEnd('=').Replace('+','-').Replace('/','_');" ^
  "bound_computer=$env:COMPUTERNAME}; $o|ConvertTo-Json|Set-Content '%DEST%\machine.json' -Encoding utf8"

schtasks /query /tn "MCP-Stack" >nul 2>&1
if not errorlevel 1 schtasks /delete /tn "MCP-Stack" /f >nul 2>&1
schtasks /create /tn "MCP-Stack" /tr "cmd.exe /c \"%DEST%\launch.cmd\"" /sc onlogon /rl highest /f >nul
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
echo   Paste the block above into machines.json -> "machines" array.
echo(
pause
exit /b 0
