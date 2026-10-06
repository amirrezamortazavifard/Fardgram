import React, { useEffect, useRef } from "react";
import { Image, FileText, Music, BarChart2 } from "lucide-react";

export interface AttachmentPickerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onPickMedia: () => void;
  onPickDocument: () => void;
  onPickAudio: () => void;
  onPickPoll?: () => void;
}

export const AttachmentPickerMenu: React.FC<AttachmentPickerMenuProps> = ({
  isOpen,
  onClose,
  onPickMedia,
  onPickDocument,
  onPickAudio,
  onPickPoll,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="attachment-picker-menu popover-surface"
      role="menu"
      aria-label="Attachment options"
    >
      <div className="attachment-picker-menu-header">
        <span>Send Attachment</span>
      </div>
      <div className="attachment-picker-menu-items">
        <button
          type="button"
          role="menuitem"
          className="attachment-picker-item"
          onClick={() => {
            onClose();
            onPickMedia();
          }}
        >
          <div className="attachment-picker-icon-wrapper is-photo">
            <Image size={18} strokeWidth={2} />
          </div>
          <div className="attachment-picker-item-details">
            <span className="attachment-picker-item-title">Photo or Video</span>
            <span className="attachment-picker-item-desc">Send compressed visual media</span>
          </div>
        </button>

        <button
          type="button"
          role="menuitem"
          className="attachment-picker-item"
          onClick={() => {
            onClose();
            onPickDocument();
          }}
        >
          <div className="attachment-picker-icon-wrapper is-doc">
            <FileText size={18} strokeWidth={2} />
          </div>
          <div className="attachment-picker-item-details">
            <span className="attachment-picker-item-title">File or Document</span>
            <span className="attachment-picker-item-desc">Send lossless without compression</span>
          </div>
        </button>

        <button
          type="button"
          role="menuitem"
          className="attachment-picker-item"
          onClick={() => {
            onClose();
            onPickAudio();
          }}
        >
          <div className="attachment-picker-icon-wrapper is-audio">
            <Music size={18} strokeWidth={2} />
          </div>
          <div className="attachment-picker-item-details">
            <span className="attachment-picker-item-title">Audio or Music</span>
            <span className="attachment-picker-item-desc">Send music tracks and audio files</span>
          </div>
        </button>

        {onPickPoll && (
          <button
            type="button"
            role="menuitem"
            className="attachment-picker-item"
            onClick={() => {
              onClose();
              onPickPoll();
            }}
          >
            <div className="attachment-picker-icon-wrapper is-poll">
              <BarChart2 size={18} strokeWidth={2} />
            </div>
            <div className="attachment-picker-item-details">
              <span className="attachment-picker-item-title">Poll</span>
              <span className="attachment-picker-item-desc">Create multiple-choice questions</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};
