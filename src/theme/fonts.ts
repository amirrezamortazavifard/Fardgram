export interface FontOption {
  id: string;
  name: string;
  family: string;
  category: "sans" | "persian" | "mono" | "geometric";
  sampleText: string;
}

export const APP_FONTS: FontOption[] = [
  {
    id: "system",
    name: "System Default",
    family: '"Segoe UI", "Microsoft YaHei UI", -apple-system, BlinkMacSystemFont, Arial, sans-serif',
    category: "sans",
    sampleText: "The quick brown fox jumps over the lazy dog",
  },
  {
    id: "inter",
    name: "Inter (Modern Minimal)",
    family: '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
    category: "sans",
    sampleText: "Clean, ultra-legible modern interface typography",
  },
  {
    id: "vazirmatn",
    name: "Vazirmatn (Arabic & Persian Script)",
    family: '"Vazirmatn", "Segoe UI", Tahoma, sans-serif',
    category: "persian",
    sampleText: "Clean, elegant typography designed for RTL scripts",
  },
  {
    id: "outfit",
    name: "Outfit (Geometric Luxury)",
    family: '"Outfit", "Segoe UI", sans-serif',
    category: "geometric",
    sampleText: "Sleek contemporary rounded geometric typography",
  },
  {
    id: "jetbrains",
    name: "JetBrains Mono (Developer)",
    family: '"JetBrains Mono", Consolas, "Courier New", monospace',
    category: "mono",
    sampleText: 'const coPilot = new TelegramAgent({ mode: "matrix" });',
  },
  {
    id: "roboto",
    name: "Roboto (Classic Clean)",
    family: '"Roboto", "Segoe UI", Arial, sans-serif',
    category: "sans",
    sampleText: "Balanced, neutral and familiar everyday typography",
  },
];

export function getFontFamilyById(fontId: string): string {
  const font = APP_FONTS.find((f) => f.id === fontId);
  return font ? font.family : APP_FONTS[0].family;
}
