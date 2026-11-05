export interface CropRect {
  x: number; // 0 to 1 relative to image width
  y: number; // 0 to 1 relative to image height
  width: number; // 0 to 1 relative to image width
  height: number; // 0 to 1 relative to image height
}

export type AspectRatioPreset = "free" | "original" | "1:1" | "4:3" | "16:9" | "9:16" | "3:2";

export interface DrawingPoint {
  x: number; // 0 to 1 relative to rendered area
  y: number; // 0 to 1 relative to rendered area
}

export interface DrawingPath {
  id: string;
  points: DrawingPoint[];
  color: string;
  width: number; // pixel width
  isBlur?: boolean;
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number; // 0 to 1 relative
  y: number; // 0 to 1 relative
  color: string;
  fontSize: number; // px at standard scale
  hasBackground: boolean;
}

export interface PhotoEditState {
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  crop: CropRect;
  aspectRatio: AspectRatioPreset;
  drawings: DrawingPath[];
  texts: TextOverlay[];
  hasSpoiler: boolean;
}

export interface VideoEditState {
  startTime: number;
  endTime: number;
  duration: number;
  isMuted: boolean;
  hasSpoiler: boolean;
  coverFrameTime: number;
  quality: "original" | "compressed";
  coverThumbnail?: File;
}

export const DEFAULT_CROP_RECT: CropRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

export const DEFAULT_PHOTO_EDIT_STATE: PhotoEditState = {
  rotation: 0,
  flipH: false,
  flipV: false,
  crop: { ...DEFAULT_CROP_RECT },
  aspectRatio: "free",
  drawings: [],
  texts: [],
  hasSpoiler: false,
};

export const COLOR_PALETTE = [
  "#ffffff", // White
  "#000000", // Black
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
];

export const ASPECT_RATIO_VALUES: Record<Exclude<AspectRatioPreset, "free" | "original">, number> = {
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "3:2": 3 / 2,
};

/**
 * Formats a duration in seconds to standard HH:MM:SS or MM:SS string.
 */
export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

/**
 * Estimates resulting file size after trimming a video.
 */
export const estimateVideoFileSize = (
  originalSizeBytes: number,
  originalDurationSeconds: number,
  trimmedDurationSeconds: number,
): number => {
  if (originalDurationSeconds <= 0 || trimmedDurationSeconds <= 0) return originalSizeBytes;
  const ratio = Math.min(1, Math.max(0.01, trimmedDurationSeconds / originalDurationSeconds));
  return Math.round(originalSizeBytes * ratio);
};

/**
 * Formats byte size to human readable string (KB, MB, GB).
 */
export const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * Calculates a new crop rectangle when switching aspect ratios.
 */
export const calculateCropForAspectRatio = (
  preset: AspectRatioPreset,
  sourceWidth: number,
  sourceHeight: number,
  currentCrop: CropRect = DEFAULT_CROP_RECT,
): CropRect => {
  if (preset === "free" || preset === "original") {
    return preset === "original" ? { ...DEFAULT_CROP_RECT } : currentCrop;
  }

  const targetRatio = ASPECT_RATIO_VALUES[preset];
  if (!targetRatio || sourceWidth <= 0 || sourceHeight <= 0) return currentCrop;

  const currentW = currentCrop.width * sourceWidth;
  const currentH = currentCrop.height * sourceHeight;
  const currentRatio = currentW / currentH;

  let newW = currentW;
  let newH = currentH;

  if (currentRatio > targetRatio) {
    // Current is wider than target ratio: constrain width
    newW = currentH * targetRatio;
  } else {
    // Current is taller than target ratio: constrain height
    newH = currentW / targetRatio;
  }

  const normW = Math.min(1, Math.max(0.05, newW / sourceWidth));
  const normH = Math.min(1, Math.max(0.05, newH / sourceHeight));
  const normX = Math.max(0, Math.min(1 - normW, currentCrop.x + (currentCrop.width - normW) / 2));
  const normY = Math.max(0, Math.min(1 - normH, currentCrop.y + (currentCrop.height - normH) / 2));

  return {
    x: normX,
    y: normY,
    width: normW,
    height: normH,
  };
};

/**
 * Renders the non-destructive photo edits into an HTMLCanvasElement
 * and exports as a new File without mutating the original source file.
 */
