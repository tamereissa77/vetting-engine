# Click Group — Sovereign Talent Engine & Click Nexus ATS Platform

A full-stack, enterprise-grade, AI-powered talent vetting, matching, and resource-management platform built for sovereign AI hiring workflows. The platform combines cyber-themed React/Vite dashboards with Python FastAPI backends, Celery background workers, Redis pub/sub progress streams, and PostgreSQL persistence — all orchestrated via Docker Compose.

The platform is composed of **three cooperating applications** sharing one authentication layer:

| Application | Purpose | Audience |
|---|---|---|
| **Central Auth Portal** | Unified sign-in/sign-up with JWT + role-based routing | All users |
| **Vitting Engine** (Click Group Talent Engine) | Candidate ingestion, AI vetting, SOW planning, project staffing, utilization tracking | Admin, HR, Project Managers |
| **Click Nexus ATS** (Talent Gateway) | Public-facing job board and application intake, integrated with the Vitting Engine pipeline | Admin, Applicants |

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Repository Layout](#repository-layout)
3. [Getting Started](#getting-started)
4. [Configuration Reference](#configuration-reference)
5. [Application 1 — Central Auth Portal & RBAC](#application-1--central-auth-portal--rbac)
6. [Application 2 — Vitting Engine](#application-2--vitting-engine)
7. [Application 3 — Click Nexus ATS](#application-3--click-nexus-ats)
8. [The AI Layer](#the-ai-layer)
9. [Background Processing & Live Progress Streams](#background-processing--live-progress-streams)
10. [Data Model](#data-model)
11. [REST API Reference](#rest-api-reference)
12. [Data-Integrity Safeguards](#data-integrity-safeguards)
13. [Theming (Dark / Light)](#theming-dark--light)
14. [Utility Scripts & Test Assets](#utility-scripts--test-assets)
15. [Further Documentation](#further-documentation)

---

## System Architecture

The system runs as two Docker Compose stacks that share a single Docker network (`click-vitting_default`), which lets `nexus-backend` reach `sovereign-backend` by container name.

```
docker-compose.yml  (Vitting Engine, Auth, shared infra)
├── frontend          Vite + React Vitting Engine dashboard        → host port 5173
├── backend           FastAPI core API ("Sovereign Talent Engine") → host port 8000
├── worker            Celery worker (CV parsing, LinkedIn, vetting)
├── auth-frontend     Vite + React Central Auth Portal (production
│                     static build served via `serve`)             → host port 5175
├── auth-backend      FastAPI auth service (JWT + RBAC)            → host port 8002
├── redis             Redis 7 — Celery broker/result backend and
│                     pub/sub channel for task progress            → host port 6379
└── db                PostgreSQL 15 — shared database
                      (`sovereign_talent`: core + auth `users`)    → host port 5432

click-nexus/docker-compose.yml  (ATS gateway — joins the same network)
├── nexus-frontend    Vite + React job board / application portal  → host port 5174
├── nexus-backend     FastAPI ATS handler + Vitting Engine client  → host port 8001
└── nexus-db          PostgreSQL 15 (`nexus_ats` applications DB)  → host port 5433
```

### End-to-end application flow

```
Applicant                Click Nexus            Vitting Engine              AI Layer
   │  apply + CV  ─────►  nexus-backend  ────►  POST /api/candidates/upload
   │                      (stores local          creates placeholder row,
   │                       Application row)      queues Celery parse task ─►  parse_cv()
   │                            │                                              │
   │                            ├──────────────► PUT /api/candidates/{id}     │
   │                            │                (binds verified form data)   │
   │                            │                                             ▼
   │                            ├─ polls until parsing done ◄── worker updates skills/CV text
   │                            │
   │                            ├──────────────► POST /api/candidates/{id}/match
   │                            │                queues Celery vetting task ─► assess_candidate()
   │                            │                                              │
   │  scorecard  ◄──────────────┴─ polls until Assessment exists ◄─────────────┘
```

HR staff work the same candidate pool directly in the Vitting Engine dashboard, with real-time task progress streamed over WebSockets.

---

## Repository Layout

```
Click-VITTING/
├── docker-compose.yml        # Core stack: frontend, backend, worker, auth, db, redis
├── .env / .env.example       # Core stack configuration (DB, Redis, AI provider keys)
├── backend/                  # Vitting Engine core API + Celery worker (same image)
│   ├── main.py               #   FastAPI app: all REST + WebSocket endpoints
│   ├── ai.py                 #   LLM provider dispatch + all AI prompt functions
│   ├── tasks_queue.py        #   Celery tasks + Redis pub/sub progress publishing
│   ├── db.py                 #   SQLAlchemy ORM models & session factory
│   ├── seed.py               #   23 pre-seeded OriginCraft talent profiles
│   ├── download_cvs.py       #   Utility: export all stored CVs to text files
│   └── test_*.py             #   Provider smoke tests (Gemini, Ollama, SOW analysis)
├── frontend/                 # Vitting Engine dashboard (React 18 + Vite + Tailwind)
│   └── src/
│       ├── App.tsx           #   Tab shell, auth guard, theme toggle, all main views
│       └── components/       #   CandidateModal, ProfileModal, DossierModal,
│                             #   AssessmentRing, RangePicker
├── auth-service/
│   ├── backend/              # FastAPI auth: register / login / verify (JWT HS256)
│   └── frontend/             # Central Auth Portal (served as production build)
├── click-nexus/
│   ├── docker-compose.yml    # ATS stack (external network → core stack)
│   ├── backend/
│   │   ├── main.py           #   Applications API + background vetting orchestration
│   │   └── api_integration.py#   VittingEngineClient (upload, bind, match, poll)
│   └── frontend/             # Job board portal (React + Vite + Tailwind)
├── db/init.sql               # Initial schema bootstrap for PostgreSQL
├── docs/screenshots/         # Images referenced by USER_GUIDE.md
├── test_files/               # Sample CVs and job descriptions for manual testing
└── USER_GUIDE.md             # Step-by-step, screenshot-driven end-user guide
```

---

## Getting Started

### Prerequisites

* Docker & Docker Compose
* Optionally [Ollama](https://ollama.com/) on the host for fully local ("sovereign") inference:
  ```bash
  ollama pull llama3
  ```
  The containers reach the host's Ollama through `host.docker.internal` (mapped via `extra_hosts`).

### Startup

```bash
# 1. Initialize environment files
cp .env.example .env            # then set GEMINI_API_KEY / provider of choice

# 2. Start the core stack (Vitting Engine, Auth, DB, Redis, worker)
docker compose up --build -d

# 3. Start the Click Nexus ATS stack (requires step 2's network to exist)
docker compose -f click-nexus/docker-compose.yml up --build -d
```

On first boot the core backend runs a lightweight migration (adds `is_open` to `talent_profiles` if missing) and seeds the database with **23 OriginCraft talent profiles** spanning all stack layers (seeding is skipped if profiles already exist).

### Accessing the portals

| Service | URL | Notes |
|---|---|---|
| Central Auth Portal | http://localhost:5175 | Entry point for all users |
| Vitting Engine Dashboard | http://localhost:5173 | Admin / HR / Project Manager |
| Click Nexus ATS Portal | http://localhost:5174 | Admin / Applicant |
| Core API (Swagger) | http://localhost:8000/docs | Vitting Engine REST reference |
| Auth API (Swagger) | http://localhost:8002/docs | Auth service REST reference |
| Nexus API (Swagger) | http://localhost:8001/docs | ATS REST reference |

`GET http://localhost:8000/` returns a health payload including the active LLM provider and model — useful to confirm AI configuration.

---

## Configuration Reference

All core-stack settings live in `.env` (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `postgres` / `postgres_sovereign_secure` / `sovereign_talent` | Shared PostgreSQL credentials (core + auth) |
| `POSTGRES_HOST` / `POSTGRES_PORT` | `db` / `5432` | In-network DB address |
| `REDIS_URL` | `redis://redis:6379/0` | Celery broker/backend and pub/sub channel |
| `LLM_PROVIDER` | `ollama` | AI engine: `ollama`, `gemini`, or `openai` |
| `OLLAMA_API_BASE` | `http://host.docker.internal:11434` | Host-local Ollama endpoint |
| `OLLAMA_MODEL` | `llama3` | Local model name |
| `GEMINI_MODEL` | `gemini-2.5-pro` | Gemini model when `LLM_PROVIDER=gemini` |
| `GEMINI_API_KEY` | — | Required for Gemini |
| `OPENAI_API_KEY` | — | Required for OpenAI (`gpt-4o-mini` is used) |

Click Nexus settings are defined inline in `click-nexus/docker-compose.yml`:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@nexus-db:5432/nexus_ats` | Local applications ledger |
| `VITTING_ENGINE_API_URL` | `http://sovereign-backend:8000` | Cross-stack API address (shared network) |

Auth service:

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET_KEY` | dev-only fallback | **Set a strong secret in production.** Tokens are HS256, 24-hour expiry |

---

## Application 1 — Central Auth Portal & RBAC

The platform is protected by a unified token-based RBAC system implemented in [auth-service/backend/main.py](auth-service/backend/main.py).

* **Registration** (`POST /api/auth/register`) — full name, email, password (bcrypt-hashed), and one of four roles: `admin`, `applicant`, `HR`, `project_manager`. Duplicate emails and invalid roles are rejected.
* **Login** (`POST /api/auth/login`) — verifies credentials and issues a JWT (HS256) embedding `sub` (email), `role`, and `name`, valid for 24 hours.
* **Verification** (`GET /api/auth/verify?token=…`) — decodes and validates a token; used by the client apps to guard their routes.

Role-based routing after login:

| Role | Destination |
|---|---|
| **Applicant** | Click Nexus ATS portal (5174) only |
| **HR / Project Manager** | Vitting Engine dashboard (5173) only |
| **Admin** | Central selector page — choose which workspace to enter; full access to both |

Sessions are held in `localStorage`; unauthorized direct navigation to a dashboard URL redirects back to the Auth Portal. The auth frontend is served as a **production static build** (`npm run build && serve -s dist`) to avoid dev-server WebSocket/HMR interference.

Users are stored in the `users` table of the shared `sovereign_talent` database.

---

## Application 2 — Vitting Engine

The central compliance ledger and talent operations dashboard, served at port 5173 with six top-level tabs:

### 1. Profiles — Talent Benchmark Library
Manage the library of target role profiles ("benchmarks") that candidates are vetted against. Each profile carries: role name, **stack layer** (Layer 1 — Infrastructure through Layer 5 — Application, plus Strategy/Governance/Security/Domain tracks), category, engagement tier, role summary, screen-out **red flags**, optional offerings, and an **is_open** flag that controls whether the role is advertised on Click Nexus. Three ways to create profiles:
* **Manual entry** via the profile modal.
* **Import a job description** (PDF/DOCX/TXT) — the AI extracts a full structured profile from the document.
* **Generate from a job title** — the AI drafts the complete profile (summary, red flags, offerings) from a title alone.

Toggling a profile's opening (`POST /api/profiles/{id}/toggle`) immediately shows/hides it as an active job on the Click Nexus board.

### 2. Vetting — AI Candidate Assessment
Ingest candidates and run matchmaking scans:
* **Drag & drop CV upload** (PDF/DOCX/TXT) — text is extracted server-side (pypdf / docx2txt), a placeholder candidate row is created instantly, and a Celery task parses the CV with the AI layer.
* **LinkedIn scraping gateway** — attempts a direct fetch of a public profile URL; if LinkedIn's anti-bot wall blocks it, the UI directs you to the **paste-profile** fallback which parses copied profile text.
* **Matchmaking** — select one or more target profiles and execute the vetting engines. Each candidate/profile pair produces an **Assessment**: match score (0–100), skills matched, skills gaps, red flags detected, and a multi-paragraph AI verdict. Live progress streams into the UI via WebSocket ("Sovereign Worker Thread" panel).
* **Scorecard matrix** — per-candidate results with score rings, red-flag counts, disqualify/requalify toggles, and full dossier inspection.

### 3. Registry — Candidate Ledger
The complete candidate database with filter/search by name, role, email, or LinkedIn. Candidates arriving from Click Nexus wear a yellow **"new candidate"** badge, and a **New Candidates** sidebar toggle filters to just them. The badge clears automatically when a candidate is deleted, blacklisted, or manually vetted. The **candidate dossier** shows contact details, capabilities, raw CV text, assessment history, assignments, and supports re-upload of CVs, LinkedIn re-scan/paste, blacklisting, and deletion. Editing a candidate automatically **re-vets** them against every profile they already hold assessments for.

### 4. Planner — SOW Scope Analysis
Paste or upload a Statement of Work. The AI compares the scope against the existing profile library and returns:
* **Matched profiles** — existing roles the project needs, with relevance reasoning.
* **Missing profiles** — fully drafted new role profiles required to deliver the scope, ready to promote into the library.

Analyses can be saved as **Projects**.

### 5. Projects — Registry & Staffing
Each project stores its SOW text/filename and analysis results. Assign candidates to project roles with optional start/end dates. The API enforces:
* **Date-conflict prevention** — a candidate cannot hold overlapping assignment date ranges across any projects.
* **Duplicate-slot prevention** — the same candidate/role/project combination cannot be double-booked without dates.

### 6. Utilization — Resource Dashboards
An as-of-today snapshot computed by `GET /api/utilization`: active / upcoming / past / unscheduled assignments, bench (available candidates), per-project **coverage percentage** (filled vs. required roles derived from SOW analysis), and Gantt-style assignment timelines.

---

## Application 3 — Click Nexus ATS

The public-facing "Talent Gateway" (port 5174) where applicants browse openings and apply.

* **Job board** — jobs are the Vitting Engine's talent profiles, fetched live via `GET /api/profiles/raw` (with a small built-in mock fallback if the engine is unreachable). *Active openings* are the profiles with `is_open = true`; a directory of all roles is also browsable.
* **Application modal** — enforces a strict dossier: full name, email, contact number, LinkedIn URL, country of residence, nationality, and a **mandatory CV upload** (PDF/DOCX/TXT), plus optional role-specific validation answers.
* **Integration pipeline** (see [click-nexus/backend/main.py](click-nexus/backend/main.py) and [api_integration.py](click-nexus/backend/api_integration.py)):
  1. A local `Application` record is created in `nexus_ats` with a running **log trail** (every step is timestamped and visible to the applicant).
  2. The CV is uploaded to the Vitting Engine, creating a candidate and queueing AI parsing.
  3. A `PUT` immediately **binds the verified form details** (name, email, contact, nationality…) to the candidate record, tagging it `is_new_candidate` and noting "Applied via Click Nexus Gateway for &lt;role&gt;".
  4. A FastAPI background task polls until parsing completes, triggers matchmaking against the applied-for profile, then polls until the assessment scorecard exists (up to 30 × 2 s attempts per phase).
  5. The final scorecard (match score, skills match/gap, red flags, AI verdict, disqualification status) is copied back onto the local application record with status `completed` (or `failed` on timeout/error).

Applicants can review their applications and watch the compliance log stream as their submission is processed.

---

## The AI Layer

All model access is centralized in [backend/ai.py](backend/ai.py). A single dispatcher, `call_llm()`, routes prompts to the provider selected by `LLM_PROVIDER`:

| Provider | Model | Transport |
|---|---|---|
| `ollama` (default, sovereign/local) | `OLLAMA_MODEL` (e.g. `llama3`) | Host-local HTTP `/api/generate`, JSON format mode |
| `gemini` | `GEMINI_MODEL` (e.g. `gemini-2.5-pro`) | Google Generative Language REST API, temp 0.2, 8K max output |
| `openai` | `gpt-4o-mini` | Chat Completions with JSON response format |

Responses are sanitized by `clean_json_string()` (extracts the JSON block from any surrounding prose). **Every AI function has a deterministic fallback** so the platform degrades gracefully when the model is offline:

| Function | Purpose | Fallback behavior |
|---|---|---|
| `parse_cv()` | Extract name, email, skills, experience years from CV text | Regex email extraction + first-line name heuristic + keyword skill scan |
| `parse_linkedin_profile()` | Same extraction from scraped/pasted LinkedIn text | Falls back to `parse_cv()` heuristics |
| `assess_candidate()` | Score a candidate against a profile (score, match/gap, red flags, verdict) | Neutral 60-score baseline flagged as "AI offline" |
| `parse_job_description()` | Convert an uploaded JD document into a structured profile | Generic "Imported Role" profile |
| `generate_job_description()` | Draft a full profile from just a job title | Title-derived stub profile |
| `analyze_project_scope_text()` | Match a SOW against the profile library; draft missing roles | Sample compliance-consultant suggestion |

The active provider/model is displayed in the dashboard header (e.g. `AI Stack: GEMINI (GEMINI-2.5-PRO)`) and returned by the API root endpoint.

---

## Background Processing & Live Progress Streams

Long-running work never blocks an HTTP request. [backend/tasks_queue.py](backend/tasks_queue.py) defines four Celery tasks (Redis as broker and result backend):

| Task | Trigger | What it does |
|---|---|---|
| `parse_cv_task` | CV upload (dashboard or Nexus) | Extract → AI-parse → write candidate fields → auto re-vet |
| `scan_linkedin_task` | LinkedIn URL scan | Direct HTTP fetch → HTML strip → AI-parse → write → auto re-vet; raises a helpful error when LinkedIn's authwall blocks scraping |
| `parse_linkedin_text_task` | Pasted LinkedIn text | HTML-clean → AI-parse → write → auto re-vet |
| `match_candidate_task` | Matchmaking request | For each target profile: AI assessment → upsert `Assessment` row |

**Progress streaming:** every task publishes step-by-step progress (`message`, `progress` %, `status`) to a Redis pub/sub channel `task:{task_id}`, and also snapshots the latest state to a `task_state:{task_id}` key (1-hour TTL) so late subscribers catch up instantly. The FastAPI WebSocket endpoint `ws://…/ws/tasks/{task_id}` relays these events to the browser, driving the live "Sovereign Worker Thread" console and queue progress bar in the UI.

**Auto re-vetting:** whenever a candidate's source data changes (new CV, LinkedIn update, profile edit), `revet_candidate_if_needed()` re-runs assessments against **every profile the candidate was previously vetted for**, keeping scorecards current.

---

## Data Model

### Core database — `sovereign_talent` (PostgreSQL 15, port 5432)

| Table | Key fields | Notes |
|---|---|---|
| `talent_profiles` | `role_name` (unique), `stack_layer`, `category`, `engagement_tier`, `role_summary`, `red_flags`, `offerings`, `is_open` | The benchmark library; also the Click Nexus job source |
| `candidates` | `full_name`, `email`, `linkedin_url`, `cv_raw_text`, `skills[]`, `experience_years`, `is_blacklisted`, `contact_number`, `notes`, `country_of_residence`, `nationality`, `is_new_candidate` | Skills stored as a native Postgres text array |
| `assessments` | `candidate_id` FK, `profile_id` FK, `match_score`, `skills_match[]`, `skills_gap[]`, `red_flags_detected[]`, `ai_verdict`, `is_disqualified` | Unique per candidate+profile (upserted on re-vet); cascade-deleted with either parent |
| `projects` | `name`, `sow_text`, `sow_filename`, `analysis_results` (JSON) | Stores full SOW analysis output |
| `candidate_assignments` | `candidate_id`, `project_id`, `profile_id`, `start_date`, `end_date` | Many-to-many staffing slots with date ranges |
| `users` | `full_name`, `email` (unique), `password_hash` (bcrypt), `role` | Owned by the auth service |

### ATS database — `nexus_ats` (PostgreSQL 15, port 5433)

| Table | Key fields | Notes |
|---|---|---|
| `applications` | `job_profile_id`, `job_role_name`, applicant contact fields, `validation_answers` (JSON), `status` (`processing`/`completed`/`failed`), `match_score`, `skills_match`, `skills_gap`, `red_flags_detected`, `ai_verdict`, `is_disqualified`, `logs` (JSON) | Self-contained application ledger; scorecard is denormalized from the Vitting Engine on completion |

---

## REST API Reference

### Core API — `sovereign-backend`, port 8000 (`/docs` for Swagger)

**Profiles**

| Method & Path | Purpose |
|---|---|
| `GET /api/profiles?stack_layer=` | List profiles (optional layer filter) |
| `GET /api/profiles/raw` | List with IDs — consumed by Click Nexus as the job feed |
| `POST /api/profiles` | Create (unique role name enforced) |
| `PUT /api/profiles/{id}` | Update |
| `DELETE /api/profiles/{id}` | Delete |
| `POST /api/profiles/{id}/toggle` | Toggle job opening (`is_open`) |
| `POST /api/profiles/import-file` | AI-extract a profile from a JD file (PDF/DOCX/TXT) |
| `POST /api/profiles/generate` | AI-generate a profile from a job title |

**Candidates & ingestion**

| Method & Path | Purpose |
|---|---|
| `GET /api/candidates` | List with best-score summary and assignment info |
| `GET /api/candidates/{id}` | Full dossier incl. raw CV text and all assessments |
| `POST /api/candidates` | Manual create |
| `PUT /api/candidates/{id}` | Partial update (`exclude_unset`) + automatic re-vetting |
| `DELETE /api/candidates/{id}` | Delete |
| `POST /api/candidates/upload` | New candidate from CV file → Celery parse task |
| `POST /api/candidates/{id}/upload` | Re-upload CV for an existing candidate |
| `POST /api/candidates/linkedin` | New candidate from LinkedIn URL → scrape task |
| `POST /api/candidates/{id}/linkedin` | Re-scan LinkedIn for existing candidate |
| `POST /api/candidates/linkedin/paste` | New candidate from pasted profile text |
| `POST /api/candidates/{id}/linkedin/paste` | Paste for existing candidate |
| `POST /api/candidates/{id}/match` | Queue AI vetting against selected (or all) profiles |
| `POST /api/assessments/{id}/disqualify` | Toggle scorecard disqualification |

**Projects, staffing & utilization**

| Method & Path | Purpose |
|---|---|
| `POST /api/projects/analyze-scope` | AI SOW analysis (file and/or text) vs. profile library |
| `GET /api/projects` / `GET /api/projects/{id}` | List / detail with assigned resources |
| `POST /api/projects` / `DELETE /api/projects/{id}` | Create / delete |
| `POST /api/projects/{pid}/assign/{cid}` | Assign candidate (optional profile + date range; conflict-checked) |
| `DELETE /api/assignments/{id}` | Release an assignment slot |
| `GET /api/utilization` | Full utilization snapshot & project coverage |

**Streaming**

| Endpoint | Purpose |
|---|---|
| `WS /ws/tasks/{task_id}` | Live task progress (replays last state, then streams pub/sub until `completed`/`failed`) |

### Auth API — `auth-backend`, port 8002

| Method & Path | Purpose |
|---|---|
| `POST /api/auth/register` | Create user (roles: `admin`, `applicant`, `HR`, `project_manager`) |
| `POST /api/auth/login` | Issue 24-hour JWT with embedded role |
| `GET /api/auth/verify?token=` | Validate a token, return identity + role |

### Nexus API — `nexus-backend`, port 8001

| Method & Path | Purpose |
|---|---|
| `GET /api/jobs` | Job feed proxied from Vitting Engine profiles (mock fallback) |
| `POST /api/applications` | Submit application (multipart: form fields + CV file) — kicks off the full integration pipeline |
| `GET /api/applications` / `GET /api/applications/{id}` | List / detail incl. live log trail and final scorecard |

---

## Data-Integrity Safeguards

* **Form-data overwrite guard** — in [tasks_queue.py](backend/tasks_queue.py), the CV/LinkedIn parsers detect candidates that originated from a Click Nexus application (via the `"Applied via Click Nexus"` note or an already-resolved name) and then update **only** `skills` and `cv_raw_text`, never letting LLM extraction overwrite verified contact details.
* **Partial-update endpoint** — `PUT /api/candidates/{id}` uses Pydantic's `exclude_unset=True`, so the Nexus form-binding request cannot wipe parsed capabilities or experience with default empty values.
* **Blacklist enforcement** — uploads, LinkedIn scans, and matchmaking are all rejected with HTTP 400 for blacklisted candidates; blacklisting also clears the "new candidate" flag.
* **New-candidate tag lifecycle** — the yellow badge set by ATS submissions clears only on delete, blacklist, or *manual* vetting (`is_manual: true` on the match request); automated re-vets keep it.
* **Assignment conflict checks** — overlapping date ranges and duplicate unscheduled slots are rejected at the API level.
* **Task-failure isolation** — every Celery task wraps its work in rollback + a `failed` progress event, so a mid-pipeline crash never leaves half-written records or a hung progress UI.

---

## Theming (Dark / Light)

Both React frontends share a cyber-styled design system with a full dark/light toggle (persisted in `localStorage`). The entire `cyber` Tailwind palette resolves through **CSS variables** (`rgb(var(--cyber-*) / <alpha-value>)` in each app's `tailwind.config.js`), so every opacity, hover, gradient, and glow-shadow variant retints automatically when `body.light` swaps the palette:

* **Dark** (default): near-black surfaces, neon cyan/magenta accents, glassmorphism panels, grid-line backdrop.
* **Light**: white/slate paper surfaces with darker, WCAG-friendly accents (sky/cyan-700, fuchsia-700, emerald-700, amber-700).

A small set of targeted `body.light` overrides in each `src/index.css` handles classes outside the palette (slate text scale, `text-white` on tinted chips, status reds/yellows, form controls, scrollbars).

---

## Utility Scripts & Test Assets

| Asset | Purpose |
|---|---|
| `backend/seed.py` | Seeds the 23-profile OriginCraft benchmark library on startup (idempotent); also importable as `PROFILES_DATA` |
| `backend/download_cvs.py` | Exports every stored candidate CV to `backend/downloaded_cvs/{id}_{name}.txt` with a metadata header — run inside the backend container: `docker exec sovereign-backend python download_cvs.py` |
| `backend/test_gemini.py` / `test_ollama.py` | Provider connectivity smoke tests |
| `backend/test_sow_analysis.py` | Exercises the SOW analysis prompt end-to-end |
| `test_files/` | Sample CVs (`cv_*.txt`) and job descriptions (`jd_*.txt`) for manual pipeline testing |
| `db/init.sql` | First-run schema bootstrap mounted into the Postgres container |

---

## Further Documentation

* **[USER_GUIDE.md](USER_GUIDE.md)** — a screenshot-driven, step-by-step walkthrough of every dashboard tab and the Click Nexus applicant journey, aimed at end users rather than developers.
* **Interactive API docs** — each FastAPI service exposes Swagger UI at `/docs` and ReDoc at `/redoc`.
