import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel

from database import get_db, User, UserPreference, Resume, ScrapedJob, JobApplication
from routers.auth import get_current_user_dep
from services.tailor_service import TailorService

router = APIRouter(prefix="/applications", tags=["applications"])
tailor = TailorService()


# ── Schemas ───────────────────────────────────────────────────────────────────

class PrepareRequest(BaseModel):
    scraped_job_id: int

class UpdateEmailRequest(BaseModel):
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    recipient_email: Optional[str] = None

class SendRequest(BaseModel):
    recipient_email: str

class SmtpSettingsRequest(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_user: str
    smtp_password: str
    sender_email: str
    sender_name: str

class JobApplicationOut(BaseModel):
    id: int
    scraped_job_id: int
    tailored_content: Optional[dict] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    recipient_email: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SmtpSettingsOut(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None
    configured: bool = False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _send_email_smtp(
    smtp_host: str, smtp_port: int, smtp_user: str, smtp_password: str,
    from_email: str, from_name: str, to_email: str,
    subject: str, body: str,
):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
        server.ehlo()
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(from_email, to_email, msg.as_string())


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/prepare", response_model=JobApplicationOut)
async def prepare_application(
    req: PrepareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Tailor resume + generate email for a specific scraped job. Returns a draft application."""
    job = db.query(ScrapedJob).filter(ScrapedJob.id == req.scraped_job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    resume = (
        db.query(Resume)
        .filter(Resume.user_id == current_user.id, Resume.is_active == True)
        .order_by(Resume.created_at.desc())
        .first()
    )
    if not resume:
        raise HTTPException(status_code=400, detail="Please upload a resume first")

    resume_summary = {
        "industry": resume.industry or "",
        "seniority_level": resume.seniority_level or "",
        "years_experience": resume.years_experience or 0,
        "key_skills": resume.key_skills or [],
        "summary": resume.summary or "",
    }

    # Run AI tailoring (can take 10-20s)
    tailored = tailor.tailor_resume(
        resume_raw_text=resume.raw_text,
        job_title=job.title,
        company_name=job.company_name,
        job_description=job.description or "",
        job_requirements=job.requirements or "",
    )
    email = tailor.generate_email(
        user_name=current_user.name,
        resume_summary=resume_summary,
        job_title=job.title,
        company_name=job.company_name,
        job_description=job.description or "",
        job_requirements=job.requirements or "",
    )

    app = JobApplication(
        user_id=current_user.id,
        scraped_job_id=job.id,
        tailored_content=tailored,
        email_subject=email["subject"],
        email_body=email["body"],
        status="draft",
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


@router.patch("/{app_id}/email", response_model=JobApplicationOut)
async def update_email(
    app_id: int,
    req: UpdateEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    app = db.query(JobApplication).filter(
        JobApplication.id == app_id, JobApplication.user_id == current_user.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if req.email_subject is not None:
        app.email_subject = req.email_subject
    if req.email_body is not None:
        app.email_body = req.email_body
    if req.recipient_email is not None:
        app.recipient_email = req.recipient_email
    db.commit()
    db.refresh(app)
    return app


@router.post("/{app_id}/send", response_model=JobApplicationOut)
async def send_application(
    app_id: int,
    req: SendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Send the application email via user's configured SMTP."""
    app = db.query(JobApplication).filter(
        JobApplication.id == app_id, JobApplication.user_id == current_user.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    prefs = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not prefs or not prefs.smtp_host or not prefs.smtp_user or not prefs.smtp_password:
        raise HTTPException(status_code=400, detail="Email SMTP not configured")

    try:
        _send_email_smtp(
            smtp_host=prefs.smtp_host,
            smtp_port=prefs.smtp_port or 587,
            smtp_user=prefs.smtp_user,
            smtp_password=prefs.smtp_password,
            from_email=prefs.sender_email or prefs.smtp_user,
            from_name=prefs.sender_name or current_user.name,
            to_email=req.recipient_email,
            subject=app.email_subject or "",
            body=app.email_body or "",
        )
        app.status = "sent"
        app.recipient_email = req.recipient_email
        app.sent_at = datetime.now(timezone.utc)
        app.error_message = None
    except Exception as e:
        app.status = "failed"
        app.error_message = str(e)[:300]
        db.commit()
        raise HTTPException(status_code=502, detail=f"Email send failed: {str(e)[:200]}")

    db.commit()
    db.refresh(app)
    return app


@router.get("", response_model=list[JobApplicationOut])
async def list_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    return (
        db.query(JobApplication)
        .filter(JobApplication.user_id == current_user.id)
        .order_by(JobApplication.created_at.desc())
        .all()
    )


# ── SMTP settings ──────────────────────────────────────────────────────────────

@router.put("/settings/email")
async def save_smtp_settings(
    req: SmtpSettingsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    prefs = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreference(user_id=current_user.id)
        db.add(prefs)
    prefs.smtp_host = req.smtp_host
    prefs.smtp_port = req.smtp_port
    prefs.smtp_user = req.smtp_user
    prefs.smtp_password = req.smtp_password
    prefs.sender_email = req.sender_email
    prefs.sender_name = req.sender_name
    db.commit()
    return {"ok": True}


@router.get("/settings/email", response_model=SmtpSettingsOut)
async def get_smtp_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    prefs = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not prefs or not prefs.smtp_host:
        return SmtpSettingsOut(configured=False)
    return SmtpSettingsOut(
        smtp_host=prefs.smtp_host,
        smtp_port=prefs.smtp_port,
        smtp_user=prefs.smtp_user,
        sender_email=prefs.sender_email,
        sender_name=prefs.sender_name,
        configured=True,
    )
