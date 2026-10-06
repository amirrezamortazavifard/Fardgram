import { translate } from "../i18n";
export const THEME_IDS = [
  "fardgram-dark",
  "fardgram-obsidian",
  "fardgram-velvet",
  "fardgram-cyberpunk",
  "fardgram-emerald",
  "fardgram-light",
] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export type ColorScheme = "light" | "dark";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  colorScheme: ColorScheme;
}

export const THEME_DEFINITIONS: Record<ThemeId, ThemeDefinition> = {
  "fardgram-dark": { id: "fardgram-dark", label: "Dark Titanium (Default)", colorScheme: "dark" },
  "fardgram-obsidian": { id: "fardgram-obsidian", label: "Midnight Obsidian (OLED)", colorScheme: "dark" },
  "fardgram-velvet": { id: "fardgram-velvet", label: "Midnight Velvet (Violet)", colorScheme: "dark" },
  "fardgram-cyberpunk": { id: "fardgram-cyberpunk", label: "Cyberpunk Neon", colorScheme: "dark" },
  "fardgram-emerald": { id: "fardgram-emerald", label: "Nordic Emerald", colorScheme: "dark" },
  "fardgram-light": { id: "fardgram-light", label: "Minimalist Light", colorScheme: "light" },
};

/** The CSS contract every theme must provide. Keep component CSS dependent on these aliases. */
export const THEME_COLOR_TOKENS = [
  "--color-bg-canvas",
  "--color-bg-surface",
  "--color-bg-surface-hover",
  "--color-bg-elevated",
  "--color-bg-control",
  "--color-bg-control-hover",
  "--color-bg-selected",
  "--color-avatar-alias-background",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-tertiary",
  "--color-text-disabled",
  "--color-text-on-accent",
  "--color-border-subtle",
  "--color-border-default",
  "--color-border-strong",
  "--color-border-focus",
  "--color-accent",
  "--color-accent-strong",
  "--color-accent-soft",
  "--color-status-success",
  "--color-status-warning",
  "--color-status-danger",
  "--color-status-info",
  "--color-admin",
  "--color-admin-soft",
  "--color-attention-badge",
  "--color-attention-badge-text",
  "--color-reaction-badge",
  "--color-reaction-badge-text",
  "--color-text-link",
  "--color-text-code",
  "--color-bg-code",
  "--color-message-incoming",
  "--color-message-outgoing",
  "--color-message-service",
  "--color-qr-background",
  "--color-qr-foreground",
  "--color-bg-media",
  "--color-on-media",
  "--color-media-backdrop",
  "--color-overlay",
  "--color-shadow",
  "--color-scrollbar-thumb",
  "--color-surface-texture",
] as const;

export type ThemeColorToken = (typeof THEME_COLOR_TOKENS)[number];

export const themeIdForColorTheme = (colorTheme: ColorScheme): ThemeId => (
  colorTheme === "dark" ? "fardgram-dark" : "fardgram-light"
);

export const colorThemeForThemeId = (themeId: ThemeId): ColorScheme => (
  THEME_DEFINITIONS[themeId].colorScheme
);

export const isThemeId = (value: unknown): value is ThemeId => (
  typeof value === "string" && THEME_IDS.some((themeId) => themeId === value)
);

export const resolveThemeId = (value: unknown, legacyColorTheme?: unknown): ThemeId => {
  if (isThemeId(value)) return value;
  return themeIdForColorTheme(legacyColorTheme === "dark" ? "dark" : "light");
};

export const currentThemeId = (): ThemeId => {
  if (typeof document === "undefined") return "fardgram-light";
  const themeId = document.documentElement.dataset.theme;
  return isThemeId(themeId) ? themeId : "fardgram-light";
};

export const currentColorTheme = (): ColorScheme => colorThemeForThemeId(currentThemeId());

export const applyThemeToDocument = (themeId: ThemeId) => {
  if (typeof document === "undefined") return;
  const colorScheme = colorThemeForThemeId(themeId);
  document.documentElement.dataset.theme = themeId;
  document.documentElement.style.colorScheme = colorScheme;
};
