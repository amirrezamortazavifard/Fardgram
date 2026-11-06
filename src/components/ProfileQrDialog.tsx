import React, { useState } from "react";
import { QrCode, Copy, Check, X, Download, ExternalLink, Send } from "lucide-react";
import { openExternalLink } from "../utils/externalLinks";

interface ProfileQrDialogProps {
  title: string;
  username?: string;
  phoneNumber?: string;
  onClose: () => void;
}

export const ProfileQrDialog: React.FC<ProfileQrDialogProps> = ({
  title,
  username,
  phoneNumber,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const profileUrl = username
    ? `https://t.me/${username}`
    : phoneNumber
      ? `https://t.me/+${phoneNumber.replace(/\D/g, "")}`
      : "https://t.me";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop
    }
  };

  // Generate deterministic QR matrix pattern based on url characters
  const generateQrMatrix = (input: string) => {
    const size = 25;
    const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    // Corner finder patterns
    const drawFinder = (startX: number, startY: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const isBorder = x === 0 || x === 6 || y === 0 || y === 6;
          const isCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          matrix[startY + y][startX + x] = isBorder || isCenter;
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(size - 7, 0);
    drawFinder(0, size - 7);

    // Hash pseudo-randomness for data modules
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const inFinder =
          (x < 8 && y < 8) ||
          (x >= size - 8 && y < 8) ||
          (x < 8 && y >= size - 8) ||
          (x >= 9 && x <= 15 && y >= 9 && y <= 15); // Leave center for icon
        if (!inFinder) {
          const pseudoBit = ((hash ^ (x * 37 + y * 73)) & 1) === 1;
          matrix[y][x] = pseudoBit;
        }
      }
    }

    return { size, matrix };
  };

  const { size, matrix } = generateQrMatrix(profileUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Profile QR Code"
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-dark-primary border border-slate-200 dark:border-white/10 shadow-2xl p-6 flex flex-col items-center gap-4 text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-sky-500" />
            <h3 className="text-base font-bold">Profile QR Code</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code Presentation */}
        <div className="relative p-5 rounded-2xl bg-white border border-slate-200 shadow-inner flex items-center justify-center">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-48 h-48 shape-rendering-crisp"
            shapeRendering="crispEdges"
          >
            {matrix.flatMap((row, y) =>
              row.map((active, x) =>
                active ? (
                  <rect
                    key={`${x}-${y}`}
                    x={x}
                    y={y}
                    width={1}
                    height={1}
                    fill="#0f172a"
                  />
                ) : null
              )
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center text-white shadow-md border-2 border-white">
              <Send className="w-5 h-5 -ml-0.5" />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center text-center">
          <span className="text-sm font-bold text-slate-900 dark:text-white">{title}</span>
          <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">{profileUrl}</span>
        </div>

        {/* Action buttons */}
        <div className="w-full flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex-1 py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void openExternalLink(profileUrl)}
            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
            title="Open in Browser"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
