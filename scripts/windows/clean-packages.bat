@echo off
echo Cleaning Node.js, Python, and Flutter build caches...

REM .\scripts\windows\clean-packages.bat

set ROOT_DIR=%cd%
set CLIENT_DIR=%ROOT_DIR%\client
set SERVER_DIR=%ROOT_DIR%\server
set MOBILE_DIR=%ROOT_DIR%\mobile

call :clean_workspace "%ROOT_DIR%"
call :clean_workspace "%CLIENT_DIR%"
call :clean_workspace "%SERVER_DIR%"
call :clean_workspace "%MOBILE_DIR%"

echo All clean completed.
goto :eof

:clean_workspace
setlocal
set TARGET=%~1
echo Cleaning: %TARGET%

REM -------------------------
REM 1️⃣ Node.js / JS / TS
REM -------------------------
if exist "%TARGET%\node_modules" (
    rmdir /s /q "%TARGET%\node_modules"
)
if exist "%TARGET%\.next" (
    rmdir /s /q "%TARGET%\.next"
)
if exist "%TARGET%\.turbo" (
    rmdir /s /q "%TARGET%\.turbo"
)
if exist "%TARGET%\.cache" (
    rmdir /s /q "%TARGET%\.cache"
)
if exist "%TARGET%\dist" (
    rmdir /s /q "%TARGET%\dist"
)
del /f /q "%TARGET%\package-lock.json" >nul 2>&1
del /f /q "%TARGET%\pnpm-lock.yaml" >nul 2>&1
del /f /q "%TARGET%\yarn.lock" >nul 2>&1

REM -------------------------
REM 2️⃣ Python / Poetry
REM -------------------------
if exist "%TARGET%\.venv" (
    rmdir /s /q "%TARGET%\.venv"
)
if exist "%TARGET%\venv" (
    rmdir /s /q "%TARGET%\venv"
)
del /f /q "%TARGET%\poetry.lock" >nul 2>&1
del /f /q "%TARGET%\Pipfile.lock" >nul 2>&1

REM -------------------------
REM 3️⃣ Flutter / Dart
REM -------------------------
if exist "%TARGET%\pubspec.yaml" (
    echo → Detected Flutter project in %TARGET%
    
    REM Run flutter clean if flutter is available
    where flutter >nul 2>&1
    if %errorlevel%==0 (
        pushd "%TARGET%"
        flutter clean
        popd
    )

    REM Remove extra caches
    if exist "%TARGET%\.dart_tool" (
        rmdir /s /q "%TARGET%\.dart_tool"
    )
    if exist "%TARGET%\build" (
        rmdir /s /q "%TARGET%\build"
    )
    if exist "%TARGET%\ios\Pods" (
        rmdir /s /q "%TARGET%\ios\Pods"
    )
    if exist "%TARGET%\ios\Podfile.lock" (
        del /f /q "%TARGET%\ios\Podfile.lock" >nul 2>&1
    )
    if exist "%TARGET%\android\.gradle" (
        rmdir /s /q "%TARGET%\android\.gradle"
    )
    del /f /q "%TARGET%\pubspec.lock" >nul 2>&1
)

echo Done: %TARGET%
echo.
endlocal
goto :eof
