#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "→ Bootstrapping PaperWar Strategy Lab at $REPO_DIR"

# Backend
echo "→ Installing Python dependencies..."
cd "$REPO_DIR/backend"
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo "✓ Backend dependencies installed"

# Frontend
echo "→ Installing Node dependencies..."
cd "$REPO_DIR/frontend"
npm install --silent
echo "✓ Frontend dependencies installed"

echo ""
echo "✓ Bootstrap complete. Start backend: cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo "✓ Start frontend: cd frontend && npm run dev"
