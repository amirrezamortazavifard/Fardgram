import { createStore } from "zustand/vanilla";
import { defaultShortcutBindings, normalizeShortcutBindings, type ShortcutBindings } from "../shortcuts/shortcuts";
import { useStore } from "zustand";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  applyThemeToDocument,
  colorThemeForThemeId,
  resolveThemeId,
  type ColorScheme,
  type ThemeId,
} from "../theme/theme";
import { effectiveReduceMotion } from "../utils/motionPreference";
import { setZalgoTextBlockingEnabled } from "../telegram/identityText";
import {
  AD_BLOCK_KEYWORD_LENGTH_LIMIT,
  AD_BLOCK_KEYWORD_LIMIT,
  AD_BLOCK_REGEX_LENGTH_LIMIT,
  AD_BLOCK_REGEX_LIMIT,
  sanitizeAdBlockEntries,
} from "../utils/adBlocking";
import {
  applyLanguagePreference,
  isLanguagePreference,
  type LanguagePreference,
} from "../i18n";
import { getFontFamilyById } from "../theme/fonts";
import { getWallpaperUrl } from "../theme/wallpapers";

export type ColorTheme = ColorScheme;
export type UnreadBadgePosition = "right" | "avatar";
export type BackgroundStyle = "plain" | "soft";

export interface AppPreferences {
  shortcuts: ShortcutBindings;
  language: LanguagePreference;
  notificationsEnabled: boolean;
  notificationSound: boolean;
  notificationPreview: boolean;
  deletedMessageArchiveEnabled: boolean;
  antiEditEnabled: boolean;
  bypassProtectedContent: boolean;
  osintInspectorEnabled: boolean;
  sendOnEnter: boolean;
  blockTypingStatus: boolean;
  ghostMode: boolean;
  blockZalgoText: boolean;
  adBlockingEnabled: boolean;
  blockSponsoredMessages: boolean;
  customAdBlockingEnabled: boolean;
  adBlockKeywords: string[];
  adBlockRegexRules: string[];
  developerMode: boolean;
  performanceMonitoringEnabled: boolean;
  autoplayAnimations: boolean;
  autoDownloadImages: boolean;
  autoDownloadVideos: boolean;
  autoDownloadAudio: boolean;
  autoDownloadFiles: boolean;
  autoDownloadLimitMb: number;
  cacheRetentionDays: number;
  reduceMotion: boolean;
  chatFontSize: number;
  quoteCollapseLines: number;
  interfaceScale: number;
  chatListRowHeight: number;
  messageGroupSpacing: number;
  messageRowSpacing: number;
  messageBubblePadding: number;
  unreadBadgePosition: UnreadBadgePosition;
  themeId: ThemeId;
  backgroundStyle: BackgroundStyle;
  wallpaperId: string;
  wallpaperBlur: number;
  wallpaperOpacity: number;
  wallpaperCustomUrl: string | null;
  fontId: string;
}

interface PreferencesState extends AppPreferences {
  systemReduceMotion: boolean;
  effectiveReduceMotion: boolean;
  setPreference: <Key extends keyof AppPreferences>(
    key: Key,
    value: AppPreferences[Key],
  ) => void;
}

