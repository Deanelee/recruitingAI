"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Loader2, Sparkles, Mail, CheckCircle2, AlertCircle,
  Copy, Send, ChevronRight, Lightbulb, Tag, ArrowRight,
} from "lucide-react";
import {
  JobMatch, JobApplicationRecord, TailoredContent,
  prepareApplication, updateApplicationEmail, sendApplication,
} from "@/lib/api";

interface Props {
  job: JobMatch;
  onClose: () => void;
}

type Stage = "loading" | "review" | "sending" | "done" | "error";
type ReviewTab = "tailor" | "email";

export default function ApplyModal({ job, onClose }: Props) {
  const [stage, setStage] = useState<Stage>("loading");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("tailor");
  const [appRecord, setAppRecord] = useState<JobApplicationRecord | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);

  const startPrepare = async () => {
    if (started) return;
    setStarted(true);
    setStage("loading");
    try {
      const rec = await prepareApplication(job.id);
      setAppRecord(rec);
      setEmailSubject(rec.email_subject || "");
      setEmailBody(rec.email_body || "");
      setStage("review");
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail || "AI 生成失败，请稍后重试");
      setStage("error");
    }
  };

  // Auto-start when modal opens
  if (!started) startPrepare();

  const tailored = appRecord?.tailored_content as TailoredContent | null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(emailBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!appRecord || !recipientEmail) return;
    setStage("sending");
    try {
      // Save any edits first
      await updateApplicationEmail(appRecord.id, {
        email_subject: emailSubject,
        email_body: emailBody,
        recipient_email: recipientEmail,
      });
      await sendApplication(appRecord.id, recipientEmail);
      setStage("done");
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail || "发送失败，请检查邮箱配置");
      setStage("error");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-text-primary">定制简历 & 投递</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {job.title} · {job.company_name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors text-text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* Loading */}
            {stage === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 px-6 gap-4">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-text-primary font-medium">AI 正在为你定制简历...</p>
                  <p className="text-text-muted text-sm mt-1">分析岗位 JD、匹配技能、生成求职信，预计 15-30 秒</p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
                  {["分析岗位 JD 关键词", "匹配简历亮点", "生成求职邮件"].map((step, i) => (
                    <motion.div key={step} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.4 + 0.3 }}
                      className="flex items-center gap-2 text-xs text-text-secondary">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                      {step}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Review */}
            {stage === "review" && tailored && (
              <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-surface-2 rounded-xl mx-6 mt-5 w-fit">
                  {[
                    { key: "tailor", label: "简历定制建议", icon: Sparkles },
                    { key: "email", label: "求职邮件", icon: Mail },
                  ].map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setReviewTab(key as ReviewTab)}
                      className={`flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg font-medium transition-all ${reviewTab === key ? "bg-white shadow-sm text-text-primary" : "text-text-muted hover:text-text-secondary"}`}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>

                <div className="p-6 space-y-4">
                  {reviewTab === "tailor" ? (
                    <>
                      {/* Match tips */}
                      {tailored.match_tips && (
                        <div className="flex items-start gap-2 px-3 py-2.5 bg-accent/5 border border-accent/20 rounded-xl">
                          <Lightbulb className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-text-secondary">{tailored.match_tips}</p>
                        </div>
                      )}

                      {/* Tailored summary */}
                      {tailored.tailored_summary && (
                        <div>
                          <p className="text-xs font-semibold text-text-primary mb-2 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-accent" /> 推荐个人简介
                          </p>
                          <div className="bg-surface rounded-xl border border-border p-3">
                            <p className="text-sm text-text-secondary leading-relaxed">{tailored.tailored_summary}</p>
                          </div>
                        </div>
                      )}

                      {/* Keywords to add */}
                      {tailored.keywords_to_add.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-text-primary mb-2 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-emerald-500" /> 建议补充关键词
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {tailored.keywords_to_add.map((kw) => (
                              <span key={kw} className="text-xs px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full">{kw}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Key highlights */}
                      {tailored.key_highlights.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-text-primary mb-2 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-accent" /> 重点突出项
                          </p>
                          <ul className="space-y-1.5">
                            {tailored.key_highlights.map((h, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                                <ChevronRight className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />{h}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Suggested changes */}
                      {tailored.suggested_changes.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-text-primary mb-2">具体优化建议</p>
                          <div className="space-y-2">
                            {tailored.suggested_changes.map((c, i) => (
                              <div key={i} className="bg-surface border border-border rounded-xl p-3 space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-accent">{c.section}</span>
                                  <span className="text-xs text-text-muted">·</span>
                                  <span className="text-xs text-text-muted">{c.reason}</span>
                                </div>
                                {c.original && (
                                  <div className="text-xs text-red-400 line-through opacity-70 pl-2 border-l-2 border-red-200">
                                    {c.original}
                                  </div>
                                )}
                                <div className="text-xs text-emerald-700 pl-2 border-l-2 border-emerald-300">
                                  {c.improved}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button onClick={() => setReviewTab("email")} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
                        查看求职邮件 <ArrowRight className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Email editor */}
                      <div>
                        <label className="text-xs font-semibold text-text-primary mb-1.5 block">邮件主题</label>
                        <input
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-text-primary mb-1.5 block">邮件正文</label>
                        <textarea
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          rows={10}
                          className="input-field text-sm resize-none leading-relaxed"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-text-primary mb-1.5 block">收件人邮箱（HR邮箱）</label>
                        <input
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="hr@company.com"
                          className="input-field text-sm"
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button onClick={handleCopy} className="btn-secondary flex items-center gap-1.5 px-4 py-2.5 text-sm">
                          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          {copied ? "已复制" : "复制邮件"}
                        </button>
                        <button
                          onClick={handleSend}
                          disabled={!recipientEmail}
                          className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                          发送邮件
                        </button>
                      </div>
                      <p className="text-xs text-text-muted text-center">
                        发送前请在 <button onClick={onClose} className="text-accent hover:underline">设置</button> 中配置你的邮箱 SMTP
                      </p>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* Sending */}
            {stage === "sending" && (
              <motion.div key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-text-primary font-medium">正在发送求职邮件...</p>
              </motion.div>
            )}

            {/* Done */}
            {stage === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="text-text-primary font-semibold text-lg">投递成功！</p>
                  <p className="text-text-muted text-sm mt-1">邮件已发送至 {recipientEmail}</p>
                </div>
                <button onClick={onClose} className="btn-primary px-8">完成</button>
              </motion.div>
            )}

            {/* Error */}
            {stage === "error" && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 gap-4 px-6">
                <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <div className="text-center">
                  <p className="text-text-primary font-medium">出错了</p>
                  <p className="text-text-muted text-sm mt-1">{errorMsg}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={onClose} className="btn-secondary px-6">关闭</button>
                  <button onClick={() => { setStarted(false); setStage("loading"); }} className="btn-primary px-6">重试</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
