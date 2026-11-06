import React from "react";
import { Gift, Lock, Sparkles } from "lucide-react";
import type { MessageGiftContent } from "../telegram/types";

interface GiftMessageProps {
  content: MessageGiftContent;
  isOutgoing?: boolean;
}

export const GiftMessage: React.FC<GiftMessageProps> = ({ content }) => {
  return (
    <div className="gift-message-bubble flex flex-col gap-2.5 p-3.5 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-fuchsia-500/5 to-amber-500/5 dark:border-violet-400/20 max-w-sm select-none">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-bold text-violet-700 dark:text-violet-300">
          <Gift className="w-4 h-4 text-violet-500" />
          <span>Telegram Gift</span>
        </div>
        <div className="flex items-center gap-1">
          {content.isPrivate && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
              <Lock className="w-2.5 h-2.5" />
              Private
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Sparkles className="w-3 h-3 fill-current" />
            {content.starCount} Stars
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 py-1">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 shadow-inner">
          {content.stickerThumbnailPath ? (
            <img
              src={content.stickerThumbnailPath}
              alt="Gift sticker"
              className="w-10 h-10 object-contain"
            />
          ) : (
            <Gift className="w-7 h-7 text-violet-500 animate-pulse" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Special Collectible Gift
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Transferred via Telegram Stars
          </span>
        </div>
      </div>

      {content.text && (
        <div className="text-xs italic bg-white/50 dark:bg-black/20 p-2.5 rounded-xl border border-slate-200/50 dark:border-white/5 text-slate-700 dark:text-slate-300">
          "{content.text}"
        </div>
      )}
    </div>
  );
};
