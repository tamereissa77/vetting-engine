import os
import json
import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from fastapi import FastAPI, Depends, File, UploadFile, Form, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import redis
from pydantic import BaseModel

import db
import tasks_queue
from seed import PROFILES_DATA

app = FastAPI(title="Sovereign AI Talent Engine API")

# CORS middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    import seed
    seed.seed_database()


# Pydantic schemas for requests/responses

class ProfileSchema(BaseModel):
    id: Optional[int] = None
    role_name: str
    stack_layer: str
    category: str
    engagement_tier: str
    role_summary: str
    red_flags: str
    offerings: Optional[str] = ""

    class Config:
        from_attributes = True


class MatchRequestSchema(BaseModel):
    profile_ids: List[int]

class DisqualifyRequestSchema(BaseModel):
    disqualified: bool

class GenerateProfileRequest(BaseModel):
    title: str

class CandidateCreateUpdateSchema(BaseModel):
    full_name: str
    email: Optional[str] = ""
    linkedin_url: Optional[str] = ""
    contact_number: Optional[str] = ""
    notes: Optional[str] = ""
    skills: List[str] = []
    experience_years: Optional[int] = 0
    is_blacklisted: Optional[bool] = False


class ProjectCreateSchema(BaseModel):
    name: str
    sow_text: Optional[str] = None
    sow_filename: Optional[str] = None
    analysis_results: Dict[str, Any]


class ProjectCandidateSchema(BaseModel):
    id: int
    full_name: str
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    contact_number: Optional[str] = None
    notes: Optional[str] = None
    skills: List[str] = []
    experience_years: Optional[int] = 0
    assigned_profile_id: Optional[int] = None
    assignment_start_date: Optional[date] = None
    assignment_end_date: Optional[date] = None

    class Config:
        from_attributes = True


class ProjectSchema(BaseModel):
    id: int
    name: str
    sow_text: Optional[str] = None
    sow_filename: Optional[str] = None
    analysis_results: Dict[str, Any]
    created_at: datetime
    assigned_resources: Optional[List[ProjectCandidateSchema]] = []

    class Config:
        from_attributes = True


def _build_assignments(candidate) -> list:
    return [
        {
            "id": a.id,
            "project_id": a.project_id,
            "project_name": a.project.name if a.project else None,
            "profile_id": a.profile_id,
            "profile_name": a.profile.role_name if a.profile else None,
            "start_date": a.start_date.isoformat() if a.start_date else None,
            "end_date": a.end_date.isoformat() if a.end_date else None,
        }
        for a in candidate.candidate_assignments
    ]


# Endpoints

@app.get("/")
def read_root():
    import ai
    return {
        "status": "Sovereign Talent Engine Backend is operational",
        "provider": ai.LLM_PROVIDER,
        "model": ai.GEMINI_MODEL if ai.LLM_PROVIDER == "gemini" else (ai.OLLAMA_MODEL if ai.LLM_PROVIDER == "ollama" else "gpt-4o-mini")
    }

# Profiles CRUD

@app.get("/api/profiles", response_model=List[ProfileSchema])
def get_profiles(stack_layer: Optional[str] = None, database: Session = Depends(db.get_db)):
    query = database.query(db.TalentProfile)
    if stack_layer:
        query = query.filter(db.TalentProfile.stack_layer == stack_layer)
    return query.order_by(db.TalentProfile.id.asc()).all()

@app.get("/api/profiles/raw")
def get_profiles_with_ids(database: Session = Depends(db.get_db)):
    """Retrieve profiles list including their IDs for matchmaking dropdowns."""
    profiles = database.query(db.TalentProfile).order_by(db.TalentProfile.id.asc()).all()
    return [{
        "id": p.id,
        "role_name": p.role_name,
        "stack_layer": p.stack_layer,
        "category": p.category,
        "engagement_tier": p.engagement_tier,
        "role_summary": p.role_summary,
        "red_flags": p.red_flags,
        "offerings": p.offerings
    } for p in profiles]

