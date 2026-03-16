"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  CheckCircle,
  Loader2,
  AlertCircle,
  X,
  Star,
  Briefcase,
  TrendingUp,
  Code,
} from "lucide-react";
import { uploadResume, ResumeUploadResponse } from "@/lib/api";

interface ResumeUploadProps {
  onUploadSuccess: (data: ResumeUploadResponse) => void;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export default function ResumeUpload({ onUploadSuccess }: ResumeUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [analysisData, setAnalysisData] = useState<ResumeUploadResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setSelectedFile(file);
      setUploadState("uploading");
      setUploadProgress(0);
      setErrorMessage("");

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 85) {
            clearInterval(progressInterval);
            return 85;
          }
          return prev + Math.random() * 15;
        });
      }, 300);

      try {
        const result = await uploadResume(file);
        clearInterval(progressInterval);
        setUploadProgress(100);
        setUploadState("success");
        setAnalysisData(result);
        onUploadSuccess(result);
      } catch (error: unknown) {
        clearInterval(progressInterval);
        setUploadState("error");
        const axiosError = error as { response?: { status?: number; data?: { detail?: string } } };
        if (axiosError?.response?.status === 401) {
          localStorage.removeItem("auth_token");
          setErrorMessage("登录已过期，请刷新页面重新登录");
        } else {
          setErrorMessage(axiosError?.response?.data?.detail || "上传失败，请重试");
        }
      }
    },
    [onUploadSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
    },
    maxFiles: 1,
    disabled: uploadState === "uploading" || uploadState === "success",
  });

  const handleReset = () => {
    setUploadState("idle");
    setUploadProgress(0);
    setErrorMessage("");
    setAnalysisData(null);
    setSelectedFile(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-400";
    if (score >= 6) return "text-yellow-400";
    return "text-red-400";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return "优秀";
    if (score >= 6) return "良好";
    if (score >= 4) return "一般";
    return "待改进";
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <AnimatePresence mode="wait">
        {uploadState !== "success" && (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              {...getRootProps()}
              className={`
                relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
                transition-all duration-200
                ${isDragActive
                  ? "border-accent bg-accent/5"
                  : uploadState === "error"
                  ? "border-error/50 bg-error/5 cursor-default"
                  : uploadState === "uploading"
                  ? "border-border cursor-default"
                  : "border-border hover:border-border-2 hover:bg-surface-2"
                }
              `}
            >
              <input {...getInputProps()} />

              {uploadState === "idle" && (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5 text-text-secondary" />
                  </div>
                  <div>
                    <p className="text-text-primary font-medium">
                      {isDragActive ? "松开以上传文件" : "拖拽简历到此处"}
                    </p>
                    <p className="text-text-muted text-sm mt-1">
                      或点击选择文件 · 支持 PDF、DOCX 格式 · 最大 10MB
                    </p>
                  </div>
                </div>
              )}

              {uploadState === "uploading" && (
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto">
                    <Loader2 className="w-5 h-5 text-accent animate-spin" />
                  </div>
                  <div>
                    <p className="text-text-primary font-medium">正在分析简历...</p>
                    <p className="text-text-muted text-sm mt-1">
                      {selectedFile?.name}
                    </p>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full max-w-xs mx-auto bg-surface-3 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                      className="h-full bg-accent rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-text-muted text-xs">
                    {Math.round(uploadProgress)}% · AI 正在深度分析您的经历...
                  </p>
                </div>
              )}

              {uploadState === "error" && (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-5 h-5 text-error" />
                  </div>
                  <div>
                    <p className="text-error font-medium">上传失败</p>
                    <p className="text-text-muted text-sm mt-1">{errorMessage}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    重新上传
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Success State with Analysis Results */}
        {uploadState === "success" && analysisData && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Success Header */}
            <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-emerald-400 font-medium text-sm">简历上传成功</p>
                <p className="text-text-muted text-xs mt-0.5 truncate">
                  {analysisData.filename}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-text-muted hover:text-text-secondary transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Analysis Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Quality Score */}
              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-text-muted text-xs">简历评分</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className={`text-2xl font-bold ${getScoreColor(analysisData.analysis.resume_quality_score)}`}>
                    {analysisData.analysis.resume_quality_score.toFixed(1)}
                  </span>
                  <span className="text-text-muted text-sm mb-0.5">/10</span>
                </div>
                <span className={`text-xs ${getScoreColor(analysisData.analysis.resume_quality_score)}`}>
                  {getScoreLabel(analysisData.analysis.resume_quality_score)}
                </span>
              </div>

              {/* Experience */}
              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-text-muted text-xs">工作年限</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-text-primary">
                    {analysisData.analysis.years_experience}
                  </span>
                  <span className="text-text-muted text-sm mb-0.5">年</span>
                </div>
                <span className="text-xs text-text-secondary">
                  {analysisData.analysis.seniority_level}
                </span>
              </div>
            </div>

            {/* Industry */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-text-muted text-xs">所属行业</span>
              </div>
              <span className="text-text-primary font-medium">
                {analysisData.analysis.industry}
              </span>
            </div>

            {/* Key Skills */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Code className="w-3.5 h-3.5 text-accent-light" />
                <span className="text-text-muted text-xs">核心技能</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysisData.analysis.key_skills.slice(0, 8).map((skill, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-accent/10 border border-accent/20 text-accent-light text-xs rounded-lg"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Summary */}
            {analysisData.analysis.summary && (
              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-text-muted text-xs">AI 摘要</span>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {analysisData.analysis.summary}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
