import { useState, useRef } from "react";
import { X, RotateCw, ExternalLink, Globe } from "lucide-react";
import { useTelegramStore } from "../store/telegramStore";
import { openExternalLink } from "../utils/externalLinks";
import { isTauri } from "@tauri-apps/api/core";

export function MiniAppModal() {
  const activeMiniApp = useTelegramStore((state) => state.activeMiniApp);
  const closeMiniApp = useTelegramStore((state) => state.closeMiniApp);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // In Tauri native desktop mode, the dedicated native WebviewWindow is opened.
  // The in-app modal serves mock mode, browser mode, and webview fallback.
  if (!activeMiniApp || isTauri()) {
    return null;
  }

  let hostname = "";
  try {
    hostname = new URL(activeMiniApp.url).hostname;
  } catch {
    hostname = "mini-app";
  }

  const handleReload = () => {
    setLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = activeMiniApp.url;
    }
  };

  const handleOpenExternal = async () => {
    await openExternalLink(activeMiniApp.url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={activeMiniApp.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="flex flex-col w-full max-w-[440px] h-[720px] max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
        {/* Top Header / Chrome */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate leading-tight">
                {activeMiniApp.title}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {activeMiniApp.botUsername ? `@${activeMiniApp.botUsername} • ` : ""}
                {hostname}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleReload}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              title="Reload Mini App"
              aria-label="Reload Mini App"
            >
              <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              title="Open in Browser"
              aria-label="Open in Browser"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => void closeMiniApp()}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              title="Close Mini App"
              aria-label="Close Mini App"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="relative flex-1 bg-slate-100 dark:bg-black overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#0c101a] z-10">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Loading Mini App...
              </p>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={activeMiniApp.url}
            title={activeMiniApp.title}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    </div>
  );
}
