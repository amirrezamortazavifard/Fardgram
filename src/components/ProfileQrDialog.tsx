import React, { useState, useRef } from "react";
import { QrCode, Copy, Check, X, Download, ExternalLink, Send } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { openExternalLink } from "../utils/externalLinks";
import { useModalFocus } from "../hooks/useModalFocus";

export interface ProfileQrDialogProps {
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
  const qrRef = useRef<HTMLDivElement>(null);
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);

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

  const handleDownloadQr = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${username || "profile"}-qrcode.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Profile QR Code"
      data-testid="profile-qr-dialog"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 flex flex-col items-center gap-4 text-slate-900 dark:text-white"
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
            aria-label="Close dialog"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Real camera-scannable QR Code */}
        <div
          ref={qrRef}
          className="relative p-5 rounded-2xl bg-white border border-slate-200 shadow-inner flex items-center justify-center"
        >
          <QRCodeSVG
            value={profileUrl}
            size={180}
            level="H"
            marginSize={2}
            fgColor="#0f172a"
            bgColor="#ffffff"
            imageSettings={{
              src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230284c7'><path d='M21.5 2L2 12l7 3 3 7 9.5-20z'/></svg>",
              height: 36,
              width: 36,
              excavate: true,
            }}
          />
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
            onClick={handleDownloadQr}
            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Download QR Code (SVG)"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void openExternalLink(profileUrl)}
            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Open in Browser"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
