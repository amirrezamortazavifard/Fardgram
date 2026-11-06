import React, { useState, useEffect } from "react";
import {
  Briefcase,
  MapPin,
  Clock,
  MessageSquare,
  Send,
  Link as LinkIcon,
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Check,
  Save,
  LoaderCircle,
  ExternalLink,
  Info,
} from "lucide-react";
import { useTelegramStore } from "../store/telegramStore";
import type {
  BusinessLocation,
  BusinessOpeningHours,
  BusinessOpeningHoursInterval,
  BusinessGreetingMessageSettings,
  BusinessAwayMessageSettings,
  BusinessStartPage,
} from "../telegram/types";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Tehran",
  "Asia/Singapore",
  "Asia/Tokyo",
];

export function BusinessSettingsPanel() {
  const businessInfo = useTelegramStore((state) => state.businessInfo);
  const businessFeatures = useTelegramStore((state) => state.businessFeatures);
  const quickReplyShortcuts = useTelegramStore((state) => state.quickReplyShortcuts);
  const businessChatLinks = useTelegramStore((state) => state.businessChatLinks);
  const businessLoading = useTelegramStore((state) => state.businessLoading);
  const businessError = useTelegramStore((state) => state.businessError);

  const loadBusinessProfile = useTelegramStore((state) => state.loadBusinessProfile);
  const updateBusinessLocation = useTelegramStore((state) => state.updateBusinessLocation);
  const updateBusinessOpeningHours = useTelegramStore((state) => state.updateBusinessOpeningHours);
  const updateBusinessGreetingSettings = useTelegramStore((state) => state.updateBusinessGreetingSettings);
  const updateBusinessAwaySettings = useTelegramStore((state) => state.updateBusinessAwaySettings);
  const updateBusinessStartPage = useTelegramStore((state) => state.updateBusinessStartPage);
  const createQuickReplyShortcut = useTelegramStore((state) => state.createQuickReplyShortcut);
  const deleteQuickReplyShortcut = useTelegramStore((state) => state.deleteQuickReplyShortcut);
  const createBusinessChatLink = useTelegramStore((state) => state.createBusinessChatLink);
  const deleteBusinessChatLink = useTelegramStore((state) => state.deleteBusinessChatLink);

  // --- Local Form State ---
  const [address, setAddress] = useState(businessInfo?.location?.address ?? "");
  const [latitude, setLatitude] = useState<string>(
    businessInfo?.location?.latitude !== undefined ? String(businessInfo.location.latitude) : "",
  );
  const [longitude, setLongitude] = useState<string>(
    businessInfo?.location?.longitude !== undefined ? String(businessInfo.location.longitude) : "",
  );

  const [timeZoneId, setTimeZoneId] = useState(businessInfo?.openingHours?.timeZoneId ?? "UTC");
  const [scheduleState, setScheduleState] = useState<Array<{ open: boolean; start: string; end: string }>>(() => {
    return DAYS_OF_WEEK.map((_, dayIdx) => {
      // Find interval for this day
      const dayStartMinute = dayIdx * 24 * 60;
      const dayEndMinute = (dayIdx + 1) * 24 * 60;
      const interval = businessInfo?.openingHours?.intervals.find(
        (i) => i.startMinute >= dayStartMinute && i.endMinute <= dayEndMinute,
      );
      if (interval) {
        const startM = interval.startMinute - dayStartMinute;
        const endM = interval.endMinute - dayStartMinute;
        const startH = String(Math.floor(startM / 60)).padStart(2, "0");
        const startMin = String(startM % 60).padStart(2, "0");
        const endH = String(Math.floor(endM / 60)).padStart(2, "0");
        const endMin = String(endM % 60).padStart(2, "0");
        return { open: true, start: `${startH}:${startMin}`, end: `${endH}:${endMin}` };
      }
      return { open: dayIdx < 5, start: "09:00", end: "18:00" };
    });
  });

  const [greetingEnabled, setGreetingEnabled] = useState(Boolean(businessInfo?.greetingMessageSettings));
  const [greetingInactivityDays, setGreetingInactivityDays] = useState(
    businessInfo?.greetingMessageSettings?.noActivityDays ?? 14,
  );

  const [awayEnabled, setAwayEnabled] = useState(Boolean(businessInfo?.awayMessageSettings));
  const [awayScheduleKind, setAwayScheduleKind] = useState<"always" | "outsideOfOpeningHours">(
    businessInfo?.awayMessageSettings?.schedule?.kind === "outsideOfOpeningHours"
      ? "outsideOfOpeningHours"
      : "always",
  );
  const [awayOfflineOnly, setAwayOfflineOnly] = useState(
    businessInfo?.awayMessageSettings?.offlineOnly ?? true,
  );

  const [startPageTitle, setStartPageTitle] = useState(businessInfo?.startPage?.title ?? "");
  const [startPageMessage, setStartPageMessage] = useState(businessInfo?.startPage?.message ?? "");

  const [newShortcutName, setNewShortcutName] = useState("");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkText, setNewLinkText] = useState("");

  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  useEffect(() => {
    void loadBusinessProfile();
  }, [loadBusinessProfile]);

  useEffect(() => {
    if (businessInfo?.location) {
      setAddress(businessInfo.location.address);
      if (businessInfo.location.latitude !== undefined) setLatitude(String(businessInfo.location.latitude));
      if (businessInfo.location.longitude !== undefined) setLongitude(String(businessInfo.location.longitude));
    }
    if (businessInfo?.openingHours) {
      setTimeZoneId(businessInfo.openingHours.timeZoneId);
    }
    if (businessInfo?.startPage) {
      setStartPageTitle(businessInfo.startPage.title);
      setStartPageMessage(businessInfo.startPage.message);
    }
  }, [businessInfo]);

  const handleSaveLocation = async () => {
    setSavingSection("location");
    const lat = latitude.trim() ? Number(latitude) : undefined;
    const lon = longitude.trim() ? Number(longitude) : undefined;
    await updateBusinessLocation(address.trim() ? { address: address.trim(), latitude: lat, longitude: lon } : null);
    setSavingSection(null);
  };

  const handleSaveOpeningHours = async () => {
    setSavingSection("hours");
    const intervals: BusinessOpeningHoursInterval[] = [];
    scheduleState.forEach((item, dayIdx) => {
      if (item.open) {
        const [startH, startM] = item.start.split(":").map(Number);
        const [endH, endM] = item.end.split(":").map(Number);
        const startMinute = dayIdx * 24 * 60 + (startH * 60 + startM);
        const endMinute = dayIdx * 24 * 60 + (endH * 60 + endM);
        if (endMinute > startMinute) {
          intervals.push({ startMinute, endMinute });
        }
      }
    });
    await updateBusinessOpeningHours(intervals.length > 0 ? { timeZoneId, intervals } : null);
    setSavingSection(null);
  };

  const handleSaveGreeting = async () => {
    setSavingSection("greeting");
    if (greetingEnabled) {
      await updateBusinessGreetingSettings({
        shortcutId: 1,
        noActivityDays: greetingInactivityDays,
      });
    } else {
      await updateBusinessGreetingSettings(null);
    }
    setSavingSection(null);
  };

  const handleSaveAway = async () => {
    setSavingSection("away");
    if (awayEnabled) {
      await updateBusinessAwaySettings({
        shortcutId: 2,
        schedule: awayScheduleKind === "outsideOfOpeningHours" ? { kind: "outsideOfOpeningHours" } : { kind: "always" },
        offlineOnly: awayOfflineOnly,
      });
    } else {
      await updateBusinessAwaySettings(null);
    }
    setSavingSection(null);
  };

  const handleSaveStartPage = async () => {
    setSavingSection("startPage");
    if (startPageTitle.trim() || startPageMessage.trim()) {
      await updateBusinessStartPage({
        title: startPageTitle.trim(),
        message: startPageMessage.trim(),
      });
    } else {
      await updateBusinessStartPage(null);
    }
    setSavingSection(null);
  };

  const handleCreateShortcut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShortcutName.trim()) return;
    const clean = newShortcutName.trim().replace(/^\//, "").toLowerCase();
    await createQuickReplyShortcut(clean);
    setNewShortcutName("");
  };

  const handleCreateChatLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkText.trim()) return;
    await createBusinessChatLink(newLinkTitle.trim() || "Business Link", newLinkText.trim());
    setNewLinkTitle("");
    setNewLinkText("");
  };

  const handleCopyLink = (link: string) => {
    void navigator.clipboard.writeText(link);
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto text-slate-900 dark:text-white">
      {/* Top Banner */}
      <div className="flex items-start justify-between p-5 rounded-2xl bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-transparent border border-sky-500/20">
        <div className="flex items-start gap-4">
          <span className="p-3 rounded-xl bg-sky-500 text-white shadow-lg shadow-sky-500/20">
            <Briefcase className="w-6 h-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">Telegram Business</h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Active Features
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
              Transform your Telegram account into a full-featured business profile. Configure opening hours,
              location, automated welcome and away messages, quick reply shortcuts, and custom chat links.
            </p>
          </div>
        </div>
        {businessLoading && <LoaderCircle className="w-5 h-5 text-sky-500 animate-spin" />}
      </div>

      {businessError && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{businessError}</span>
        </div>
      )}

      {/* 1. Business Location & Map */}
      <section className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-5 h-5 text-sky-500" />
            <div>
              <h4 className="text-sm font-semibold">Business Location</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Display your address and map coordinates on your profile.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveLocation()}
            disabled={savingSection === "location"}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            {savingSection === "location" ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Location
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Physical Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 710 Ashbury St, San Francisco, CA 94117"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Latitude (Optional)</label>
            <input
              type="text"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="e.g. 37.7690"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Longitude (Optional)</label>
            <input
              type="text"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="e.g. -122.4460"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 font-mono text-xs"
            />
          </div>
        </div>
      </section>

      {/* 2. Opening Hours */}
      <section className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-indigo-500" />
            <div>
              <h4 className="text-sm font-semibold">Opening Hours</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Set weekly working hours and business timezone.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveOpeningHours()}
            disabled={savingSection === "hours"}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            {savingSection === "hours" ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Hours
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Timezone:</label>
          <select
            value={timeZoneId}
            onChange={(e) => setTimeZoneId(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 font-medium text-slate-900 dark:text-white"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col divide-y divide-slate-200 dark:divide-white/5 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-black/20">
          {DAYS_OF_WEEK.map((day, idx) => (
            <div key={day} className="flex items-center justify-between px-4 py-2.5 text-xs">
              <label className="flex items-center gap-2.5 font-medium cursor-pointer w-32">
                <input
                  type="checkbox"
                  checked={scheduleState[idx].open}
                  onChange={(e) => {
                    const next = [...scheduleState];
                    next[idx] = { ...next[idx], open: e.target.checked };
                    setScheduleState(next);
                  }}
                  className="accent-sky-500 rounded"
                />
                <span>{day}</span>
              </label>

              {scheduleState[idx].open ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={scheduleState[idx].start}
                    onChange={(e) => {
                      const next = [...scheduleState];
                      next[idx] = { ...next[idx], start: e.target.value };
                      setScheduleState(next);
                    }}
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 font-mono"
                  />
                  <span>to</span>
                  <input
                    type="time"
                    value={scheduleState[idx].end}
                    onChange={(e) => {
                      const next = [...scheduleState];
                      next[idx] = { ...next[idx], end: e.target.value };
                      setScheduleState(next);
                    }}
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 font-mono"
                  />
                </div>
              ) : (
                <span className="text-slate-400 italic">Closed</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 3. Quick Replies */}
      <section className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-emerald-500" />
            <div>
              <h4 className="text-sm font-semibold">Quick Replies</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pre-set shortcuts to quickly reply with canned messages using "/".</p>
            </div>
          </div>
        </div>

        {/* Add Shortcut Form */}
        <form onSubmit={handleCreateShortcut} className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-xs">/</span>
            <input
              type="text"
              value={newShortcutName}
              onChange={(e) => setNewShortcutName(e.target.value)}
              placeholder="e.g. pricing, hello, support"
              className="w-full pl-6 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={!newShortcutName.trim()}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 shadow-sm transition disabled:opacity-40"
          >
            <Plus className="w-4 h-4" /> Add Shortcut
          </button>
        </form>

        {/* Shortcut List */}
        <div className="flex flex-wrap gap-2.5">
          {quickReplyShortcuts.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 shadow-sm"
            >
              <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                /{s.name}
              </span>
              {s.messageCount !== undefined && s.messageCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500">
                  {s.messageCount} msg
                </span>
              )}
              <button
                type="button"
                onClick={() => void deleteQuickReplyShortcut(s.id)}
                title="Delete shortcut"
                className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {quickReplyShortcuts.length === 0 && (
            <span className="text-xs text-slate-400 italic">No quick reply shortcuts created yet.</span>
          )}
        </div>
      </section>

      {/* 4. Automated Messaging: Greeting & Away */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Greeting Message */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-500" /> Greeting Message
            </h4>
            <button
              type="button"
              onClick={() => void handleSaveGreeting()}
              disabled={savingSection === "greeting"}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-1 shadow-sm transition disabled:opacity-50"
            >
              {savingSection === "greeting" ? <LoaderCircle className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Automatically welcome new customers who contact your business for the first time or after a period of inactivity.
          </p>
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={greetingEnabled}
              onChange={(e) => setGreetingEnabled(e.target.checked)}
              className="accent-sky-500 rounded"
            />
            <span>Enable Greeting Message</span>
          </label>
          {greetingEnabled && (
            <div className="flex items-center gap-2 text-xs pt-1">
              <span>Inactivity Period:</span>
              <select
                value={greetingInactivityDays}
                onChange={(e) => setGreetingInactivityDays(Number(e.target.value))}
                className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20"
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={21}>21 Days</option>
                <option value={28}>28 Days</option>
              </select>
            </div>
          )}
        </div>

        {/* Away Message */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> Away Message
            </h4>
            <button
              type="button"
              onClick={() => void handleSaveAway()}
              disabled={savingSection === "away"}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-1 shadow-sm transition disabled:opacity-50"
            >
              {savingSection === "away" ? <LoaderCircle className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Send automated responses when you are away, outside business hours, or offline.
          </p>
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={awayEnabled}
              onChange={(e) => setAwayEnabled(e.target.checked)}
              className="accent-sky-500 rounded"
            />
            <span>Enable Away Message</span>
          </label>
          {awayEnabled && (
            <div className="flex flex-col gap-2 pt-1 text-xs">
              <label className="flex items-center gap-2">
                <span>Schedule:</span>
                <select
                  value={awayScheduleKind}
                  onChange={(e) => setAwayScheduleKind(e.target.value as any)}
                  className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20"
                >
                  <option value="always">Always Send</option>
                  <option value="outsideOfOpeningHours">Outside Opening Hours</option>
                </select>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={awayOfflineOnly}
                  onChange={(e) => setAwayOfflineOnly(e.target.checked)}
                  className="accent-sky-500 rounded"
                />
                <span>Only when my status is Offline</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* 5. Business Chat Links */}
      <section className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LinkIcon className="w-5 h-5 text-indigo-500" />
            <div>
              <h4 className="text-sm font-semibold">Business Chat Links</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Create short links (t.me/m/...) with pre-filled messages for customer acquisition.</p>
            </div>
          </div>
        </div>

        {/* Create Link Form */}
        <form onSubmit={handleCreateChatLink} className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <input
            type="text"
            value={newLinkTitle}
            onChange={(e) => setNewLinkTitle(e.target.value)}
            placeholder="Link Title (e.g. Website Order)"
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20"
          />
          <input
            type="text"
            value={newLinkText}
            onChange={(e) => setNewLinkText(e.target.value)}
            placeholder="Pre-filled message for user..."
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20"
          />
          <button
            type="submit"
            disabled={!newLinkText.trim()}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-40"
          >
            <Plus className="w-4 h-4" /> Create Link
          </button>
        </form>

        {/* Existing Links */}
        <div className="flex flex-col gap-2">
          {businessChatLinks.map((item) => (
            <div
              key={item.link}
              className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <strong className="font-semibold">{item.title || "Business Link"}</strong>
                  <span className="font-mono text-[11px] text-sky-500">{item.link}</span>
                </div>
                <span className="text-slate-500 dark:text-slate-400 italic">"{item.text}"</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5">
                  {item.viewCount} views
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyLink(item.link)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
                  title="Copy link"
                >
                  {copiedLink === item.link ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteBusinessChatLink(item.link)}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                  title="Delete link"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {businessChatLinks.length === 0 && (
            <span className="text-xs text-slate-400 italic">No business chat links created yet.</span>
          )}
        </div>
      </section>

      {/* 6. Start Page / Greeting Intro */}
      <section className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <div>
              <h4 className="text-sm font-semibold">Business Start Page</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Custom title and greeting displayed when customers open an empty chat with you.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveStartPage()}
            disabled={savingSection === "startPage"}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            {savingSection === "startPage" ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Start Page
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          <input
            type="text"
            value={startPageTitle}
            onChange={(e) => setStartPageTitle(e.target.value)}
            placeholder="Start Page Title (e.g. Welcome to Acme Store)"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 font-medium"
          />
          <textarea
            value={startPageMessage}
            onChange={(e) => setStartPageMessage(e.target.value)}
            placeholder="Start Page Message (e.g. How can we help you today? Check our pinned catalog or message us directly!)"
            rows={3}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20"
          />
        </div>
      </section>
    </div>
  );
}
