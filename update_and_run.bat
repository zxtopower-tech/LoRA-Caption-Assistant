@echo off
SETLOCAL

IF NOT EXIST ".git" (
    ECHO [WARNING] Not a git repository. Auto-update is not available.
    ECHO Please download the latest version manually or clone the repository.
    PAUSE
) ELSE (
    ECHO [INFO] Checking for updates...
    git pull
    IF ERRORLEVEL 1 (
        ECHO [ERROR] Failed to update. Please check your git configuration.
        PAUSE
    ) ELSE (
        ECHO [INFO] Update check completed.
    )
)

ECHO [INFO] Starting Application...
call run.bat

ENDLOCAL