export const applyPhotoEdits = async (
  image: HTMLImageElement,
  state: PhotoEditState,
  originalFile: File,
): Promise<{ file: File; width: number; height: number }> => {
  const naturalW = image.naturalWidth || image.width;
  const naturalH = image.naturalHeight || image.height;
  if (!naturalW || !naturalH) {
    return { file: originalFile, width: naturalW, height: naturalH };
  }

  // Determine intermediate rotated dimensions
  const isRotatedQuarter = state.rotation === 90 || state.rotation === 270;
  const rotatedW = isRotatedQuarter ? naturalH : naturalW;
  const rotatedH = isRotatedQuarter ? naturalW : naturalH;

  // Compute crop box in pixels on rotated coordinates
  const cropX = Math.round(state.crop.x * rotatedW);
  const cropY = Math.round(state.crop.y * rotatedH);
  const cropW = Math.max(1, Math.round(state.crop.width * rotatedW));
  const cropH = Math.max(1, Math.round(state.crop.height * rotatedH));

  // Create canvas for the cropped output
  const canvas = document.createElement("canvas");
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { file: originalFile, width: cropW, height: cropH };
  }

  ctx.save();
  // Translate coordinate origin relative to crop offset
  ctx.translate(-cropX, -cropY);

  // Apply rotation & flip around the center of the rotated frame
  ctx.translate(rotatedW / 2, rotatedH / 2);
  if (state.rotation !== 0) {
    ctx.rotate((state.rotation * Math.PI) / 180);
  }
  ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  // Draw the original image centered
  ctx.drawImage(image, -naturalW / 2, -naturalH / 2, naturalW, naturalH);
  ctx.restore();

  // Draw freehand annotations
  if (state.drawings.length > 0) {
    for (const draw of state.drawings) {
      if (draw.points.length === 0) continue;
      ctx.save();
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = draw.color;
      ctx.lineWidth = draw.width;

      const firstPoint = draw.points[0];
      ctx.moveTo(firstPoint.x * cropW, firstPoint.y * cropH);
      for (let i = 1; i < draw.points.length; i++) {
        const pt = draw.points[i];
        ctx.lineTo(pt.x * cropW, pt.y * cropH);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw text overlays
  if (state.texts.length > 0) {
    for (const txt of state.texts) {
      if (!txt.text.trim()) continue;
      ctx.save();
      const px = txt.x * cropW;
      const py = txt.y * cropH;
      const fontSize = Math.max(14, Math.round(txt.fontSize * (cropW / 600)));
      ctx.font = `bold ${fontSize}px sans-serif`;

      const metrics = ctx.measureText(txt.text);
      const textWidth = metrics.width;
      const textHeight = fontSize * 1.2;

      if (txt.hasBackground) {
        // Draw pill background
        const paddingX = fontSize * 0.4;
        const paddingY = fontSize * 0.2;
        ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
        ctx.beginPath();
        const rx = px - paddingX;
        const ry = py - textHeight * 0.8;
        const rw = textWidth + paddingX * 2;
        const rh = textHeight + paddingY * 2;
        const radius = 6;
        ctx.roundRect ? ctx.roundRect(rx, ry, rw, rh, radius) : ctx.rect(rx, ry, rw, rh);
        ctx.fill();
      } else {
        // Shadow for readability
        ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
      }

      ctx.fillStyle = txt.color;
      ctx.textBaseline = "middle";
      ctx.fillText(txt.text, px, py);
      ctx.restore();
    }
  }

  // Export blob
  const mimeType = originalFile.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, 0.95);
  });

  if (!blob) {
    return { file: originalFile, width: cropW, height: cropH };
  }

  const editedFile = new File([blob], originalFile.name, {
    type: mimeType,
    lastModified: Date.now(),
  });

  return { file: editedFile, width: cropW, height: cropH };
};

/**
 * Captures the exact current video frame as an image thumbnail File.
 */
export const captureVideoThumbnail = async (
  video: HTMLVideoElement,
  fileName: string,
): Promise<File | undefined> => {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return undefined;

  const scale = Math.min(1, 320 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) return undefined;

  const stem = fileName.replace(/\.[^.]+$/, "") || "video";
  return new File([blob], `${stem}-cover.jpg`, { type: "image/jpeg", lastModified: Date.now() });
};
