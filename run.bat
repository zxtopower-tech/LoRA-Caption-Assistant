@echo off
setlocal enabledelayedexpansion

:: Set window title and size
title LoRA Caption Assistant Launcher
mode con: cols=85 lines=30
color 0B

:: ====================================================
:: UI HELPER FUNCTIONS
:: ====================================================
goto :MAIN

:PRINT_HEADER
cls
echo.
echo  ===================================================================================
echo  #                                                                                 #
echo  #                       LoRA Caption Assistant Launcher                           #
echo  #                                                                                 #
echo  ===================================================================================
echo.
exit /b

:PRINT_STEP
echo  [%~1] %~2...
exit /b

:PRINT_SUCCESS
echo.
echo     [OK] %~1
echo.
exit /b

:PRINT_ERROR
color 0C
echo.
echo  ===================================================================================
echo   [ERROR] %~1
echo  ===================================================================================
echo.
pause
exit /b 1

:: ====================================================
:: MAIN LOGIC
:: ====================================================
:MAIN
call :PRINT_HEADER

if not exist "bin" mkdir bin

:: --- STEP 1: PYTHON CHECK ---
call :PRINT_STEP "1/4" "Checking Python Environment"

:: Check Local
if exist "bin\python\python.exe" (
    set "PYTHON_CMD=%~dp0bin\python\python.exe"
    set "PIP_CMD=%~dp0bin\python\Scripts\pip.exe"
    echo      - Found local portable Python.
    goto :CHECK_NODE
)

:: Check System
python --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python"
    set "PIP_CMD=pip"
    echo      - Found system Python.
    goto :CHECK_NODE
)

:: Download Python (using curl)
echo      - Python not found. Downloading Portable Python 3.10...
echo        (Official Python.org Embeddable Package)
set "PYTHON_URL=https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip"

curl -L -sS -o "bin\python.zip" "%PYTHON_URL%"
if not exist "bin\python.zip" call :PRINT_ERROR "Failed to download Python. Check internet connection."

echo      - Extracting...
if not exist "bin\python" mkdir "bin\python"
tar -xf "bin\python.zip" -C "bin\python"
if not exist "bin\python\python.exe" call :PRINT_ERROR "Failed to extract Python."
del "bin\python.zip"

echo      - Configuring pip...
:: Re-write .pth file to uncomment 'import site' using pure batch
echo python310.zip> "bin\python\python310._pth"
echo .>> "bin\python\python310._pth"
echo import site>> "bin\python\python310._pth"

:: Download pip installer (using curl)
curl -L -sS -o "bin\python\get-pip.py" "https://bootstrap.pypa.io/get-pip.py"
if not exist "bin\python\get-pip.py" call :PRINT_ERROR "Failed to download pip installer."

"bin\python\python.exe" "bin\python\get-pip.py" --no-warn-script-location >nul 2>&1
del "bin\python\get-pip.py"

set "PYTHON_CMD=%~dp0bin\python\python.exe"
set "PIP_CMD=%~dp0bin\python\Scripts\pip.exe"

call :PRINT_SUCCESS "Python Environment Ready"


:: --- STEP 2: NODE.JS CHECK ---
:CHECK_NODE
call :PRINT_STEP "2/4" "Checking Node.js Environment"

:: Check Local
if exist "bin\node\node.exe" (
    set "PATH=%~dp0bin\node;%PATH%"
    echo      - Found local portable Node.js.
    goto :INSTALL_DEPS
)

:: Check System
call npm --version >nul 2>&1
if %errorlevel% equ 0 (
    echo      - Found system Node.js.
    goto :INSTALL_DEPS
)

:: Download Node (using curl)
echo      - Node.js not found. Downloading Portable Node.js v20...
set "NODE_URL=https://nodejs.org/dist/v20.11.0/node-v20.11.0-win-x64.zip"

curl -L -sS -o "bin\node.zip" "%NODE_URL%"
if not exist "bin\node.zip" call :PRINT_ERROR "Failed to download Node.js."

echo      - Extracting...
tar -xf "bin\node.zip" -C "bin"
del "bin\node.zip"

:: Rename folder (Pure Batch tricky, simpler to move contents)
:: Node zip extracts to node-v20.11.0-win-x64
if exist "bin\node-v20.11.0-win-x64" (
    move "bin\node-v20.11.0-win-x64" "bin\node" >nul
)

if not exist "bin\node\node.exe" call :PRINT_ERROR "Failed to setup Node.js."

set "PATH=%~dp0bin\node;%PATH%"
call :PRINT_SUCCESS "Node.js Environment Ready"


:: --- STEP 3: INSTALL DEPENDENCIES ---
:INSTALL_DEPS
call :PRINT_STEP "3/4" "Installing Dependencies"

:: Setup venv for System Python if needed
if "%PYTHON_CMD%"=="python" (
    if not exist ".venv" (
        echo      - Creating virtual environment...
        python -m venv .venv
    )
    call .venv\Scripts\activate.bat >nul 2>&1
    set "PYTHON_CMD=python"
    set "PIP_CMD=pip"
)

echo      - Installing Backend Requirements...
"%PIP_CMD%" install -r backend\requirements.txt >nul 2>&1
if %errorlevel% neq 0 call :PRINT_ERROR "Failed to install backend dependencies."

if not exist "frontend\node_modules" (
    echo      - Installing Frontend Packages...
    pushd frontend
    call npm install >nul 2>&1
    popd
    if %errorlevel% neq 0 call :PRINT_ERROR "Failed to install frontend dependencies."
)
call :PRINT_SUCCESS "Dependencies Installed"


:: --- STEP 4: LAUNCH ---
:LAUNCH
call :PRINT_STEP "4/4" "Launching Application"

echo.
echo      Starting Backend Server (Port 8001)...
start /b "" "%PYTHON_CMD%" -m uvicorn app:app --app-dir backend --host 127.0.0.1 --port 8001 --reload

echo      Starting Frontend Server (Port 7788)...
start /b "" cmd /c "set PATH=%PATH% && cd frontend && npm run dev -- --port 7788"

echo.
echo  ===================================================================================
echo  #                                                                                 #
echo  #   [SUCCESS] Application is running!                                             #
echo  #   Browser will open in 5 seconds...                                             #
echo  #                                                                                 #
echo  #   [NOTE] Don't close this window! It runs the servers.                          #
echo  #                                                                                 #
echo  ===================================================================================
echo.

timeout /t 5 >nul
start http://localhost:7788

echo.
echo  ===================================================================================
echo  #   Running...                                                                    #
echo  #   To stop the server, simply CLOSE this window.                                 #
echo  ===================================================================================
echo.

:LOOP
pause >nul
goto :LOOP
