#!/bin/bash

if [ ! -d ".git" ]; then
    echo "[WARNING] Not a git repository. Auto-update is not available."
    echo "Please download the latest version manually or clone the repository."
    read -p "Press any key to continue..."
else
    echo "[INFO] Checking for updates..."
    git pull
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to update. Please check your git configuration."
        read -p "Press any key to continue..."
    else
        echo "[INFO] Update check completed."
    fi
fi

echo "[INFO] Starting Application..."
./run.sh
