// Preset Wallpapers Catalog
// Uses Vite's glob import for high performance and zero manual maintenance

const wallpaperModules = import.meta.glob<string>("../assets/wallpapers/*.jpg", {
  eager: true,
  import: "default",
});

const thumbnailModules = import.meta.glob<string>("../assets/wallpapers/thumbs/*.jpg", {
  eager: true,
  import: "default",
});

export interface WallpaperPreset {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  category: "all" | "abstract" | "dark" | "nature" | "gradient";
}

function formatWallpaperName(filename: string): string {
  // Turn "alex-fxrwJGMCz_g-unsplash.jpg" into a clean readable name
  const base = filename.replace(/^.*[\\/]/, "").replace(/\.jpg$/i, "");
  const parts = base.split("-");
  const author = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "Art";
  const desc = parts[1] && isNaN(Number(parts[1])) && parts[1] !== "unsplash"
    ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
    : "Canvas";
  return `${author} ${desc}`;
}

export const PRESET_WALLPAPERS: WallpaperPreset[] = Object.entries(wallpaperModules).map(
  ([filePath, url]) => {
    const filename = filePath.replace(/^.*[\\/]/, "");
    const cleanId = `preset-${filename.replace(/\.jpg$/i, "")}`;
    const name = formatWallpaperName(filename);
    const thumbKey = `../assets/wallpapers/thumbs/${filename}`;
    const thumbnailUrl = thumbnailModules[thumbKey] || url;

    let category: WallpaperPreset["category"] = "abstract";
    if (/forest|pine|mountain|sea|ocean|sky|alpine/i.test(filename)) {
      category = "nature";
    } else if (/gradient|fluid|waves|smoke|mesh/i.test(filename)) {
      category = "gradient";
    } else if (/dark|obsidian|monolith|space/i.test(filename)) {
      category = "dark";
    }

    return {
      id: cleanId,
      name,
      url,
      thumbnailUrl,
      category,
    };
  }
);

export function getWallpaperUrl(
  wallpaperId: string,
  customDataUrl?: string | null
): string | null {
  if (wallpaperId === "none") return null;
  if (wallpaperId === "custom" && customDataUrl) return customDataUrl;
  const found = PRESET_WALLPAPERS.find((p) => p.id === wallpaperId);
  return found ? found.url : null;
}
