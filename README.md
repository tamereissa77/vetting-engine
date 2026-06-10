# Sovereign Talent Vetting & Matching Engine

A containerized talent vetting platform for sovereign AI hiring workflows. This project combines a React/Vite dashboard with a Python FastAPI backend, a Celery worker, Redis pub/sub progress streams, and PostgreSQL persistence.

## What this project does

- Seeds **22 high-fidelity OriginCraft Talent Profiles** across infrastructure, data, model, AI reasoning, application, governance, and domain specialty layers.
- Lets users manage talent profiles with full CRUD operations.
- Accepts resume uploads in PDF/DOCX form and extracts candidate metadata using a local or cloud LLM parser.
- Provides a mocked LinkedIn scan flow that converts a profile URL into a candidate ledger entry.
- Runs AI-powered candidate assessment and matchmaking against one or more target profiles.
- Streams task progress back to the UI over WebSockets for live extraction, scraping, and vetting feedback.

## Architecture

The application is orchestrated with `docker-compose.yml` and includes:

- `frontend`: React + TypeScript + Vite + Tailwind CSS dashboard.
- `backend`: FastAPI REST API gateway, local config manager, and orchestration layer.
- `worker`: Celery worker that executes background tasks for resume parsing, LinkedIn profile mock scanning, and matchmaking.
- `redis`: Redis broker for Celery and Pub/Sub progress updates.
- `db`: PostgreSQL for persistent talent profiles, candidate records, and assessment history.

## Database persistence

The PostgreSQL service is configured with a Docker named volume (`postgres_data`) mounted at `/var/lib/postgresql/data`. This means your candidate and profile data will survive container restarts and rebuilds as long as the volume is kept.

> Warning: running `docker-compose down -v` will remove the database volume and erase persisted data.

## Tech stack

- Backend: Python, FastAPI, Celery, SQLAlchemy, PostgreSQL, Redis
- AI: Local `ollama` provider by default, optional `gemini` or `openai` providers
- Frontend: React, TypeScript, Vite, Tailwind CSS, Lucide icons
- Orchestration: Docker, Docker Compose

## Features

- Pre-seeded talent benchmark profiles with red-flag scoring guidance.
- Live candidate registry and assessment dashboard.
- Manual candidate creation and profile editing.
- CV upload parsing pipeline for PDF and DOCX resumes.
- LinkedIn scraping mock workflow that generates candidate details.
- AI assessment engine that returns match score, skill match/gap, red flags, and written verdict.
- WebSocket task progress stream: `/ws/tasks/{task_id}`.

## Getting started

### Prerequisites

- Docker Desktop running on Windows.
- Optionally, install [Ollama](https://ollama.com/) if you want a local sovereign model.
- If using Ollama, pull a model:
  ```bash
  ollama pull llama3
  ```

### Start the app

1. Create environment variables:
   ```bash
   copy .env.example .env
   ```
2. Build and start all services:
   ```bash
   docker-compose up --build
   ```
3. Open the UI:
   - Frontend: http://localhost:5173
   - API docs: http://localhost:8000/docs

### Default service ports

- Frontend: `5173`
- Backend: `8000`
- PostgreSQL: `5432`
- Redis: `6379`

## Environment variables

These variables can be configured in `.env` or the Docker Compose environment.

- `POSTGRES_USER` - PostgreSQL username (default: `postgres`)
- `POSTGRES_PASSWORD` - PostgreSQL password (default: `postgres_sovereign_secure`)
- `POSTGRES_DB` - database name (default: `sovereign_talent`)
- `POSTGRES_HOST` - database host (default: `db`)
- `POSTGRES_PORT` - database port (default: `5432`)
- `REDIS_URL` - Redis connection string (default: `redis://redis:6379/0`)
- `LLM_PROVIDER` - AI provider: `ollama`, `gemini`, or `openai` (default: `ollama`)
- `OLLAMA_API_BASE` - local Ollama endpoint base URL
- `OLLAMA_MODEL` - Ollama model name (default: `llama3`)
- `GEMINI_API_KEY` - Gemini API key for cloud provider usage
- `GEMINI_MODEL` - Gemini model name (default: `gemini-2.5-pro`)
- `OPENAI_API_KEY` - OpenAI API key if using OpenAI provider

## API overview

### Profile management

- `GET /api/profiles` - list profiles, optional `stack_layer` filter
- `GET /api/profiles/raw` - list profiles with raw ID metadata for dropdowns
- `POST /api/profiles` - create a new talent profile
- `PUT /api/profiles/{profile_id}` - update a profile
- `DELETE /api/profiles/{profile_id}` - delete a profile

### Candidate management

- `GET /api/candidates` - list all candidates with their highest assessment result
- `GET /api/candidates/{candidate_id}` - get a detailed candidate record and assessments
- `POST /api/candidates` - manually create a candidate record
- `PUT /api/candidates/{candidate_id}` - update candidate details
- `DELETE /api/candidates/{candidate_id}` - remove a candidate from the ledger

### Background workflows

- `POST /api/candidates/upload` - upload a PDF/DOCX resume and enqueue CV parsing
- `POST /api/candidates/linkedin` - provide a LinkedIn profile URL and enqueue a mock scan
- `POST /api/candidates/{candidate_id}/match` - enqueue AI assessment against selected profile IDs

### Live progress stream

- `WS /ws/tasks/{task_id}` - subscribe to background task progress updates for CV parsing, LinkedIn scanning, or matchmaking.

## How it works

1. The backend seeds the PostgreSQL database with 22 OriginCraft Talent Profiles on startup.
2. The frontend fetches profiles and candidate ledger data via REST API.
3. CV uploads and LinkedIn scans create placeholder candidate records, then enqueue Celery tasks.
4. The Celery worker processes all heavy work and publishes progress events to Redis.
5. The frontend listens over WebSockets and renders live progress logs and completion status.
6. Completed assessments are stored in PostgreSQL and can be reviewed from the candidate dossier.

## Development notes

- Backend code lives in `backend/` and uses `uvicorn` for FastAPI.
- Worker code is in `backend/tasks_queue.py` and runs with `celery -A tasks_queue.celery_app worker --loglevel=info`.
- Frontend code lives in `frontend/src/` and uses React + Vite.
- The frontend API client is implemented in `frontend/src/utils/api.ts`.
- CV parsing is handled by `backend/ai.py`, which supports local `ollama` or cloud API fallbacks.

## Seeded profiles

The project ships with 22 pre-defined roles, including:
- Infrastructure and cloud engineering
- Data engineering and vector database experts
- Model engineering, MLOps, and NLP specialists
- AI reasoning, agent engineering, and governance leads
- Strategy, enablement, and domain SME roles for legal, finance, healthcare, and defense

---

## Notes

- The LinkedIn workflow is intentionally implemented as a mock scan that simulates the pipeline and generates candidate data from the supplied URL.
- The AI matcher returns structured JSON with `match_score`, `skills_match`, `skills_gap`, `red_flags_detected`, and `ai_verdict`.
- Redis is used for both Celery message brokering and real-time task progress streams.
