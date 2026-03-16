"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Loader2, CheckCircle2, MessageSquare,
  Eye, EyeOff, Building2, MapPin, TrendingUp, ExternalLink,
  Scan, Sparkles, AlertCircle, Lightbulb, Star, Upload
} from "lucide-react";
import ResumeUpload from "@/components/resume/ResumeUpload";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import {
  ResumeUploadResponse,
  OnboardingMessage,
  UserPreferences,
  ChatProgress,
  CompanyRecommendation,
  sendOnboardingMessage,
  getCompanyRecommendations,
  scanSingle,
  startScan,
  registerUser,
  loginUser,
} from "@/lib/api";

type Step = "auth" | "upload" | "analysis" | "chat";

const TOPIC_LABELS: Record<string, string> = {
  target_cities: "目标城市",
  salary: "薪资期望",
  work_type: "工作方式",
  blacklist_companies: "屏蔽公司",
  blacklist_industries: "屏蔽行业",
  extra_notes: "其他需求",
};

const ALL_TOPICS = ["target_cities", "salary", "work_type", "blacklist_companies", "blacklist_industries", "extra_notes"];

const SCORE_LABELS: Record<string, string> = {
  experience: "工作经历",
  skills: "技能匹配",
  achievements: "量化成果",
  presentation: "表达规范",
};

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function ScoreRing({ score }: { score: number }) {
  const pct = score / 10;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = score >= 8 ? "#10B981" : score >= 6 ? "#4B6FF0" : "#F59E0B";

  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#F0F0F4" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-text-primary">{score.toFixed(1)}</div>
        <div className="text-xs text-text-muted">/ 10</div>
      </div>
    </div>
  );
}

function MiniBar({ score, label }: { score: number; label: string }) {
  const color = score >= 8 ? "bg-emerald-400" : score >= 6 ? "bg-accent" : "bg-amber-400";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="font-medium text-text-primary">{score.toFixed(0)}</span>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${score * 10}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
      </div>
    </div>
  );
}

