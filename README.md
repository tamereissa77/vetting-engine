# Sovereign Talent Engine

A full-stack AI-powered talent vetting, matching, and resource management platform built for sovereign AI hiring workflows. The platform combines a React/Vite cyber-themed dashboard with a Python FastAPI backend, Celery background workers, Redis pub/sub progress streams, and PostgreSQL persistence — all orchestrated via Docker Compose.

---

## Dashboard Tabs

The UI is organised into six tabs accessible from the top navigation bar.

### 1. Profiles
Manage the talent benchmark library.

- View all 22 pre-seeded OriginCraft AI talent profiles grouped by stack layer (Infrastructure, Data, Model, AI/Reasoning, Application, Strategy, Governance, Domain).
- Filter profiles by stack layer.
- Create new profiles manually via a form modal.
- **Import from file** — upload a PDF, DOCX, or TXT job description and the AI extracts a structured talent profile automatically.
- **Generate from title** — type any job title and the AI generates a complete profile (role summary, red flags, engagement tier, category, stack layer).
- Edit or delete any existing profile.

### 2. Vetting
Run AI-powered candidate assessments.

- Select one or more target talent profiles from the library.
- Choose candidates from the ledger to assess against the selected profiles.
- Trigger the AI matchmaking engine, which returns per-profile scores, skill matches, skill gaps, detected red flags, and a written AI verdict.
- Disqualify individual assessment results to remove them from scoring.
- View live progress of background assessment tasks via WebSocket streams.

### 3. Candidates
The full candidate ledger.

- View all candidates with their top match score, matched role, skills, and experience years.
- Search and filter by name.
- **Upload CV** — upload a PDF or DOCX resume; the backend parses it with an LLM and creates a candidate record automatically.
- **LinkedIn Scan** — provide a LinkedIn profile URL; a mock scraping pipeline creates a candidate record from the profile.
- Create candidates manually.
- Edit candidate details (name, email, contact number, LinkedIn URL, notes, skills, experience).
- Open a candidate **Dossier** — a detailed modal showing all assessments across all profiles, assessment ring visualisations, skill match/gap breakdowns, red flags, and the full AI verdict.
- Blacklist a candidate to exclude them from assignment and matching.
- Delete a candidate from the ledger.
- See current project assignments directly on each candidate card.

### 4. SOW Planner
AI-assisted Statement of Work scope analysis and resource planning.

- Paste raw SOW text or upload a PDF/DOCX SOW document.
- The AI analyses the SOW and identifies:
  - **Matched Profiles** — existing talent profiles in the library that are relevant to the project.
  - **Identified Missing Gaps** — roles required by the SOW that are not yet in the profile library, with AI-generated profile definitions for each gap.
- Missing gap profiles can be promoted directly into the profile library with one click.
- For each matched or promoted profile, see candidate recommendations — top-scored candidates from the ledger, with their match scores.
- Assign a candidate to a project and profile slot directly from the planner view.
- Candidates with multiple time-slot assignments show all slots inline; add additional slots with the `+ Slot` button.
- **Save as Project** — save the SOW analysis as a named project in the Projects Registry.
- **Load Project** — reload a previously saved project workspace into the planner.

### 5. Projects Registry
Overview and management of all saved SOW projects.

- Project cards show project name, creation date, number of matched roles, number of missing gaps, and number of assigned resources.
- Open a project detail view to see:
  - **Role Allocation** — profiles grouped by role, each showing assigned candidates with their slot dates, duration, and per-slot Release buttons.
  - Matched role count and missing gap count (dynamically adjusted for any promoted gap profiles).
- Delete a project.
- Navigate directly from a project card into the SOW Planner to continue work on that project.

### 6. Utilization
Resource utilisation KPIs and timeline.

- **Summary KPIs** — six stat cards: Total Candidates, Active Assignments, Upcoming, Past, Unscheduled, and Available.
- **Project Coverage** — per-project coverage bars showing filled vs. required roles and percentage filled.
- **Resource Timeline (Gantt)** — horizontal bar chart spanning the full assignment date range. Each candidate occupies one row; multiple assignment slots for the same candidate render as separate bars on the same row. Colour-coded by status (active = cyan, upcoming = blue, past = slate).
- **All Assignments** — grouped accordion table. Each candidate appears as a single collapsible row showing their name, slot count, overall date span, and dominant status. Expanding the row reveals per-slot detail rows with project, role, dates, duration, status badge, and a Release button.
- **Available for Assignment** — grid of candidates with no current assignments.

---

## Candidate Assignment System