const STORAGE_KEY = "fardgram:preferences:v1";
const isVitest = Boolean((globalThis as unknown as { process?: { env?: { VITEST?: string } } }).process?.env?.VITEST);
const defaults: AppPreferences = {
  shortcuts: defaultShortcutBindings,
  language: isVitest ? "system" : "en",
  notificationsEnabled: true,
  notificationSound: true,
  notificationPreview: true,
  deletedMessageArchiveEnabled: true,
  antiEditEnabled: true,
  bypassProtectedContent: true,
  osintInspectorEnabled: true,
  sendOnEnter: true,
  blockTypingStatus: true,
  ghostMode: false,
  blockZalgoText: true,
  adBlockingEnabled: true,
  blockSponsoredMessages: true,
  customAdBlockingEnabled: false,
  adBlockKeywords: [],
  adBlockRegexRules: [],
  developerMode: false,
  performanceMonitoringEnabled: true,
  autoplayAnimations: true,
  autoDownloadImages: true,
  autoDownloadVideos: false,
  autoDownloadAudio: false,
  autoDownloadFiles: false,
  autoDownloadLimitMb: 10,
  cacheRetentionDays: 7,
  reduceMotion: false,
  chatFontSize: 14,
  quoteCollapseLines: 10,
  interfaceScale: 100,
  chatListRowHeight: 68,
  messageGroupSpacing: 4,
  messageRowSpacing: 1,
  messageBubblePadding: 4,
  unreadBadgePosition: "right",
  themeId: "fardgram-light",
  backgroundStyle: "plain",
  wallpaperId: "none",
  wallpaperBlur: 0,
  wallpaperOpacity: 0.90,
  wallpaperCustomUrl: null,
  fontId: "system",
};

const boundedInteger = (value: unknown, fallback: number, minimum: number, maximum: number) =>
  Number.isFinite(value)
    ? Math.round(Math.max(minimum, Math.min(maximum, Number(value))))
    : fallback;