@app.post("/api/profiles", response_model=ProfileSchema)
def create_profile(profile: ProfileSchema, database: Session = Depends(db.get_db)):
    # Check if name exists
    existing = database.query(db.TalentProfile).filter(db.TalentProfile.role_name == profile.role_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Profile with this role name already exists.")
    
    db_profile = db.TalentProfile(**profile.dict())
    database.add(db_profile)
    database.commit()
    database.refresh(db_profile)
    return db_profile

@app.put("/api/profiles/{profile_id}", response_model=ProfileSchema)
def update_profile(profile_id: int, updated: ProfileSchema, database: Session = Depends(db.get_db)):
    db_profile = database.query(db.TalentProfile).filter(db.TalentProfile.id == profile_id).first()
    if not db_profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    
    for key, value in updated.dict().items():
        setattr(db_profile, key, value)
    
    database.commit()
    database.refresh(db_profile)
    return db_profile

@app.delete("/api/profiles/{profile_id}")
def delete_profile(profile_id: int, database: Session = Depends(db.get_db)):
    db_profile = database.query(db.TalentProfile).filter(db.TalentProfile.id == profile_id).first()
    if not db_profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    
    database.delete(db_profile)
    database.commit()
    return {"message": f"Profile {profile_id} successfully purged."}

@app.post("/api/profiles/import-file")
async def import_profile_file(file: UploadFile = File(...)):
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    contents = await file.read()
    jd_text = ""

    try:
        if ext == ".pdf":
            import io
            from pypdf import PdfReader
            pdf_file = io.BytesIO(contents)
            reader = PdfReader(pdf_file)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    jd_text += text + "\n"
        elif ext == ".docx":
            import docx2txt
            import io
            docx_file = io.BytesIO(contents)
            jd_text = docx2txt.process(docx_file)
        else:
            # Try decoding as standard text
            jd_text = contents.decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"Error reading file structure: {e}")
        raise HTTPException(status_code=400, detail=f"Unsupported or corrupted file structure: {e}")

    if not jd_text.strip():
        raise HTTPException(status_code=400, detail="Empty job description file.")

    import ai
    parsed_data = ai.parse_job_description(jd_text)
    return parsed_data

@app.post("/api/profiles/generate")
def generate_profile_from_title(req: GenerateProfileRequest):
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty.")
    
    import ai
    generated_data = ai.generate_job_description(req.title)
    return generated_data

# Candidates and Uploads

@app.get("/api/candidates")
def get_candidates(database: Session = Depends(db.get_db)):
    candidates = database.query(db.Candidate).order_by(db.Candidate.created_at.desc()).all()
    res = []
    for c in candidates:
        best_assessment = database.query(db.Assessment).filter(db.Assessment.candidate_id == c.id, db.Assessment.is_disqualified == False).order_by(db.Assessment.match_score.desc()).first()
        res.append({
            "id": c.id,
            "full_name": c.full_name,
            "email": c.email,
            "linkedin_url": c.linkedin_url,
            "contact_number": c.contact_number,
            "notes": c.notes,
            "skills": c.skills,
            "experience_years": c.experience_years,
            "is_blacklisted": c.is_blacklisted,
            "assignments": _build_assignments(c),
            "created_at": c.created_at,
            "highest_score": best_assessment.match_score if best_assessment else None,
            "highest_role_name": best_assessment.profile.role_name if (best_assessment and best_assessment.profile) else None,
            "assessments": [{"role_name": a.profile.role_name, "match_score": a.match_score} for a in c.assessments if a.profile and not a.is_disqualified]
        })
    return res

