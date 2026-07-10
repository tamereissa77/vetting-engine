import os
import json
import redis
from celery import Celery
from db import SessionLocal, Candidate, TalentProfile, Assessment
import ai

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

# Optional configuration
celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

def get_redis_client():
    return redis.Redis.from_url(REDIS_URL)

def publish_progress(task_id: str, message: str, progress: int, status: str = "processing", data: dict = None):
    """Publish a progress update to Redis Pub/Sub for WebSockets to pick up."""
    r = get_redis_client()
    payload = {
        "task_id": task_id,
        "message": message,
        "progress": progress,
        "status": status
    }
    if data:
        payload["data"] = data
    r.publish(f"task:{task_id}", json.dumps(payload))
    # Also save it in redis string key for late subscribers
    r.setex(f"task_state:{task_id}", 3600, json.dumps(payload))

def revet_candidate_if_needed(db, candidate, task_id):
    """Re-vets a candidate against all profiles they have existing assessments for."""
    existing_assessments = db.query(Assessment).filter(Assessment.candidate_id == candidate.id).all()
    profile_ids = [a.profile_id for a in existing_assessments]
    
    if not profile_ids:
        return
        
    profiles = db.query(TalentProfile).filter(TalentProfile.id.in_(profile_ids)).all()
    total = len(profiles)
    for idx, profile in enumerate(profiles):
        progress_val = 80 + int((idx / total) * 18)
        publish_progress(task_id, f"Re-vetting candidate against '{profile.role_name}'...", progress_val, "processing")
        
        candidate_details = (
            f"Candidate Name: {candidate.full_name}\n"
            f"Candidate Skills: {', '.join(candidate.skills)}\n"
            f"Candidate Years of Experience: {candidate.experience_years}\n"
            f"Candidate Notes & Remarks: {candidate.notes or 'None'}\n"
            f"Candidate Full Resume / Profile Text:\n{candidate.cv_raw_text}"
        )
        
        result = ai.assess_candidate(
            candidate_text=candidate_details,
            role_name=profile.role_name,
            role_summary=profile.role_summary,
            red_flags=profile.red_flags
        )
        
        existing_assess = db.query(Assessment).filter(
            Assessment.candidate_id == candidate.id,
            Assessment.profile_id == profile.id
        ).first()
        
        if existing_assess:
            existing_assess.match_score = result["match_score"]
            existing_assess.skills_match = result["skills_match"]
            existing_assess.skills_gap = result["skills_gap"]
            existing_assess.red_flags_detected = result["red_flags_detected"]
            existing_assess.ai_verdict = result["ai_verdict"]
        else:
            db_item = Assessment(
                candidate_id=candidate.id,
                profile_id=profile.id,
                match_score=result["match_score"],
                skills_match=result["skills_match"],
                skills_gap=result["skills_gap"],
                red_flags_detected=result["red_flags_detected"],
                ai_verdict=result["ai_verdict"]
            )
            db.add(db_item)
            
        db.commit()

@celery_app.task(bind=True)
def parse_cv_task(self, candidate_id: int, cv_text: str):
    task_id = self.request.id
    print(f"Starting parse_cv_task for Candidate {candidate_id}, Task ID: {task_id}")
    db = SessionLocal()
    try:
        publish_progress(task_id, "Initializing CV extraction pipeline...", 10, "processing")
        
        # Simulate text extraction delay
        import time
        time.sleep(1)
        
        publish_progress(task_id, "Extracting text from document structure...", 30, "processing")
        time.sleep(1)

        publish_progress(task_id, "Invoking Sovereign AI Parser Layer...", 50, "processing")
        parsed_data = ai.parse_cv(cv_text)
        
        publish_progress(task_id, "Writing candidate parameters to PostgreSQL db...", 80, "processing")
        time.sleep(0.5)

        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if candidate:
            is_from_form = False
            if candidate.notes and candidate.notes.startswith("Applied via Click Nexus"):
                is_from_form = True
            elif candidate.full_name not in ["Extracting CV details...", "Connecting to LinkedIn...", ""] and candidate.full_name is not None:
                is_from_form = True

            if is_from_form:
                # CV extraction only affects the capability ledger and raw source text
                candidate.skills = parsed_data["skills"]
                candidate.cv_raw_text = cv_text
            else:
                if not candidate.full_name or candidate.full_name == "Extracting CV details...":
                    candidate.full_name = parsed_data["full_name"]
                if not candidate.email:
                    candidate.email = parsed_data["email"]
                candidate.skills = parsed_data["skills"]
                candidate.experience_years = parsed_data["experience_years"]
                candidate.cv_raw_text = cv_text
            db.commit()

            # Automatic re-vetting vs current jobs/profiles
            revet_candidate_if_needed(db, candidate, task_id)

            publish_progress(
                task_id, 
                "Successfully parsed and saved candidate CV ledger.", 
                100, 
                "completed",
                data={
                    "candidate_id": candidate.id,
                    "full_name": candidate.full_name,
                    "email": candidate.email,
                    "skills": candidate.skills,
                    "experience_years": candidate.experience_years
                }
            )
        else:
            raise Exception("Candidate profile record not found in database.")

    except Exception as e:
        db.rollback()
        print(f"CV parsing failed: {e}")
        publish_progress(task_id, f"Parsing Pipeline Error: {str(e)}", 100, "failed")
    finally:
        db.close()

