import { useState, useEffect, useRef, type FormEvent } from "react";
import { Link2, X } from "lucide-react";

export interface ComposerLinkDialogProps {
  isOpen: boolean;
  initialText: string;
  initialUrl?: string;
  onApply: (text: string, url: string) => void;
  onClose: () => void;
}

export function ComposerLinkDialog({
  isOpen,
  initialText,
  initialUrl = "",
  onApply,
  onClose,
}: ComposerLinkDialogProps) {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText(initialText);
      setUrl(initialUrl);
      setTimeout(() => {
        urlInputRef.current?.focus();
        urlInputRef.current?.select();
      }, 50);
    }
  }, [isOpen, initialText, initialUrl]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    let finalUrl = url.trim();
    if (!finalUrl) return;

    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }

    const finalText = text.trim() || finalUrl;
    onApply(finalText, finalUrl);
    onClose();
  };

  return (
    <div
      className="composer-link-dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="composer-link-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add or edit link"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="composer-link-dialog-header">
          <div className="composer-link-dialog-title">
            <Link2 size={16} className="text-sky-400" />
            <span>Formatting: Link</span>
          </div>
          <button
            type="button"
            className="composer-link-dialog-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="composer-link-dialog-form">
          <div className="composer-link-dialog-field">
            <label htmlFor="composer-link-text">Text</label>
            <input
              id="composer-link-text"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Display text"
              className="composer-link-input"
            />
          </div>

          <div className="composer-link-dialog-field">
            <label htmlFor="composer-link-url">URL</label>
            <input
              ref={urlInputRef}
              id="composer-link-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              className="composer-link-input"
            />
          </div>

          <div className="composer-link-dialog-actions">
            <button
              type="button"
              className="composer-link-btn composer-link-btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="composer-link-btn composer-link-btn-save"
              disabled={!url.trim()}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
