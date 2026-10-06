import React from "react";
import { Bold, Italic, Code, Strikethrough, EyeOff, Link2 } from "lucide-react";
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
        title="Monospace (Code) - Ctrl+Shift+M"
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
        title="Strikethrough - Ctrl+Shift+X"
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
        title="Spoiler - Ctrl+Shift+P"
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
        title="Link - Ctrl+K"
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
