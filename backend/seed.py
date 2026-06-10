import json
from db import SessionLocal, TalentProfile

PROFILES_DATA = [
  {
    "role_name": "Sovereign Cloud / DevOps Architect",
    "stack_layer": "Layer 1 — Infrastructure",
    "category": "Engineering",
    "engagement_tier": "Full-Time (core)",
    "role_summary": "Owns the foundation layer: builds and operates sovereign, air-gapped cloud infrastructure that keeps models and data inside client jurisdiction.",
    "red_flags": "Cloud-only admin with no air-gap experience; No exposure to data residency/sovereignty constraints."
  },
  {
    "role_name": "Site Reliability Engineer (AIOps)",
    "stack_layer": "Layer 1 — Infrastructure",
    "category": "Engineering",
    "engagement_tier": "Full-Time",
    "role_summary": "Keeps production AI systems running to a 99.99% HA SLA; operationalizes AIOps SYNAPSE for observability and incident response.",
    "red_flags": "Pure dev background with no on-call/production ops; No experience with 1M+ events/sec ingestion scale."
  },
  {
    "role_name": "Security Engineer / Cryptography Specialist",
    "stack_layer": "Layer 1 — Infrastructure",
    "category": "Engineering / Security",
    "engagement_tier": "Full-Time",
    "role_summary": "Applies military-grade hardening across the AI stack — encryption, zero-trust, and the security posture underpinning CYBRAL products.",
    "red_flags": "Theoretical security knowledge with no hardened deployment record; No defense / classified-environment exposure."
  },
  {
    "role_name": "Data Engineer (High-Throughput ETL)",
    "stack_layer": "Layer 2 — Data",
    "category": "Data Engineering",
    "engagement_tier": "Full-Time (core)",
    "role_summary": "Builds the data pipelines that feed clean, structured data to models at scale — supporting 1M+ events/second.",
    "red_flags": "Only batch / small-scale ETL experience; No streaming or high-volume pipeline background."
  },
  {
    "role_name": "Vector Database Engineer",
    "stack_layer": "Layer 2 — Data",
    "category": "Data Engineering",
    "engagement_tier": "Full-Time / Project",
    "role_summary": "Designs and deploys the vector stores that power semantic search and RAG across large document and knowledge corpora.",
    "red_flags": "No production vector DB experience; Treats RAG as a demo, not a scaled system."
  },
  {
    "role_name": "Data Architect",
    "stack_layer": "Layer 2 — Data",
    "category": "Data Engineering / Advisory",
    "engagement_tier": "Fractional / Project",
    "role_summary": "Assesses and designs the client's overall data landscape; runs the data inventory audits and readiness scoring that open every engagement.",
    "red_flags": "Implementation-only engineer with no assessment/advisory skill."
  },
  {
    "role_name": "ML Engineer / LLM Fine-Tuning Specialist",
    "stack_layer": "Layer 3 — Model",
    "category": "Engineering / Data Science",
    "engagement_tier": "Full-Time (core)",
    "role_summary": "Trains and fine-tunes domain-specific models on client data — Arabic finance and legal fields.",
    "red_flags": "Only calls hosted APIs; cannot fine-tune or self-host; No PyTorch/TensorFlow depth."
  },
  {
    "role_name": "MLOps Engineer",
    "stack_layer": "Layer 3 — Model",
    "category": "Engineering",
    "engagement_tier": "Full-Time",
    "role_summary": "Owns the model lifecycle in production — monitoring, drift detection, retraining and automated deployment across 50+ models.",
    "red_flags": "Builds models but can't operationalize them; No monitoring/drift experience in production."
  },
  {
    "role_name": "NLP / Arabic Language Specialist",
    "stack_layer": "Layer 3 — Model",
    "category": "Data Science",
    "engagement_tier": "Full-Time (differentiator)",
    "role_summary": "Handles Arabic dialect nuance and Right-to-Left (RTL) processing that global models fail at.",
    "red_flags": "Generic NLP background with no Arabic depth; Treats Arabic as a single language, not a dialect family."
  },
  {
    "role_name": "AI / Agent Engineer",
    "stack_layer": "Layer 4 — AI / Reasoning",
    "category": "Engineering / Data Science",
    "engagement_tier": "Full-Time (core)",
    "role_summary": "Builds RAG systems, GraphRAG, autonomous agents and reasoning engines.",
    "red_flags": "Demo-grade prototypes only; no production agents; No grounding/citation/eval discipline."
  },
  {
    "role_name": "Reinforcement Learning Engineer",
    "stack_layer": "Layer 4 — AI / Reasoning",
    "category": "Data Science",
    "engagement_tier": "Project / Specialist",
    "role_summary": "Powers adaptive cyber defense through deep reinforcement learning and autonomous red-team simulation.",
    "red_flags": "Supervised-learning-only background; No adversarial / security domain exposure."
  },
  {
    "role_name": "Knowledge Graph Engineer",
    "stack_layer": "Layer 4 — AI / Reasoning",
    "category": "Engineering / Data Science",
    "engagement_tier": "Project / Specialist",
    "role_summary": "Builds the knowledge graphs behind GraphRAG, attack-graph intelligence and legislative matching.",
    "red_flags": "Relational-DB-only mindset; no graph modeling."
  },
  {
    "role_name": "Full-Stack / Frontend Engineer",
    "stack_layer": "Layer 5 — Application",
    "category": "Engineering",
    "engagement_tier": "Full-Time",
    "role_summary": "Builds the user-facing surface — APIs, dashboards and bilingual RTL interfaces that make the AI usable.",
    "red_flags": "No RTL / bilingual UI experience."
  },
  {
    "role_name": "AI Strategy Consultant",
    "stack_layer": "Strategy & Advisory",
    "category": "Advisory",
    "engagement_tier": "Fractional",
    "role_summary": "Aligns AI investment with business value using the DRI framework and Triple-Metric ROI.",
    "red_flags": "Slide-deck strategist with no execution credibility ('pontificator')."
  },
  {
    "role_name": "AI Governance & Risk Lead",
    "stack_layer": "Strategy & Governance",
    "category": "Governance / Advisory",
    "engagement_tier": "Fractional (highest leverage)",
    "role_summary": "Builds NIST/ISO-aligned governance, bias auditing and regulatory compliance.",
    "red_flags": "Generalist compliance background with no AI-specific governance."
  },
  {
    "role_name": "Organizational Change Management Lead",
    "stack_layer": "Strategy & Enablement",
    "category": "Change / People",
    "engagement_tier": "Fractional",
    "role_summary": "Drives adoption so AI augments rather than threatens employees inside engineering and operational cultures.",
    "red_flags": "Pure HR-admin background; not change-led; No experience with technical/engineering cultures."
  },
  {
    "role_name": "AI Enablement / Training Lead",
    "stack_layer": "Strategy & Enablement",
    "category": "Enablement",
    "engagement_tier": "Fractional / Project",
    "role_summary": "Transfers capability to clients — prompt-engineering masterclasses and CoE setup.",
    "red_flags": "Strong engineer who cannot teach / transfer knowledge."
  },
  {
    "role_name": "Compliance / Cybersecurity Analyst",
    "stack_layer": "Governance & Security",
    "category": "Security / Compliance",
    "engagement_tier": "Project / Specialist",
    "role_summary": "Operates data-protection, classification, compliance reporting, and threat monitoring.",
    "red_flags": "Checklist compliance only; no hands-on tooling."
  },
  {
    "role_name": "Domain Specialist — Legal / Legislative",
    "stack_layer": "Domain (Vertical)",
    "category": "Domain SME",
    "engagement_tier": "Project / Advisory",
    "role_summary": "Provides legal subject-matter depth, validates precedent logic and compliance.",
    "red_flags": "Tech-only profile with no legal grounding."
  },
  {
    "role_name": "Domain Specialist — Financial Services",
    "stack_layer": "Domain (Vertical)",
    "category": "Domain SME",
    "engagement_tier": "Project / Advisory",
    "role_summary": "Provides finance and regulatory depth, validates financial logic and benchmarking.",
    "red_flags": "No regulated-finance exposure."
  },
  {
    "role_name": "Domain Specialist — Defense / Critical Infrastructure",
    "stack_layer": "Domain (Vertical)",
    "category": "Domain SME",
    "engagement_tier": "Project / Advisory",
    "role_summary": "Provides defense and critical-infrastructure depth for air-gapped environments.",
    "red_flags": "Commercial-only background; no classified exposure."
  },
  {
    "role_name": "Domain Specialist — Healthcare",
    "stack_layer": "Domain (Vertical)",
    "category": "Domain SME",
    "engagement_tier": "Project / Advisory",
    "role_summary": "Provides clinical and HIPAA depth for clinical decision support and health-data classification.",
    "red_flags": "No clinical or health-compliance grounding."
  }
]

def seed_database():
    print("Seeding database with OriginCraft Talent Profiles...")
    db = SessionLocal()
    try:
        # Check if table already seeded
        count = db.query(TalentProfile).count()
        if count > 0:
            print(f"Database already contains {count} talent profiles. Skipping seeding.")
            return

        for p in PROFILES_DATA:
            profile = TalentProfile(
                role_name=p["role_name"],
                stack_layer=p["stack_layer"],
                category=p["category"],
                engagement_tier=p["engagement_tier"],
                role_summary=p["role_summary"],
                red_flags=p["red_flags"],
                offerings=p.get("offerings", "")
            )
            db.add(profile)
        db.commit()
        print(f"Successfully seeded {len(PROFILES_DATA)} profiles.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
