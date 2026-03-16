from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.sql import func
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./recruiting_agent.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    resumes = relationship("Resume", back_populates="user")
    preferences = relationship("UserPreference", back_populates="user", uselist=False)
    applications = relationship("Application", back_populates="user")


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    raw_text = Column(Text, nullable=False)
    industry = Column(String)
    current_location = Column(String)
    seniority_level = Column(String)
    resume_quality_score = Column(Float)
    score_breakdown = Column(JSON)
    key_skills = Column(JSON)
    years_experience = Column(Float)
    summary = Column(Text)
    strengths = Column(JSON)
    weaknesses = Column(JSON)
    suggestions = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="resumes")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    target_cities = Column(JSON, default=[])
    salary_min = Column(Integer)
    salary_max = Column(Integer)
    work_type = Column(String)
    blacklist_companies = Column(JSON, default=[])
    blacklist_industries = Column(JSON, default=[])
    extra_notes = Column(Text)
    # SMTP settings for email sending
    smtp_host = Column(String)
    smtp_port = Column(Integer, default=587)
    smtp_user = Column(String)
    smtp_password = Column(String)
    sender_email = Column(String)
    sender_name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="preferences")


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    industry = Column(String)
    size = Column(String)
    location = Column(String)
    website = Column(String)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    jobs = relationship("Job", back_populates="company")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    requirements = Column(Text)
    location = Column(String)
    salary_min = Column(Integer)
    salary_max = Column(Integer)
    work_type = Column(String)
    is_active = Column(Boolean, default=True)
    posted_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="jobs")
    applications = relationship("Application", back_populates="job")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    status = Column(String, default="pending")
    cover_letter = Column(Text)
    customized_resume = Column(Text)
    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="applications")
    job = relationship("Job", back_populates="applications")


class ScanTask(Base):
    __tablename__ = "scan_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_name = Column(String, nullable=False)
    careers_url = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending / scanning / done / failed
    jobs_found = Column(Integer, default=0)
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ScrapedJob(Base):
    __tablename__ = "scraped_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    scan_task_id = Column(Integer, ForeignKey("scan_tasks.id"))
    company_name = Column(String, nullable=False)
    company_stage = Column(String)
    title = Column(String, nullable=False)
    location = Column(String)
    description = Column(Text)
    requirements = Column(Text)
    salary_range = Column(String)
    job_url = Column(String)
    is_active = Column(Boolean, default=True)
    scraped_at = Column(DateTime(timezone=True), server_default=func.now())


class JobMatch(Base):
    __tablename__ = "job_matches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("scraped_jobs.id"), nullable=False)
    match_score = Column(Float)           # 0-100
    match_reasons = Column(JSON)          # list of strings
    gap_reasons = Column(JSON)            # list of strings
    status = Column(String, default="new")  # new / viewed / applied / ignored
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("ScrapedJob")


class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    scraped_job_id = Column(Integer, ForeignKey("scraped_jobs.id"), nullable=False)
    # AI-generated tailoring content
    tailored_content = Column(JSON)   # full dict from TailorService.tailor_resume
    email_subject = Column(String)
    email_body = Column(Text)
    # Sending
    recipient_email = Column(String)
    status = Column(String, default="draft")  # draft / sent / failed
    error_message = Column(Text)
    sent_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    scraped_job = relationship("ScrapedJob")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
    # Migrate: add SMTP columns to user_preferences if missing
    _migrate_smtp_columns()


def _migrate_smtp_columns():
    """Add SMTP columns to user_preferences if they don't exist (SQLite only)."""
    if not DATABASE_URL.startswith("sqlite"):
        return  # PostgreSQL: create_all() handles this on fresh DB
    new_cols = [
        ("smtp_host", "VARCHAR"),
        ("smtp_port", "INTEGER DEFAULT 587"),
        ("smtp_user", "VARCHAR"),
        ("smtp_password", "VARCHAR"),
        ("sender_email", "VARCHAR"),
        ("sender_name", "VARCHAR"),
    ]
    with engine.connect() as conn:
        try:
            from sqlalchemy import text
            result = conn.execute(text("PRAGMA table_info(user_preferences)"))
            existing = {row[1] for row in result.fetchall()}
            for col_name, col_type in new_cols:
                if col_name not in existing:
                    conn.execute(text(f"ALTER TABLE user_preferences ADD COLUMN {col_name} {col_type}"))
            conn.commit()
        except Exception:
            pass
