import React, { memo } from "react";

interface FloatingReactionsBarProps {
  onSelectReaction: (emoji: string) => void;
  onOpenMore?: () => void;
}

const QUICK_EMOJIS = ["👍", "❤️", "🔥", "😂", "👏", "🎉", "😍", "🙏", "⚡"];

export const FloatingReactionsBar = memo(function FloatingReactionsBar({
  onSelectReaction,
}: FloatingReactionsBarProps) {
  return (
    <div
      className="floating-reactions-bar"
      role="toolbar"
      aria-label="Quick reactions"
      onClick={(e) => e.stopPropagation()}
    >
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-emoji-btn"
          aria-label={`React with ${emoji}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelectReaction(emoji);
          }}
        >
          <span>{emoji}</span>
        </button>
      ))}
    </div>
  );
});
