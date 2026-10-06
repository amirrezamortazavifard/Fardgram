import React, { useState } from "react";
import { History, Copy, Check, ArrowRight, X, Clock } from "lucide-react";
import type { Message, MessageContent } from "../telegram/types";
import { formatMessageTime } from "../utils/formatters";
import "./osintDialogs.css";

interface MessageEditHistoryDialogProps {
  message: Message;
  onClose: () => void;
}

export function MessageEditHistoryDialog({ message, onClose }: MessageEditHistoryDialogProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const revisions = message.editHistory ?? [];
  const currentContent = message.content;

  const getText = (content: MessageContent): string => {
    if (content.kind === "text") return content.text;
    if ("caption" in content && content.caption) return content.caption;
    if (content.kind === "media") return `[Media: ${content.mediaType}]`;
    return `[${content.kind}]`;
  };

  const copyText = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1800);
    } catch {
      // fallback
    }
  };

  return (
    <div className="osint-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="osint-modal-card osint-history-card" onClick={(e) => e.stopPropagation()}>
        <div className="osint-modal-header">
          <div className="osint-header-title">
            <History className="osint-shield-icon" size={20} />
            <h3>Message Edit History (Anti-Edit Audit)</h3>
          </div>
          <button className="osint-close-btn" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="osint-modal-body">
          <p className="osint-intro-text">
            This message was edited {revisions.length} time{revisions.length === 1 ? "" : "s"}. Previous revisions were captured and preserved locally:
          </p>

          <div className="osint-timeline-container">
            {/* Current latest version */}
            <div className="osint-timeline-step is-current">
              <div className="osint-step-badge">Current Version</div>
              <div className="osint-step-time">
                <Clock size={13} />
                <span>
                  {message.editedAt ? new Date(message.editedAt).toLocaleString() : new Date(message.sentAt).toLocaleString()}
                </span>
              </div>
              <div className="osint-step-content">
                <p>{getText(currentContent)}</p>
                <button
                  className="osint-inline-copy-btn"
                  type="button"
                  onClick={() => copyText(getText(currentContent), -1)}
                  title="Copy current text"
                >
                  {copiedIndex === -1 ? <Check size={14} className="osint-text-success" /> : <Copy size={14} />}
                  <span>Copy</span>
                </button>
              </div>
            </div>

            {/* Previous versions in reverse chronological order */}
            {revisions.slice().reverse().map((revision, idx) => {
              const revText = getText(revision.content);
              const originalIndex = revisions.length - 1 - idx;
              return (
                <div className="osint-timeline-step is-old" key={idx}>
                  <div className="osint-step-badge">Previous Revision #{originalIndex + 1}</div>
                  <div className="osint-step-time">
                    <Clock size={13} />
                    <span>{new Date(revision.editedAt).toLocaleString()}</span>
                  </div>
                  <div className="osint-step-content">
                    <p>{revText}</p>
                    <button
                      className="osint-inline-copy-btn"
                      type="button"
                      onClick={() => copyText(revText, originalIndex)}
                      title="Copy this revision"
                    >
                      {copiedIndex === originalIndex ? (
                        <Check size={14} className="osint-text-success" />
                      ) : (
                        <Copy size={14} />
                      )}
                      <span>Copy Revision</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="osint-modal-footer">
          <button className="osint-primary-btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