Candidates can be assigned to multiple projects across non-overlapping time slots.

- Assignments are stored in a dedicated `candidate_assignments` table (not flat columns on the candidate).
- Each slot records: candidate, project, profile (role), start date, end date.
- **Date overlap conflict detection** — the backend rejects a new assignment if its date range overlaps an existing slot for the same candidate.
- **Interactive calendar range picker** — the Assign modal shows a monthly calendar instead of text inputs. Existing busy slots are greyed out with a magenta dot; available days are clickable. Selecting a start date then hovering previews the range live; clicking the end date auto-clamps to just before any conflicting slot.
- Candidates can be assigned without dates (unscheduled) and dates added later.
- Slots can be released individually from the Planner, Projects Registry, or Utilization tab.

---

## Architecture

```
docker-compose.yml
├── frontend   React + TypeScript + Vite + Tailwind CSS (port 5173)
├── backend    FastAPI + SQLAlchemy + Celery (port 8000)
├── worker     Celery worker (background tasks)
├── redis      Message broker + pub/sub (port 6379)
└── db         PostgreSQL 15 (port 5432)
```

### Backend (`backend/`)

| File | Role |
|---|---|
| `main.py` | FastAPI app — all REST endpoints and WebSocket handler |
| `db.py` | SQLAlchemy ORM models (`TalentProfile`, `Candidate`, `CandidateAssignment`, `Assessment`, `Project`) |
| `ai.py` | LLM adapter — Ollama, Gemini, or OpenAI; handles CV parsing, SOW analysis, profile generation |
| `tasks_queue.py` | Celery task definitions — CV parsing, LinkedIn mock scan, matchmaking |
| `seed.py` | Database seeding and schema migrations on startup |

### Frontend (`frontend/src/`)

| File / Folder | Role |
|---|---|
| `App.tsx` | Root component — all six tabs, state management, API calls |
| `utils/api.ts` | Typed API client with all fetch helpers and TypeScript interfaces |
| `components/RangePicker.tsx` | Interactive calendar range picker with busy-day blocking |
| `components/DossierModal.tsx` | Full candidate dossier modal with assessment rings and verdict |
| `components/AssessmentRing.tsx` | SVG ring chart for match score visualisation |
| `components/ProfileModal.tsx` | Profile create/edit form modal |
| `components/CandidateModal.tsx` | Candidate create/edit form modal |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| Backend | Python, FastAPI, Pydantic v2, SQLAlchemy, Uvicorn |
| Background | Celery, Redis |
| Database | PostgreSQL 15 |
| AI / LLM | Google Gemini (default), Ollama (local), OpenAI (optional) |
| Containerisation | Docker, Docker Compose |

---

## Getting Started

### Prerequisites

