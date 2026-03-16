"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Loader2, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { getSmtpSettings, saveSmtpSettings, SmtpSettings } from "@/lib/api";

const SMTP_PRESETS: Record<string, { host: string; port: number }> = {
  Gmail: { host: "smtp.gmail.com", port: 587 },
  QQ邮箱: { host: "smtp.qq.com", port: 587 },
  "163邮箱": { host: "smtp.163.com", port: 465 },
  Outlook: { host: "smtp-mail.outlook.com", port: 587 },
};

interface Props {
  onClose: () => void;
}

export default function EmailSettingsModal({ onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    sender_email: "",
    sender_name: "",
  });

  useEffect(() => {
    getSmtpSettings()
      .then((s: SmtpSettings) => {
        if (s.configured) {
          setForm({
            smtp_host: s.smtp_host || "",
            smtp_port: s.smtp_port || 587,
            smtp_user: s.smtp_user || "",
            smtp_password: "",
            sender_email: s.sender_email || "",
            sender_name: s.sender_name || "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const applyPreset = (name: string) => {
    const p = SMTP_PRESETS[name];
    setForm((f) => ({ ...f, smtp_host: p.host, smtp_port: p.port }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveSmtpSettings(form);
      setSaved(true);
      setTimeout(onClose, 1200);
    } catch {
      setError("保存失败，请检查输入");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl border border-border w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
              <Mail className="w-4 h-4 text-accent" />
            </div>
            <h2 className="text-base font-semibold text-text-primary">邮箱发送配置</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors text-text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-accent" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-4">
            {/* Preset buttons */}
            <div>
              <p className="text-xs text-text-muted mb-2">快速选择邮件服务商</p>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(SMTP_PRESETS).map((name) => (
                  <button type="button" key={name} onClick={() => applyPreset(name)}
                    className="text-xs px-3 py-1 rounded-full border border-border hover:border-accent/40 hover:bg-accent/5 text-text-secondary transition-colors">
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-text-secondary mb-1.5">SMTP 服务器</label>
                <input value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })} required placeholder="smtp.example.com" className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">端口</label>
                <input type="number" value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) })} required className="input-field text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1.5">邮箱账号</label>
              <input type="email" value={form.smtp_user} onChange={(e) => setForm({ ...form, smtp_user: e.target.value })} required placeholder="you@example.com" className="input-field text-sm" />
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1.5">邮箱密码 / 授权码</label>
              <input type="password" value={form.smtp_password} onChange={(e) => setForm({ ...form, smtp_password: e.target.value })} required placeholder="••••••••" className="input-field text-sm" />
              <p className="text-xs text-text-muted mt-1">Gmail/QQ 等需使用应用专用密码</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">发件人姓名</label>
                <input value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} placeholder="你的姓名" className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">发件人邮箱</label>
                <input type="email" value={form.sender_email} onChange={(e) => setForm({ ...form, sender_email: e.target.value })} placeholder="同账号" className="input-field text-sm" />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
              </div>
            )}

            <button type="submit" disabled={saving || saved} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-70">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : null}
              {saved ? "已保存" : saving ? "保存中..." : "保存配置"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