@app.get("/api/candidates/{candidate_id}")
def get_candidate_details(candidate_id: int, database: Session = Depends(db.get_db)):
    candidate = database.query(db.Candidate).filter(db.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    
    # Fetch all assessments for this candidate
    assessments = database.query(db.Assessment).filter(db.Assessment.candidate_id == candidate_id).all()
    
    assessment_list = []
    for a in assessments:
        profile = database.query(db.TalentProfile).filter(db.TalentProfile.id == a.profile_id).first()
        assessment_list.append({
            "id": a.id,
            "profile_id": a.profile_id,
            "role_name": profile.role_name if profile else "Unknown Profile",
            "stack_layer": profile.stack_layer if profile else "Unknown Layer",
            "match_score": a.match_score,
            "skills_match": a.skills_match,
            "skills_gap": a.skills_gap,
            "red_flags_detected": a.red_flags_detected,
            "ai_verdict": a.ai_verdict,
            "is_disqualified": a.is_disqualified,
            "created_at": a.created_at
        })

    return {
        "id": candidate.id,
        "full_name": candidate.full_name,
        "email": candidate.email,
        "linkedin_url": candidate.linkedin_url,
        "contact_number": candidate.contact_number,
        "notes": candidate.notes,
        "skills": candidate.skills,
        "experience_years": candidate.experience_years,
        "is_blacklisted": candidate.is_blacklisted,
        "assignments": _build_assignments(candidate),
        "cv_raw_text": candidate.cv_raw_text,
        "created_at": candidate.created_at,
        "assessments": assessment_list
    }

@app.post("/api/candidates")
def create_candidate(candidate: CandidateCreateUpdateSchema, database: Session = Depends(db.get_db)):
    db_cand = db.Candidate(
        full_name=candidate.full_name,
        email=candidate.email,
        linkedin_url=candidate.linkedin_url,
        contact_number=candidate.contact_number,
        notes=candidate.notes,
        skills=candidate.skills,
        experience_years=candidate.experience_years,
        is_blacklisted=candidate.is_blacklisted,
        cv_raw_text=f"Manually created profile for candidate {candidate.full_name}."
    )
    database.add(db_cand)
    database.commit()
    database.refresh(db_cand)
    return {
        "id": db_cand.id,
        "full_name": db_cand.full_name,
        "email": db_cand.email,
        "linkedin_url": db_cand.linkedin_url,
        "contact_number": db_cand.contact_number,
        "notes": db_cand.notes,
        "skills": db_cand.skills,
        "experience_years": db_cand.experience_years,
        "is_blacklisted": db_cand.is_blacklisted,
        "assigned_project_id": db_cand.assigned_project_id,
        "assigned_project_name": db_cand.assigned_project.name if db_cand.assigned_project else None,
        "created_at": db_cand.created_at
    }

@app.put("/api/candidates/{candidate_id}")
def update_candidate(candidate_id: int, updated: CandidateCreateUpdateSchema, database: Session = Depends(db.get_db)):
    db_cand = database.query(db.Candidate).filter(db.Candidate.id == candidate_id).first()
    if not db_cand:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    
    db_cand.full_name = updated.full_name
    db_cand.email = updated.email
    db_cand.linkedin_url = updated.linkedin_url
    db_cand.contact_number = updated.contact_number
    db_cand.notes = updated.notes
    db_cand.skills = updated.skills
    db_cand.experience_years = updated.experience_years
    db_cand.is_blacklisted = updated.is_blacklisted
    
    database.commit()
    database.refresh(db_cand)
    
    # Automatically trigger re-vetting if there are existing assessments and candidate is not blacklisted
    existing_assessments = database.query(db.Assessment).filter(db.Assessment.candidate_id == candidate_id).all()
    profile_ids = [a.profile_id for a in existing_assessments]
    task_id = None
    if profile_ids and not db_cand.is_blacklisted:
        task = tasks_queue.match_candidate_task.delay(candidate_id, profile_ids)
        task_id = task.id
        
    return {
        "id": db_cand.id,
        "full_name": db_cand.full_name,
        "email": db_cand.email,
        "linkedin_url": db_cand.linkedin_url,
        "contact_number": db_cand.contact_number,
        "notes": db_cand.notes,
        "skills": db_cand.skills,
        "experience_years": db_cand.experience_years,
        "is_blacklisted": db_cand.is_blacklisted,
        "assigned_project_id": db_cand.assigned_project_id,
        "assigned_project_name": db_cand.assigned_project.name if db_cand.assigned_project else None,
        "created_at": db_cand.created_at,
        "task_id": task_id
    }

@app.post("/api/candidates/{candidate_id}/upload")
async def upload_cv_for_candidate(candidate_id: int, file: UploadFile = File(...), database: Session = Depends(db.get_db)):
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    contents = await file.read()
    cv_text = ""

    try:
        if ext == ".pdf":
            import io
            from pypdf import PdfReader
            pdf_file = io.BytesIO(contents)
            reader = PdfReader(pdf_file)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    cv_text += text + "\n"
        elif ext == ".docx":
            import docx2txt
            import io
            docx_file = io.BytesIO(contents)
            cv_text = docx2txt.process(docx_file)
        else:
            cv_text = contents.decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"Error reading file structure: {e}")
        raise HTTPException(status_code=400, detail=f"Unsupported or corrupted file structure: {e}")

    if not cv_text.strip():
        cv_text = f"Candidate Resume File: {filename}\nContains raw text structure."

    db_cand = database.query(db.Candidate).filter(db.Candidate.id == candidate_id).first()
    if not db_cand:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    if db_cand.is_blacklisted:
        raise HTTPException(status_code=400, detail="Candidate is blacklisted. System override or whitelist required.")

    # Launch Celery background task
    task = tasks_queue.parse_cv_task.delay(candidate_id, cv_text)
    
    return {
        "message": "CV uploaded and queue worker parsing initiated for existing candidate.",
        "candidate_id": candidate_id,
        "task_id": task.id
    }

