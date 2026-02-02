#!/bin/bash
# NLP Service startup script for PM2
# This script activates the Python virtual environment and starts uvicorn

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo "Error: No virtual environment found. Please create one first:"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements.txt"
    exit 1
fi

# Set defaults
NLP_HOST="${NLP_HOST:-127.0.0.1}"
NLP_PORT="${NLP_PORT:-8000}"
NLP_WORKERS="${NLP_WORKERS:-1}"
NLP_ENV="${NLP_ENV:-development}"

# Start uvicorn
if [ "$NLP_ENV" = "production" ]; then
    echo "Starting NLP service in production mode..."
    exec uvicorn app.main:app \
        --host "$NLP_HOST" \
        --port "$NLP_PORT" \
        --workers "$NLP_WORKERS" \
        --log-level info \
        --access-log \
        --no-use-colors
else
    echo "Starting NLP service in development mode..."
    exec uvicorn app.main:app \
        --host "$NLP_HOST" \
        --port "$NLP_PORT" \
        --reload \
        --log-level debug
fi
