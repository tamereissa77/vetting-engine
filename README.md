# Sovereign Talent Engine & Click Nexus ATS Platform

A full-stack, enterprise-grade AI-powered talent vetting, matching, and resource management platform built for sovereign AI hiring workflows. The platform combines a React/Vite cyber-themed dashboard with a Python FastAPI backend, Celery background workers, Redis pub/sub progress streams, and PostgreSQL persistence — all orchestrated via Docker Compose.

It also integrates a secure **Central Authentication Portal** and the **Click Nexus Applicant Tracking System (ATS)** gateway to support multi-role compliance workflows.

---

## Architecture Overview

The system is built as a set of dockerized microservices running on a shared network environment:

```
docker-compose.yml (Vitting Engine & Auth Services)
├── auth-frontend     Vite + React Central Auth Portal (port 5175)
├── auth-backend      FastAPI User Management & RBAC Backend (port 8002)
├── frontend          Vite + React Vitting Engine Dashboard (port 5173)
├── backend           FastAPI Vitting Engine Core API (port 8000)
├── worker            Celery Background Task Worker
├── redis             Message Broker & Pub/Sub (port 6379)
└── db                PostgreSQL 15 Shared Database (port 5432)

click-nexus/docker-compose.yml (Click Nexus ATS Gateway)
├── nexus-frontend    Vite + React Job Search Portal (port 5174)
└── nexus-backend     FastAPI ATS Application Handler (port 8001)
```

---

## Core Features & System Breakdown

### 1. Central Authentication & Role-Based Access Control (RBAC)
The platform is protected by a unified token-based RBAC system. Users sign up/sign in via the **Central Auth Portal** (port 5175), which issues JWT tokens. Access and redirects are determined strictly by user roles:
* **Applicant**: Can only access the **Click Nexus ATS** portal (port 5174) to view jobs and submit applications.
* **HR / Project Manager**: Can only access the **Vitting Engine** (port 5173) to review candidates, manage projects, and run AI matchmaking.
* **Admin**: Possesses full administrative rights to access all systems. Upon logging in, admins are presented with a central control panel to select which application they wish to enter.

Sessions are validated on the client side via localStorage token storage, with unauthorized entries automatically redirected back to the Auth Portal.

---

### 2. Click Nexus ATS Job Ingestion
Applicants apply for roles on the Click Nexus portal. The job application modal enforces strict candidate dossier validation:
* **Mandatory Fields**: Applicants must supply their *Full Name*, *Email*, *Secure Contact Number*, *LinkedIn URL*, *Country of Residence*, and *Nationality*.
* **Mandatory CV Upload**: A resume (PDF/DOCX/TXT) is strictly required to submit the application.
* **Integration Pipeline**: Once submitted, `nexus-backend` uploads the CV to the Vitting Engine core API, retrieves a candidate record placeholder, and immediately executes a partial `PUT` update to bind all validated contact details, notes, and metadata fields to the profile.

---

### 3. Vitting Engine Registry & Dossiers
The Vitting Engine acts as the central compliance ledger for talent review.
* **Candidate Dossier View**: Open any candidate to access their complete profile, detailed AI matchmaking scorecards, parsed capabilities, red flags, and clickable LinkedIn profiles.
* **Yellow "New Candidate" Status Tag**: All incoming submissions from the Click Nexus ATS gateway are flagged with a prominent yellow `"new candidate"` status badge.
* **Left Sidebar Push-Button Toggle**: Filter candidate lists instantly by clicking the `"New Candidates"` toggle in the left sidebar stack. Clicking it again toggles the filter off.
* **Automatic Tag Clearing**: The yellow `"new candidate"` badge is automatically removed if the candidate is:
  * **Deleted**: Purged from the database ledger.
  * **Blacklisted**: Flagged as Deviant / Blacklisted.
  * **Vetted**: Vitted manually against any target job profile from the matchmaking evaluation interface.

---

### 4. Candidate Form Integrity & Parsing Safeguards
* **Overwriting Safeguard**: In [tasks_queue.py](file:///home/ai-ubuntu-server/Click-VITTING/backend/tasks_queue.py), the background Celery parser checks if the incoming candidate record originated from a Click Nexus application form. If so, it updates **only** the `skills` (capabilities ledger) and the `cv_raw_text` (raw source payload), ensuring the form's name, email, and other contact details are never modified or corrupted by LLM extraction errors.
* **Partial PUT API Endpoint**: The core candidate update endpoint in [main.py](file:///home/ai-ubuntu-server/Click-VITTING/backend/main.py) uses Pydantic's `exclude_unset=True` model dumping. This prevents ATS form binding requests from accidentally wiping out parsed capabilities or experience data with default empty schemas.

---

## Getting Started

### Prerequisites
* Docker & Docker Compose
* Optionally [Ollama](https://ollama.com/) for local sovereign inference:
  ```bash
  ollama pull llama3
  ```

### Startup Instructions

```bash
# 1. Initialize environment files
cp .env.example .env
cp click-nexus/.env.example click-nexus/.env

# 2. Start Vitting Engine, Auth, and Database services
docker compose up --build -d

# 3. Start Click Nexus ATS services
docker compose -f click-nexus/docker-compose.yml up --build -d
```

### Accessing the Portals

* **Central Auth Portal**: `http://localhost:5175`
* **Vitting Engine Dashboard**: `http://localhost:5173`
* **Click Nexus ATS Portal**: `http://localhost:5174`
* **Core API Docs**: `http://localhost:8000/docs`

---

## Detailed Dashboard Tabs

1. **Profiles**: Manage the talent benchmark library. Import PDF/DOCX job descriptions to extract custom benchmark profiles or generate them using job titles.
2. **Vetting**: Trigger matchmaking scans of candidates against one or more target profiles to generate relevance scorecards, identify capability gaps, and detect compliance red flags.
3. **Candidates**: Complete candidate database. Review details, open detailed dossiers, and manage blacklist/deletion records.
4. **SOW Planner**: Paste/upload Statements of Work (SOW) to parse resource requirements, recommend existing candidates, and identify missing capability gaps.
5. **Projects Registry**: Allocate candidate resources to project roles across non-overlapping date ranges.
6. **Utilization**: Enterprise utilization dashboards tracking total candidate bandwidth, assignment timelines (Gantt charts), and resource availability.
