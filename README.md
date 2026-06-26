# PaperWar Strategy Lab

A monorepo for analyzing PaperWar matches, learning winning patterns, and optionally assisting production and transport decisions.

## Structure

```
.
├── backend/           FastAPI service — ingestion, analysis, recommendations, automation gates
├── frontend/          React/Vite dashboard — match review, live overlays, control toggles
├── shared/            Shared schemas and event definitions
├── infra/             Local stack files
├── .devcontainer/     GitHub Codespaces configuration
├── docs/              Architecture, data model, roadmap
├── scripts/           Bootstrap scripts
└── tests/             Integration and unit test scaffolding
```

## Quick start

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Open in GitHub Codespaces

1. Go to the repository on GitHub.
2. Click **Code** → **Codespaces** tab.
3. Click **Create codespace on main**.

The `.devcontainer/devcontainer.json` configures Python 3.12, Node 20, and all required VS Code extensions automatically.
