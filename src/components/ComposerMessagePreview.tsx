import { useMemo } from "react";
import { Eye, X, Sparkles } from "lucide-react";
import type { MessageTextEntity } from "../telegram/types";
import { MessageRichText } from "./MessageRichText";
import { isRtlText } from "../utils/textDirection";
import { parseMarkdownToFormattedText } from "../utils/markdownEntities";

export interface ComposerMessagePreviewProps {
  text: string;
  entities?: readonly MessageTextEntity[];
  colorTheme: "light" | "dark";
  onClose: () => void;
}

export function ComposerMessagePreview({
  text,
  entities = [],
  colorTheme,
  onClose,
}: ComposerMessagePreviewProps) {
  // Parse any markdown tokens live for the preview
  const parsed = useMemo(() => {
    return parseMarkdownToFormattedText(text, entities);
  }, [text, entities]);

  const isRtl = useMemo(() => isRtlText(parsed.text), [parsed.text]);
  const wordCount = useMemo(() => {
    const trimmed = parsed.text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [parsed.text]);

  const entityKindsCount = useMemo(() => {
    const kinds = new Set(parsed.entities.map((e) => e.kind));
    return kinds.size;
  }, [parsed.entities]);

  return (
    <div
      className={`composer-message-preview-container ${colorTheme === "light" ? "is-light" : "is-dark"}`}
      role="region"
      aria-label="Message preview"
    >
      <div className="composer-preview-header">
        <div className="composer-preview-title">
          <Sparkles size={14} className="text-amber-400" />
          <span className="font-semibold">Rich Message Preview</span>
          <span className="composer-preview-badge">
            {parsed.entities.length} {parsed.entities.length === 1 ? "entity" : "entities"}
            {entityKindsCount > 0 ? ` (${entityKindsCount} types)` : ""}
          </span>
        </div>

        <div className="composer-preview-meta">
          <span className="composer-preview-stat">{parsed.text.length} chars</span>
          <span className="composer-preview-stat">{wordCount} words</span>
          <button
            type="button"
            className="composer-preview-close"
            onClick={onClose}
            title="Close preview"
            aria-label="Close preview"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="composer-preview-bubble-wrapper" dir={isRtl ? "rtl" : "ltr"}>
        <div className="composer-preview-bubble">
          <MessageRichText
            text={parsed.text}
            entities={parsed.entities}
            className="composer-preview-content"
          />
        </div>
      </div>
    </div>
  );
}