const readPreferences = (): AppPreferences => {
  try {
    const serialized = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!serialized) return defaults;
    const stored = JSON.parse(serialized) as Partial<AppPreferences> & {
      colorTheme?: ColorTheme;
      compactMode?: boolean;
      sendTypingStatus?: boolean;
    };
    const legacyCompact = stored.compactMode === true;
    const blockTypingStatus = stored.blockTypingStatus ?? (
      stored.sendTypingStatus === undefined
        ? defaults.blockTypingStatus
        : !stored.sendTypingStatus
    );
    return {
      shortcuts: normalizeShortcutBindings(stored.shortcuts),
      language: isVitest
        ? (isLanguagePreference(stored.language) ? stored.language : defaults.language)
        : (isLanguagePreference(stored.language) && stored.language !== "zh-CN" && stored.language !== "system" ? stored.language : "en"),
      notificationsEnabled: stored.notificationsEnabled ?? defaults.notificationsEnabled,
      notificationSound: stored.notificationSound ?? defaults.notificationSound,
      notificationPreview: stored.notificationPreview ?? defaults.notificationPreview,
      deletedMessageArchiveEnabled: stored.deletedMessageArchiveEnabled ?? defaults.deletedMessageArchiveEnabled,
      antiEditEnabled: stored.antiEditEnabled ?? defaults.antiEditEnabled,
      bypassProtectedContent: stored.bypassProtectedContent ?? defaults.bypassProtectedContent,
      osintInspectorEnabled: stored.osintInspectorEnabled ?? defaults.osintInspectorEnabled,
      sendOnEnter: stored.sendOnEnter ?? defaults.sendOnEnter,
      blockTypingStatus,
      ghostMode: stored.ghostMode ?? defaults.ghostMode,
      blockZalgoText: stored.blockZalgoText ?? defaults.blockZalgoText,
      adBlockingEnabled: stored.adBlockingEnabled ?? defaults.adBlockingEnabled,
      blockSponsoredMessages: stored.blockSponsoredMessages ?? defaults.blockSponsoredMessages,
      customAdBlockingEnabled: stored.customAdBlockingEnabled ?? defaults.customAdBlockingEnabled,
      adBlockKeywords: sanitizeAdBlockEntries(
        stored.adBlockKeywords,
        AD_BLOCK_KEYWORD_LIMIT,
        AD_BLOCK_KEYWORD_LENGTH_LIMIT,
      ),
      adBlockRegexRules: sanitizeAdBlockEntries(
        stored.adBlockRegexRules,
        AD_BLOCK_REGEX_LIMIT,
        AD_BLOCK_REGEX_LENGTH_LIMIT,
      ),
      developerMode: stored.developerMode ?? defaults.developerMode,
      performanceMonitoringEnabled: typeof stored.performanceMonitoringEnabled === "boolean"
        ? stored.performanceMonitoringEnabled
        : defaults.performanceMonitoringEnabled,
      autoplayAnimations: stored.autoplayAnimations ?? defaults.autoplayAnimations,
      autoDownloadImages: stored.autoDownloadImages ?? defaults.autoDownloadImages,
      autoDownloadVideos: stored.autoDownloadVideos ?? defaults.autoDownloadVideos,
      autoDownloadAudio: stored.autoDownloadAudio ?? defaults.autoDownloadAudio,
      autoDownloadFiles: stored.autoDownloadFiles ?? defaults.autoDownloadFiles,
      autoDownloadLimitMb: boundedInteger(
        stored.autoDownloadLimitMb,
        defaults.autoDownloadLimitMb,
        1,
        2_048,
      ),
      cacheRetentionDays: boundedInteger(
        stored.cacheRetentionDays,
        defaults.cacheRetentionDays,
        0,
        365,
      ),
      reduceMotion: stored.reduceMotion ?? defaults.reduceMotion,
      chatFontSize: boundedInteger(stored.chatFontSize, defaults.chatFontSize, 12, 20),
      quoteCollapseLines: boundedInteger(stored.quoteCollapseLines, defaults.quoteCollapseLines, 1, 100),
      interfaceScale: boundedInteger(stored.interfaceScale, defaults.interfaceScale, 80, 150),
      chatListRowHeight: boundedInteger(
        stored.chatListRowHeight,
        legacyCompact ? 60 : defaults.chatListRowHeight,
        56,
        88,
      ),
      messageGroupSpacing: boundedInteger(
        stored.messageGroupSpacing,
        legacyCompact ? 5 : defaults.messageGroupSpacing,
        4,
        18,
      ),
      messageRowSpacing: boundedInteger(
        stored.messageRowSpacing,
        defaults.messageRowSpacing,
        0,
        6,
      ),
      messageBubblePadding: boundedInteger(
        stored.messageBubblePadding,
        legacyCompact ? 6 : defaults.messageBubblePadding,
        4,
        12,
      ),
      unreadBadgePosition: stored.unreadBadgePosition === "avatar"
        ? "avatar"
        : defaults.unreadBadgePosition,
      themeId: resolveThemeId(stored.themeId, stored.colorTheme),
      backgroundStyle: stored.backgroundStyle === "soft" ? "soft" : defaults.backgroundStyle,
      wallpaperId: typeof stored.wallpaperId === "string" ? stored.wallpaperId : defaults.wallpaperId,
      wallpaperBlur: typeof stored.wallpaperBlur === "number"
        ? (stored.wallpaperBlur === 12 ? 0 : Math.max(0, Math.min(40, stored.wallpaperBlur)))
        : defaults.wallpaperBlur,
      wallpaperOpacity: typeof stored.wallpaperOpacity === "number" ? Math.max(0.1, Math.min(1, stored.wallpaperOpacity)) : defaults.wallpaperOpacity,
      wallpaperCustomUrl: typeof stored.wallpaperCustomUrl === "string" ? stored.wallpaperCustomUrl : null,
      fontId: typeof stored.fontId === "string" ? stored.fontId : defaults.fontId,
    };
  } catch {
    return defaults;
  }
};

const initialPreferences = readPreferences();
setZalgoTextBlockingEnabled(initialPreferences.blockZalgoText);
const syncNativeDeveloperMode = (enabled: boolean) => {
  if (!isTauri()) return;
  void invoke("fardgram_set_developer_mode", { enabled }).catch(() => undefined);
};

syncNativeDeveloperMode(initialPreferences.developerMode);
const readSystemReduceMotion = () => typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const initialSystemReduceMotion = readSystemReduceMotion();
let appliedInterfaceScale: number | undefined;
let appliedThemeId: ThemeId | undefined;

