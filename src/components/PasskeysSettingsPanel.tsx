import { useEffect, useState } from "react";
import { KeyRound, Plus, Trash2, LoaderCircle, ShieldCheck, AlertCircle } from "lucide-react";
import { useTelegramStore } from "../store/telegramStore";

export function PasskeysSettingsPanel() {
  const passkeys = useTelegramStore((state) => state.passkeys);
  const loading = useTelegramStore((state) => state.passkeysLoading);
  const error = useTelegramStore((state) => state.passkeyError);
  const passkeyAuthAvailable = useTelegramStore((state) => state.passkeyAuthAvailable);
  const loadPasskeys = useTelegramStore((state) => state.loadLoginPasskeys);
  const registerPasskey = useTelegramStore((state) => state.registerPasskey);
  const removePasskey = useTelegramStore((state) => state.removePasskey);

  const [registering, setRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  const handleAddPasskey = async () => {
    setRegistering(true);
    setActionMessage(null);
    try {
      const result = await registerPasskey();
      if (result) {
        setActionMessage(`Passkey "${result.name || "New Passkey"}" successfully added!`);
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleRemovePasskey = async (id: string, name: string) => {
    setDeletingId(id);
    setActionMessage(null);
    try {
      const ok = await removePasskey(id);
      if (ok) {
        setActionMessage(`Passkey "${name}" removed.`);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (unixSeconds: number) => {
    if (!unixSeconds) return "Never";
    return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <section className="settings-section rounded-2xl bg-white dark:bg-dark-primary border border-slate-200 dark:border-white/10 p-5 shadow-sm space-y-4" aria-labelledby="passkeys-heading">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <KeyRound size={20} />
          </div>
          <div>
            <h4 id="passkeys-heading" className="text-base font-semibold text-slate-900 dark:text-white">
              Passkeys
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Sign in securely without SMS codes using Windows Hello, biometric sensors, or security keys
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddPasskey}
          disabled={registering || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition shadow-sm"
        >
          {registering ? (
            <>
              <LoaderCircle size={14} className="animate-spin" />
              <span>Registering...</span>
            </>
          ) : (
            <>
              <Plus size={14} />
              <span>Add Passkey</span>
            </>
          )}
        </button>
      </div>

      {actionMessage && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">
          <ShieldCheck size={14} />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium border border-red-500/20">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        {loading && passkeys.length === 0 ? (
          <div className="flex items-center justify-center p-6 text-slate-400 text-xs gap-2">
            <LoaderCircle size={16} className="animate-spin" />
            <span>Loading passkeys...</span>
          </div>
        ) : passkeys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/10 p-6 text-center text-slate-500 dark:text-slate-400 text-xs space-y-1">
            <p className="font-medium text-slate-700 dark:text-slate-300">No passkeys registered</p>
            <p>You can add a passkey to quickly log in to your Telegram account on this or other devices.</p>
          </div>
        ) : (
          passkeys.map((pk) => (
            <div
              key={pk.id}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100/50 dark:hover:bg-white/[0.05] transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300">
                  <KeyRound size={16} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    {pk.name || "Passkey"}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Added {formatDate(pk.additionDate)} • Last used: {formatDate(pk.lastUsageDate)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemovePasskey(pk.id, pk.name)}
                disabled={deletingId === pk.id}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                title="Remove passkey"
              >
                {deletingId === pk.id ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
        <ShieldCheck size={14} className="text-blue-500" />
        <span>
          {passkeyAuthAvailable
            ? "Platform authenticator is available on this system."
            : "Platform authenticator will prompt during enrollment if supported by your OS."}
        </span>
      </div>
    </section>
  );
}
