#!/bin/bash

# BountyAI Backend Startup Script
# Starts the FastAPI server with proper configuration
#
# Copyright (c) 2025 Luis Penson. All rights reserved.
# This software may not be copied, modified, distributed, or used without explicit permission.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║          🚀 BountyAI Backend 🚀            ║"
echo "║     AI-Powered Bounty Assignment System     ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Load environment variables from .env file BEFORE starting server
if [ -f ".env" ]; then
    echo "🔑 Loading environment variables from .env..."
    set -a
    source .env
    set +a
fi

# Install/update dependencies
echo "📚 Checking dependencies..."
if [ ! -f "venv/lib/python*/site-packages/fastapi/__init__.py" 2>/dev/null ]; then
    echo "📦 Installing dependencies..."
    pip install -q -r requirements.txt
    echo "✓ Dependencies installed"
else
    echo "✓ Dependencies already installed"
fi

echo ""
echo "🌐 Starting FastAPI server..."
echo ""
echo "Server running at http://localhost:8000"
echo "API docs at http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server (environment already loaded above)
python -m uvicorn main:app --host 0.0.0.0 --port 8000