export const preferencesStore = createStore<PreferencesState>((set) => ({
  ...initialPreferences,
  systemReduceMotion: initialSystemReduceMotion,
  effectiveReduceMotion: effectiveReduceMotion({
    reduceMotion: initialPreferences.reduceMotion,
    systemReduceMotion: initialSystemReduceMotion,
  }),
  setPreference: (key, value) => {
    if (key === "shortcuts") value = normalizeShortcutBindings(value) as typeof value;
    if (key === "quoteCollapseLines") {
      value = boundedInteger(value, defaults.quoteCollapseLines, 1, 100) as typeof value;
    }
    set((state) => ({
      [key]: value,
      ...(key === "reduceMotion"
        ? {
            effectiveReduceMotion: effectiveReduceMotion({
              reduceMotion: Boolean(value),
              systemReduceMotion: state.systemReduceMotion,
            }),
          }
        : {}),
    }) as Partial<PreferencesState>);
    if (key === "developerMode") syncNativeDeveloperMode(Boolean(value));
  },
}));

const applyPreferences = (preferences: AppPreferences, systemMotionReduced: boolean) => {
  if (typeof document === "undefined") return;
  applyLanguagePreference(preferences.language);
  const reduceMotion = effectiveReduceMotion({
    reduceMotion: preferences.reduceMotion,
    systemReduceMotion: systemMotionReduced,
  });
  document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  document.documentElement.dataset.motion = reduceMotion ? "reduced" : "full";
  document.documentElement.style.setProperty("--chat-font-size", `${preferences.chatFontSize}px`);
  document.documentElement.style.setProperty(
    "--chat-row-min-height",
    `${preferences.chatListRowHeight}px`,
  );
  document.documentElement.style.setProperty(
    "--message-group-spacing",
    `${preferences.messageGroupSpacing}px`,
  );
  document.documentElement.style.setProperty(
    "--message-row-spacing",
    `${preferences.messageRowSpacing}px`,
  );
  document.documentElement.style.setProperty(
    "--message-bubble-padding-y",
    `${preferences.messageBubblePadding}px`,
  );
  if (appliedInterfaceScale !== preferences.interfaceScale) {
    appliedInterfaceScale = preferences.interfaceScale;
    const scale = preferences.interfaceScale / 100;
    if (isTauri()) {
      document.documentElement.style.removeProperty("zoom");
      void getCurrentWebview().setZoom(scale).catch(() => {
        if (appliedInterfaceScale === preferences.interfaceScale) {
          document.documentElement.style.setProperty("zoom", String(scale));
        }
      });
    } else {
      document.documentElement.style.setProperty("zoom", String(scale));
    }
  }
  if (appliedThemeId !== preferences.themeId) {
    appliedThemeId = preferences.themeId;
    const colorScheme = colorThemeForThemeId(preferences.themeId);
    applyThemeToDocument(preferences.themeId);
    if (isTauri()) {
      void getCurrentWindow().setTheme(colorScheme).catch(() => undefined);
    }
  }
  document.documentElement.dataset.backgroundStyle = preferences.backgroundStyle;
  // Apply wallpaper
  const wallpaperUrl = getWallpaperUrl(preferences.wallpaperId, preferences.wallpaperCustomUrl);
  if (wallpaperUrl) {
    document.documentElement.style.setProperty("--app-wallpaper-url", `url('${wallpaperUrl}')`);
    document.documentElement.style.setProperty("--app-wallpaper-blur", `${preferences.wallpaperBlur}px`);
    document.documentElement.style.setProperty("--app-wallpaper-opacity", String(preferences.wallpaperOpacity));
    document.documentElement.dataset.wallpaper = "on";
  } else {
    document.documentElement.style.removeProperty("--app-wallpaper-url");
    document.documentElement.dataset.wallpaper = "off";
  }
  // Apply font
  const fontFamily = getFontFamilyById(preferences.fontId);
  document.documentElement.style.setProperty("--app-font-family", fontFamily);
};