@app.post("/api/candidates/{candidate_id}/linkedin")
def scan_linkedin_for_candidate(candidate_id: int, database: Session = Depends(db.get_db)):
    db_cand = database.query(db.Candidate).filter(db.Candidate.id == candidate_id).first()
    if not db_cand:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    linkedin_url = db_cand.linkedin_url
    if not linkedin_url or "linkedin.com/" not in linkedin_url.lower():
        raise HTTPException(status_code=400, detail="Invalid or missing LinkedIn profile URL on candidate record.")
        
    if db_cand.is_blacklisted:
        raise HTTPException(status_code=400, detail="Candidate is blacklisted. System override or whitelist required.")

    # Launch Celery task
    task = tasks_queue.scan_linkedin_task.delay(candidate_id, linkedin_url)

    return {
        "message": "LinkedIn scraping mock initialized for existing candidate.",
        "candidate_id": candidate_id,
        "task_id": task.id
    }

@app.post("/api/candidates/{candidate_id}/linkedin/paste")
def paste_linkedin_for_candidate(candidate_id: int, text: str = Form(...), database: Session = Depends(db.get_db)):
    db_cand = database.query(db.Candidate).filter(db.Candidate.id == candidate_id).first()
    if not db_cand:
        raise HTTPException(status_code=404, detail="Candidate not found.")
        
    if db_cand.is_blacklisted:
        raise HTTPException(status_code=400, detail="Candidate is blacklisted. System override or whitelist required.")
        
    task = tasks_queue.parse_linkedin_text_task.delay(candidate_id, text)
    return {
        "message": "LinkedIn pasted profile parsing task enqueued.",
        "candidate_id": candidate_id,
        "task_id": task.id
    }

@app.delete("/api/candidates/{candidate_id}")
def delete_candidate(candidate_id: int, database: Session = Depends(db.get_db)):
    db_cand = database.query(db.Candidate).filter(db.Candidate.id == candidate_id).first()
    if not db_cand:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    
    database.delete(db_cand)
    database.commit()
    return {"message": f"Candidate {candidate_id} successfully purged."}

@app.post("/api/candidates/upload")
async def upload_cv(file: UploadFile = File(...), database: Session = Depends(db.get_db)):
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    contents = await file.read()
    cv_text = ""

    try:
        if ext == ".pdf":
            import io
            from pypdf import PdfReader
            pdf_file = io.BytesIO(contents)
            reader = PdfReader(pdf_file)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    cv_text += text + "\n"
        elif ext == ".docx":
            import docx2txt
            import io
            docx_file = io.BytesIO(contents)
            cv_text = docx2txt.process(docx_file)
        else:
            # Try decoding as standard text
            cv_text = contents.decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"Error reading file structure: {e}")
        raise HTTPException(status_code=400, detail=f"Unsupported or corrupted file structure: {e}")

    if not cv_text.strip():
        # Fallback raw string if extraction is empty
        cv_text = f"Candidate Resume File: {filename}\nContains raw text structure."

    # Create dummy candidate first to get ID
    new_candidate = db.Candidate(
        full_name="Extracting CV details...",
        email="",
        cv_raw_text="Extraction in progress..."
    )
    database.add(new_candidate)
    database.commit()
    database.refresh(new_candidate)

    # Launch Celery background task
    task = tasks_queue.parse_cv_task.delay(new_candidate.id, cv_text)
    
    return {
        "message": "CV uploaded and queue worker parsing initiated.",
        "candidate_id": new_candidate.id,
        "task_id": task.id
    }

