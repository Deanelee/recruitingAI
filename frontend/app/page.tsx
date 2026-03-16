"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, FileText, Target, Send, Sparkles, ChevronRight } from "lucide-react";

const features = [
  {
    icon: FileText,
    step: "01",
    title: "简历分析",
    description: "上传 PDF 或 Word 简历，AI 自动识别行业方向、职级水平、核心技能，精准评估你的求职竞争力。",
    color: "from-blue-500/20 to-blue-600/5",
    iconColor: "text-blue-400",
  },
  {
    icon: Target,
    step: "02",
    title: "智能匹配",
    description: "根据你的技能和偏好，AI 从海量职位中筛选出最匹配的岗位，并自动定制每份申请材料。",
    color: "from-purple-500/20 to-purple-600/5",
    iconColor: "text-purple-400",
  },
  {
    icon: Send,
    step: "03",
    title: "自动投递",
    description: "AI 自动向匹配的公司发送定制化申请，跟踪投递状态，让求职变得轻松高效。",
    color: "from-emerald-500/20 to-emerald-600/5",
    iconColor: "text-emerald-400",
  },
];

const stats = [
  { value: "10x", label: "投递效率提升" },
  { value: "85%", label: "简历匹配准确率" },
  { value: "3min", label: "完成全部设置" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative max-w-6xl mx-auto px-6 pt-24 pb-20">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center relative"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-1.5 text-sm text-text-secondary mb-8">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>由 Claude AI 驱动</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="text-text-primary">让AI替你</span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent via-purple-400 to-blue-400">
              找工作
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            上传简历，AI 自动分析行业、匹配岗位、定制简历、发送投递
            <br className="hidden md:block" />
            告别繁琐的求职流程，让技术替你把关每一个机会
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/onboarding">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary flex items-center gap-2 text-base px-8 py-3 shadow-lg shadow-accent/20"
              >
                开始使用
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
            <Link href="/dashboard">
              <button className="btn-secondary flex items-center gap-2 text-base px-8 py-3">
                查看看板
                <ChevronRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex justify-center gap-12 mt-20"
        >
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-bold text-text-primary mb-1">{stat.value}</div>
              <div className="text-sm text-text-muted">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            三步完成智能求职
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            从上传简历到自动投递，全程由 AI 驱动，让每一次求职都更高效
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="relative group"
              >
                <div className="card-hover h-full">
                  {/* Step number */}
                  <div className="text-xs font-mono text-text-muted mb-4">{feature.step}</div>

                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 border border-border`}>
                    <Icon className={`w-5 h-5 ${feature.iconColor}`} />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-text-primary mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Arrow hint on hover */}
                  <div className="mt-6 flex items-center gap-1 text-accent text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>了解更多</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="max-w-6xl mx-auto px-6 py-10 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface to-surface-2 p-10 text-center"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-blue-500/5 pointer-events-none" />
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-4 relative">
            准备好开始你的智能求职之旅了吗？
          </h2>
          <p className="text-text-secondary mb-8 relative">
            只需 3 分钟完成设置，AI 将为你持续工作
          </p>
          <Link href="/onboarding">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary text-base px-10 py-3 shadow-lg shadow-accent/20 relative"
            >
              立即开始 →
            </motion.button>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
