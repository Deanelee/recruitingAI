from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal
from datetime import datetime


# Auth schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Resume schemas
class ScoreBreakdown(BaseModel):
    experience: float
    skills: float
    achievements: float
    presentation: float


class ResumeAnalysis(BaseModel):
    industry: str
    seniority_level: str
    resume_quality_score: float = Field(ge=1, le=10)
    score_breakdown: Optional[ScoreBreakdown] = None
    key_skills: List[str]
    years_experience: float
    summary: str
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)


class ResumeUploadResponse(BaseModel):
    id: int
    filename: str
    analysis: ResumeAnalysis
    message: str = "Resume uploaded and analyzed successfully"


# Onboarding schemas
class OnboardingMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class OnboardingChatRequest(BaseModel):
    messages: List[OnboardingMessage]
    session_id: str
    user_id: Optional[int] = None


class UserPreferences(BaseModel):
    target_cities: List[str] = Field(default_factory=list)
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    work_type: Optional[Literal["full_time", "remote", "hybrid"]] = None
    blacklist_companies: List[str] = Field(default_factory=list)
    blacklist_industries: List[str] = Field(default_factory=list)
    extra_notes: Optional[str] = None


class OnboardingSession(BaseModel):
    session_id: str
    messages: List[OnboardingMessage] = Field(default_factory=list)
    preferences: Optional[UserPreferences] = None
    is_complete: bool = False


class ChatProgress(BaseModel):
    collected: List[str] = Field(default_factory=list)
    pending: List[str] = Field(default_factory=list)
    current_topic: Optional[str] = None


class OnboardingChatResponse(BaseModel):
    message: str
    preferences_complete: bool = False
    preferences: Optional[UserPreferences] = None
    session_id: str
    progress: Optional[ChatProgress] = None


class CompanyRecommendation(BaseModel):
    name: str
    industry: str
    size: str
    stage: str
    city: str
    careers_url: str = ""
    prospect_score: float
    prospect_reason: str
    match_reason: str


class CompanyListResponse(BaseModel):
    companies: List[CompanyRecommendation]
    total: int