function ProspectBar({ score }: { score: number }) {
  const color = score >= 8 ? "bg-emerald-400" : score >= 6 ? "bg-accent" : "bg-amber-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score * 10}%` }} />
      </div>
      <span className="text-xs font-medium text-text-secondary w-6 text-right">{score}</span>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("auth");
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resumeData, setResumeData] = useState<ResumeUploadResponse | null>(null);
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preferencesComplete, setPreferencesComplete] = useState(false);
  const [savedPreferences, setSavedPreferences] = useState<UserPreferences | null>(null);
  const [progress, setProgress] = useState<ChatProgress | null>(null);
  const [sessionId] = useState(generateSessionId);
  const [companies, setCompanies] = useState<CompanyRecommendation[] | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [companiesRequested, setCompaniesRequested] = useState(false);
  const [scanningCompany, setScanningCompany] = useState<string | null>(null);
  const [scannedCompanies, setScannedCompanies] = useState<Set<string>>(new Set());
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanningAll, setScanningAll] = useState(false);
  const [showReuploadConfirm, setShowReuploadConfirm] = useState(false);
  const [showExtraInput, setShowExtraInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" && localStorage.getItem("auth_token");
    if (!token) return;
    // Verify token is still valid
    fetch("http://localhost:8000/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      if (res.ok) {
        setStep("upload");
      } else {
        localStorage.removeItem("auth_token");
      }
    }).catch(() => {
      localStorage.removeItem("auth_token");
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const data = await getCompanyRecommendations();
      setCompanies(data.companies);
    } catch {
      // user can retry
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      if (authMode === "register") {
        await registerUser(authForm.email, authForm.password, authForm.name);
      }
      const data = await loginUser(authForm.email, authForm.password);
      localStorage.setItem("auth_token", data.access_token);
      setStep("upload");
    } catch (err: any) {
      const msg = err?.response?.data?.detail;
      if (msg === "Email already registered") setAuthError("该邮箱已注册，请直接登录");
      else if (msg === "Invalid credentials") setAuthError("邮箱或密码错误");
      else setAuthError("操作失败，请稍后重试");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResumeUploadSuccess = async (data: ResumeUploadResponse) => {
    setResumeData(data);
    // Go to analysis step immediately
    setTimeout(() => setStep("analysis"), 600);
  };

  const handleProceedToChat = async () => {
    setStep("chat");
    setIsTyping(true);
    try {
      const response = await sendOnboardingMessage([], sessionId);
      setMessages([{ role: "assistant", content: response.message }]);
      if (response.progress) setProgress(response.progress);
    } catch {
      setMessages([{ role: "assistant", content: "您好！已分析了您的简历。请问您希望在哪些城市工作呢？" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: OnboardingMessage = { role: "user", content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsTyping(true);
    try {
      const response = await sendOnboardingMessage(newMessages, sessionId);
      setMessages([...newMessages, { role: "assistant", content: response.message }]);
      if (response.progress) setProgress(response.progress);
      if (response.preferences_complete && response.preferences) {
        setPreferencesComplete(true);
        setSavedPreferences(response.preferences);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "抱歉，遇到了一些问题，请稍后再试。" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleStartScan = async (careersUrl: string, companyName: string, stage: string) => {
    if (!careersUrl || scannedCompanies.has(companyName)) return;
    setScanningCompany(companyName);
    setScanError(null);
    try {
      await scanSingle(companyName, careersUrl, stage);
      setScannedCompanies((prev) => new Set([...prev, companyName]));
    } catch {
      setScanError(`${companyName} 扫描触发失败，请稍后重试`);
    } finally {
      setScanningCompany(null);
    }
  };

  const handleScanAll = async () => {
    if (!companies || scanningAll) return;
    setScanningAll(true);
    setScanError(null);
    const unscanned = companies.filter((c) => c.careers_url && !scannedCompanies.has(c.name));
    try {
      if (unscanned.length > 0) {
        await startScan(unscanned.map((c) => ({ name: c.name, careers_url: c.careers_url, stage: c.stage })));
        setScannedCompanies(new Set(companies.map((c) => c.name)));
      }
      router.push("/dashboard");
    } catch {
      setScanError("部分公司扫描触发失败，请前往看板重试");
      router.push("/dashboard");
    } finally {
      setScanningAll(false);
    }
  };

  const steps = [
    { key: "auth", label: "创建账号" },
    { key: "upload", label: "上传简历" },
    { key: "analysis", label: "简历分析" },
    { key: "chat", label: "设置偏好" },
  ];
  const currentStepIndex = steps.findIndex((s) => s.key === step);
  const collectedTopics = progress?.collected ?? [];
  const allCollected = collectedTopics.length >= ALL_TOPICS.length;
  const isComplete = preferencesComplete || allCollected;
  const progressPct = isComplete ? 100 : Math.round((collectedTopics.length / ALL_TOPICS.length) * 100);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Step indicator */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-2 mb-5">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2 flex-1 last:flex-none">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 flex-shrink-0 ${
                  i < currentStepIndex
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : i === currentStepIndex
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-text-muted border border-border"
                }`}>
                  {i < currentStepIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-sm font-medium transition-colors whitespace-nowrap ${
                  i === currentStepIndex ? "text-text-primary" : "text-text-muted"
                }`}>{s.label}</span>
                {i < steps.length - 1 && <div className="flex-1 h-px bg-border mx-1" />}
              </div>
            ))}
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            {step === "auth" ? (authMode === "register" ? "创建你的账号" : "欢迎回来")
              : step === "upload" ? "上传你的简历"
              : step === "analysis" ? "简历分析报告"
              : "告诉我你的求职偏好"}
          </h1>
          <p className="text-text-secondary text-sm mt-1.5">
            {step === "auth" ? "开始你的智能求职之旅"
              : step === "upload" ? "支持 PDF / Word 格式，AI 将自动分析你的技能和经验"
              : step === "analysis" ? "AI 已完成简历评估，查看你的优势和改进建议"
              : "AI 将根据你的偏好，为你精准匹配最合适的职位"}
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* Auth */}
          {step === "auth" && (
            <motion.div key="auth" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
                <form onSubmit={handleAuth} className="space-y-4">
                  {authMode === "register" && (
                    <div>
                      <label className="block text-sm text-text-secondary mb-1.5">姓名</label>
                      <input type="text" required value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="你的姓名" className="input-field" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">邮箱</label>
                    <input type="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="your@email.com" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">密码</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} required value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="至少6位" minLength={6} className="input-field pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {authError && <p className="text-red-500 text-sm">{authError}</p>}
                  <button type="submit" disabled={authLoading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
                    {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : authMode === "register" ? "创建账号" : "登录"}
                    {!authLoading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>
                <div className="mt-4 text-center">
                  <button onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setAuthError(""); }} className="text-sm text-text-muted hover:text-accent transition-colors">
                    {authMode === "register" ? "已有账号？直接登录" : "没有账号？注册一个"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Upload */}
          {step === "upload" && (
            <motion.div key="upload" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <ResumeUpload onUploadSuccess={handleResumeUploadSuccess} />
            </motion.div>
          )}

          {/* Analysis */}
          {step === "analysis" && resumeData && (
            <motion.div key="analysis" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }} className="space-y-4">
              {/* Score card */}
              <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
                <div className="flex items-start gap-6">
                  <ScoreRing score={resumeData.analysis.resume_quality_score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-semibold text-text-primary">{resumeData.analysis.industry}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{resumeData.analysis.seniority_level}</span>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed mb-3">{resumeData.analysis.summary}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {resumeData.analysis.key_skills.slice(0, 6).map((skill) => (
                        <span key={skill} className="text-xs px-2 py-0.5 rounded-md bg-surface-2 text-text-secondary border border-border">{skill}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Score breakdown */}
                {resumeData.analysis.score_breakdown && (
                  <div className="mt-5 pt-5 border-t border-border grid grid-cols-2 gap-3">
                    {Object.entries(resumeData.analysis.score_breakdown).map(([key, val]) => (
                      <MiniBar key={key} score={val} label={SCORE_LABELS[key] ?? key} />
                    ))}
                  </div>
                )}
              </div>

              {/* Strengths */}
              {resumeData.analysis.strengths.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white border border-border rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Star className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <span className="text-sm font-semibold text-text-primary">简历亮点</span>
                  </div>
                  <ul className="space-y-2">
                    {resumeData.analysis.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* Weaknesses */}
              {resumeData.analysis.weaknesses.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="bg-white border border-border rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <span className="text-sm font-semibold text-text-primary">待改进项</span>
                  </div>
                  <ul className="space-y-2">
                    {resumeData.analysis.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400 font-bold text-xs flex items-center justify-center">!</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* Suggestions */}
              {resumeData.analysis.suggestions.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }} className="bg-white border border-border rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Lightbulb className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <span className="text-sm font-semibold text-text-primary">AI 优化建议</span>
                  </div>
                  <ul className="space-y-2">
                    {resumeData.analysis.suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <Sparkles className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="pt-1 space-y-2">
                {/* Option 1: AI rewrites resume */}
                <button
                  onClick={() => alert("AI 修改简历功能即将上线")}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-border rounded-xl hover:border-accent/40 hover:bg-accent/5 transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">AI 帮我修改简历</p>
                    <p className="text-xs text-text-muted mt-0.5">根据建议自动优化，生成新版本</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors flex-shrink-0" />
                </button>

                {/* Option 2: Manual re-upload with confirmation */}
                <button
                  onClick={() => setShowReuploadConfirm(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-border rounded-xl hover:border-border-2 hover:bg-surface-2 transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
                    <Upload className="w-4 h-4 text-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">手动修改后重新上传</p>
                    <p className="text-xs text-text-muted mt-0.5">自行修改简历文件，重新开始分析</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-text-secondary transition-colors flex-shrink-0" />
                </button>

                {/* Option 3: Continue */}
                <button onClick={handleProceedToChat} className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-1">
                  继续设置求职偏好 <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>

              {/* Re-upload confirmation modal */}
              <AnimatePresence>
                {showReuploadConfirm && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center px-6"
                    onClick={() => setShowReuploadConfirm(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 8 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white rounded-2xl p-6 shadow-xl border border-border w-full max-w-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                      </div>
                      <h3 className="text-base font-semibold text-text-primary mb-1.5">离开当前分析？</h3>
                      <p className="text-sm text-text-secondary leading-relaxed mb-5">
                        返回上传页面后，当前的分析报告将被清除，重新上传简历后将重新生成。
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowReuploadConfirm(false)}
                          className="btn-secondary flex-1 py-2.5 text-sm"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => { setShowReuploadConfirm(false); setResumeData(null); setStep("upload"); }}
                          className="flex-1 py-2.5 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors"
                        >
                          确认离开
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Chat */}
          {step === "chat" && (
            <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="flex flex-col gap-4">
              {/* Resume badge */}
              {resumeData && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-border rounded-xl shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span className="text-text-secondary text-xs">已分析简历 · </span>
                  <span className="text-text-primary text-xs font-medium">{resumeData.analysis.industry} · {resumeData.analysis.seniority_level}</span>
                  <span className="ml-auto text-xs text-emerald-600 font-semibold">{resumeData.analysis.resume_quality_score.toFixed(1)}/10</span>
                </div>
              )}

              {/* Progress tracker */}
              <div className="bg-white border border-border rounded-xl px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-muted font-medium">偏好收集进度</span>
                  <span className={`text-xs font-semibold ${isComplete ? "text-emerald-600" : "text-accent"}`}>{isComplete ? "完成" : `${collectedTopics.length}/${ALL_TOPICS.length}`}</span>
                </div>
                <div className="h-1 bg-surface-2 rounded-full overflow-hidden mb-3">
                  <motion.div className={`h-full rounded-full ${isComplete ? "bg-emerald-500" : "bg-accent"}`} initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.5 }} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_TOPICS.map((topic) => {
                    const collected = collectedTopics.includes(topic);
                    const isCurrent = progress?.current_topic === topic;
                    return (
                      <span key={topic} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all ${
                        collected ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                          : isCurrent ? "bg-accent/10 border-accent/30 text-accent"
                          : "bg-surface-2 border-border text-text-muted"
                      }`}>
                        {collected && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {isCurrent && !collected && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse inline-block" />}
                        {TOPIC_LABELS[topic]}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Chat window */}
              <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="h-[380px] overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 && !isTyping && (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3">
                          <MessageSquare className="w-5 h-5 text-accent" />
                        </div>
                        <p className="text-text-muted text-sm">AI 正在初始化...</p>
                      </div>
                    </div>
                  )}
                  {messages.map((message, i) => (
                    <ChatMessage key={i} message={message} isLatest={i === messages.length - 1} />
                  ))}
                  {isTyping && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">R</span>
                      </div>
                      <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex gap-1 items-center h-4">
                          {[0, 1, 2].map((i) => (
                            <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-text-muted" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-border p-4">
                  {isComplete && !showExtraInput ? (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div className="flex items-center justify-center gap-1.5 text-emerald-600 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        偏好已全部收集完成
                      </div>
                      <div className="flex gap-2">
                        {!companiesRequested && (
                          <button
                            onClick={() => { setCompaniesRequested(true); fetchCompanies(); }}
                            className="btn-primary flex-1 inline-flex items-center justify-center gap-2 py-2.5"
                          >
                            <Building2 className="w-4 h-4" />
                            生成目标公司清单
                          </button>
                        )}
                        <button
                          onClick={() => setShowExtraInput(true)}
                          className="btn-secondary inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm"
                          title="继续补充需求"
                        >
                          <Lightbulb className="w-3.5 h-3.5" />
                          补充需求
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-2">
                      {showExtraInput && (
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-text-muted">继续补充求职需求</span>
                          <button onClick={() => setShowExtraInput(false)} className="text-xs text-text-muted hover:text-text-secondary transition-colors">收起</button>
                        </div>
                      )}
                      <ChatInput onSend={handleSendMessage} disabled={isTyping} placeholder={showExtraInput ? "继续补充你的需求..." : "回复 AI 的问题..."} />
                    </div>
                  )}
                </div>
              </div>

              {/* Company list */}
              <AnimatePresence>
                {companiesRequested && (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="text-base font-semibold text-text-primary">AI 推荐目标公司</h2>
                        <p className="text-xs text-text-muted mt-0.5">根据你的简历含金量和求职偏好生成</p>
                      </div>
                      {!loadingCompanies && companies && (
                        <button onClick={fetchCompanies} className="text-xs text-accent hover:underline">重新生成</button>
                      )}
                    </div>

                    {loadingCompanies ? (
                      <div className="bg-white border border-border rounded-2xl p-8 flex flex-col items-center gap-3 shadow-sm">
                        <Loader2 className="w-6 h-6 animate-spin text-accent" />
                        <p className="text-text-primary text-sm font-medium">AI 正在努力分析中，请耐心等待...</p>
                        <p className="text-text-muted text-xs">正在根据行业格局、城市分布和简历匹配度生成公司清单，预计需要 2-5 分钟</p>
                      </div>
                    ) : companies ? (
                      <div className="space-y-2">
                        {companies.map((company, i) => (
                          <motion.div key={company.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                            className="bg-white border border-border rounded-xl p-4 hover:border-accent/30 hover:shadow-sm transition-all">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Building2 className="w-4 h-4 text-accent" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-text-primary">{company.name}</span>
                                  <span className="text-xs px-1.5 py-0.5 rounded-md bg-surface-2 text-text-secondary border border-border">{company.stage}</span>
                                  <span className="text-xs text-text-muted flex items-center gap-0.5"><MapPin className="w-3 h-3" />{company.city}</span>
                                </div>
                                <p className="text-xs text-text-muted mt-0.5">{company.industry} · {company.size}</p>
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-start gap-1.5">
                                    <TrendingUp className="w-3.5 h-3.5 text-text-muted flex-shrink-0 mt-0.5" />
                                    <span className="text-xs text-text-secondary">{company.prospect_reason}</span>
                                  </div>
                                  <p className="text-xs text-accent pl-5">{company.match_reason}</p>
                                </div>
                                <div className="mt-2.5">
                                  <ProspectBar score={company.prospect_score} />
                                </div>
                              </div>
                              <div className="flex flex-col gap-1.5 flex-shrink-0">
                                {company.careers_url && (
                                  <a href={company.careers_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg border border-border hover:border-accent/40 hover:bg-accent/5 transition-colors" title="查看官网">
                                    <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleStartScan(company.careers_url, company.name, company.stage)}
                                  disabled={scanningCompany === company.name || scannedCompanies.has(company.name)}
                                  className={`p-1.5 rounded-lg border transition-colors ${
                                    scannedCompanies.has(company.name)
                                      ? "border-emerald-200 bg-emerald-50 cursor-default"
                                      : "border-border hover:border-emerald-400/40 hover:bg-emerald-50 disabled:opacity-50"
                                  }`}
                                  title={scannedCompanies.has(company.name) ? "已触发扫描" : "扫描招聘页面"}
                                >
                                  {scanningCompany === company.name
                                    ? <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
                                    : scannedCompanies.has(company.name)
                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    : <Scan className="w-3.5 h-3.5 text-text-muted" />}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}

                        {scanError && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            {scanError}
                          </div>
                        )}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="pt-2 flex justify-center">
                          <button onClick={handleScanAll} disabled={scanningAll} className="btn-primary inline-flex items-center gap-2 px-8 disabled:opacity-70">
                            {scanningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                            {scanningAll ? "正在触发全部扫描..." : `进入看板，开始全部扫描`}
                            {!scanningAll && <ArrowRight className="w-4 h-4" />}
                          </button>
                        </motion.div>
                      </div>
                    ) : (
                      <div className="bg-white border border-border rounded-2xl p-6 text-center shadow-sm">
                        <p className="text-text-secondary text-sm mb-3">公司清单生成失败</p>
                        <button onClick={fetchCompanies} className="btn-secondary text-sm px-4 py-2">重试</button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
