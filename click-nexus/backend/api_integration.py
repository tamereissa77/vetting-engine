import os
import time
import requests
from typing import Dict, Any, List, Optional

VITTING_ENGINE_URL = os.getenv("VITTING_ENGINE_API_URL", "http://sovereign-backend:8000")

class VittingEngineClient:
    VITTING_ENGINE_URL = VITTING_ENGINE_URL

    @staticmethod
    def get_job_profiles() -> List[Dict[str, Any]]:
        """Fetch profiles from the Vitting Engine to display as jobs."""
        try:
            url = f"{VITTING_ENGINE_URL}/api/profiles/raw"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                return response.json()
            print(f"Error fetching Vitting profiles: Status {response.status_code}")
            return []
        except Exception as e:
            print(f"Connection error to Vitting Engine at {VITTING_ENGINE_URL}: {e}")
            return []

    @staticmethod
    def upload_cv(file_bytes: bytes, filename: str) -> Optional[Dict[str, Any]]:
        """Upload candidate CV to Vitting Engine to initialize candidate indexing."""
        try:
            url = f"{VITTING_ENGINE_URL}/api/candidates/upload"
            files = {"file": (filename, file_bytes, "application/octet-stream")}
            response = requests.post(url, files=files, timeout=15)
            if response.status_code == 200:
                return response.json() # {"message", "candidate_id", "task_id"}
            print(f"Error uploading CV: Status {response.status_code} - {response.text}")
            return None
        except Exception as e:
            print(f"Connection error uploading CV to Vitting Engine: {e}")
            return None

    @staticmethod
    def paste_linkedin(text: str, linkedin_url: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Submit LinkedIn text profile to Vitting Engine to initialize candidate indexing."""
        try:
            url = f"{VITTING_ENGINE_URL}/api/candidates/linkedin/paste"
            data = {"text": text}
            if linkedin_url:
                data["linkedin_url"] = linkedin_url
            response = requests.post(url, data=data, timeout=15)
            if response.status_code == 200:
                return response.json() # {"message", "candidate_id", "task_id"}
            print(f"Error pasting LinkedIn profile: Status {response.status_code} - {response.text}")
            return None
        except Exception as e:
            print(f"Connection error pasting LinkedIn to Vitting Engine: {e}")
            return None

    @staticmethod
    def trigger_matchmaking(candidate_id: int, profile_id: int) -> bool:
        """Trigger Vitting Engine assessment for candidate against a target profile ID."""
        try:
            url = f"{VITTING_ENGINE_URL}/api/candidates/{candidate_id}/match"
            payload = {"profile_ids": [profile_id]}
            response = requests.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                return True
            print(f"Error triggering matchmaking: Status {response.status_code} - {response.text}")
            return False
        except Exception as e:
            print(f"Connection error triggering matchmaking: {e}")
            return False

    @staticmethod
    def get_candidate_status(candidate_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve candidate status and assessment scorecards from Vitting Engine."""
        try:
            url = f"{VITTING_ENGINE_URL}/api/candidates/{candidate_id}"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                return response.json()
            print(f"Error fetching candidate details: Status {response.status_code}")
            return None
        except Exception as e:
            print(f"Connection error fetching candidate details: {e}")
            return None

    @classmethod
    def process_and_poll_application(
        cls, 
        candidate_id: int, 
        profile_id: int, 
        log_callback=None
    ) -> Optional[Dict[str, Any]]:
        """
        Polls Vitting Engine until CV/LinkedIn parsing is complete, 
        triggers matchmaking, and polls until assessment is ready.
        """
        def log(msg):
            if log_callback:
                log_callback(msg)
            else:
                print(msg)

        # 1. Poll for CV/LinkedIn Parsing Completion
        log("Sandbox initiated. Waiting for candidate CV/LinkedIn ingestion task...")
        max_attempts = 30
        parsed_candidate = None
        
        for attempt in range(max_attempts):
            time.sleep(2)
            status = cls.get_candidate_status(candidate_id)
            if not status:
                log(f"Attempt {attempt+1}: Unable to connect to Vitting Engine database.")
                continue
            
            name = status.get("full_name", "")
            # Vitting Engine initial placeholders: "Extracting CV details...", "Parsing Pasted LinkedIn..."
            if name and not name.startswith("Extracting") and not name.startswith("Parsing"):
                parsed_candidate = status
                log(f"Ingestion successful. Candidate profile resolved: {name}")
                break
                
            log(f"Analyzing profile structure (Attempt {attempt+1}/{max_attempts})...")
        
        if not parsed_candidate:
            log("Ingestion timeout. Failed to parse CV/LinkedIn structure.")
            return None

        # 2. Trigger matchmaking assessment
        log(f"Registering matchmaking vector scan against Target Profile ID: {profile_id}...")
        success = cls.trigger_matchmaking(candidate_id, profile_id)
        if not success:
            log("Matchmaking dispatch failed.")
            return None

        # 3. Poll for matchmaking scorecard completion
        log("Matchmaking assessment queued. Running Vitting Engine Scorecard Matrix...")
        for attempt in range(max_attempts):
            time.sleep(2)
            status = cls.get_candidate_status(candidate_id)
            if not status:
                continue
            
            assessments = status.get("assessments", [])
            target_assessment = next((a for a in assessments if a.get("profile_id") == profile_id), None)
            
            if target_assessment:
                log("Compliance analysis complete. Ingestion scorecard loaded successfully.")
                return {
                    "candidate_name": status.get("full_name"),
                    "email": status.get("email"),
                    "match_score": target_assessment.get("match_score", 0),
                    "skills_match": target_assessment.get("skills_match", []),
                    "skills_gap": target_assessment.get("skills_gap", []),
                    "red_flags_detected": target_assessment.get("red_flags_detected", []),
                    "ai_verdict": target_assessment.get("ai_verdict", ""),
                    "is_disqualified": target_assessment.get("is_disqualified", False)
                }
            log(f"Executing semantic alignment match (Attempt {attempt+1}/{max_attempts})...")
            
        log("Matchmaking analysis timeout.")
        return None
