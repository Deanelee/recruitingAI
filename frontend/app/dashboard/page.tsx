"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Building2, MapPin, Loader2,
  CheckCircle2, XCircle, Clock, Briefcase, ChevronDown,
  ChevronUp, ExternalLink, Sparkles, TrendingUp, AlertCircle,
  ScanLine, Settings, Mail,
} from "lucide-react";
import { getScanStatus, getJobMatches, ScanTask, JobMatch } from "@/lib/api";
import ApplyModal from "@/components/apply/ApplyModal";
import EmailSettingsModal from "@/components/apply/EmailSettingsModal";

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-400" : score >= 60 ? "bg-accent" : "bg-amber-400";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold text-text-primary w-7 text-right flex-shrink-0">{score}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:  { label: "等待中", cls: "bg-surface-2 text-text-muted border-border" },
    scanning: { label: "扫描中", cls: "bg-blue-50 text-blue-600 border-blue-200" },
    done:     { label: "完成",   cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
    failed:   { label: "失败",   cls: "bg-red-50 text-red-500 border-red-200" },
  };
  const { label, cls } = map[status] ?? map.pending;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls} inline-flex items-center gap-1`}>
      {status === "scanning" && <Loader2 className="w-3 h-3 animate-spin" />}
      {status === "done"     && <CheckCircle2 className="w-3 h-3" />}
      {status === "failed"   && <XCircle className="w-3 h-3" />}
      {status === "pending"  && <Clock className="w-3 h-3" />}
      {label}
    </span>
  );
}

function JobCard({ job, onApply }: { job: JobMatch; onApply: (job: JobMatch) => void }) {
  const [expanded, setExpanded] = useState(false);
  const score = job.match_score ?? 0;
  const scoreColor = score >= 80 ? "text-emerald-600" : score >= 60 ? "text-accent" : "text-amber-500";

  return (
    <motion.div
      layout
      className="bg-white border border-border rounded-xl overflow-hidden hover:border-accent/30 hover:shadow-sm transition-all"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Briefcase className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-text-primary leading-tight">{job.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-text-secondary font-medium">{job.company_name}</span>
                  {job.company_stage && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-surface-2 text-text-muted border border-border">{job.company_stage}</span>
                  )}
                  {job.location && (
                    <span className="text-xs text-text-muted flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />{job.location}
                    </span>
                  )}
                  {job.salary_range && (
                    <span className="text-xs text-emerald-600 font-medium">{job.salary_range}</span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <span className={`text-lg font-bold ${scoreColor}`}>{score}</span>
                <p className="text-xs text-text-muted">匹配分</p>
              </div>
            </div>
            <div className="mt-2">
              <ScoreBar score={score} />
            </div>
          </div>
        </div>

        {/* Match reasons preview */}
        {job.match_reasons && job.match_reasons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.match_reasons.slice(0, 2).map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full">
                <Sparkles className="w-2.5 h-2.5" />{r}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-text-muted hover:text-accent transition-colors flex items-center gap-1">
            {expanded ? <><ChevronUp className="w-3.5 h-3.5" />收起详情</> : <><ChevronDown className="w-3.5 h-3.5" />查看详情</>}
          </button>
          <div className="flex items-center gap-2">
            {job.job_url && (
              <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted hover:text-accent transition-colors flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" />原帖
              </a>
            )}
            <button onClick={() => onApply(job)} className="text-xs btn-primary py-1 px-3 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />定制投递
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-4 space-y-3 bg-surface">
              {job.description && (
                <div>
                  <p className="text-xs font-medium text-text-primary mb-1">岗位职责</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{job.description}</p>
                </div>
              )}
              {job.requirements && (
                <div>
                  <p className="text-xs font-medium text-text-primary mb-1">任职要求</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{job.requirements}</p>
                </div>
              )}
              {job.gap_reasons && job.gap_reasons.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-600 mb-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />潜在差距</p>
                  <div className="flex flex-wrap gap-1.5">
                    {job.gap_reasons.map((g, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-full">{g}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<ScanTask[]>([]);
  const [jobs, setJobs] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"matches" | "scans">("matches");
  const [minScore, setMinScore] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [applyJob, setApplyJob] = useState<JobMatch | null>(null);
  const [showEmailSettings, setShowEmailSettings] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, j] = await Promise.all([getScanStatus(), getJobMatches(minScore)]);
      setTasks(t);
      setJobs(j);
      // Keep polling if any task is still running
      setIsPolling(t.some(tk => tk.status === "scanning" || tk.status === "pending"));
    } catch {
      // not logged in — will show empty state
    } finally {
      setLoading(false);
    }
  }, [minScore]);

  useEffect(() => { load(); }, [load]);

  // Poll every 8s while tasks are running
  useEffect(() => {
    if (!isPolling) return;
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [isPolling, load]);

  const scanning = tasks.filter(t => t.status === "scanning" || t.status === "pending");
  const done = tasks.filter(t => t.status === "done");
  const failed = tasks.filter(t => t.status === "failed");
  const totalJobs = done.reduce((s, t) => s + (t.jobs_found ?? 0), 0);
  const highMatches = jobs.filter(j => (j.match_score ?? 0) >= 75).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-text-muted hover:text-text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-text-primary">求职看板</h1>
              <p className="text-xs text-text-muted mt-0.5">实时追踪岗位扫描与匹配结果</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              刷新
            </button>
            <button onClick={() => setShowEmailSettings(true)} className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5" title="邮箱配置">
              <Mail className="w-3.5 h-3.5" />
            </button>
            <Link href="/onboarding" className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              偏好设置
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "扫描公司", value: tasks.length, icon: ScanLine, color: "text-accent" },
            { label: "发现岗位", value: totalJobs, icon: Briefcase, color: "text-blue-500" },
            { label: "高匹配岗位", value: highMatches, icon: TrendingUp, color: "text-emerald-500" },
            { label: "进行中", value: scanning.length, icon: Loader2, color: "text-amber-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white border border-border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-text-muted">{label}</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{value}</p>
            </div>
          ))}
        </div>

        {/* Scanning banner */}
        <AnimatePresence>
          {scanning.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
              <p className="text-sm text-blue-700">
                正在扫描 {scanning.length} 家公司招聘页面，完成后自动刷新匹配结果...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-2 rounded-xl mb-4 w-fit">
          {[
            { key: "matches", label: `匹配岗位 ${jobs.length > 0 ? `(${jobs.length})` : ""}` },
            { key: "scans",   label: `扫描记录 ${tasks.length > 0 ? `(${tasks.length})` : ""}` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-all ${activeTab === key ? "bg-white shadow-sm text-text-primary" : "text-text-muted hover:text-text-secondary"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Matches tab */}
        {activeTab === "matches" && (
          <div>
            {/* Score filter */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-text-muted">最低匹配分：</span>
              {[0, 60, 75, 90].map(s => (
                <button key={s} onClick={() => setMinScore(s)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${minScore === s ? "bg-accent text-white border-accent" : "bg-white border-border text-text-secondary hover:border-accent/40"}`}>
                  {s === 0 ? "全部" : `${s}+`}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
                <p className="text-text-muted text-sm">加载中...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-text-muted" />
                </div>
                <div>
                  <p className="text-text-primary font-medium mb-1">暂无匹配岗位</p>
                  <p className="text-text-muted text-sm">在入职流程中选择公司后点击扫描，完成后岗位将在此展示</p>
                </div>
                <Link href="/onboarding" className="btn-primary text-sm px-6">
                  去设置偏好 →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map(job => <JobCard key={job.id} job={job} onApply={setApplyJob} />)}
              </div>
            )}
          </div>
        )}

        {/* Scans tab */}
        {activeTab === "scans" && (
          <div>
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center">
                  <ScanLine className="w-6 h-6 text-text-muted" />
                </div>
                <div>
                  <p className="text-text-primary font-medium mb-1">还没有扫描记录</p>
                  <p className="text-text-muted text-sm">在公司推荐清单中点击扫描按钮开始</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} className="bg-white border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text-primary truncate">{task.company_name}</p>
                        <StatusBadge status={task.status} />
                      </div>
                      <p className="text-xs text-text-muted mt-0.5 truncate">{task.careers_url}</p>
                      {task.error_message && (
                        <p className="text-xs text-red-500 mt-0.5 truncate">{task.error_message}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {task.status === "done" && (
                        <p className="text-sm font-semibold text-emerald-600">{task.jobs_found} 个岗位</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {applyJob && (
          <ApplyModal key="apply" job={applyJob} onClose={() => setApplyJob(null)} />
        )}
        {showEmailSettings && (
          <EmailSettingsModal key="email-settings" onClose={() => setShowEmailSettings(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