@app.post("/api/candidates/linkedin")
def scan_linkedin(linkedin_url: str = Form(...), database: Session = Depends(db.get_db)):
    if not linkedin_url or "linkedin.com/" not in linkedin_url.lower():
        raise HTTPException(status_code=400, detail="Invalid LinkedIn profile URL.")
        
    # Create candidate placeholder
    new_candidate = db.Candidate(
        full_name="Connecting to LinkedIn...",
        linkedin_url=linkedin_url
    )
    database.add(new_candidate)
    database.commit()
    database.refresh(new_candidate)

    # Launch Celery task
    task = tasks_queue.scan_linkedin_task.delay(new_candidate.id, linkedin_url)

    return {
        "message": "LinkedIn scraping mock initialized.",
        "candidate_id": new_candidate.id,
        "task_id": task.id
    }

@app.post("/api/candidates/linkedin/paste")
def paste_linkedin(linkedin_url: Optional[str] = Form(None), text: str = Form(...), database: Session = Depends(db.get_db)):
    # Create candidate placeholder
    new_candidate = db.Candidate(
        full_name="Parsing Pasted LinkedIn...",
        linkedin_url=linkedin_url,
        cv_raw_text="Parsing in progress..."
    )
    database.add(new_candidate)
    database.commit()
    database.refresh(new_candidate)

    # Launch Celery task
    task = tasks_queue.parse_linkedin_text_task.delay(new_candidate.id, text)

    return {
        "message": "LinkedIn pasted profile parsing task enqueued.",
        "candidate_id": new_candidate.id,
        "task_id": task.id
    }

