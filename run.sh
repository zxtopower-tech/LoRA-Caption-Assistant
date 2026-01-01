#!/bin/bash

echo "==============================================="
echo " LoRA Caption Assistant - Local Launcher"
echo "==============================================="

# 1. Check for Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed or not in PATH."
    exit 1
fi

# 2. Check for Node.js
if ! command -v npm &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH."
    exit 1
fi

# 3. Setup Python Virtual Environment
if [ ! -d ".venv" ]; then
    echo "[INFO] Creating Python virtual environment..."
    python3 -m venv .venv
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to create virtual environment."
        exit 1
    fi
fi

# 4. Install Backend Dependencies
echo "[INFO] Installing/Updating backend dependencies..."
source .venv/bin/activate
pip install -r backend/requirements.txt
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install backend dependencies."
    exit 1
fi

# 5. Install Frontend Dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo "[INFO] Installing frontend dependencies..."
    cd frontend
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install frontend dependencies."
        exit 1
    fi
    cd ..
fi

# 6. Start Application
echo ""
echo "[INFO] Starting Backend..."
# Run backend in background
uvicorn app:app --app-dir backend --host 127.0.0.1 --port 8001 --reload &
BACKEND_PID=$!

echo "[INFO] Starting Frontend..."
# Run frontend
cd frontend && npm run dev -- --port 7788 &
FRONTEND_PID=$!

echo ""
echo "[SUCCESS] Application launched!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop servers."
echo ""
echo "Opening browser..."

# Open browser based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    sleep 2
    open http://localhost:7788
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sleep 2
    xdg-open http://localhost:7788 > /dev/null 2>&1 &
fi

# Function to kill processes on exit
cleanup() {
    echo ""
    echo "[INFO] Stopping servers..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit
}

# Trap Ctrl+C
trap cleanup SIGINT

# Wait for processes
wait
