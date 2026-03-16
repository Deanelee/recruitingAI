import json
import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db, User, UserPreference, Resume
from models.schemas import (
    OnboardingChatRequest,
    OnboardingChatResponse,
    UserPreferences,
    ChatProgress,
    CompanyListResponse,
    CompanyRecommendation,
)
from services.claude_service import ClaudeService
from routers.auth import get_current_user_dep

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

claude_service = ClaudeService()


def extract_preferences(text: str) -> Optional[dict]:
    pattern = r"<preferences>\s*([\s\S]*?)\s*</preferences>"
    match = re.search(pattern, text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            return None
    return None


def extract_progress(text: str) -> Optional[ChatProgress]:
    pattern = r"<progress>\s*([\s\S]*?)\s*</progress>"
    match = re.search(pattern, text)
    if match:
        try:
            data = json.loads(match.group(1).strip())
            return ChatProgress(
                collected=data.get("collected", []),
                pending=data.get("pending", []),
                current_topic=data.get("current_topic"),
            )
        except (json.JSONDecodeError, Exception):
            return None
    return None


def clean_message(text: str) -> str:
    cleaned = re.sub(r"<preferences>[\s\S]*?</preferences>", "", text)
    cleaned = re.sub(r"<progress>[\s\S]*?</progress>", "", cleaned)
    return cleaned.strip()


@router.post("/chat", response_model=OnboardingChatResponse)
async def onboarding_chat(
    request: OnboardingChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_dep),
):
    resume_summary = None
    if current_user:
        latest_resume = (
            db.query(Resume)
            .filter(Resume.user_id == current_user.id, Resume.is_active == True)
            .order_by(Resume.created_at.desc())
            .first()
        )
        if latest_resume:
            resume_summary = {
                "industry": latest_resume.industry,
                "current_location": latest_resume.current_location or "",
                "seniority_level": latest_resume.seniority_level,
                "years_experience": latest_resume.years_experience,
                "resume_quality_score": latest_resume.resume_quality_score or 5,
                "key_skills": latest_resume.key_skills or [],
                "summary": latest_resume.summary,
            }

    messages_dicts = [
        {"role": msg.role, "content": msg.content}
        for msg in request.messages
    ]

    try:
        raw_response = claude_service.chat_onboarding(messages_dicts, resume_summary)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get AI response: {str(e)}"
        )

    preferences_data = extract_preferences(raw_response)
    progress = extract_progress(raw_response)
    clean_response = clean_message(raw_response)

    preferences_complete = preferences_data is not None
    preferences_obj = None

    if preferences_data and current_user:
        try:
            preferences_obj = UserPreferences(
                target_cities=preferences_data.get("target_cities", []),
                salary_min=preferences_data.get("salary_min"),
                salary_max=preferences_data.get("salary_max"),
                work_type=preferences_data.get("work_type"),
                blacklist_companies=preferences_data.get("blacklist_companies", []),
                blacklist_industries=preferences_data.get("blacklist_industries", []),
                extra_notes=preferences_data.get("extra_notes"),
            )

            existing_pref = (
                db.query(UserPreference)
                .filter(UserPreference.user_id == current_user.id)
                .first()
            )

            if existing_pref:
                existing_pref.target_cities = preferences_obj.target_cities
                existing_pref.salary_min = preferences_obj.salary_min
                existing_pref.salary_max = preferences_obj.salary_max
                existing_pref.work_type = preferences_obj.work_type
                existing_pref.blacklist_companies = preferences_obj.blacklist_companies
                existing_pref.blacklist_industries = preferences_obj.blacklist_industries
                existing_pref.extra_notes = preferences_obj.extra_notes
            else:
                new_pref = UserPreference(
                    user_id=current_user.id,
                    target_cities=preferences_obj.target_cities,
                    salary_min=preferences_obj.salary_min,
                    salary_max=preferences_obj.salary_max,
                    work_type=preferences_obj.work_type,
                    blacklist_companies=preferences_obj.blacklist_companies,
                    blacklist_industries=preferences_obj.blacklist_industries,
                    extra_notes=preferences_obj.extra_notes,
                )
                db.add(new_pref)

            db.commit()

        except Exception:
            preferences_complete = False
            preferences_obj = None

    return OnboardingChatResponse(
        message=clean_response,
        preferences_complete=preferences_complete,
        preferences=preferences_obj,
        session_id=request.session_id,
        progress=progress,
    )


@router.get("/companies", response_model=CompanyListResponse)
async def get_company_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    latest_resume = (
        db.query(Resume)
        .filter(Resume.user_id == current_user.id, Resume.is_active == True)
        .order_by(Resume.created_at.desc())
        .first()
    )
    if not latest_resume:
        raise HTTPException(status_code=404, detail="No resume found")

    preferences = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == current_user.id)
        .first()
    )

    resume_summary = {
        "industry": latest_resume.industry,
        "seniority_level": latest_resume.seniority_level,
        "years_experience": latest_resume.years_experience,
        "key_skills": latest_resume.key_skills or [],
        "resume_quality_score": latest_resume.resume_quality_score or 5,
        "summary": latest_resume.summary,
    }

    prefs_dict = {}
    if preferences:
        prefs_dict = {
            "target_cities": preferences.target_cities or [],
            "salary_min": preferences.salary_min,
            "salary_max": preferences.salary_max,
            "blacklist_companies": preferences.blacklist_companies or [],
            "blacklist_industries": preferences.blacklist_industries or [],
            "extra_notes": preferences.extra_notes or "",
        }

    try:
        raw_companies = claude_service.generate_company_list(resume_summary, prefs_dict)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate company list: {str(e)}"
        )

    companies = []
    for c in raw_companies:
        try:
            companies.append(CompanyRecommendation(
                name=c.get("name", ""),
                industry=c.get("industry", ""),
                size=c.get("size", ""),
                stage=c.get("stage", ""),
                city=c.get("city", ""),
                careers_url=c.get("careers_url", ""),
                prospect_score=float(c.get("prospect_score", 5)),
                prospect_reason=c.get("prospect_reason", ""),
                match_reason=c.get("match_reason", ""),
            ))
        except Exception:
            continue

    return CompanyListResponse(companies=companies, total=len(companies))