@app.post("/api/candidates/{candidate_id}/match")
def match_candidate(candidate_id: int, request: MatchRequestSchema, database: Session = Depends(db.get_db)):
    # Verify candidate exists
    candidate = database.query(db.Candidate).filter(db.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")
        
    if candidate.is_blacklisted:
        raise HTTPException(status_code=400, detail="Candidate is blacklisted. System override or whitelist required.")
        
    # If profile list is empty, default to checking all pre-seeded profiles
    profile_ids = request.profile_ids
    if not profile_ids:
        profiles = database.query(db.TalentProfile).all()
        profile_ids = [p.id for p in profiles]
        
    if not profile_ids:
        raise HTTPException(status_code=400, detail="No target profiles exist for matchmaking.")

    # Launch Celery task
    task = tasks_queue.match_candidate_task.delay(candidate_id, profile_ids)

    return {
        "message": "Matchmaking analysis queued successfully.",
        "task_id": task.id
    }

@app.post("/api/assessments/{assessment_id}/disqualify")
def disqualify_assessment(assessment_id: int, request: DisqualifyRequestSchema, database: Session = Depends(db.get_db)):
    assessment = database.query(db.Assessment).filter(db.Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    assessment.is_disqualified = request.disqualified
    database.commit()
    return {"message": "Assessment disqualification status updated successfully"}

# WebSockets Endpoint for Task Progress Streams

@app.websocket("/ws/tasks/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()
    
    r = tasks_queue.get_redis_client()
    
    # Check if state already completed
    state = r.get(f"task_state:{task_id}")
    if state:
        await websocket.send_text(state.decode('utf-8'))
        state_dict = json.loads(state.decode('utf-8'))
        if state_dict.get("status") in ["completed", "failed"]:
            await websocket.close()
            return

    # Subscribe to pub/sub
    pubsub = r.pubsub()
    pubsub.subscribe(f"task:{task_id}")
    
    try:
        while True:
            # Non-blocking get message
            # pubsub.get_message reads raw pub/sub packet
            message = pubsub.get_message(ignore_subscribe_messages=True)
            if message:
                data = message['data'].decode('utf-8')
                await websocket.send_text(data)
                
                # Check if this represents end of task execution
                data_dict = json.loads(data)
                if data_dict.get("status") in ["completed", "failed"]:
                    break
            # Small async yield sleep to prevent loop spinning
            await asyncio.sleep(0.2)
    except WebSocketDisconnect:
        print(f"WebSocket client closed connection for task: {task_id}")
    except Exception as e:
        print(f"Error in websocket_endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise e
    finally:
        try:
            pubsub.unsubscribe(f"task:{task_id}")
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass

@app.post("/api/projects/analyze-scope")
async def analyze_project_scope(
    sow_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    database: Session = Depends(db.get_db)
):
    text_content = ""
    if file:
        filename = file.filename
        ext = os.path.splitext(filename)[1].lower()
        contents = await file.read()
        try:
            if ext == ".pdf":
                import io
                from pypdf import PdfReader
                pdf_file = io.BytesIO(contents)
                reader = PdfReader(pdf_file)
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        text_content += text + "\n"
            elif ext == ".docx":
                import docx2txt
                import io
                docx_file = io.BytesIO(contents)
                text_content = docx2txt.process(docx_file)
            else:
                text_content = contents.decode("utf-8", errors="ignore")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")
    
    if sow_text:
        text_content += "\n" + sow_text
        
    text_content = text_content.strip()
    if not text_content:
        raise HTTPException(status_code=400, detail="Please provide either a Scope of Work file or description text.")
        
    # Retrieve all existing profiles to match against
    existing_profiles = database.query(db.TalentProfile).all()
    profiles_list = [{
        "id": p.id,
        "role_name": p.role_name,
        "stack_layer": p.stack_layer,
        "category": p.category,
        "engagement_tier": p.engagement_tier,
        "role_summary": p.role_summary,
        "red_flags": p.red_flags,
        "offerings": p.offerings
    } for p in existing_profiles]
    
    import ai
    analysis = ai.analyze_project_scope_text(text_content, profiles_list)
    return analysis


# Projects CRUD Endpoints

def _unique_candidates_for_project(project_id: int, database: Session):
    """Return unique Candidate objects that have at least one assignment to this project."""
    slots = database.query(db.CandidateAssignment).filter(db.CandidateAssignment.project_id == project_id).all()
    seen = {}
    for s in slots:
        if s.candidate_id not in seen:
            seen[s.candidate_id] = s.candidate
    return list(seen.values())


@app.get("/api/projects", response_model=List[ProjectSchema])
def get_projects(database: Session = Depends(db.get_db)):
    projects = database.query(db.Project).order_by(db.Project.created_at.desc()).all()
    res = []
    for p in projects:
        cands = _unique_candidates_for_project(p.id, database)
        res.append({
            "id": p.id,
            "name": p.name,
            "sow_text": p.sow_text,
            "sow_filename": p.sow_filename,
            "analysis_results": p.analysis_results,
            "created_at": p.created_at,
            "assigned_resources": cands
        })
    return res


@app.get("/api/projects/{project_id}", response_model=ProjectSchema)
def get_project(project_id: int, database: Session = Depends(db.get_db)):
    project = database.query(db.Project).filter(db.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    cands = _unique_candidates_for_project(project_id, database)
    return {
        "id": project.id,
        "name": project.name,
        "sow_text": project.sow_text,
        "sow_filename": project.sow_filename,
        "analysis_results": project.analysis_results,
        "created_at": project.created_at,
        "assigned_resources": cands
    }


@app.post("/api/projects", response_model=ProjectSchema)
def create_project(project_in: ProjectCreateSchema, database: Session = Depends(db.get_db)):
    project = db.Project(
        name=project_in.name,
        sow_text=project_in.sow_text,
        sow_filename=project_in.sow_filename,
        analysis_results=project_in.analysis_results
    )
    database.add(project)
    database.commit()
    database.refresh(project)
    return {
        "id": project.id,
        "name": project.name,
        "sow_text": project.sow_text,
        "sow_filename": project.sow_filename,
        "analysis_results": project.analysis_results,
        "created_at": project.created_at,
        "assigned_resources": []
    }


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, database: Session = Depends(db.get_db)):
    project = database.query(db.Project).filter(db.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    database.delete(project)
    database.commit()
    return {"message": f"Project {project_id} deleted successfully"}


# Project Assignment Endpoints

@app.post("/api/projects/{project_id}/assign/{candidate_id}")
def assign_candidate_to_project(
    project_id: int,
    candidate_id: int,
    profile_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    database: Session = Depends(db.get_db)
):
    project = database.query(db.Project).filter(db.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    candidate = database.query(db.Candidate).filter(db.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Check for date-range conflicts with any existing assignment
    if start_date and end_date:
        conflict = (
            database.query(db.CandidateAssignment)
            .filter(
                db.CandidateAssignment.candidate_id == candidate_id,
                db.CandidateAssignment.start_date.isnot(None),
                db.CandidateAssignment.end_date.isnot(None),
                db.CandidateAssignment.start_date <= end_date,
                db.CandidateAssignment.end_date >= start_date,
            )
            .first()
        )
        if conflict:
            proj_name = conflict.project.name if conflict.project else "another project"
            raise HTTPException(
                status_code=400,
                detail=f"Date conflict: candidate already has an assignment from {conflict.start_date} to {conflict.end_date} in project '{proj_name}'"
            )

    # Prevent exact-duplicate unscheduled slot (same project + profile, no dates)
    if not (start_date and end_date):
        dupe = (
            database.query(db.CandidateAssignment)
            .filter(
                db.CandidateAssignment.candidate_id == candidate_id,
                db.CandidateAssignment.project_id == project_id,
                db.CandidateAssignment.profile_id == profile_id,
                db.CandidateAssignment.start_date.is_(None),
            )
            .first()
        )
        if dupe:
            raise HTTPException(status_code=400, detail="Candidate is already assigned to this role in this project with no dates set")

    new_slot = db.CandidateAssignment(
        candidate_id=candidate_id,
        project_id=project_id,
        profile_id=profile_id,
        start_date=start_date,
        end_date=end_date,
    )
    database.add(new_slot)
    database.commit()
    database.refresh(new_slot)
    database.refresh(candidate)
    return {
        "message": f"Candidate {candidate.full_name} assigned to project '{project.name}' successfully",
        "assignment_id": new_slot.id,
        "assignments": _build_assignments(candidate),
    }


@app.delete("/api/assignments/{assignment_id}")
def release_assignment(assignment_id: int, database: Session = Depends(db.get_db)):
    slot = database.query(db.CandidateAssignment).filter(db.CandidateAssignment.id == assignment_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Assignment not found")
    candidate_name = slot.candidate.full_name if slot.candidate else "Unknown"
    database.delete(slot)
    database.commit()
    return {"message": f"Assignment released for {candidate_name} successfully"}


@app.get("/api/utilization")
def get_utilization(database: Session = Depends(db.get_db)):
    today = date.today()

    all_candidates = database.query(db.Candidate).all()
    all_slots = database.query(db.CandidateAssignment).all()
    projects = database.query(db.Project).all()
    existing_profile_names = {p.role_name for p in database.query(db.TalentProfile).all()}

    assigned_candidate_ids = {s.candidate_id for s in all_slots}
    active, upcoming, past, unscheduled = [], [], [], []

    for s in all_slots:
        info = {
            "assignment_id": s.id,
            "candidate_id": s.candidate_id,
            "full_name": s.candidate.full_name if s.candidate else "Unknown",
            "experience_years": s.candidate.experience_years if s.candidate else 0,
            "assigned_project_id": s.project_id,
            "assigned_project_name": s.project.name if s.project else None,
            "assigned_profile_id": s.profile_id,
            "assigned_profile_name": s.profile.role_name if s.profile else None,
            "start_date": s.start_date.isoformat() if s.start_date else None,
            "end_date": s.end_date.isoformat() if s.end_date else None,
        }
        if s.start_date and s.end_date:
            if s.start_date <= today <= s.end_date:
                active.append(info)
            elif s.start_date > today:
                upcoming.append(info)
            else:
                past.append(info)
        else:
            unscheduled.append(info)

    available = [
        {"id": c.id, "full_name": c.full_name, "experience_years": c.experience_years, "skills": c.skills or []}
        for c in all_candidates if c.id not in assigned_candidate_ids
    ]

    project_coverage = []
    for p in projects:
        matched = p.analysis_results.get("matched_profiles", []) if p.analysis_results else []
        missing = p.analysis_results.get("missing_profiles", []) if p.analysis_results else []
        promoted = sum(1 for m in missing if m.get("role_name") in existing_profile_names)
        total_required = len(matched) + promoted
        filled = len({s.candidate_id for s in all_slots if s.project_id == p.id})
        project_coverage.append({
            "project_id": p.id,
            "project_name": p.name,
            "required_roles": total_required,
            "filled_roles": filled,
            "coverage_pct": round(filled / total_required * 100) if total_required > 0 else 0,
        })

    return {
        "as_of": today.isoformat(),
        "summary": {
            "total_candidates": len(all_candidates),
            "active_assignments": len(active),
            "upcoming_assignments": len(upcoming),
            "past_assignments": len(past),
            "unscheduled_assignments": len(unscheduled),
            "available_candidates": len(available),
        },
        "active_assignments": active,
        "upcoming_assignments": upcoming,
        "past_assignments": past,
        "unscheduled_assignments": unscheduled,
        "available_candidates": available,
        "project_coverage": project_coverage,
    }
