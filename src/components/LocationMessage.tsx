import React, { useState, useEffect, useCallback } from "react";
import { Compass, ExternalLink, MapPin, Navigation, Radio, Copy, Check, StopCircle } from "lucide-react";
import { openExternalLink } from "../utils/externalLinks";
import { telegramStore } from "../store/telegramStore";
import type { Message, MessageLocationContent } from "../telegram/types";

export interface LocationMessageProps {
  message: Message;
  content: MessageLocationContent;
  isOutgoing: boolean;
  onStopLiveLocation?: (messageId: string, chatId: string) => Promise<boolean | void>;
}

export const formatCoordinates = (lat: number, lon: number): string => {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
};

export const formatDurationCountdown = (seconds: number): string => {
  if (seconds <= 0) return "Expired";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSecs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSecs}s left`;
  }
  return `${remainingSecs}s left`;
};

export const LocationMessage: React.FC<LocationMessageProps> = ({
  message,
  content,
  isOutgoing,
  onStopLiveLocation,
}) => {
  const [copied, setCopied] = useState(false);
  const [stopping, setStopping] = useState(false);

  const isLive = Boolean(content.livePeriod && content.livePeriod > 0);
  const initialExpiresIn = content.expiresIn !== undefined
    ? content.expiresIn
    : isLive && content.livePeriod
      ? Math.max(0, Math.floor((new Date(message.sentAt).getTime() + content.livePeriod * 1000 - Date.now()) / 1000))
      : 0;

  const [remainingTime, setRemainingTime] = useState(initialExpiresIn);

  useEffect(() => {
    if (!isLive || remainingTime <= 0) return;
    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLive, remainingTime]);

  const isLiveActive = isLive && remainingTime > 0 && content.expiresIn !== 0;

  const handleOpenMap = useCallback(() => {
    const url = `https://www.google.com/maps?q=${encodeURIComponent(`${content.latitude},${content.longitude}`)}`;
    void openExternalLink(url);
  }, [content.latitude, content.longitude]);

  const handleCopyCoordinates = useCallback(async () => {
    try {
      const coordString = `${content.latitude.toFixed(6)}, ${content.longitude.toFixed(6)}`;
      await navigator.clipboard.writeText(coordString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failures
    }
  }, [content.latitude, content.longitude]);

  const handleStopLive = useCallback(async () => {
    if (stopping) return;
    try {
      setStopping(true);
      if (onStopLiveLocation) {
        await onStopLiveLocation(message.id, message.chatId);
      } else {
        await telegramStore.getState().stopLiveLocation(message.id, message.chatId);
      }
      setRemainingTime(0);
    } catch {
      // Re-enable if stopping failed
      setStopping(false);
    }
  }, [message.id, message.chatId, onStopLiveLocation, stopping]);

  return (
    <div
      className="location-message-card group overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 shadow-sm backdrop-blur-md transition-all hover:shadow-md"
      data-testid="location-message-card"
    >
      {/* Map visual preview header */}
      <div
        className="relative h-36 w-full cursor-pointer overflow-hidden bg-slate-100 dark:bg-slate-800 transition-opacity hover:opacity-95"
        onClick={handleOpenMap}
        role="button"
        tabIndex={0}
        aria-label="Open location in external map"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpenMap();
          }
        }}
      >
        {/* Subtle decorative street map grid svg */}
        <svg
          className="absolute inset-0 h-full w-full opacity-40 dark:opacity-20 stroke-slate-400 dark:stroke-slate-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
        >
          <defs>
            <pattern id={`map-grid-${message.id}`} width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" strokeWidth="0.8" />
            </pattern>
            {/* Soft decorative contour lines */}
            <pattern id={`map-contour-${message.id}`} width="84" height="84" patternUnits="userSpaceOnUse">
              <path d="M 0 42 Q 28 10 56 42 T 84 42" fill="none" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#map-grid-${message.id})`} />
          <rect width="100%" height="100%" fill={`url(#map-contour-${message.id})`} />
          {/* Fictional road arterials */}
          <path d="M -10 110 Q 90 80 180 100 T 360 40" strokeWidth="4" stroke="currentColor" opacity="0.25" />
          <path d="M 120 -10 Q 140 70 110 160" strokeWidth="3" stroke="currentColor" opacity="0.2" />
        </svg>

        {/* Center Pin & Radar Pulse */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {isLiveActive && (
            <div className="absolute h-16 w-16 animate-ping rounded-full bg-emerald-500/25" />
          )}
          {isLiveActive ? (
            <div className="relative flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500 text-white shadow-lg ring-4 ring-emerald-400/30">
              {content.heading !== undefined ? (
                <Navigation
                  size={20}
                  className="transition-transform duration-300"
                  style={{ transform: `rotate(${content.heading}deg)` }}
                />
              ) : (
                <Radio size={20} className="animate-pulse" />
              )}
            </div>
          ) : (
            <div className="relative flex items-center justify-center h-10 w-10 rounded-full bg-rose-500 text-white shadow-lg ring-4 ring-rose-400/20">
              <MapPin size={22} className="-translate-y-0.5" />
            </div>
          )}
        </div>

        {/* Live / Static Status Badge */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-md shadow-sm transition-all bg-black/40 text-white border border-white/20">
          {isLive ? (
            <>
              <span
                className={`h-2 w-2 rounded-full ${isLiveActive ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`}
              />
              <span>{isLiveActive ? "Live Location" : "Live Ended"}</span>
            </>
          ) : (
            <>
              <MapPin size={12} className="text-rose-400" />
              <span>Location</span>
            </>
          )}
        </div>

        {/* Heading / Accuracy tag if present */}
        {content.horizontalAccuracy !== undefined && content.horizontalAccuracy > 0 && (
          <div className="absolute top-2.5 right-2.5 rounded-md px-2 py-0.5 text-[10px] font-medium backdrop-blur-md bg-black/40 text-white border border-white/10">
            ±{Math.round(content.horizontalAccuracy)}m
          </div>
        )}

        {/* Interactive "Open External" hover hint */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white/90 bg-black/50 backdrop-blur-sm opacity-90 group-hover:opacity-100 transition-opacity">
          <span>Maps</span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Details body */}
      <div className="p-3 space-y-2">
        {/* Venue Title & Address or Coordinates */}
        <div>
          {content.title ? (
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
              {content.title}
            </h4>
          ) : (
            <h4 className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
              {formatCoordinates(content.latitude, content.longitude)}
            </h4>
          )}

          {content.address && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
              {content.address}
            </p>
          )}
          {content.title && (
            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
              {formatCoordinates(content.latitude, content.longitude)}
            </p>
          )}
        </div>

        {/* Live sharing countdown & Stop Sharing Action */}
        {isLive && (
          <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/5 text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-400">
              {isLiveActive ? formatDurationCountdown(remainingTime) : "Sharing expired"}
            </span>

            {isOutgoing && isLiveActive && (
              <button
                type="button"
                onClick={handleStopLive}
                disabled={stopping}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-95 transition-all disabled:opacity-50"
              >
                <StopCircle size={13} />
                <span>{stopping ? "Stopping..." : "Stop Sharing"}</span>
              </button>
            )}
          </div>
        )}

        {/* Quick action footer */}
        <div className="flex items-center justify-between pt-1 text-xs text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={handleCopyCoordinates}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Copy latitude and longitude"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy coordinates</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenMap}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 font-medium transition-colors"
          >
            <span>Open in Google Maps</span>
            <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
