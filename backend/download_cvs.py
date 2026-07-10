import os
from db import SessionLocal, Candidate

def download_cvs():
    db = SessionLocal()
    try:
        candidates = db.query(Candidate).all()
        output_dir = "/app/downloaded_cvs"
        os.makedirs(output_dir, exist_ok=True)
        
        count = 0
        for candidate in candidates:
            if candidate.cv_raw_text:
                # Clean candidate name for filename
                safe_name = "".join(c for c in candidate.full_name if c.isalnum() or c in (" ", "_", "-")).strip()
                safe_name = safe_name.replace(" ", "_")
                filename = f"{candidate.id}_{safe_name}.txt"
                filepath = os.path.join(output_dir, filename)
                
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(f"Candidate Name: {candidate.full_name}\n")
                    f.write(f"Email: {candidate.email or 'N/A'}\n")
                    f.write(f"Experience Years: {candidate.experience_years or 0}\n")
                    f.write(f"Skills: {', '.join(candidate.skills) if candidate.skills else 'None'}\n")
                    f.write("-" * 80 + "\n\n")
                    f.write(candidate.cv_raw_text)
                count += 1
                
        print(f"Successfully extracted {count} candidate CVs to {output_dir}")
    finally:
        db.close()

if __name__ == "__main__":
    download_cvs()
