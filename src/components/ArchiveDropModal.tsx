import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Archive,
  FileText,
  Folder,
  X,
  AlertTriangle,
  Loader2,
  Check,
  Files,
  Sliders,
} from "lucide-react";
import {
  buildZipArchive,
  formatFileSize,
  isHiddenOrSystemFile,
  TELEGRAM_MAX_FILE_SIZE,
  type ScannedArchiveFile,
  type ZipProgress,
} from "../utils/archiveBuilder";

export interface ArchiveDropModalProps {
  files: ScannedArchiveFile[];
  defaultArchiveName?: string;
  hasDirectory?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSendArchive: (archiveFile: File) => void;
  onSendSeparateFiles: (files: File[]) => void;
}

export const ArchiveDropModal: React.FC<ArchiveDropModalProps> = ({
  files,
  defaultArchiveName = "archive.zip",
  hasDirectory = false,
  isOpen,
  onClose,
  onSendArchive,
  onSendSeparateFiles,
}) => {
  const [archiveName, setArchiveName] = useState(() => {
    const clean = defaultArchiveName.replace(/\.zip$/i, "");
    return clean || (hasDirectory ? "folder" : "archive");
  });
  const [compressionMode, setCompressionMode] = useState<"deflate" | "store">("deflate");
  const [includeHidden, setIncludeHidden] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState<ZipProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const clean = defaultArchiveName.replace(/\.zip$/i, "");
      setArchiveName(clean || (hasDirectory ? "folder" : "archive"));
      setErrorMessage(null);
      setProgress(null);
      setIsCompressing(false);
    }
  }, [isOpen, defaultArchiveName, hasDirectory]);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Filtered files list based on hidden toggle
  const visibleFiles = useMemo(() => {
    if (includeHidden) return files;
    return files.filter((f) => !isHiddenOrSystemFile(f.relativePath));
  }, [files, includeHidden]);

  const hiddenCount = useMemo(() => {
    return files.filter((f) => isHiddenOrSystemFile(f.relativePath)).length;
  }, [files]);

  const totalBytes = useMemo(() => {
    return visibleFiles.reduce((acc, f) => acc + f.size, 0);
  }, [visibleFiles]);

  const isOversized = totalBytes > TELEGRAM_MAX_FILE_SIZE;

  const handleCancelCompression = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsCompressing(false);
    setProgress(null);
  };

  const handleCompressAndSend = async () => {
    if (visibleFiles.length === 0) {
      setErrorMessage("No files available to archive.");
      return;
    }
    if (isOversized) {
      setErrorMessage(
        `Total size (${formatFileSize(totalBytes)}) exceeds Telegram's 2 GB document limit.`,
      );
      return;
    }

    setErrorMessage(null);
    setIsCompressing(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const cleanName = archiveName.trim() || (hasDirectory ? "folder" : "archive");
      const finalZipName = cleanName.toLowerCase().endsWith(".zip")
        ? cleanName
        : `${cleanName}.zip`;

      const zipFile = await buildZipArchive(visibleFiles, {
        archiveName: finalZipName,
        compression: compressionMode,
        includeHidden,
        signal: controller.signal,
        onProgress: (p) => setProgress(p),
      });

      setIsCompressing(false);
      onSendArchive(zipFile);
      onClose();
    } catch (err: any) {
      if (err?.name === "AbortError" || controller.signal.aborted) {
        setIsCompressing(false);
        setProgress(null);
        return;
      }
      setErrorMessage(err?.message || "Failed to create archive.");
      setIsCompressing(false);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleSendSeparate = () => {
    if (isCompressing) return;
    const rawFiles = visibleFiles.map((vf) => vf.file);
    onSendSeparateFiles(rawFiles);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-label="Archive Drop Dialog"
      ref={modalRef}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !isCompressing) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl border bg-white dark:bg-[#0c101a] border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Archive size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {hasDirectory ? "Send Folder or Archive" : "Send Files as Archive"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/60">
                {visibleFiles.length} {visibleFiles.length === 1 ? "file" : "files"} •{" "}
                {formatFileSize(totalBytes)} uncompressed
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            onClick={isCompressing ? handleCancelCompression : onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Oversize Warning */}
          {isOversized && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-400 text-xs">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                Total size exceeds Telegram document upload limit of 2 GB. Please remove items or
                send files individually.
              </span>
            </div>
          )}

          {/* Archive Name Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="archive-name-input"
              className="text-xs font-medium text-slate-700 dark:text-white/80"
            >
              Archive Name
            </label>
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <input
                id="archive-name-input"
                type="text"
                disabled={isCompressing}
                value={archiveName}
                onChange={(e) => setArchiveName(e.target.value)}
                placeholder="archive"
                className="flex-1 px-3.5 py-2 text-sm bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
              />
              <span className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-white/40 bg-slate-100 dark:bg-white/[0.05] border-l border-slate-200 dark:border-white/10 select-none">
                .zip
              </span>
            </div>
          </div>

          {/* Compression & Options */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-white/80">
                Compression Format
              </label>
              <select
                disabled={isCompressing}
                value={compressionMode}
                onChange={(e) => setCompressionMode(e.target.value as "deflate" | "store")}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121622] text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="deflate">ZIP (Deflate Compressed)</option>
                <option value="store">ZIP (Store / Lossless)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-white/80">
                Hidden & System Files
              </label>
              <label className="flex items-center gap-2 px-3 py-2 h-[34px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121622] cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors">
                <input
                  type="checkbox"
                  disabled={isCompressing}
                  checked={includeHidden}
                  onChange={(e) => setIncludeHidden(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-700 dark:text-white/80 truncate">
                  {hiddenCount > 0 ? `Include (${hiddenCount} hidden)` : "Include dotfiles"}
                </span>
              </label>
            </div>
          </div>

          {/* File Structure Preview List */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-white/80">
              <span>Archive Contents</span>
              <span className="text-slate-400 dark:text-white/40">
                {visibleFiles.length} items
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-black/20 p-2 space-y-1 divide-y divide-slate-100 dark:divide-white/[0.04]">
              {visibleFiles.map((fileEntry, idx) => {
                const isHidden = isHiddenOrSystemFile(fileEntry.relativePath);
                const hasSubdir = fileEntry.relativePath.includes("/");

                return (
                  <div
                    key={`${fileEntry.relativePath}-${idx}`}
                    className="flex items-center justify-between py-1 px-1.5 text-xs text-slate-700 dark:text-white/80 group"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      {hasSubdir ? (
                        <Folder
                          size={14}
                          className="shrink-0 text-amber-500 dark:text-amber-400"
                        />
                      ) : (
                        <FileText
                          size={14}
                          className="shrink-0 text-slate-400 dark:text-white/40"
                        />
                      )}
                      <span className="truncate font-mono text-[11px]" title={fileEntry.relativePath}>
                        {fileEntry.relativePath}
                      </span>
                      {isHidden && (
                        <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/60">
                          hidden
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] font-mono text-slate-400 dark:text-white/40">
                      {formatFileSize(fileEntry.size)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compression Progress Bar */}
          {isCompressing && progress && (
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-blue-900 dark:text-blue-300">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-blue-600 dark:text-blue-400" />
                  <span>
                    {progress.stage === "assembling"
                      ? "Finalizing archive package..."
                      : `Compressing file ${progress.completedCount + 1} of ${progress.totalCount}`}
                  </span>
                </div>
                <span>{progress.percent}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-blue-200 dark:bg-blue-950 overflow-hidden">
                <div
                  className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-150"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              {progress.currentFile && (
                <p className="text-[11px] font-mono text-slate-500 dark:text-white/50 truncate">
                  {progress.currentFile}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.02]">
          <button
            type="button"
            disabled={isCompressing}
            className="px-3.5 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-white/70 hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
            onClick={isCompressing ? handleCancelCompression : onClose}
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isCompressing || visibleFiles.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl text-slate-700 dark:text-white/90 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/15 transition-colors disabled:opacity-50"
              onClick={handleSendSeparate}
              title="Send each file separately without creating an archive"
            >
              <Files size={14} />
              <span>Send Separately</span>
            </button>

            <button
              type="button"
              disabled={isCompressing || isOversized || visibleFiles.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              onClick={handleCompressAndSend}
            >
              {isCompressing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Compressing...</span>
                </>
              ) : (
                <>
                  <Archive size={14} />
                  <span>Compress & Send Archive</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
