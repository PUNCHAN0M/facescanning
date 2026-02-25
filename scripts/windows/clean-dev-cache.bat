@echo off
echo Cleaning global caches...

REM .\scripts\windows\clean-dev-cache.bat

:: PNPM
for /f "usebackq delims=" %%s in (`pnpm store path`) do set "STORE_PATH=%%s"
echo PNPM STORE_PATH is "%STORE_PATH%"

if defined STORE_PATH (
    echo Pruning PNPM store...
    call pnpm store prune

    if exist "%STORE_PATH%" (
        echo Removing PNPM store at "%STORE_PATH%"
        rmdir /s /q "%STORE_PATH%"
        if errorlevel 1 (
            echo Failed to remove PNPM store folder.
        ) else (
            echo PNPM store folder removed successfully.
        )
    ) else (
        echo PNPM store folder not found, skipping removal.
    )
) else (
    echo PNPM store path not found, skipping removal.
)

echo --- Passed PNPM ---

:: NPM
where npm >nul 2>&1
if %errorlevel%==0 (
    echo Cleaning NPM cache...
    call npm cache verify
    echo NPM cache verified.
) else (
    echo NPM not found, skipping...
)

echo --- Passed NPM ---

:: NPX cache
set "NPX_CACHE=%USERPROFILE%\AppData\Local\npm-cache\_npx"
echo Checking NPX cache at "%NPX_CACHE%"
if exist "%NPX_CACHE%" (
    echo Removing NPX cache...
    rmdir /s /q "%NPX_CACHE%"
    if exist "%NPX_CACHE%" (
        echo Failed to remove NPX cache.
    ) else (
        echo NPX cache removed successfully.
    )
) else (
    echo NPX cache not found.
)

echo --- Passed NPX ---

:: Python pip cache
set "PIP_CACHE=%LOCALAPPDATA%\pip\Cache"
echo Checking Python pip cache at "%PIP_CACHE%"
if exist "%PIP_CACHE%" (
    echo Removing pip cache...
    rmdir /s /q "%PIP_CACHE%"
    if errorlevel 1 (
        echo Failed to remove pip cache.
    ) else (
        echo pip cache removed successfully.
    )
) else (
    echo pip cache not found.
)

echo --- Passed PIP ---

:: Yarn
where yarn >nul 2>&1
if %errorlevel%==0 (
    echo Cleaning Yarn cache...
    call yarn cache clean
    echo Yarn cache cleaned.
) else (
    echo Yarn not found, skipping...
)

echo --- Passed Yarn ---

echo.
echo All caches cleaned successfully.
echo Press any key to exit...
pause >nul
