import json
from db import SessionLocal, TalentProfile
import ai

# Connect to database and retrieve profiles
db_session = SessionLocal()
existing_profiles = db_session.query(TalentProfile).all()
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

sow_text = """efinance AI project
- implement 4 Dell XE7745 servers with 8 x Nvidia RTX Pro 6000 GPUs for each server
- building Alkhabeer AI application full stack
- build the knowalage base
- integration with Cloudera data platfrom
- required tech lead"""

print("SOW Text:")
print(sow_text)
print(f"\nRetrieved {len(profiles_list)} existing profiles.")

try:
    print("\nRunning ai.analyze_project_scope_text...")
    result = ai.analyze_project_scope_text(sow_text, profiles_list)
    print("\nAnalysis Result:")
    print(json.dumps(result, indent=2))
except Exception as e:
    print(f"\nError running analysis: {e}")
finally:
    db_session.close()
