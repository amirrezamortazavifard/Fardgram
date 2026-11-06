import { Bold, Italic, Underline, Strikethrough, Code, SquareCode, EyeOff, Quote, Link2 } from "lucide-react";
import type { ComposerFormat } from "../utils/composerFormatting";

interface ComposerFormattingBarProps {
  onApplyFormat: (format: ComposerFormat) => void;
}

export function ComposerFormattingBar({ onApplyFormat }: ComposerFormattingBarProps) {
  return (
    <div
      className="composer-formatting-toolbar"
      role="toolbar"
      aria-label="Format text"
      onMouseDown={(e) => {
        e.preventDefault();
      }}
    >
      <button
        type="button"
        className="format-tool-btn"
        title="Bold - Ctrl+B"
        aria-label="Bold (Ctrl+B)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onApplyFormat("bold");
        }}
      >
        <Bold size={14} strokeWidth={2.5} />
      </button>

      <button
        type="button"
        className="format-tool-btn"
        title="Italic - Ctrl+I"
        aria-label="Italic (Ctrl+I)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onApplyFormat("italic");
        }}
      >
        <Italic size={14} strokeWidth={2.5} />
      </button>

      <button
        type="button"
        className="format-tool-btn"
        title="Underline - Ctrl+U"
        aria-label="Underline (Ctrl+U)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onApplyFormat("underline");
        }}
      >
        <Underline size={14} strokeWidth={2.5} />
      </button>

      <button
        type="button"
        className="format-tool-btn"
        title="Strikethrough - Ctrl+Shift+X"
        aria-label="Strikethrough (Ctrl+Shift+X)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onApplyFormat("strikethrough");
        }}
      >
        <Strikethrough size={14} strokeWidth={2.5} />
      </button>

      <button
        type="button"
        className="format-tool-btn"
        title="Monospace (Code) - Ctrl+Shift+M"
        aria-label="Monospace code (Ctrl+Shift+M)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onApplyFormat("code");
        }}
      >
        <Code size={14} strokeWidth={2.5} />
      </button>

      <button
        type="button"
        className="format-tool-btn"
        title="Code Block - Ctrl+Shift+C"
        aria-label="Code block (Ctrl+Shift+C)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onApplyFormat("pre");
        }}
      >
        <SquareCode size={14} strokeWidth={2.3} />
      </button>

      <button
        type="button"
        className="format-tool-btn"
        title="Spoiler - Ctrl+Shift+P"
        aria-label="Spoiler (Ctrl+Shift+P)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onApplyFormat("spoiler");
        }}
      >
        <EyeOff size={14} strokeWidth={2.2} />
      </button>

      <button
        type="button"
        className="format-tool-btn"
        title="Quote - Ctrl+Shift+Q"
        aria-label="Quote (Ctrl+Shift+Q)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onApplyFormat("blockquote");
        }}
      >
        <Quote size={14} strokeWidth={2.3} />
      </button>

      <button
        type="button"
        className="format-tool-btn"
        title="Link - Ctrl+K"
        aria-label="Link (Ctrl+K)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onApplyFormat("link");
        }}
      >
        <Link2 size={14} strokeWidth={2.2} />
      </button>
    </div>
  );
}