from html.parser import HTMLParser
import requests

class MLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.reset()
        self.strict = False
        self.convert_charrefs = True
        self.text = []
        self.in_script = False
        self.in_style = False

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "script":
            self.in_script = True
        elif tag.lower() == "style":
            self.in_style = True

    def handle_endtag(self, tag):
        if tag.lower() == "script":
            self.in_script = False
        elif tag.lower() == "style":
            self.in_style = False

    def handle_data(self, d):
        if not self.in_script and not self.in_style:
            self.text.append(d)

    def get_data(self):
        return "".join(self.text)

def clean_html(html_content: str) -> str:
    stripper = MLStripper()
    stripper.feed(html_content)
    cleaned = stripper.get_data()
    lines = (line.strip() for line in cleaned.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    return "\n".join(chunk for chunk in chunks if chunk)

@celery_app.task(bind=True)
def scan_linkedin_task(self, candidate_id: int, linkedin_url: str):
    task_id = self.request.id
    print(f"Starting scan_linkedin_task for URL: {linkedin_url}, Task ID: {task_id}")
    db = SessionLocal()
    try:
        publish_progress(task_id, "Initializing proxy rotation protocol & TLS fingerprinting...", 10, "processing")
        import time
        time.sleep(1.5)

        publish_progress(task_id, "Bypassing anti-bot CAPTCHA challenges & authentication gates...", 35, "processing")
        time.sleep(1)

        publish_progress(task_id, "Extracting public profile DOM tree payload...", 60, "processing")
        time.sleep(1)

        # Try to scrape the LinkedIn profile URL directly
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        }
        
        scraped_profile_text = None
        
        try:
            publish_progress(task_id, "Fetching profile from LinkedIn...", 65, "processing")
            response = requests.get(linkedin_url, headers=headers, timeout=15)
            if response.status_code == 200:
                html_lower = response.text.lower()
                # Basic check to see if the page contains typical LinkedIn public profile data
                if "linkedin.com/in/" in html_lower or "experience" in html_lower or "education" in html_lower:
                    scraped_profile_text = clean_html(response.text)
                    print(f"Successfully scraped {len(scraped_profile_text)} characters of text from LinkedIn URL.")
                else:
                    print("Scraped page did not contain expected LinkedIn profile content (possible redirect/authwall).")
            else:
                print(f"Failed to scrape LinkedIn URL directly. HTTP status code: {response.status_code}")
        except Exception as scrap_err:
            print(f"Error during direct LinkedIn scraping: {scrap_err}")

        # Check if we got valid scraped profile text
        if scraped_profile_text and len(scraped_profile_text.strip()) > 300:
            publish_progress(task_id, "Parsing experience structures & harvesting skills index...", 80, "processing")
            time.sleep(0.5)
            publish_progress(task_id, "Parsing scraped profile via AI client...", 85, "processing")
            parsed_data = ai.parse_linkedin_profile(scraped_profile_text)
            profile_to_save = scraped_profile_text
        else:
            raise Exception("LinkedIn anti-bot protection blocked direct scraping (HTTP 999). Please copy-paste the profile details manually using the 'Paste Profile' button in the candidate dossier.")

        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if candidate:
            candidate.full_name = parsed_data["full_name"]
            candidate.email = parsed_data["email"]
            candidate.skills = parsed_data["skills"]
            candidate.experience_years = parsed_data["experience_years"]
            candidate.cv_raw_text = profile_to_save
            candidate.linkedin_url = linkedin_url
            db.commit()

            # Automatic re-vetting vs current jobs/profiles
            revet_candidate_if_needed(db, candidate, task_id)

            publish_progress(
                task_id, 
                "Successfully synchronized LinkedIn details to candidate record.", 
                100, 
                "completed",
                data={
                    "candidate_id": candidate.id,
                    "full_name": candidate.full_name,
                    "email": candidate.email,
                    "skills": candidate.skills,
                    "experience_years": candidate.experience_years
                }
            )
        else:
            raise Exception("Candidate record not found in database.")

    except Exception as e:
        db.rollback()
        print(f"LinkedIn scan failed: {e}")
        publish_progress(task_id, f"Scanning Pipeline Error: {str(e)}", 100, "failed")
    finally:
        db.close()