- Docker Desktop
- Optionally [Ollama](https://ollama.com/) for a local sovereign model:
  ```bash
  ollama pull llama3
  ```

### Start the app

```bash
# 1. Copy environment config
copy .env.example .env

# 2. Build and start all services
docker-compose up --build

# 3. Open the UI
#    Dashboard: http://localhost:5173
#    API docs:  http://localhost:8000/docs
```

### Service ports

| Service | Port |
|---|---|
| Frontend | 5173 |
| Backend API | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_USER` | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `postgres_sovereign_secure` | PostgreSQL password |
| `POSTGRES_DB` | `sovereign_talent` | Database name |
| `POSTGRES_HOST` | `db` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection string |
| `LLM_PROVIDER` | `ollama` | AI provider: `ollama`, `gemini`, or `openai` |
| `OLLAMA_API_BASE` | `http://host.docker.internal:11434` | Local Ollama endpoint |
| `OLLAMA_MODEL` | `llama3` | Ollama model name |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-2.5-pro` | Gemini model name |
| `OPENAI_API_KEY` | — | OpenAI API key |

---

## API Reference

### Talent Profiles

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/profiles` | List profiles, optional `stack_layer` filter |
| `GET` | `/api/profiles/raw` | List all profiles with IDs (for dropdowns) |
| `POST` | `/api/profiles` | Create a profile manually |
| `PUT` | `/api/profiles/{id}` | Update a profile |
| `DELETE` | `/api/profiles/{id}` | Delete a profile |
| `POST` | `/api/profiles/import-file` | Upload PDF/DOCX/TXT and extract profile |
| `POST` | `/api/profiles/generate` | Generate profile from job title string |

### Candidates

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/candidates` | List all candidates with assessment summary |
| `GET` | `/api/candidates/{id}` | Get candidate detail with all assessments |
| `POST` | `/api/candidates` | Create candidate manually |
| `PUT` | `/api/candidates/{id}` | Update candidate details |
| `DELETE` | `/api/candidates/{id}` | Delete candidate |
| `POST` | `/api/candidates/upload` | Upload CV (PDF/DOCX) and enqueue parsing |
| `POST` | `/api/candidates/linkedin` | Submit LinkedIn URL and enqueue mock scan |
| `POST` | `/api/candidates/{id}/match` | Enqueue AI matchmaking against profile IDs |

### Assessments

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/assessments/{id}/disqualify` | Toggle disqualification on an assessment result |

### Projects

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List all saved projects |
| `GET` | `/api/projects/{id}` | Get project detail with assigned resources |
| `POST` | `/api/projects` | Save a new project |
| `DELETE` | `/api/projects/{id}` | Delete a project |
| `POST` | `/api/projects/analyze-scope` | Analyse SOW text or file, return matched and missing profiles |

### Assignments

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/projects/{project_id}/assign/{candidate_id}` | Assign candidate to project (with optional profile, start/end dates) |
| `DELETE` | `/api/assignments/{assignment_id}` | Release a single assignment slot |

### Utilization

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/utilization` | Return full utilisation data: KPIs, Gantt slots, project coverage, available candidates |

### WebSocket

| Endpoint | Description |
|---|---|
| `WS /ws/tasks/{task_id}` | Stream background task progress events (CV parsing, LinkedIn scan, matchmaking) |

---

## Database Schema

```
talent_profiles       — 22 pre-seeded benchmark role definitions
candidates            — candidate ledger (CV metadata, skills, experience)
assessments           — AI match results per candidate × profile
projects              — saved SOW project workspaces
candidate_assignments — multi-slot assignment records (candidate ↔ project ↔ profile ↔ date range)
```

> PostgreSQL data is persisted in a Docker named volume (`postgres_data`).
> Running `docker-compose down -v` will destroy all data.

---

## Seeded Talent Profiles

The platform ships with 22 pre-defined OriginCraft AI roles across seven stack layers:

| Layer | Roles |
|---|---|
| Layer 1 — Infrastructure | Sovereign Cloud / DevOps Architect, Site Reliability Engineer (AIOps), Security Engineer / Cryptography Specialist |
| Layer 2 — Data | Data Engineer (High-Throughput ETL), Vector Database Engineer, Data Architect |
| Layer 3 — Model | ML Engineer / LLM Fine-Tuning Specialist, MLOps Engineer, NLP / Arabic Language Specialist |
| Layer 4 — AI / Reasoning | AI / Agent Engineer, Reinforcement Learning Engineer, Knowledge Graph Engineer |
| Layer 5 — Application | Full-Stack / Frontend Engineer |
| Strategy & Advisory | AI Strategy Consultant, AI Governance & Risk Lead, Organizational Change Management Lead, AI Enablement / Training Lead |
| Governance & Security | Compliance / Cybersecurity Analyst |
| Domain (Vertical) | Domain Specialist — Legal/Legislative, Financial Services, Defense/Critical Infrastructure, Healthcare |

---

## How It Works

1. **Startup** — the backend seeds PostgreSQL with 22 talent profiles and runs schema migrations.
2. **Profile management** — users create, import, or generate profiles to define the hiring benchmark.
3. **Candidate intake** — CVs are uploaded or LinkedIn URLs are submitted; Celery workers parse them with an LLM and populate the candidate ledger.
4. **AI Vetting** — the matchmaking engine scores each candidate against selected profiles, returning a structured JSON result with scores, matched/gap skills, red flags, and a written verdict.
5. **SOW Planning** — the SOW Planner analyses project scope documents to identify required roles, match them to existing profiles, and flag gaps.
6. **Assignment** — candidates are assigned to projects with optional date ranges; the system enforces non-overlapping slot constraints per candidate.
7. **Utilization tracking** — the Utilization tab aggregates all assignment data into KPIs, a Gantt timeline, and a grouped accordion assignment table.

---

## Notes

- The LinkedIn scan workflow is intentionally a mock pipeline that generates synthetic candidate data from the supplied URL, simulating a real scraping flow.
- All heavy AI operations (CV parsing, profile generation, matchmaking) run in Celery background workers; progress is streamed to the UI via WebSockets and Redis pub/sub.
- The AI matcher returns structured JSON: `match_score`, `skills_match`, `skills_gap`, `red_flags_detected`, `ai_verdict`.
- LLM calls to Gemini have a 120-second timeout to handle large SOW documents.
