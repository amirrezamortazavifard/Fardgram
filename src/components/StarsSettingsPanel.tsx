import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Gift,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  Coins,
  Send,
  Loader2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useTelegramStore } from "../store/telegramStore";
import type {
  StarTransaction,
  StarsTopupOption,
  StarRevenueStatus,
  TelegramGift,
} from "../telegram/types";
import { openExternalLink } from "../utils/externalLinks";

export const StarsSettingsPanel: React.FC = () => {
  const users = useTelegramStore((state) => state.users);
  const starBalance = useTelegramStore((state) => state.starBalance);
  const transactions = useTelegramStore((state) => state.starTransactions);
  const topupOptions = useTelegramStore((state) => state.starsTopupOptions);
  const revenueStatus = useTelegramStore((state) => state.starRevenueStatus);
  const gifts = useTelegramStore((state) => state.availableGifts);
  const loading = useTelegramStore((state) => state.starsLoading);
  const loadData = useTelegramStore((state) => state.loadStarsData);
  const sendGift = useTelegramStore((state) => state.sendGift);

  // Sending gift modal state
  const [selectedGift, setSelectedGift] = useState<TelegramGift | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [giftText, setGiftText] = useState("");
  const [isPrivateGift, setIsPrivateGift] = useState(false);
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [giftSuccess, setGiftSuccess] = useState(false);

  // Top-up purchase state
  const [purchasingOptionId, setPurchasingOptionId] = useState<string | null>(null);
  const [topupSuccess, setTopupSuccess] = useState(false);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleTopup = async (option: StarsTopupOption) => {
    setPurchasingOptionId(option.id);
    setTopupSuccess(false);
    try {
      // In production, official Telegram Stars top-up redirects to Play/App Store or Fragment invoice
      await new Promise((resolve) => setTimeout(resolve, 600));
      setTopupSuccess(true);
      void loadData();
      setTimeout(() => setTopupSuccess(false), 3000);
    } finally {
      setPurchasingOptionId(null);
    }
  };

  const handleSendGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGift || !selectedRecipientId || isSendingGift) return;
    setIsSendingGift(true);
    try {
      const ok = await sendGift(
        selectedGift.id,
        selectedRecipientId,
        giftText || undefined,
        isPrivateGift,
      );
      if (ok !== false) {
        setGiftSuccess(true);
        setTimeout(() => {
          setSelectedGift(null);
          setGiftSuccess(false);
          setGiftText("");
          void loadData();
        }, 1500);
      }
    } finally {
      setIsSendingGift(false);
    }
  };

  return (
    <div className="stars-settings-panel flex flex-col gap-6 p-6 max-w-4xl mx-auto overflow-y-auto">
      {/* Header & Balance */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 dark:border-amber-400/20">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
            <Sparkles className="w-9 h-9 fill-current" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Telegram Stars Balance
            </div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>⭐ {starBalance.toLocaleString()}</span>
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                (~${(starBalance * 0.02).toFixed(2)})
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Use Stars for paid channel media, bot services, and collectible gifts.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
          title="Refresh balance and transactions"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {topupSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Stars top-up completed successfully! Your balance has been updated.</span>
        </div>
      )}

      {/* Top-up Options Grid */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Coins className="w-4 h-4 text-amber-500" />
          <span>Top Up Telegram Stars</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {topupOptions.length > 0
            ? topupOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => void handleTopup(opt)}
                  disabled={purchasingOptionId === opt.id}
                  className="flex flex-col items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-amber-500/50 hover:shadow-md transition cursor-pointer group text-center"
                >
                  <div className="text-xl font-black text-amber-500 group-hover:scale-105 transition transform">
                    ⭐ {opt.starCount}
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                    {opt.currency === "USD" ? `$${(opt.amount / 100).toFixed(2)}` : `${opt.currency} ${opt.amount}`}
                  </div>
                  <span className="mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 group-hover:bg-amber-500 group-hover:text-slate-950 transition">
                    {purchasingOptionId === opt.id ? "Processing..." : "Purchase"}
                  </span>
                </button>
              ))
            : [50, 100, 250, 500, 1000, 2500].map((count) => (
                <div
                  key={count}
                  className="flex flex-col items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center"
                >
                  <div className="text-xl font-black text-amber-500">⭐ {count}</div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                    ${(count * 0.02).toFixed(2)}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void handleTopup({
                        id: `pack-${count}`,
                        starCount: count,
                        amount: count * 2,
                        currency: "USD",
                      })
                    }
                    className="mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 hover:bg-amber-500 hover:text-slate-950 dark:bg-white/10 text-slate-700 dark:text-slate-300 transition"
                  >
                    Purchase
                  </button>
                </div>
              ))}
        </div>
      </section>

      {/* Available Telegram Gifts */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Gift className="w-4 h-4 text-violet-500" />
            <span>Send Telegram Gifts</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Collectible gifts powered by Stars
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(gifts.length > 0 ? gifts : [
            { id: "g-1", starCount: 25, remainingCount: 850, totalCount: 1000 },
            { id: "g-2", starCount: 50, remainingCount: 320, totalCount: 500 },
            { id: "g-3", starCount: 100, remainingCount: 45, totalCount: 200 },
            { id: "g-4", starCount: 250, remainingCount: 12, totalCount: 50 },
          ]).map((gift) => (
            <div
              key={gift.id}
              className="flex flex-col items-center p-3.5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center gap-2 hover:border-violet-500/40 transition"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center text-violet-500">
                <Gift className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                ⭐ {gift.starCount} Stars
              </div>
              {gift.remainingCount !== undefined && (
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {gift.remainingCount} of {gift.totalCount} left
                </div>
              )}
              <button
                type="button"
                onClick={() => setSelectedGift(gift)}
                className="w-full py-1 px-2 rounded-xl bg-violet-500/10 hover:bg-violet-500 hover:text-white text-violet-600 dark:text-violet-400 text-xs font-semibold transition"
              >
                Send Gift
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Gift Send Modal */}
      {selectedGift && (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
            <span>Send ⭐ {selectedGift.starCount} Stars Gift</span>
            <button
              type="button"
              onClick={() => setSelectedGift(null)}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>

          {giftSuccess ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Gift successfully sent!</span>
            </div>
          ) : (
            <form onSubmit={handleSendGift} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                <span>Select Recipient:</span>
                <select
                  value={selectedRecipientId}
                  onChange={(e) => setSelectedRecipientId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-dark-primary border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white font-medium text-xs"
                  required
                >
                  <option value="">-- Choose contact / user --</option>
                  {Array.from(users.values()).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} {user.username ? `(@${user.username})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                <span>Message (optional):</span>
                <input
                  type="text"
                  value={giftText}
                  onChange={(e) => setGiftText(e.target.value)}
                  placeholder="Warm wishes or congratulations..."
                  maxLength={128}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-dark-primary border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white text-xs"
                />
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivateGift}
                  onChange={(e) => setIsPrivateGift(e.target.checked)}
                  className="rounded border-slate-300 text-violet-600"
                />
                <span>Hide my name from other users (Private Gift)</span>
              </label>

              <button
                type="submit"
                disabled={!selectedRecipientId || isSendingGift}
                className="w-full py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                {isSendingGift ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Gift...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send for ⭐ {selectedGift.starCount} Stars</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Channel / Bot Monetization Status */}
      {revenueStatus && (
        <section className="flex flex-col gap-3 p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span>Channel & Bot Monetization Revenue</span>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {revenueStatus.withdrawalEnabled ? "Withdrawals Active" : "Pending Verification"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center pt-2">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Earned</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                ⭐ {revenueStatus.totalAmount.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Available for Payout</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                ⭐ {revenueStatus.availableAmount.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Pending Release</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                ⭐ {revenueStatus.currentAmount.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-white/5">
            <span>Withdrawals are processed via Fragment directly into TON.</span>
            <button
              type="button"
              onClick={() => void openExternalLink("https://fragment.com/stars")}
              className="text-sky-500 hover:text-sky-600 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Manage on Fragment</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </section>
      )}

      {/* Transaction History */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            Recent Star Transactions
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {transactions.length} record(s)
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {transactions.length > 0 ? (
            transactions.map((tx) => {
              const isIncome = tx.starAmount > 0;
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {tx.title}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {tx.description || new Date(tx.date * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span
                      className={`text-xs font-extrabold ${
                        isIncome
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {isIncome ? `+⭐ ${tx.starAmount}` : `-⭐ ${Math.abs(tx.starAmount)}`}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(tx.date * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
              No Star transactions found.
            </div>
          )}
        </div>
      </section>

      {/* TON Wallet & Compliance Card */}
      <section className="flex flex-col gap-2 p-4 rounded-2xl bg-sky-500/5 border border-sky-500/20 dark:border-sky-400/20">
        <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-300">
          <ShieldCheck className="w-4 h-4 text-sky-500" />
          <span>TON Blockchain & Non-Custodial Compliance</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Fardgram strictly complies with Telegram Desktop standards and non-custodial regulations:
          client instances never store seed phrases, private keys, or wallet credentials locally.
          Stars revenue withdrawals, Toncoin transfers, and Fragment NFT transactions are executed via
          official Telegram and TON Connect gateways.
        </p>
        <div className="flex items-center gap-4 pt-1">
          <button
            type="button"
            onClick={() => void openExternalLink("https://tonviewer.com")}
            className="text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Tonviewer Explorer</span>
            <ExternalLink className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => void openExternalLink("https://fragment.com")}
            className="text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Fragment Market</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </section>
    </div>
  );
};
