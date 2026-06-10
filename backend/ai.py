import os
import json
import re
import requests
from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()
OLLAMA_API_BASE = os.getenv("OLLAMA_API_BASE", "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

def clean_json_string(response_text: str) -> str:
    """Extracts the JSON substring from a text response."""
    # Find the first occurrences of { or [ and the last occurrence of } or ]
    match = re.search(r'(\{.*\}|\[.*\])', response_text, re.DOTALL)
    if match:
        return match.group(1)
    return response_text

def call_llm(prompt: str, system_prompt: str = "") -> str:
    """Dispatches the prompt to the selected LLM provider."""
    print(f"Calling AI Engine: Provider={LLM_PROVIDER}, Model={GEMINI_MODEL if LLM_PROVIDER == 'gemini' else (OLLAMA_MODEL if LLM_PROVIDER == 'ollama' else 'gpt-4o-mini')}")
    try:
        if LLM_PROVIDER == "openai" and OPENAI_API_KEY:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            data = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "response_format": {"type": "json_object"} if "json" in prompt.lower() else None
            }
            resp = requests.post(url, headers=headers, json=data, timeout=30)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

        elif LLM_PROVIDER == "gemini" and GEMINI_API_KEY:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
            headers = {"Content-Type": "application/json; charset=utf-8"}
            combined_prompt = f"{system_prompt}\n\nUser Input:\n{prompt}"

            data = {
                "contents": [
                    {
                        "parts": [
                            {
                                "text": combined_prompt
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 8192
                }
            }

            resp = requests.post(url, headers=headers, json=data, timeout=30)
            resp.raise_for_status()
            body = resp.json()

            if "candidates" in body and len(body["candidates"]) > 0:
                candidate = body["candidates"][0]
                if isinstance(candidate, dict):
                    if "content" in candidate:
                        content = candidate["content"]
                        if isinstance(content, dict):
                            parts = content.get("parts", [])
                            if isinstance(parts, list) and len(parts) > 0:
                                return parts[0].get("text", "")
                        elif isinstance(content, list) and len(content) > 0:
                            first = content[0]
                            if isinstance(first, dict) and "text" in first:
                                return first["text"]
                            if isinstance(first, dict) and "parts" in first:
                                parts = first["parts"]
                                if isinstance(parts, list) and len(parts) > 0:
                                    return parts[0].get("text", "")
                    if "text" in candidate:
                        return candidate["text"]

            # Fall back to raw body text if we cannot parse the response shape.
            return resp.text

        else: # Default: Ollama (local sovereign model)
            url = f"{OLLAMA_API_BASE}/api/generate"
            combined_prompt = f"{system_prompt}\n\nUser Input:\n{prompt}"
            data = {
                "model": OLLAMA_MODEL,
                "prompt": combined_prompt,
                "stream": False,
                "format": "json" if "json" in prompt.lower() else None
            }
            resp = requests.post(url, json=data, timeout=30)
            resp.raise_for_status()
            return resp.json()["response"]

    except Exception as e:
        print(f"AI Engine failure: {e}. Falling back to default mock/heuristics.")
        raise e

def parse_cv(cv_text: str) -> dict:
    """Parses CV text using LLM, returning candidates structure in JSON format."""
    system_prompt = (
        "You are an expert recruitment parser AI. "
        "Your task is to extract structural metadata from candidate CV resumes. "
        "Return ONLY a valid JSON object matching this structure: "
        "{\n"
        "  \"full_name\": \"Candidate Full Name\",\n"
        "  \"email\": \"Candidate Email\",\n"
        "  \"skills\": [\"Skill1\", \"Skill2\", ...],\n"
        "  \"experience_years\": 5\n"
        "}"
    )

    prompt = (
        "Extract the metadata from the following resume text. "
        "If you cannot find a specific field, return null or empty values. "
        "For experience_years, estimate the total years of relevant experience from the timeline. "
        "Ensure all keys are formatted exactly as instructed and the output is valid JSON.\n\n"
        f"Resume Content:\n{cv_text}"
    )

    try:
        raw_res = call_llm(prompt, system_prompt)
        cleaned_res = clean_json_string(raw_res)
        parsed = json.loads(cleaned_res)
        return {
            "full_name": parsed.get("full_name") or "Unknown Candidate",
            "email": parsed.get("email") or "candidate@sovereign-talent.net",
            "skills": parsed.get("skills") or [],
            "experience_years": parsed.get("experience_years") or 0
        }
    except Exception as e:
        # Fallback heuristic parser if model fails
        print(f"Fallback parse triggered: {e}")
        # Extract email via regex
        emails = re.findall(r'[\w\.-]+@[\w\.-]+', cv_text)
        email = emails[0] if emails else "candidate@sovereign-talent.net"
        
        # Simple heuristics for name (take first non-empty line)
        lines = [l.strip() for l in cv_text.split("\n") if l.strip()]
        name = lines[0] if lines else "Unknown Candidate"
        # Clean prefix like "Name:" or "Full Name:"
        name = re.sub(r'^(name|full\s*name)\s*:\s*', '', name, flags=re.IGNORECASE).strip()
        if len(name) > 50:
            name = "Unknown Candidate"

        # Guess some common keywords for skills
        skills_keywords = ["python", "javascript", "react", "docker", "kubernetes", "aws", "postgresql", "fastapi", "git", "linux", "ai", "security"]
        found_skills = [k for k in skills_keywords if k in cv_text.lower()]
        
        return {
            "full_name": name,
            "email": email,
            "skills": found_skills,
            "experience_years": 3 # default guess
        }

def assess_candidate(candidate_text: str, role_name: str, role_summary: str, red_flags: str) -> dict:
    """Assess a candidate against a target talent profile summary and red flags."""
    system_prompt = (
        "You are a Senior Technical Talent Assessor. Your task is to evaluate a candidate "
        "against a specific OriginCraft Talent Profile. "
        "Evaluate the skills matches, skills gaps, and check for any of the listed screen-out red flags. "
        "You must return ONLY a valid JSON object matching the following structure:\n"
        "{\n"
        "  \"match_score\": 75,\n"
        "  \"skills_match\": [\"python\", \"etl\"],\n"
        "  \"skills_gap\": [\"streaming pipelines\"],\n"
        "  \"red_flags_detected\": [\"Only batch ETL experience\"],\n"
        "  \"ai_verdict\": \"A detailed multi-paragraph rationale detailing the candidate's strengths, weaknesses, and decision reasoning.\"\n"
        "}"
    )

    prompt = (
        f"Target Profile: {role_name}\n"
        f"Profile Summary: {role_summary}\n"
        f"Critical Red Flags to check: {red_flags}\n\n"
        "Evaluate this candidate against the profile. Match score must be between 0 and 100. "
        "If the candidate's background matches any of the critical red flags, identify them in red_flags_detected and lower the score significantly. "
        "Ensure the response is valid JSON.\n\n"
        f"Candidate CV & Details:\n{candidate_text}"
    )

    try:
        raw_res = call_llm(prompt, system_prompt)
        cleaned_res = clean_json_string(raw_res)
        parsed = json.loads(cleaned_res)
        return {
            "match_score": int(parsed.get("match_score", 50)),
            "skills_match": parsed.get("skills_match") or [],
            "skills_gap": parsed.get("skills_gap") or [],
            "red_flags_detected": parsed.get("red_flags_detected") or [],
            "ai_verdict": parsed.get("ai_verdict") or "No detailed verdict could be generated by the model."
        }
    except Exception as e:
        print(f"Fallback assessment triggered: {e}")
        # Default mock assessment if AI fails
        return {
            "match_score": 60,
            "skills_match": ["General engineering capabilities"],
            "skills_gap": ["Specific Sovereign AI framework proficiency"],
            "red_flags_detected": [],
            "ai_verdict": "Fallback Match: The AI model is currently offline or unreachable. A generic baseline match has been generated. Please verify the Ollama endpoint or provider keys."
        }

def coerce_to_string(val) -> str:
    if isinstance(val, list):
        return "\n".join([f"- {item}" for item in val if item])
    if val is None:
        return ""
    return str(val)

def parse_job_description(jd_text: str) -> dict:
    """Parses raw job description text into a structured talent profile."""
    system_prompt = (
        "You are an expert AI recruiter. Your task is to extract structured talent profile information "
        "from a raw job description text.\n"
        "You must output ONLY a valid JSON object matching the following structure:\n"
        "{\n"
        "  \"role_name\": \"Lead AI Engineer\",\n"
        "  \"stack_layer\": \"Layer 4 — AI / Reasoning\",\n"
        "  \"category\": \"Engineering\",\n"
        "  \"engagement_tier\": \"Full-Time\",\n"
        "  \"role_summary\": \"Provide a clear summary of the role objectives, tech stack, and key responsibilities.\",\n"
        "  \"red_flags\": \"Key disqualifying factors (e.g. No hands-on Python experience, no cloud exposure).\",\n"
        "  \"offerings\": \"Optional deliverables or offerings mapped to this role (separated by commas or as a brief description).\"\n"
        "}\n"
        "Note for stack_layer: Select the closest match from these options:\n"
        "- Layer 1 — Infrastructure\n"
        "- Layer 2 — Data\n"
        "- Layer 3 — Model\n"
        "- Layer 4 — AI / Reasoning\n"
        "- Layer 5 — Application\n"
        "- Strategy & Advisory\n"
        "- Strategy & Governance\n"
        "- Strategy & Enablement\n"
        "- Governance & Security\n"
        "- Domain (Vertical)\n"
    )
    
    prompt = (
        "Analyze the following job description and extract the role's details. "
        "If some fields are not clearly specified, guess or generate appropriate values that fit the role.\n\n"
        f"Job Description Content:\n{jd_text}"
    )

    try:
        raw_res = call_llm(prompt, system_prompt)
        cleaned_res = clean_json_string(raw_res)
        parsed = json.loads(cleaned_res)
        return {
            "role_name": coerce_to_string(parsed.get("role_name") or "Unknown Role"),
            "stack_layer": coerce_to_string(parsed.get("stack_layer") or "Layer 5 — Application"),
            "category": coerce_to_string(parsed.get("category") or "Engineering"),
            "engagement_tier": coerce_to_string(parsed.get("engagement_tier") or "Full-Time"),
            "role_summary": coerce_to_string(parsed.get("role_summary") or ""),
            "red_flags": coerce_to_string(parsed.get("red_flags") or ""),
            "offerings": coerce_to_string(parsed.get("offerings") or "")
        }
    except Exception as e:
        print(f"Failed to parse job description: {e}")
        # Default mock values
        return {
            "role_name": "Imported Role",
            "stack_layer": "Layer 5 — Application",
            "category": "Engineering",
            "engagement_tier": "Full-Time",
            "role_summary": "Parsed from imported document.",
            "red_flags": "No specific red flags extracted.",
            "offerings": ""
        }

def generate_job_description(title: str) -> dict:
    """Generates a structured talent profile based on a job title."""
    system_prompt = (
        "You are an expert AI recruiter. Your task is to generate structured talent profile details "
        "based on the provided job title.\n"
        "You must output ONLY a valid JSON object matching the following structure:\n"
        "{\n"
        "  \"role_name\": \"Generated Role Name matching the title\",\n"
        "  \"stack_layer\": \"Layer 4 — AI / Reasoning\",\n"
        "  \"category\": \"Engineering\",\n"
        "  \"engagement_tier\": \"Full-Time\",\n"
        "  \"role_summary\": \"A clear, professional summary of the role objectives, tech stack, and key responsibilities.\",\n"
        "  \"red_flags\": \"3-4 key screen-out red flags or disqualifying factors, separated by semicolons or bullet points.\",\n"
        "  \"offerings\": \"Deliverables or offerings mapped to this role (e.g. secure deployment, API integrations).\"\n"
        "}\n"
        "Note for stack_layer: Select the closest match from these options:\n"
        "- Layer 1 — Infrastructure\n"
        "- Layer 2 — Data\n"
        "- Layer 3 — Model\n"
        "- Layer 4 — AI / Reasoning\n"
        "- Layer 5 — Application\n"
        "- Strategy & Advisory\n"
        "- Strategy & Governance\n"
        "- Strategy & Enablement\n"
        "- Governance & Security\n"
        "- Domain (Vertical)\n"
    )

    prompt = f"Generate details for a talent profile with the title: '{title}'."

    try:
        raw_res = call_llm(prompt, system_prompt)
        cleaned_res = clean_json_string(raw_res)
        parsed = json.loads(cleaned_res)
        return {
            "role_name": coerce_to_string(parsed.get("role_name") or title),
            "stack_layer": coerce_to_string(parsed.get("stack_layer") or "Layer 5 — Application"),
            "category": coerce_to_string(parsed.get("category") or "Engineering"),
            "engagement_tier": coerce_to_string(parsed.get("engagement_tier") or "Full-Time"),
            "role_summary": coerce_to_string(parsed.get("role_summary") or f"Summary for {title}"),
            "red_flags": coerce_to_string(parsed.get("red_flags") or "None specified"),
            "offerings": coerce_to_string(parsed.get("offerings") or "")
        }
    except Exception as e:
        print(f"Failed to generate job description: {e}")
        return {
            "role_name": title,
            "stack_layer": "Layer 5 — Application",
            "category": "Engineering",
            "engagement_tier": "Full-Time",
            "role_summary": f"Generated summary for {title}",
            "red_flags": "No specific red flags generated",
            "offerings": ""
        }
