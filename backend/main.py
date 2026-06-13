import os
import json
import asyncio
from typing import List, Optional
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

class GenerateProfileRequest(BaseModel):
    title: str

class CandidateCreateUpdateSchema(BaseModel):
    full_name: str
    email: Optional[str] = ""
    linkedin_url: Optional[str] = ""
    skills: List[str] = []
    experience_years: Optional[int] = 0
    is_blacklisted: Optional[bool] = False


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
        best_assessment = database.query(db.Assessment).filter(db.Assessment.candidate_id == c.id).order_by(db.Assessment.match_score.desc()).first()
        res.append({
            "id": c.id,
            "full_name": c.full_name,
            "email": c.email,
            "linkedin_url": c.linkedin_url,
            "skills": c.skills,
            "experience_years": c.experience_years,
            "is_blacklisted": c.is_blacklisted,
            "created_at": c.created_at,
            "highest_score": best_assessment.match_score if best_assessment else None,
            "highest_role_name": best_assessment.profile.role_name if (best_assessment and best_assessment.profile) else None
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
            "created_at": a.created_at
        })

    return {
        "id": candidate.id,
        "full_name": candidate.full_name,
        "email": candidate.email,
        "linkedin_url": candidate.linkedin_url,
        "skills": candidate.skills,
        "experience_years": candidate.experience_years,
        "is_blacklisted": candidate.is_blacklisted,
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
        "skills": db_cand.skills,
        "experience_years": db_cand.experience_years,
        "is_blacklisted": db_cand.is_blacklisted,
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
    db_cand.skills = updated.skills
    db_cand.experience_years = updated.experience_years
    db_cand.is_blacklisted = updated.is_blacklisted
    
    database.commit()
    database.refresh(db_cand)
    return {
        "id": db_cand.id,
        "full_name": db_cand.full_name,
        "email": db_cand.email,
        "linkedin_url": db_cand.linkedin_url,
        "skills": db_cand.skills,
        "experience_years": db_cand.experience_years,
        "is_blacklisted": db_cand.is_blacklisted,
        "created_at": db_cand.created_at
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
    finally:
        try:
            pubsub.unsubscribe(f"task:{task_id}")
        except Exception:
            pass
        await websocket.close()

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
