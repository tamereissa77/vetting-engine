import os
import json
import requests
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, JSON, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel

from api_integration import VittingEngineClient

# Database Setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@nexus-db:5432/nexus_ats")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Job Opening Status Model
class JobOpening(Base):
    __tablename__ = 'job_openings'

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, unique=True, nullable=False, index=True)
    is_open = Column(Boolean, default=True)

# Application Table Model
class Application(Base):
    __tablename__ = 'applications'

    id = Column(Integer, primary_key=True, index=True)
    job_profile_id = Column(Integer, nullable=False)
    job_role_name = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    linkedin_url = Column(String(255), nullable=True)
    validation_answers = Column(JSON, default={})
    status = Column(String(50), default="processing") # processing, completed, failed
    match_score = Column(Integer, default=0)
    skills_match = Column(JSON, default=[])
    skills_gap = Column(JSON, default=[])
    red_flags_detected = Column(JSON, default=[])
    ai_verdict = Column(Text, nullable=True)
    is_disqualified = Column(Boolean, default=False)
    logs = Column(JSON, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

# FastAPI Initialization
app = FastAPI(title="Click Nexus: Talent Gateway API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic Schemas
class ApplicationResponse(BaseModel):
    id: int
    job_profile_id: int
    job_role_name: str
    full_name: Optional[str]
    email: Optional[str]
    linkedin_url: Optional[str]
    status: str
    match_score: int
    skills_match: List[str]
    skills_gap: List[str]
    red_flags_detected: List[str]
    ai_verdict: Optional[str]
    is_disqualified: bool
    logs: List[str]
    created_at: datetime

    class Config:
        orm_mode = True

# Helper to append logs
def add_app_log(db_session: Session, app_id: int, log_line: str):
    app_record = db_session.query(Application).filter(Application.id == app_id).first()
    if app_record:
        current_logs = list(app_record.logs or [])
        timestamp = datetime.now().strftime("%H:%M:%S")
        current_logs.append(f"[{timestamp}] {log_line}")
        app_record.logs = current_logs
        db_session.commit()

# Background matching task
def run_vitting_vett_task(app_id: int, candidate_id: int, profile_id: int):
    db_session = SessionLocal()
    try:
        def log_cb(msg):
            add_app_log(db_session, app_id, msg)

        log_cb("Connecting to Sovereign Vitting Engine sandbox...")
        result = VittingEngineClient.process_and_poll_application(
            candidate_id=candidate_id,
            profile_id=profile_id,
            log_callback=log_cb
        )

        app_record = db_session.query(Application).filter(Application.id == app_id).first()
        if not app_record:
            return

        if result:
            app_record.full_name = result["candidate_name"]
            app_record.email = result["email"]
            app_record.match_score = result["match_score"]
            app_record.skills_match = result["skills_match"]
            app_record.skills_gap = result["skills_gap"]
            app_record.red_flags_detected = result["red_flags_detected"]
            app_record.ai_verdict = result["ai_verdict"]
            app_record.is_disqualified = result["is_disqualified"]
            app_record.status = "completed"
            add_app_log(db_session, app_id, "Application successfully vetted. Vitting scorecard synced.")
        else:
            app_record.status = "failed"
            add_app_log(db_session, app_id, "Vitting Engine analysis failed or timed out.")
        
        db_session.commit()
    except Exception as e:
        print(f"Error in background task: {e}")
        add_app_log(db_session, app_id, f"System error occurred during compliance check: {str(e)}")
        app_record = db_session.query(Application).filter(Application.id == app_id).first()
        if app_record:
            app_record.status = "failed"
            db_session.commit()
    finally:
        db_session.close()

# API Endpoints
@app.get("/")
def read_root():
    return {"status": "Click Nexus: Talent Gateway Backend is operational"}

@app.get("/api/jobs")
def get_jobs(database: Session = Depends(get_db)):
    """Fetch available job postings directly from Vitting Engine's target profiles."""
    profiles = VittingEngineClient.get_job_profiles()
    
    # Fallback Mock Job Profiles in case connection is down or during setup
    if not profiles:
        profiles = [
            {
                "id": 1,
                "role_name": "Sovereign AI Infrastructure Architect",
                "stack_layer": "Layer 1 — Infrastructure",
                "category": "Core Engineering",
                "engagement_tier": "Tier-1 Mission Critical",
                "role_summary": "Architect air-gapped on-premise compute cluster infrastructure with RTX 6000 hardware.",
                "red_flags": "Lack of Linux system administration credentials.",
                "offerings": "RTX compute clusters, local LLM architectures, secure networking"
            },
            {
                "id": 2,
                "role_name": "Vector Database Engineer",
                "stack_layer": "Layer 2 — Data",
                "category": "Core Engineering",
                "engagement_tier": "Tier-1 Mission Critical",
                "role_summary": "Design and manage distributed high-dimensional vector databases and search indices.",
                "red_flags": "Inability to work with local pgvector/milvus systems.",
                "offerings": "pgvector, Qdrant, Milvus, text-embeddings-inference"
            }
        ]
        
    # Sync and merge with local openings db
    openings = database.query(JobOpening).all()
    openings_dict = {o.profile_id: o.is_open for o in openings}

    # If openings is empty, populate all profiles as open by default
    if not openings:
        for p in profiles:
            p_id = p["id"]
            db_opening = JobOpening(profile_id=p_id, is_open=True)
            database.add(db_opening)
            openings_dict[p_id] = True
        database.commit()

    # Merge is_open status into returned profiles
    for p in profiles:
        p_id = p["id"]
        if p_id not in openings_dict:
            db_opening = JobOpening(profile_id=p_id, is_open=True)
            database.add(db_opening)
            database.commit()
            openings_dict[p_id] = True
            
        p["is_open"] = openings_dict[p_id]

    return profiles

@app.post("/api/jobs/{profile_id}/toggle")
def toggle_job_opening(profile_id: int, database: Session = Depends(get_db)):
    """Toggle the open/closed active status of a job posting."""
    db_opening = database.query(JobOpening).filter(JobOpening.profile_id == profile_id).first()
    if not db_opening:
        db_opening = JobOpening(profile_id=profile_id, is_open=False)
        database.add(db_opening)
    else:
        db_opening.is_open = not db_opening.is_open
    
    database.commit()
    database.refresh(db_opening)
    return {"profile_id": profile_id, "is_open": db_opening.is_open}

@app.post("/api/applications", response_model=ApplicationResponse)
async def create_application(
    background_tasks: BackgroundTasks,
    job_profile_id: int = Form(...),
    job_role_name: str = Form(...),
    full_name: str = Form(...),
    email: str = Form(...),
    linkedin_url: Optional[str] = Form(None),
    linkedin_text: Optional[str] = Form(None),
    validation_answers: str = Form("{}"),
    cv_file: Optional[UploadFile] = File(None),
    database: Session = Depends(get_db)
):
    # Parse dynamic questions answers
    try:
        answers = json.loads(validation_answers)
    except Exception:
        answers = {}

    # 1. Create a local application record
    new_app = Application(
        job_profile_id=job_profile_id,
        job_role_name=job_role_name,
        full_name=full_name,
        email=email,
        linkedin_url=linkedin_url,
        validation_answers=answers,
        status="processing",
        logs=[]
    )
    database.add(new_app)
    database.commit()
    database.refresh(new_app)

    add_app_log(database, new_app.id, f"Application received for: {job_role_name}.")
    
    # 2. Upload/Paste payload to Vitting Engine
    candidate_id = None
    vitting_task_id = None

    if cv_file:
        add_app_log(database, new_app.id, f"Ingesting uploaded CV: {cv_file.filename}...")
        file_bytes = await cv_file.read()
        res = VittingEngineClient.upload_cv(file_bytes, cv_file.filename)
        if res:
            candidate_id = res.get("candidate_id")
            vitting_task_id = res.get("task_id")
            add_app_log(database, new_app.id, f"CV successfully uploaded. Vitting Engine Candidate ID: {candidate_id}")
    elif linkedin_text:
        add_app_log(database, new_app.id, "Processing pasted LinkedIn profile payload...")
        res = VittingEngineClient.paste_linkedin(linkedin_text, linkedin_url)
        if res:
            candidate_id = res.get("candidate_id")
            vitting_task_id = res.get("task_id")
            add_app_log(database, new_app.id, f"LinkedIn text enqueued. Vitting Engine Candidate ID: {candidate_id}")
    else:
        # If neither is provided, create candidate with name/email only
        add_app_log(database, new_app.id, "No CV or LinkedIn text payload. Registering base candidate profile...")
        try:
            url = f"{VittingEngineClient.VITTING_ENGINE_URL}/api/candidates"
            payload = {
                "full_name": full_name,
                "email": email,
                "linkedin_url": linkedin_url or "",
                "notes": f"Applied via Click Nexus Gateway for {job_role_name}"
            }
            res = requests.post(url, json=payload, timeout=10)
            if res.status_code == 200:
                candidate_id = res.json().get("id")
                add_app_log(database, new_app.id, f"Base candidate profile indexed. Candidate ID: {candidate_id}")
        except Exception as e:
            add_app_log(database, new_app.id, f"Base candidate registration failed: {str(e)}")

    if not candidate_id:
        new_app.status = "failed"
        add_app_log(database, new_app.id, "Vetting Engine candidate creation failed. Terminating.")
        database.commit()
        return new_app

    # 3. Spin up the background task to poll and match the candidate
    background_tasks.add_task(run_vitting_vett_task, new_app.id, candidate_id, job_profile_id)
    return new_app

@app.get("/api/applications", response_model=List[ApplicationResponse])
def get_applications(database: Session = Depends(get_db)):
    return database.query(Application).order_by(Application.created_at.desc()).all()

@app.get("/api/applications/{app_id}", response_model=ApplicationResponse)
def get_application_details(app_id: int, database: Session = Depends(get_db)):
    app_record = database.query(Application).filter(Application.id == app_id).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Application record not found.")
    return app_record
