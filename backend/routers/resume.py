from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db, Resume, User
from models.schemas import ResumeUploadResponse, ResumeAnalysis
from services.resume_parser import ResumeParser
from services.claude_service import ClaudeService
from routers.auth import get_current_user_dep

router = APIRouter(prefix="/resume", tags=["resume"])

resume_parser = ResumeParser()
claude_service = ClaudeService()

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_dep),
):
    # Validate file extension
    filename = file.filename or "resume"
    file_ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: PDF, DOCX"
        )

    # Read file content
    file_bytes = await file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB"
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty"
        )

    # Parse resume text
    try:
        raw_text = resume_parser.parse(file_bytes, filename)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse resume: {str(e)}"
        )

    # Analyze with Claude
    try:
        analysis = claude_service.analyze_resume(raw_text)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze resume: {str(e)}"
        )

    # Save to database
    resume_record = Resume(
        user_id=current_user.id,
        filename=filename,
        raw_text=raw_text,
        industry=analysis["industry"],
        current_location=analysis.get("current_location", ""),
        seniority_level=analysis["seniority_level"],
        resume_quality_score=analysis["resume_quality_score"],
        score_breakdown=analysis.get("score_breakdown"),
        key_skills=analysis["key_skills"],
        years_experience=analysis["years_experience"],
        summary=analysis["summary"],
        strengths=analysis.get("strengths", []),
        weaknesses=analysis.get("weaknesses", []),
        suggestions=analysis.get("suggestions", []),
    )
    db.add(resume_record)
    db.commit()
    db.refresh(resume_record)

    return ResumeUploadResponse(
        id=resume_record.id,
        filename=filename,
        analysis=ResumeAnalysis(**analysis),
    )


@router.get("/latest")
async def get_latest_resume(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    resume = (
        db.query(Resume)
        .filter(Resume.user_id == current_user.id, Resume.is_active == True)
        .order_by(Resume.created_at.desc())
        .first()
    )
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume found"
        )

    return {
        "id": resume.id,
        "filename": resume.filename,
        "industry": resume.industry,
        "seniority_level": resume.seniority_level,
        "resume_quality_score": resume.resume_quality_score,
        "key_skills": resume.key_skills,
        "years_experience": resume.years_experience,
        "summary": resume.summary,
        "created_at": resume.created_at,
    }
