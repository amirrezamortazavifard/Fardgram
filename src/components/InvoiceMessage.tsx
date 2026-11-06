import React, { useState } from "react";
import { Receipt, CheckCircle2, Sparkles, CreditCard, Loader2 } from "lucide-react";
import type { MessageInvoiceContent } from "../telegram/types";

interface InvoiceMessageProps {
  chatId: string;
  messageId: string;
  content: MessageInvoiceContent;
  isOutgoing?: boolean;
  onPayInvoice?: (chatId: string, messageId: string) => Promise<boolean | void>;
}

export const InvoiceMessage: React.FC<InvoiceMessageProps> = ({
  chatId,
  messageId,
  content,
  isOutgoing = false,
  onPayInvoice,
}) => {
  const [isPaying, setIsPaying] = useState(false);
  const [paid, setPaid] = useState(content.isPaid);

  const formattedPrice =
    content.currency === "XTR"
      ? `⭐ ${content.totalAmount} Stars`
      : `${content.currency} ${(content.totalAmount / 100).toFixed(2)}`;

  const handlePay = async () => {
    if (!onPayInvoice || isPaying || paid) return;
    setIsPaying(true);
    try {
      const ok = await onPayInvoice(chatId, messageId);
      if (ok !== false) {
        setPaid(true);
      }
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="invoice-message flex flex-col gap-2.5 p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 max-w-sm select-none">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
          <Receipt className="w-4 h-4 text-sky-500" />
          <span>Invoice</span>
        </div>
        {content.isTest && (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Test Mode
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
          {content.title}
        </h4>
        {content.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">
            {content.description}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-white/10">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total:</span>
        <span className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
          {formattedPrice}
        </span>
      </div>

      {paid ? (
        <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>Payment Completed</span>
        </div>
      ) : !isOutgoing ? (
        <button
          type="button"
          onClick={handlePay}
          disabled={isPaying}
          className="w-full py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
        >
          {isPaying ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : content.currency === "XTR" ? (
            <>
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Pay {formattedPrice}</span>
            </>
          ) : (
            <>
              <CreditCard className="w-3.5 h-3.5" />
              <span>Pay {formattedPrice}</span>
            </>
          )}
        </button>
      ) : null}
    </div>
  );
};