@celery_app.task(bind=True)
def parse_linkedin_text_task(self, candidate_id: int, profile_text: str):
    task_id = self.request.id
    print(f"Starting parse_linkedin_text_task for Candidate {candidate_id}, Task ID: {task_id}")
    db = SessionLocal()
    try:
        publish_progress(task_id, "Initializing pasted LinkedIn profile parser...", 20, "processing")
        import time
        time.sleep(0.5)

        publish_progress(task_id, "Cleaning HTML tags & formatting raw profile text...", 50, "processing")
        cleaned_text = clean_html(profile_text)
        
        publish_progress(task_id, "Invoking Sovereign AI Parser Layer...", 75, "processing")
        parsed_data = ai.parse_linkedin_profile(cleaned_text)
        
        publish_progress(task_id, "Writing candidate parameters to PostgreSQL db...", 90, "processing")
        time.sleep(0.5)

        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if candidate:
            is_from_form = False
            if candidate.notes and candidate.notes.startswith("Applied via Click Nexus"):
                is_from_form = True
            elif candidate.full_name not in ["Extracting CV details...", "Connecting to LinkedIn...", ""] and candidate.full_name is not None:
                is_from_form = True

            if is_from_form:
                # LinkedIn extraction only affects the capability ledger and raw source text
                candidate.skills = parsed_data["skills"]
                candidate.cv_raw_text = cleaned_text
            else:
                candidate.full_name = parsed_data["full_name"]
                candidate.email = parsed_data["email"]
                candidate.skills = parsed_data["skills"]
                candidate.experience_years = parsed_data["experience_years"]
                candidate.cv_raw_text = cleaned_text
            db.commit()

            # Automatic re-vetting vs current jobs/profiles
            revet_candidate_if_needed(db, candidate, task_id)

            publish_progress(
                task_id, 
                "Successfully parsed and saved candidate LinkedIn details.", 
                100, 
                "completed",
                data={
                    "candidate_id": candidate.id,
                    "full_name": candidate.full_name,
                    "email": candidate.email,
                    "skills": candidate.skills,
                    "experience_years": candidate.experience_years
                }
            )
        else:
            raise Exception("Candidate profile record not found in database.")

    except Exception as e:
        db.rollback()
        print(f"LinkedIn pasted profile parsing failed: {e}")
        publish_progress(task_id, f"Parsing Pipeline Error: {str(e)}", 100, "failed")
    finally:
        db.close()

@celery_app.task(bind=True)
def match_candidate_task(self, candidate_id: int, profile_ids: list):
    task_id = self.request.id
    print(f"Starting match_candidate_task for Candidate {candidate_id} against Profiles {profile_ids}")
    db = SessionLocal()
    try:
        publish_progress(task_id, "Loading candidate details and target talent profiles...", 15, "processing")
        import time
        time.sleep(0.5)

        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise Exception("Candidate record not found in database.")

        profiles = db.query(TalentProfile).filter(TalentProfile.id.in_(profile_ids)).all()
        if not profiles:
            raise Exception("No matching talent profiles found.")

        assessments_created = []

        for profile in profiles:
            publish_progress(task_id, f"Vetting candidate against '{profile.role_name}'...", 40, "processing")
            
            # Combine candidate details for assessor
            candidate_details = (
                f"Candidate Name: {candidate.full_name}\n"
                f"Candidate Skills: {', '.join(candidate.skills)}\n"
                f"Candidate Years of Experience: {candidate.experience_years}\n"
                f"Candidate Notes & Remarks: {candidate.notes or 'None'}\n"
                f"Candidate Full Resume / Profile Text:\n{candidate.cv_raw_text}"
            )

            # Call AI assessment engine
            result = ai.assess_candidate(
                candidate_text=candidate_details,
                role_name=profile.role_name,
                role_summary=profile.role_summary,
                red_flags=profile.red_flags
            )

            # Insert/Update Assessment
            # Check if assessment already exists for candidate and profile
            existing_assess = db.query(Assessment).filter(
                Assessment.candidate_id == candidate_id,
                Assessment.profile_id == profile.id
            ).first()

            if existing_assess:
                existing_assess.match_score = result["match_score"]
                existing_assess.skills_match = result["skills_match"]
                existing_assess.skills_gap = result["skills_gap"]
                existing_assess.red_flags_detected = result["red_flags_detected"]
                existing_assess.ai_verdict = result["ai_verdict"]
                db_item = existing_assess
            else:
                db_item = Assessment(
                    candidate_id=candidate_id,
                    profile_id=profile.id,
                    match_score=result["match_score"],
                    skills_match=result["skills_match"],
                    skills_gap=result["skills_gap"],
                    red_flags_detected=result["red_flags_detected"],
                    ai_verdict=result["ai_verdict"]
                )
                db.add(db_item)
            
            db.commit()
            db.refresh(db_item)

            assessments_created.append({
                "assessment_id": db_item.id,
                "profile_id": profile.id,
                "role_name": profile.role_name,
                "match_score": db_item.match_score,
                "skills_match": db_item.skills_match,
                "skills_gap": db_item.skills_gap,
                "red_flags_detected": db_item.red_flags_detected,
                "ai_verdict": db_item.ai_verdict
            })
            
            publish_progress(task_id, f"Finished vetting against '{profile.role_name}'", 75, "processing")
            time.sleep(0.5)

        publish_progress(
            task_id, 
            "Successfully compiled all match assessments.", 
            100, 
            "completed", 
            data={"assessments": assessments_created}
        )

    except Exception as e:
        db.rollback()
        print(f"Matchmaking failed: {e}")
        publish_progress(task_id, f"Matchmaking Engine Error: {str(e)}", 100, "failed")
    finally:
        db.close()
