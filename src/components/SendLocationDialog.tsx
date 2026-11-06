import React, { useState, useEffect, useCallback } from "react";
import {
  Compass,
  MapPin,
  Navigation,
  Radio,
  X,
  AlertCircle,
  Clock,
  ShieldCheck,
  Building2,
  Crosshair,
} from "lucide-react";
import { useModalFocus } from "../hooks/useModalFocus";

export interface SendLocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (locationData: {
    latitude: number;
    longitude: number;
    horizontalAccuracy?: number;
    livePeriod?: number;
    heading?: number;
    title?: string;
    address?: string;
  }) => void | boolean | Promise<void | boolean>;
}

type LocationMode = "static" | "live";

export const SendLocationDialog: React.FC<SendLocationDialogProps> = ({
  isOpen,
  onClose,
  onSend,
}) => {
  const [mode, setMode] = useState<LocationMode>("static");
  const [latitude, setLatitude] = useState<string>("37.7749");
  const [longitude, setLongitude] = useState<string>("-122.4194");
  const [accuracy, setAccuracy] = useState<number | undefined>(undefined);
  const [liveDuration, setLiveDuration] = useState<number>(900); // 15 mins default
  const [venueTitle, setVenueTitle] = useState<string>("");
  const [venueAddress, setVenueAddress] = useState<string>("");

  const [locating, setLocating] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const dialogRef = useModalFocus<HTMLDivElement>(onClose, isSubmitting);

  // Reset or detect when dialog opens
  useEffect(() => {
    if (isOpen) {
      setGeoError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your operating system or browser.");
      return;
    }

    setLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setAccuracy(position.coords.accuracy);
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoError("Location permission was denied. You can still enter coordinates manually.");
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoError("Location information is currently unavailable.");
            break;
          case error.TIMEOUT:
            setGeoError("Location request timed out.");
            break;
          default:
            setGeoError("An unknown error occurred while retrieving location.");
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const parsedLat = parseFloat(latitude);
  const parsedLon = parseFloat(longitude);
  const isValidLat = !isNaN(parsedLat) && parsedLat >= -90 && parsedLat <= 90;
  const isValidLon = !isNaN(parsedLon) && parsedLon >= -180 && parsedLon <= 180;
  const canSubmit = isValidLat && isValidLon && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await onSend({
        latitude: parsedLat,
        longitude: parsedLon,
        horizontalAccuracy: accuracy,
        livePeriod: mode === "live" ? liveDuration : 0,
        title: venueTitle.trim() || undefined,
        address: venueAddress.trim() || undefined,
      });
      onClose();
    } catch {
      // error handled upstream
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-location-title"
      data-testid="send-location-dialog"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-slate-100 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <MapPin size={20} />
            </div>
            <div>
              <h3 id="send-location-title" className="text-base font-semibold leading-tight">
                Send Location
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Share a point on map or live real-time movement
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 p-1">
          <button
            type="button"
            onClick={() => setMode("static")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === "static"
                ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <MapPin size={15} />
            <span>Static Location</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("live")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === "live"
                ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Radio size={15} className={mode === "live" ? "animate-pulse" : ""} />
            <span>Share Live Location</span>
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Geolocation Trigger */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <Crosshair size={18} className="text-sky-500 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-semibold block text-slate-800 dark:text-slate-200">
                  Current GPS Position
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {locating ? "Acquiring coordinates..." : "Auto-detect via system sensor"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={locating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-500 text-white hover:bg-sky-600 active:scale-95 transition-all disabled:opacity-50"
            >
              <Navigation size={13} className={locating ? "animate-spin" : ""} />
              <span>{locating ? "Locating..." : "Locate Me"}</span>
            </button>
          </div>

          {geoError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{geoError}</span>
            </div>
          )}

          {/* Coordinate Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Latitude (-90 to 90)
              </label>
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
                className={`w-full px-3 py-2 text-xs font-mono rounded-lg border bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${
                  !isValidLat
                    ? "border-rose-400 focus:ring-rose-400/20"
                    : "border-slate-300 dark:border-slate-700 focus:ring-sky-500/20 focus:border-sky-500"
                }`}
                placeholder="37.7749"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Longitude (-180 to 180)
              </label>
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
                className={`w-full px-3 py-2 text-xs font-mono rounded-lg border bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${
                  !isValidLon
                    ? "border-rose-400 focus:ring-rose-400/20"
                    : "border-slate-300 dark:border-slate-700 focus:ring-sky-500/20 focus:border-sky-500"
                }`}
                placeholder="-122.4194"
              />
            </div>
          </div>

          {/* Live Location Duration Selector */}
          {mode === "live" && (
            <div className="space-y-2 pt-1 animate-fade-in">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Share My Live Location For:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "15 minutes", value: 900 },
                  { label: "1 hour", value: 3600 },
                  { label: "8 hours", value: 28800 },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setLiveDuration(item.value)}
                    className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-medium border transition-all ${
                      liveDuration === item.value
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-semibold ring-1 ring-emerald-500"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Clock size={15} className="mb-1 opacity-80" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Venue Inputs (Static Mode only) */}
          {mode === "static" && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <Building2 size={14} />
                <span>Venue Details (Optional)</span>
              </div>
              <input
                type="text"
                value={venueTitle}
                onChange={(e) => setVenueTitle(e.target.value)}
                placeholder="Venue or Place Name (e.g. Fardgram Headquarters)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                placeholder="Street address or landmark description"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>
          )}

          {/* Privacy Safeguard Note */}
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>
              Your location is shared solely with members of this chat. You can stop live location sharing at any time.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${
                mode === "live"
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                  : "bg-sky-600 hover:bg-sky-700 shadow-sky-500/20"
              }`}
            >
              {mode === "live" ? (
                <>
                  <Radio size={14} className="animate-pulse" />
                  <span>Start Live Sharing</span>
                </>
              ) : (
                <>
                  <MapPin size={14} />
                  <span>Send Location</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