applyPreferences(initialPreferences, preferencesStore.getState().systemReduceMotion);
preferencesStore.subscribe((state) => {
  const preferences: AppPreferences = {
    shortcuts: state.shortcuts,
    language: state.language,
    notificationsEnabled: state.notificationsEnabled,
    notificationSound: state.notificationSound,
    notificationPreview: state.notificationPreview,
    deletedMessageArchiveEnabled: state.deletedMessageArchiveEnabled,
    antiEditEnabled: state.antiEditEnabled,
    bypassProtectedContent: state.bypassProtectedContent,
    osintInspectorEnabled: state.osintInspectorEnabled,
    sendOnEnter: state.sendOnEnter,
    blockTypingStatus: state.blockTypingStatus,
    blockZalgoText: state.blockZalgoText,
    adBlockingEnabled: state.adBlockingEnabled,
    blockSponsoredMessages: state.blockSponsoredMessages,
    customAdBlockingEnabled: state.customAdBlockingEnabled,
    adBlockKeywords: state.adBlockKeywords,
    adBlockRegexRules: state.adBlockRegexRules,
    developerMode: state.developerMode,
    performanceMonitoringEnabled: state.performanceMonitoringEnabled,
    autoplayAnimations: state.autoplayAnimations,
    autoDownloadImages: state.autoDownloadImages,
    autoDownloadVideos: state.autoDownloadVideos,
    autoDownloadAudio: state.autoDownloadAudio,
    autoDownloadFiles: state.autoDownloadFiles,
    autoDownloadLimitMb: state.autoDownloadLimitMb,
    cacheRetentionDays: state.cacheRetentionDays,
    reduceMotion: state.reduceMotion,
    chatFontSize: state.chatFontSize,
    quoteCollapseLines: state.quoteCollapseLines,
    interfaceScale: state.interfaceScale,
    chatListRowHeight: state.chatListRowHeight,
    messageGroupSpacing: state.messageGroupSpacing,
    messageRowSpacing: state.messageRowSpacing,
    messageBubblePadding: state.messageBubblePadding,
    unreadBadgePosition: state.unreadBadgePosition,
    themeId: state.themeId,
    backgroundStyle: state.backgroundStyle,
    wallpaperId: state.wallpaperId,
    wallpaperBlur: state.wallpaperBlur,
    wallpaperOpacity: state.wallpaperOpacity,
    wallpaperCustomUrl: state.wallpaperCustomUrl,
    fontId: state.fontId,
    ghostMode: state.ghostMode,
  };
  applyPreferences(preferences, state.systemReduceMotion);
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences remain active for this session when persistence is unavailable.
  }
});

if (typeof window !== "undefined") {
  const reducedMotionQuery = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : undefined;
  const syncSystemMotion = (matches: boolean) => {
    preferencesStore.setState((state) => ({
      systemReduceMotion: matches,
      effectiveReduceMotion: effectiveReduceMotion({
        reduceMotion: state.reduceMotion,
        systemReduceMotion: matches,
      }),
    }));
  };
  if (reducedMotionQuery) {
    const onSystemMotionChange = (event: MediaQueryListEvent) => syncSystemMotion(event.matches);
    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", onSystemMotionChange);
    } else {
      reducedMotionQuery.addListener(onSystemMotionChange);
    }
  }
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    const next = readPreferences();
    preferencesStore.setState((state) => ({
      ...next,
      effectiveReduceMotion: effectiveReduceMotion({
        reduceMotion: next.reduceMotion,
        systemReduceMotion: state.systemReduceMotion,
      }),
    }));
  });
}

export const usePreferencesStore = <T,>(selector: (state: PreferencesState) => T) =>
  useStore(preferencesStore, selector);
