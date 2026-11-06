import React, { useState } from "react";
import { Lock, Sparkles, Loader2, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import type { MessagePaidMediaContent } from "../telegram/types";
import { MessageRichText } from "./MessageRichText";
import type { ExpandQuoteHandler } from "./CollapsibleBlockQuote";

interface PaidMediaMessageProps {
  chatId: string;
  messageId: string;
  content: MessagePaidMediaContent;
  isOutgoing?: boolean;
  highlightQuery?: string;
  onBuyPaidMedia?: (chatId: string, messageId: string) => Promise<boolean | void>;
  onOpenMention?: (username?: string, userId?: string) => void;
  onSearchHashtag?: (hashtag: string) => void;
  onCollapseQuote?: (
    collapse: () => void,
    pointerClientY: number,
    getCollapsedAnchor: () => Element | null,
  ) => void;
  onExpandQuote?: ExpandQuoteHandler;
}

export const PaidMediaMessage: React.FC<PaidMediaMessageProps> = ({
  chatId,
  messageId,
  content,
  isOutgoing = false,
  highlightQuery,
  onBuyPaidMedia,
  onOpenMention,
  onSearchHashtag,
  onCollapseQuote,
  onExpandQuote,
}) => {
  const [isBuying, setIsBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    if (!onBuyPaidMedia || isBuying) return;
    setIsBuying(true);
    setError(null);
    try {
      const ok = await onBuyPaidMedia(chatId, messageId);
      if (ok === false) {
        setError("Failed to unlock media. Please check your Star balance.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock media");
    } finally {
      setIsBuying(false);
    }
  };

  const isLocked = !content.isBought;

  return (
    <div className="paid-media-container flex flex-col gap-2 rounded-2xl overflow-hidden border border-amber-500/20 bg-amber-500/5 dark:border-amber-400/20 dark:bg-amber-400/5 p-3 select-none max-w-sm">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Exclusive Paid Media</span>
        </span>
        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          ⭐ {content.starCount} Stars
        </span>
      </div>

      {isLocked ? (
        <div className="relative w-full h-48 rounded-xl overflow-hidden bg-slate-900/10 dark:bg-black/30 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center border border-slate-200/50 dark:border-white/10">
          {content.media[0]?.previewDataUrl && (
            <img
              src={content.media[0].previewDataUrl}
              alt="Locked preview"
              className="absolute inset-0 w-full h-full object-cover filter blur-xl opacity-40 pointer-events-none"
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
              <Lock className="w-6 h-6" />
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              {content.media.length > 1
                ? `${content.media.length} items locked`
                : content.media[0]?.type === "video"
                  ? "Locked video"
                  : "Locked photo"}
            </div>
            {!isOutgoing && (
              <button
                type="button"
                onClick={handleUnlock}
                disabled={isBuying}
                className="mt-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
              >
                {isBuying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Unlocking...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 fill-current" />
                    <span>Unlock for ⭐ {content.starCount}</span>
                  </>
                )}
              </button>
            )}
            {error && <span className="text-[11px] text-red-500 font-medium mt-1">{error}</span>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden">
          {content.media.map((item, index) => (
            <div
              key={index}
              className="relative aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center"
            >
              {item.localPath || item.previewDataUrl ? (
                <img
                  src={item.localPath || item.previewDataUrl}
                  alt={`Unlocked media ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  {item.type === "video" ? <VideoIcon className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
                  <span className="text-[10px] capitalize">{item.type}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {content.caption && (
        <MessageRichText
          chatId={chatId}
          className="attachment-caption text-xs mt-1"
          text={content.caption}
          entities={content.captionEntities}
          highlightQuery={highlightQuery}
          onOpenMention={onOpenMention}
          onSearchHashtag={onSearchHashtag}
          onCollapseQuote={onCollapseQuote}
          onExpandQuote={onExpandQuote}
        />
      )}
    </div>
  );
};
