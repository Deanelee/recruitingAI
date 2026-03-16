"use client";

import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { OnboardingMessage } from "@/lib/api";

interface ChatMessageProps {
  message: OnboardingMessage;
  isLatest?: boolean;
}

export default function ChatMessage({ message, isLatest = false }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";

  return (
    <motion.div
      initial={isLatest ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-start gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}
    >
      {/* AI Avatar */}
      {isAssistant && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent flex items-center justify-center mt-0.5">
          <span className="text-white text-xs font-bold">R</span>
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isAssistant
            ? "bg-surface border border-border text-text-primary rounded-tl-sm"
            : "bg-accent text-white rounded-tr-sm"
          }
        `}
      >
        {isAssistant ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0 text-text-primary">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside mb-2 space-y-1 text-text-primary">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside mb-2 space-y-1 text-text-primary">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-text-primary">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-text-primary">{children}</strong>
                ),
                code: ({ children }) => (
                  <code className="bg-surface-3 rounded px-1 py-0.5 text-xs text-accent-light">
                    {children}
                  </code>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <span className="text-white">{message.content}</span>
        )}
      </div>

      {/* User avatar placeholder for alignment */}
      {!isAssistant && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center mt-0.5">
          <span className="text-text-secondary text-xs font-medium">U</span>
        </div>
      )}
    </motion.div>
  );
}
