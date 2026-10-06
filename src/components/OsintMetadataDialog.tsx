import React, { useState } from "react";
import { Copy, Check, Shield, Server, Clock, Calendar, FileText, Info, X } from "lucide-react";
import type { Message } from "../telegram/types";
import {
  extractMessageForensics,
  estimateAccountAge,
  getDcInfo,
} from "../utils/osintMetadata";
import { formatMessageTime } from "../utils/formatters";
import "./osintDialogs.css";

interface OsintMetadataDialogProps {
  message: Message;
  onClose: () => void;
}

export function OsintMetadataDialog({ message, onClose }: OsintMetadataDialogProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const forensics = extractMessageForensics(message);
  const accountAge = estimateAccountAge(message.senderId);
  const dcInfo = forensics.mediaDetails?.fileId ? getDcInfo(2) : undefined; // Default DC2 hint or resolved DC

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // fallback
    }
  };

  return (
    <div className="osint-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="osint-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="osint-modal-header">
          <div className="osint-header-title">
            <Shield className="osint-shield-icon" size={20} />
            <h3>Message Forensics & Metadata (OSINT Inspector)</h3>
          </div>
          <button className="osint-close-btn" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="osint-modal-body">
          {/* Identity & Origin Card */}
          <div className="osint-section-box">
            <div className="osint-section-title">
              <Info size={16} />
              <span>Sender Identity & Channel Information</span>
            </div>
            <div className="osint-grid-2">
              <div className="osint-field-item">
                <span className="osint-label">Sender Numeric ID:</span>
                <div className="osint-value-row">
                  <code>{message.senderId}</code>
                  <button
                    className="osint-copy-btn"
                    type="button"
                    onClick={() => copyToClipboard(message.senderId, "senderId")}
                    title="Copy numeric ID"
                  >
                    {copiedKey === "senderId" ? <Check size={14} className="osint-text-success" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="osint-field-item">
                <span className="osint-label">Chat / Target ID:</span>
                <div className="osint-value-row">
                  <code>{message.chatId}</code>
                  <button
                    className="osint-copy-btn"
                    type="button"
                    onClick={() => copyToClipboard(message.chatId, "chatId")}
                    title="Copy chat ID"
                  >
                    {copiedKey === "chatId" ? <Check size={14} className="osint-text-success" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {accountAge && (
              <div className="osint-age-badge">
                <Calendar size={15} />
                <div className="osint-age-content">
                  <strong>Estimated Account Creation: {accountAge.formattedRange}</strong>
                  <span className="osint-age-sub">
                    Approximate Age: ~{accountAge.approxAgeYears} years ago • Era: {accountAge.eraName} (Confidence: {accountAge.confidence})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Message Timing & Lifecycle */}
          <div className="osint-section-box">
            <div className="osint-section-title">
              <Clock size={16} />
              <span>Message Timestamps & Lifecycle</span>
            </div>
            <div className="osint-grid-2">
              <div className="osint-field-item">
                <span className="osint-label">Sent At (Local):</span>
                <span className="osint-val">{new Date(message.sentAt).toLocaleString()} ({formatMessageTime(message.sentAt)})</span>
              </div>
              <div className="osint-field-item">
                <span className="osint-label">Exact Unix Timestamp:</span>
                <div className="osint-value-row">
                  <code>{forensics.unixTimestamp}</code>
                  <button
                    className="osint-copy-btn"
                    type="button"
                    onClick={() => copyToClipboard(String(forensics.unixTimestamp), "unix")}
                    title="Copy Unix timestamp"
                  >
                    {copiedKey === "unix" ? <Check size={14} className="osint-text-success" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="osint-status-flags">
              {forensics.isDeleted ? (
                <span className="osint-tag osint-tag-danger">
                  Deleted from Telegram Server (Retained in Local Archive)
                </span>
              ) : (
                <span className="osint-tag osint-tag-success">Active on Telegram Server</span>
              )}

              {forensics.hasEditHistory ? (
                <span className="osint-tag osint-tag-warning">
                  Edited ({forensics.editCount} previous revision{forensics.editCount === 1 ? "" : "s"} archived)
                </span>
              ) : message.editedAt ? (
                <span className="osint-tag osint-tag-info">Edited at {new Date(message.editedAt).toLocaleTimeString()}</span>
              ) : null}

              {message.outgoing && <span className="osint-tag osint-tag-neutral">Outgoing Message</span>}
            </div>
          </div>

          {/* Media & Datacenter Info */}
          {forensics.mediaDetails && (
            <div className="osint-section-box">
              <div className="osint-section-title">
                <Server size={16} />
                <span>Media & Local Storage Forensics</span>
              </div>
              <div className="osint-grid-2">
                <div className="osint-field-item">
                  <span className="osint-label">Media Type:</span>
                  <span className="osint-val">{forensics.mediaDetails.type}</span>
                </div>
                {forensics.mediaDetails.size && (
                  <div className="osint-field-item">
                    <span className="osint-label">File Size:</span>
                    <span className="osint-val">{forensics.mediaDetails.size}</span>
                  </div>
                )}
                {forensics.mediaDetails.dimensions && (
                  <div className="osint-field-item">
                    <span className="osint-label">Dimensions:</span>
                    <span className="osint-val">{forensics.mediaDetails.dimensions}</span>
                  </div>
                )}
                {forensics.mediaDetails.fileId && (
                  <div className="osint-field-item">
                    <span className="osint-label">TDLib File ID:</span>
                    <code>{forensics.mediaDetails.fileId}</code>
                  </div>
                )}
              </div>

              {forensics.mediaDetails.localPath && (
                <div className="osint-local-path">
                  <span className="osint-label">Local File Path:</span>
                  <code>{forensics.mediaDetails.localPath}</code>
                </div>
              )}
            </div>
          )}

          {/* Raw JSON inspection toggle */}
          <div className="osint-raw-toggle-box">
            <button
              className="osint-secondary-btn"
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
            >
              <FileText size={15} />
              <span>{showRawJson ? "Hide Raw JSON Payload" : "Inspect Raw TDLib Message Object (JSON)"}</span>
            </button>
          </div>

          {showRawJson && (
            <div className="osint-raw-json-viewer">
              <pre>{JSON.stringify(message, null, 2)}</pre>
            </div>
          )}
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
