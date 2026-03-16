import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
      }
    }
    return Promise.reject(error);
  }
);

export interface ScoreBreakdown {
  experience: number;
  skills: number;
  achievements: number;
  presentation: number;
}

export interface ResumeAnalysis {
  industry: string;
  seniority_level: string;
  resume_quality_score: number;
  score_breakdown: ScoreBreakdown | null;
  key_skills: string[];
  years_experience: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface ResumeUploadResponse {
  id: number;
  filename: string;
  analysis: ResumeAnalysis;
  message: string;
}

export interface OnboardingMessage {
  role: "user" | "assistant";
  content: string;
}

export interface UserPreferences {
  target_cities: string[];
  salary_min: number | null;
  salary_max: number | null;
  work_type: "full_time" | "remote" | "hybrid" | null;
  blacklist_companies: string[];
  blacklist_industries: string[];
  extra_notes: string | null;
}

export interface ChatProgress {
  collected: string[];
  pending: string[];
  current_topic: string | null;
}

export interface OnboardingChatResponse {
  message: string;
  preferences_complete: boolean;
  preferences: UserPreferences | null;
  session_id: string;
  progress: ChatProgress | null;
}

export interface CompanyRecommendation {
  name: string;
  industry: string;
  size: string;
  stage: string;
  city: string;
  careers_url: string;
  prospect_score: number;
  prospect_reason: string;
  match_reason: string;
}

export interface CompanyListResponse {
  companies: CompanyRecommendation[];
  total: number;
}

export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<ResumeUploadResponse>("/resume/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
}

export async function sendOnboardingMessage(
  messages: OnboardingMessage[],
  sessionId: string
): Promise<OnboardingChatResponse> {
  const response = await api.post<OnboardingChatResponse>("/onboarding/chat", {
    messages,
    session_id: sessionId,
  });

  return response.data;
}

export async function registerUser(email: string, password: string, name: string) {
  const response = await api.post("/auth/register", { email, password, name });
  return response.data;
}

export async function loginUser(email: string, password: string) {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get("/auth/me");
  return response.data;
}

export async function getCompanyRecommendations(): Promise<CompanyListResponse> {
  const response = await api.get<CompanyListResponse>("/onboarding/companies");
  return response.data;
}

// Jobs
export interface ScanTask {
  id: number;
  company_name: string;
  careers_url: string;
  status: "pending" | "scanning" | "done" | "failed";
  jobs_found: number;
  error_message: string | null;
  created_at: string;
}

export interface JobMatch {
  id: number;
  company_name: string;
  company_stage: string | null;
  title: string;
  location: string | null;
  description: string | null;
  requirements: string | null;
  salary_range: string | null;
  job_url: string | null;
  match_score: number | null;
  match_reasons: string[] | null;
  gap_reasons: string[] | null;
  recommendation: string | null;
  match_status: string | null;
}

export async function startScan(companies: { name: string; careers_url: string; stage: string }[]): Promise<ScanTask[]> {
  const response = await api.post<ScanTask[]>("/jobs/scan", { companies });
  return response.data;
}

export async function scanSingle(companyName: string, careersUrl: string, stage = ""): Promise<{ task_id: number; status: string }> {
  const response = await api.post("/jobs/scan/single", null, {
    params: { company_name: companyName, careers_url: careersUrl, company_stage: stage },
  });
  return response.data;
}

export async function getScanStatus(): Promise<ScanTask[]> {
  const response = await api.get<ScanTask[]>("/jobs/scan/status");
  return response.data;
}

export async function getJobMatches(minScore = 0): Promise<JobMatch[]> {
  const response = await api.get<JobMatch[]>("/jobs/matches", { params: { min_score: minScore } });
  return response.data;
}

// Applications
export interface TailoredContent {
  tailored_summary: string;
  key_highlights: string[];
  suggested_changes: { section: string; original: string; improved: string; reason: string }[];
  keywords_to_add: string[];
  match_tips: string;
}

export interface JobApplicationRecord {
  id: number;
  scraped_job_id: number;
  tailored_content: TailoredContent | null;
  email_subject: string | null;
  email_body: string | null;
  recipient_email: string | null;
  status: "draft" | "sent" | "failed";
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface SmtpSettings {
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  sender_email: string | null;
  sender_name: string | null;
  configured: boolean;
}

export async function prepareApplication(scrapedJobId: number): Promise<JobApplicationRecord> {
  const response = await api.post<JobApplicationRecord>("/applications/prepare", { scraped_job_id: scrapedJobId });
  return response.data;
}

export async function updateApplicationEmail(
  appId: number,
  data: { email_subject?: string; email_body?: string; recipient_email?: string }
): Promise<JobApplicationRecord> {
  const response = await api.patch<JobApplicationRecord>(`/applications/${appId}/email`, data);
  return response.data;
}

export async function sendApplication(appId: number, recipientEmail: string): Promise<JobApplicationRecord> {
  const response = await api.post<JobApplicationRecord>(`/applications/${appId}/send`, { recipient_email: recipientEmail });
  return response.data;
}

export async function listApplications(): Promise<JobApplicationRecord[]> {
  const response = await api.get<JobApplicationRecord[]>("/applications");
  return response.data;
}

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const response = await api.get<SmtpSettings>("/applications/settings/email");
  return response.data;
}

export async function saveSmtpSettings(settings: {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  sender_email: string;
  sender_name: string;
}): Promise<void> {
  await api.put("/applications/settings/email", settings);
}

export default api;
