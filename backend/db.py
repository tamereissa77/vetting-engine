import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, ARRAY, Boolean, JSON, Date
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database Connection
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres_sovereign_secure")
DB_DB = os.getenv("POSTGRES_DB", "sovereign_talent")
DB_HOST = os.getenv("POSTGRES_HOST", "db")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_DB}"

engine = create_engine(DATABASE_URL, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ORM Models

class TalentProfile(Base):
    __tablename__ = 'talent_profiles'

    id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(255), unique=True, nullable=False)
    stack_layer = Column(String(100), nullable=False)
    category = Column(String(100), nullable=False)
    engagement_tier = Column(String(100), nullable=False)
    role_summary = Column(Text, nullable=False)
    red_flags = Column(Text, nullable=False)
    offerings = Column(Text, nullable=True)
    is_open = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assessments = relationship("Assessment", back_populates="profile", cascade="all, delete-orphan")


class Candidate(Base):
    __tablename__ = 'candidates'

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    linkedin_url = Column(String(255), nullable=True)
    cv_raw_text = Column(Text, nullable=True)
    skills = Column(ARRAY(String), default=[], server_default='{}')
    experience_years = Column(Integer, nullable=True)
    is_blacklisted = Column(Boolean, default=False)
    contact_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    assigned_project_id = Column(Integer, ForeignKey('projects.id', ondelete='SET NULL'), nullable=True)
    assigned_profile_id = Column(Integer, ForeignKey('talent_profiles.id', ondelete='SET NULL'), nullable=True)
    assignment_start_date = Column(Date, nullable=True)
    assignment_end_date = Column(Date, nullable=True)
    country_of_residence = Column(String(100), nullable=True)
    nationality = Column(String(100), nullable=True)
    is_new_candidate = Column(Boolean, default=True, server_default='true')
    created_at = Column(DateTime, default=datetime.utcnow)

    assessments = relationship("Assessment", back_populates="candidate", cascade="all, delete-orphan")
    assigned_project = relationship("Project", foreign_keys=[assigned_project_id])
    assigned_profile = relationship("TalentProfile", foreign_keys=[assigned_profile_id])
    candidate_assignments = relationship("CandidateAssignment", back_populates="candidate", cascade="all, delete-orphan")


class CandidateAssignment(Base):
    __tablename__ = 'candidate_assignments'

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    profile_id = Column(Integer, ForeignKey('talent_profiles.id', ondelete='SET NULL'), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="candidate_assignments")
    project = relationship("Project", foreign_keys=[project_id])
    profile = relationship("TalentProfile", foreign_keys=[profile_id])


class Assessment(Base):
    __tablename__ = 'assessments'

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False)
    profile_id = Column(Integer, ForeignKey('talent_profiles.id', ondelete='CASCADE'), nullable=False)
    match_score = Column(Integer, nullable=False)
    skills_match = Column(ARRAY(String), default=[], server_default='{}')
    skills_gap = Column(ARRAY(String), default=[], server_default='{}')
    red_flags_detected = Column(ARRAY(String), default=[], server_default='{}')
    ai_verdict = Column(Text, nullable=True)
    is_disqualified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="assessments")
    profile = relationship("TalentProfile", back_populates="assessments")


class Project(Base):
    __tablename__ = 'projects'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    sow_text = Column(Text, nullable=True)
    sow_filename = Column(String(255), nullable=True)
    analysis_results = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# DB Session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
