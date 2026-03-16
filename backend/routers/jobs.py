from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel

from database import get_db, User, Resume, UserPreference, ScanTask, ScrapedJob, JobMatch
from routers.auth import get_current_user_dep
from services.scraper_service import ScraperService
from services.matching_service import MatchingService

router = APIRouter(prefix="/jobs", tags=["jobs"])

scraper = ScraperService()
matcher = MatchingService()


# ── Schemas ──────────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    companies: List[dict]   # [{name, careers_url, stage}]


class ScanTaskOut(BaseModel):
    id: int
    company_name: str
    careers_url: str
    status: str
    jobs_found: int
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class JobOut(BaseModel):
    id: int
    company_name: str
    company_stage: Optional[str]
    title: str
    location: Optional[str]
    description: Optional[str]
    requirements: Optional[str]
    salary_range: Optional[str]
    job_url: Optional[str]
    match_score: Optional[float] = None
    match_reasons: Optional[List[str]] = None
    gap_reasons: Optional[List[str]] = None
    recommendation: Optional[str] = None
    match_status: Optional[str] = None

    class Config:
        from_attributes = True


# ── Background task ───────────────────────────────────────────────────────────

def _run_scan(task_id: int, company_name: str, careers_url: str, company_stage: str,
              user_id: int, db_url: str):
    """Run in background: scrape → match → save."""
    from database import SessionLocal, Resume, UserPreference
    db = SessionLocal()
    try:
        task = db.query(ScanTask).filter(ScanTask.id == task_id).first()
        if not task:
            return

        task.status = "scanning"
        task.started_at = datetime.now(timezone.utc)
        db.commit()

        # Get resume + preferences for matching
        resume = db.query(Resume).filter(Resume.user_id == user_id, Resume.is_active == True).order_by(Resume.created_at.desc()).first()
        prefs = db.query(UserPreference).filter(UserPreference.user_id == user_id).first()

        resume_summary = {}
        preferences = {}
        if resume:
            resume_summary = {
                "industry": resume.industry or "",
                "seniority_level": resume.seniority_level or "",
                "years_experience": resume.years_experience or 0,
                "key_skills": resume.key_skills or [],
                "summary": resume.summary or "",
            }
        if prefs:
            preferences = {
                "target_cities": prefs.target_cities or [],
                "salary_min": prefs.salary_min,
                "salary_max": prefs.salary_max,
                "extra_notes": prefs.extra_notes or "",
            }

        # Scrape
        jobs_data = scraper.scrape_company(company_name, careers_url, company_stage)

        # Save scraped jobs + compute match scores
        saved_count = 0
        for job_data in jobs_data:
            # Persist scraped job
            scraped = ScrapedJob(
                user_id=user_id,
                scan_task_id=task_id,
                company_name=job_data.get("company_name", company_name),
                company_stage=job_data.get("company_stage", company_stage),
                title=job_data.get("title", ""),
                location=job_data.get("location", ""),
                description=job_data.get("description", ""),
                requirements=job_data.get("requirements", ""),
                salary_range=job_data.get("salary_range", ""),
                job_url=job_data.get("job_url", ""),
            )
            db.add(scraped)
            db.flush()

            # Match score
            try:
                score_data = matcher.match_job(job_data, resume_summary, preferences)
                match = JobMatch(
                    user_id=user_id,
                    job_id=scraped.id,
                    match_score=score_data["match_score"],
                    match_reasons=score_data["match_reasons"],
                    gap_reasons=score_data["gap_reasons"],
                    status="new",
                )
                db.add(match)
            except Exception:
                pass

            saved_count += 1

        task.status = "done"
        task.jobs_found = saved_count
        task.completed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as e:
        db.rollback()
        task = db.query(ScanTask).filter(ScanTask.id == task_id).first()
        if task:
            task.status = "failed"
            task.error_message = str(e)[:500]
            task.completed_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/scan", response_model=List[ScanTaskOut])
async def start_scan(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Trigger background scraping for a list of companies."""
    from database import DATABASE_URL
    tasks_out = []
    for company in request.companies:
        name = company.get("name", "")
        url = company.get("careers_url", "")
        stage = company.get("stage", "")
        if not url:
            continue

        task = ScanTask(
            user_id=current_user.id,
            company_name=name,
            careers_url=url,
            status="pending",
        )
        db.add(task)
        db.flush()
        tasks_out.append(task)

        background_tasks.add_task(
            _run_scan,
            task_id=task.id,
            company_name=name,
            careers_url=url,
            company_stage=stage,
            user_id=current_user.id,
            db_url=DATABASE_URL,
        )

    db.commit()
    for t in tasks_out:
        db.refresh(t)
    return tasks_out


@router.post("/scan/single")
async def scan_single(
    background_tasks: BackgroundTasks,
    company_name: str,
    careers_url: str,
    company_stage: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Trigger scan for one company (used by the Scan button in onboarding)."""
    from database import DATABASE_URL
    task = ScanTask(
        user_id=current_user.id,
        company_name=company_name,
        careers_url=careers_url,
        status="pending",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    background_tasks.add_task(
        _run_scan,
        task_id=task.id,
        company_name=company_name,
        careers_url=careers_url,
        company_stage=company_stage,
        user_id=current_user.id,
        db_url=DATABASE_URL,
    )
    return {"task_id": task.id, "status": "pending"}


@router.get("/scan/status", response_model=List[ScanTaskOut])
async def get_scan_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    tasks = db.query(ScanTask).filter(ScanTask.user_id == current_user.id).order_by(ScanTask.created_at.desc()).limit(50).all()
    return tasks


@router.get("/matches", response_model=List[JobOut])
async def get_matches(
    min_score: float = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Return all matched jobs for current user, sorted by score."""
    rows = (
        db.query(JobMatch, ScrapedJob)
        .join(ScrapedJob, JobMatch.job_id == ScrapedJob.id)
        .filter(JobMatch.user_id == current_user.id, JobMatch.match_score >= min_score)
        .order_by(JobMatch.match_score.desc())
        .all()
    )

    result = []
    for match, job in rows:
        result.append(JobOut(
            id=job.id,
            company_name=job.company_name,
            company_stage=job.company_stage,
            title=job.title,
            location=job.location,
            description=job.description,
            requirements=job.requirements,
            salary_range=job.salary_range,
            job_url=job.job_url,
            match_score=match.match_score,
            match_reasons=match.match_reasons,
            gap_reasons=match.gap_reasons,
            recommendation=None,
            match_status=match.status,
        ))
    return result


@router.patch("/matches/{match_id}/status")
async def update_match_status(
    match_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    match = db.query(JobMatch).filter(JobMatch.id == match_id, JobMatch.user_id == current_user.id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Not found")
    match.status = status
    db.commit()
    return {"ok": True}
