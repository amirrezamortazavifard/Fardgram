import { useState, useRef, useEffect } from "react";
import {
  Download,
  Folder,
  FileCode,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  Pause,
  StopCircle,
  Image,
  Video,
  Mic,
  Music,
  File,
  Smile,
  Layers,
  Calendar,
} from "lucide-react";
import { useTelegramStore } from "../../store/telegramStore";
import type { Chat } from "../../telegram/types";
import type {
  ChatExportFormat,
  ChatExportMediaCategory,
  ChatExportProgress,
  ChatExportSummary,
} from "../../export/types";

interface ChatExportDialogProps {
  chat: Chat;
  onClose: () => void;
}

export function ChatExportDialog({ chat, onClose }: ChatExportDialogProps) {
  const pickFolder = useTelegramStore((state) => state.pickExportFolder);
  const openFolder = useTelegramStore((state) => state.openExportFolder);
  const exportChatHistory = useTelegramStore((state) => state.exportChatHistory);
  const cancelExport = useTelegramStore((state) => state.cancelChatExport);
  const pauseExport = useTelegramStore((state) => state.pauseChatExport);
  const resumeExport = useTelegramStore((state) => state.resumeChatExport);

  // Form State
  const [format, setFormat] = useState<ChatExportFormat>("both");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<ChatExportMediaCategory[]>([
    "photos",
    "videos",
    "voice",
    "audio",
    "documents",
  ]);
  const [maxSizeMb, setMaxSizeMb] = useState<number>(50);
  const [includeService, setIncludeService] = useState(true);
  const [destinationDir, setDestinationDir] = useState<string>("");

  // Execution State
  const [viewState, setViewState] = useState<"config" | "progress" | "complete">("config");
  const [progress, setProgress] = useState<ChatExportProgress>({
    phase: "idle",
    fetchedMessages: 0,
    copiedMediaCount: 0,
    totalMediaBytes: 0,
    statusText: "",
  });
  const [summary, setSummary] = useState<ChatExportSummary | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleMediaCategory = (cat: ChatExportMediaCategory) => {
    setSelectedMedia((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handlePickFolder = async () => {
    const chosen = await pickFolder();
    if (chosen) {
      setDestinationDir(chosen);
      setErrorMsg(null);
    }
  };

  const handleStartExport = async () => {
    if (!destinationDir.trim()) {
      setErrorMsg("Please select a destination directory first.");
      return;
    }

    const fromTimestamp = fromDate ? Math.floor(new Date(fromDate).getTime() / 1000) : undefined;
    const toTimestamp = toDate ? Math.floor(new Date(toDate).getTime() / 1000) + 86399 : undefined;

    setViewState("progress");
    setErrorMsg(null);

    try {
      const res = await exportChatHistory(
        {
          chatId: chat.id,
          chatTitle: chat.title || "Exported Chat",
          format,
          dateRange: { from: fromTimestamp, to: toTimestamp },
          mediaCategories: selectedMedia,
          maxMediaSizeMb: maxSizeMb,
          includeServiceMessages: includeService,
          destinationDir,
        },
        (p) => setProgress(p),
      );
      setSummary(res);
      setViewState("complete");
    } catch (err: any) {
      if (err?.message === "EXPORT_CANCELLED") {
        setViewState("config");
      } else {
        setErrorMsg(err?.message || "Export encountered an unexpected error.");
      }
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeExport();
      setIsPaused(false);
    } else {
      pauseExport();
      setIsPaused(true);
    }
  };

  const handleCancel = () => {
    if (viewState === "progress") {
      cancelExport();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-dark-primary border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Download size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Export Chat History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {chat.title || "Selected Conversation"}
              </p>
            </div>
          </div>
          {viewState !== "progress" && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800 dark:text-slate-200 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {viewState === "config" && (
            <>
              {/* Output Format */}
              <div>
                <label className="font-semibold block mb-2 text-slate-700 dark:text-slate-300">
                  Export Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormat("html")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                      format === "html"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium"
                        : "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <FileText size={18} className="mb-1" />
                    <span>HTML</span>
                    <span className="text-[10px] text-slate-400">Readable</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat("json")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                      format === "json"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium"
                        : "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <FileCode size={18} className="mb-1" />
                    <span>JSON</span>
                    <span className="text-[10px] text-slate-400">Data</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat("both")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                      format === "both"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium"
                        : "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <Layers size={18} className="mb-1" />
                    <span>Both</span>
                    <span className="text-[10px] text-slate-400">Complete</span>
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="font-semibold block mb-2 text-slate-700 dark:text-slate-300">
                  Date Range (Optional)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">From</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">To</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Media Categories */}
              <div>
                <label className="font-semibold block mb-2 text-slate-700 dark:text-slate-300">
                  Media Attachments
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "photos", label: "Photos", icon: Image },
                    { id: "videos", label: "Videos", icon: Video },
                    { id: "voice", label: "Voice Messages", icon: Mic },
                    { id: "audio", label: "Audio Files", icon: Music },
                    { id: "documents", label: "Documents", icon: File },
                    { id: "stickers", label: "Stickers", icon: Smile },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isChecked = selectedMedia.includes(item.id as ChatExportMediaCategory);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleMediaCategory(item.id as ChatExportMediaCategory)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition ${
                          isChecked
                            ? "border-blue-500/50 bg-blue-500/5 text-blue-600 dark:text-blue-400 font-medium"
                            : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                        }`}
                      >
                        <Icon size={14} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Size & Options */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Max file size</span>
                  <select
                    value={maxSizeMb}
                    onChange={(e) => setMaxSizeMb(Number(e.target.value))}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141b26] text-slate-900 dark:text-white font-medium"
                  >
                    <option value={8}>Up to 8 MB</option>
                    <option value={50}>Up to 50 MB</option>
                    <option value={100}>Up to 100 MB</option>
                    <option value={0}>Unlimited</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeService}
                    onChange={(e) => setIncludeService(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Include service messages (pins, member joins, updates)</span>
                </label>
              </div>

              {/* Destination Directory */}
              <div>
                <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">
                  Export Location
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    placeholder="Choose destination folder..."
                    value={destinationDir}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={handlePickFolder}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition font-medium"
                  >
                    <Folder size={14} />
                    <span>Browse</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {viewState === "progress" && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full border-3 border-blue-500/20 border-t-blue-500 animate-spin flex items-center justify-center" />
              <div>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                  Exporting Chat History...
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  {progress.statusText || "Processing messages..."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full max-w-xs pt-4 border-t border-slate-100 dark:border-white/10">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="text-slate-400 text-[10px] block">Messages</span>
                  <span className="font-semibold text-base text-slate-800 dark:text-slate-200">
                    {progress.fetchedMessages}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="text-slate-400 text-[10px] block">Media Files</span>
                  <span className="font-semibold text-base text-slate-800 dark:text-slate-200">
                    {progress.copiedMediaCount}
                  </span>
                </div>
              </div>
            </div>
          )}

          {viewState === "complete" && summary && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Export Completed!
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Your chat data has been successfully saved to disk.
                </p>
              </div>

              <div className="w-full rounded-xl bg-slate-50 dark:bg-white/5 p-4 text-left space-y-2 border border-slate-100 dark:border-white/10">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Messages:</span>
                  <span className="font-semibold">{summary.totalMessages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Media Files:</span>
                  <span className="font-semibold">{summary.totalMediaFiles}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Export Location:</span>
                  <span className="font-mono text-[11px] truncate max-w-[200px]" title={summary.exportPath}>
                    {summary.exportPath}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
          {viewState === "config" && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartExport}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs transition flex items-center gap-1.5"
              >
                <Download size={14} />
                <span>Export Chat</span>
              </button>
            </>
          )}

          {viewState === "progress" && (
            <>
              <button
                type="button"
                onClick={handlePauseResume}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 font-medium transition flex items-center gap-1.5"
              >
                {isPaused ? <Play size={14} /> : <Pause size={14} />}
                <span>{isPaused ? "Resume" : "Pause"}</span>
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition flex items-center gap-1.5"
              >
                <StopCircle size={14} />
                <span>Cancel</span>
              </button>
            </>
          )}

          {viewState === "complete" && summary && (
            <>
              <button
                type="button"
                onClick={() => openFolder(summary.exportPath)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 font-medium transition flex items-center gap-1.5"
              >
                <Folder size={14} />
                <span>Open Folder</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs transition"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
