import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import {
  Crop,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Brush,
  Type,
  EyeOff,
  Undo2,
  Redo2,
  RotateCcw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Camera,
  Check,
  X,
  Trash2,
  Scissors,
  Sparkles,
} from "lucide-react";
import { useModalFocus } from "../hooks/useModalFocus";
import type { OutgoingAttachment, OutgoingAttachmentKind } from "../telegram/types";
import {
  type AspectRatioPreset,
  type CropRect,
  type DrawingPath,
  type TextOverlay,
  type PhotoEditState,
  type VideoEditState,
  DEFAULT_PHOTO_EDIT_STATE,
  DEFAULT_CROP_RECT,
  COLOR_PALETTE,
  ASPECT_RATIO_VALUES,
  calculateCropForAspectRatio,
  formatDuration,
  formatFileSize,
  estimateVideoFileSize,
  applyPhotoEdits,
  captureVideoThumbnail,
} from "../media/mediaEditor";

export interface MediaEditorResult {
  file: File;
  kind?: OutgoingAttachmentKind;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: File;
  hasSpoiler?: boolean;
}

export interface MediaEditorModalProps {
  attachment: OutgoingAttachment;
  previewUrl: string;
  onSave: (result: MediaEditorResult) => void;
  onClose: () => void;
}

type PhotoTool = "crop" | "transform" | "draw" | "text" | "spoiler";

export function MediaEditorModal({
  attachment,
  previewUrl,
  onSave,
  onClose,
}: MediaEditorModalProps) {
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);
  const titleId = useId();
  const isVideo = attachment.kind === "video";
  const isAnimation = attachment.kind === "animation";
  const isPhoto = attachment.kind === "photo" || (!isVideo && !isAnimation);

  // --- Photo Editor State ---
  const [photoState, setPhotoState] = useState<PhotoEditState>(() => ({
    ...DEFAULT_PHOTO_EDIT_STATE,
    hasSpoiler: Boolean(attachment.hasSpoiler),
  }));
  const [photoTool, setPhotoTool] = useState<PhotoTool>("crop");
  const [selectedColor, setSelectedColor] = useState<string>("#3b82f6");
  const [brushWidth, setBrushWidth] = useState<number>(6);
  const [undoStack, setUndoStack] = useState<DrawingPath[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingPath[][]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentPathRef = useRef<DrawingPath | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const photoContainerRef = useRef<HTMLDivElement | null>(null);

  // --- Video / GIF Editor State ---
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(attachment.duration || 0);
  const [videoState, setVideoState] = useState<VideoEditState>(() => ({
    startTime: 0,
    endTime: attachment.duration || 10,
    duration: attachment.duration || 10,
    isMuted: false,
    hasSpoiler: Boolean(attachment.hasSpoiler),
    coverFrameTime: 0,
    quality: "original",
    coverThumbnail: attachment.thumbnail,
  }));
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle Video Metadata Load
  const handleVideoLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || 0;
    setVideoDuration(dur);
    setVideoState((prev) => ({
      ...prev,
      duration: dur,
      endTime: prev.endTime > 0 && prev.endTime <= dur ? prev.endTime : dur,
    }));
  };

  // Video Time Update Loop
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);
    if (curr >= videoState.endTime) {
      videoRef.current.currentTime = videoState.startTime;
      if (!videoRef.current.paused) {
        void videoRef.current.play().catch(() => undefined);
      }
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      if (videoRef.current.currentTime >= videoState.endTime) {
        videoRef.current.currentTime = videoState.startTime;
      }
      void videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Handle Video Scrubbing
  const handleSeek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  // Capture Cover Thumbnail from Video
  const handleCaptureCover = async () => {
    if (!videoRef.current) return;
    try {
      const cover = await captureVideoThumbnail(videoRef.current, attachment.file.name);
      if (cover) {
        if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
        setThumbnailPreviewUrl(URL.createObjectURL(cover));
        setVideoState((prev) => ({
          ...prev,
          coverThumbnail: cover,
          coverFrameTime: videoRef.current?.currentTime || 0,
        }));
      }
    } catch {
      // Ignored
    }
  };

  // --- Photo Transformations ---
  const handleRotate = () => {
    setPhotoState((prev) => {
      const nextRot = (prev.rotation + 90) % 360;
      return {
        ...prev,
        rotation: nextRot,
        crop: { ...DEFAULT_CROP_RECT },
        aspectRatio: "free",
      };
    });
  };

  const handleFlipH = () => {
    setPhotoState((prev) => ({ ...prev, flipH: !prev.flipH }));
  };

  const handleFlipV = () => {
    setPhotoState((prev) => ({ ...prev, flipV: !prev.flipV }));
  };

  const handleAspectRatioChange = (preset: AspectRatioPreset) => {
    setPhotoState((prev) => {
      const sourceW = imageRef.current?.naturalWidth || 600;
      const sourceH = imageRef.current?.naturalHeight || 400;
      const isQuarter = prev.rotation === 90 || prev.rotation === 270;
      const w = isQuarter ? sourceH : sourceW;
      const h = isQuarter ? sourceW : sourceH;
      const newCrop = calculateCropForAspectRatio(preset, w, h, prev.crop);
      return {
        ...prev,
        aspectRatio: preset,
        crop: newCrop,
      };
    });
  };

  // --- Drawing Interaction ---
  const getRelativeCoordinates = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (photoTool !== "draw") return;
    event.preventDefault();
    setIsDrawing(true);
    const point = getRelativeCoordinates(event);
    const newPath: DrawingPath = {
      id: globalThis.crypto.randomUUID(),
      points: [point],
      color: selectedColor,
      width: brushWidth,
    };
    currentPathRef.current = newPath;
    setUndoStack((prev) => [...prev, photoState.drawings]);
    setRedoStack([]);
    setPhotoState((prev) => ({
      ...prev,
      drawings: [...prev.drawings, newPath],
    }));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || photoTool !== "draw" || !currentPathRef.current) return;
    event.preventDefault();
    const point = getRelativeCoordinates(event);
    currentPathRef.current.points.push(point);
    setPhotoState((prev) => ({
      ...prev,
      drawings: prev.drawings.map((path) =>
        path.id === currentPathRef.current?.id ? { ...currentPathRef.current } : path,
      ),
    }));
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    currentPathRef.current = null;
  };

  const handleUndoDraw = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, photoState.drawings]);
    setUndoStack((prev) => prev.slice(0, -1));
    setPhotoState((prev) => ({ ...prev, drawings: previous }));
  };

  const handleRedoDraw = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, photoState.drawings]);
    setRedoStack((prev) => prev.slice(0, -1));
    setPhotoState((prev) => ({ ...prev, drawings: next }));
  };

  // --- Text Overlays ---
  const handleAddText = () => {
    const newText: TextOverlay = {
      id: globalThis.crypto.randomUUID(),
      text: "Text",
      x: 0.5,
      y: 0.5,
      color: selectedColor,
      fontSize: 28,
      hasBackground: true,
    };
    setPhotoState((prev) => ({
      ...prev,
      texts: [...prev.texts, newText],
    }));
    setSelectedTextId(newText.id);
  };

  const handleUpdateText = (id: string, updates: Partial<TextOverlay>) => {
    setPhotoState((prev) => ({
      ...prev,
      texts: prev.texts.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    }));
  };

  const handleDeleteText = (id: string) => {
    setPhotoState((prev) => ({
      ...prev,
      texts: prev.texts.filter((item) => item.id !== id),
    }));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  // Reset to initial
  const handleReset = () => {
    if (isPhoto) {
      setPhotoState({ ...DEFAULT_PHOTO_EDIT_STATE });
      setUndoStack([]);
      setRedoStack([]);
      setSelectedTextId(null);
    } else {
      setVideoState({
        startTime: 0,
        endTime: videoDuration || 10,
        duration: videoDuration || 10,
        isMuted: false,
        hasSpoiler: false,
        coverFrameTime: 0,
        quality: "original",
      });
      if (thumbnailPreviewUrl) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
        setThumbnailPreviewUrl(null);
      }
    }
  };

  // Save changes and export non-destructive result
  const handleSave = async () => {
    setIsProcessing(true);
    try {
      if (isPhoto && imageRef.current) {
        const { file, width, height } = await applyPhotoEdits(
          imageRef.current,
          photoState,
          attachment.file,
        );
        onSave({
          file,
          kind: "photo",
          width,
          height,
          hasSpoiler: photoState.hasSpoiler,
        });
      } else if (isVideo || isAnimation) {
        const trimmedDur = Math.max(0.1, videoState.endTime - videoState.startTime);
        onSave({
          file: attachment.file,
          kind: videoState.isMuted ? "animation" : attachment.kind,
          duration: Math.round(trimmedDur),
          thumbnail: videoState.coverThumbnail,
          hasSpoiler: videoState.hasSpoiler,
        });
      }
      onClose();
    } catch {
      setIsProcessing(false);
    }
  };

  // Clean up thumbnails on unmount
  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    };
  }, [thumbnailPreviewUrl]);

  const selectedText = photoState.texts.find((t) => t.id === selectedTextId);
  const trimmedDuration = Math.max(0.1, videoState.endTime - videoState.startTime);
  const estimatedSize = estimateVideoFileSize(
    attachment.file.size,
    videoDuration || 1,
    trimmedDuration,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white dark:bg-[#181d28] text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
              {isVideo ? <Scissors className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </span>
            <div>
              <h2 id={titleId} className="text-base font-semibold leading-tight">
                {isPhoto ? "Photo Editor" : isVideo ? "Video Editor" : "GIF Editor"}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {attachment.file.name} ({formatFileSize(attachment.file.size)})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              title="Reset all edits"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              aria-label="Cancel editing"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Workspace */}
        <div className="flex-1 min-h-[380px] max-h-[56vh] bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden select-none">
          {isPhoto && (
            <div
              ref={photoContainerRef}
              className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden"
              style={{
                filter: photoState.hasSpoiler ? "blur(22px)" : "none",
                transition: "filter 0.2s ease",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <img
                ref={imageRef}
                src={previewUrl}
                alt={attachment.file.name}
                draggable={false}
                className="max-w-full max-h-[50vh] object-contain rounded shadow-lg pointer-events-none"
                style={{
                  transform: `rotate(${photoState.rotation}deg) scaleX(${photoState.flipH ? -1 : 1}) scaleY(${photoState.flipV ? -1 : 1})`,
                  transition: "transform 0.15s ease-out",
                }}
              />

              {/* Freehand SVG Drawing Layer */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
              >
                {photoState.drawings.map((draw) => {
                  if (draw.points.length === 0) return null;
                  const d = draw.points.reduce((acc, pt, idx) => {
                    return idx === 0
                      ? `M ${pt.x * 1000} ${pt.y * 1000}`
                      : `${acc} L ${pt.x * 1000} ${pt.y * 1000}`;
                  }, "");
                  return (
                    <path
                      key={draw.id}
                      d={d}
                      stroke={draw.color}
                      strokeWidth={draw.width * 2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  );
                })}
              </svg>

              {/* Text Overlays Layer */}
              {photoState.texts.map((txt) => (
                <div
                  key={txt.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTextId(txt.id);
                    setPhotoTool("text");
                  }}
                  className={`absolute z-20 cursor-move font-bold select-none transition-shadow ${
                    selectedTextId === txt.id ? "ring-2 ring-sky-400" : ""
                  }`}
                  style={{
                    left: `${txt.x * 100}%`,
                    top: `${txt.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    color: txt.color,
                    fontSize: `${txt.fontSize}px`,
                    background: txt.hasBackground ? "rgba(0,0,0,0.72)" : "transparent",
                    padding: txt.hasBackground ? "4px 10px" : "0",
                    borderRadius: "6px",
                    textShadow: txt.hasBackground ? "none" : "0 2px 6px rgba(0,0,0,0.85)",
                  }}
                >
                  {txt.text}
                </div>
              ))}

              {/* Crop Grid Overlay */}
              {photoTool === "crop" && (
                <div
                  className="absolute z-30 pointer-events-none border-2 border-dashed border-sky-400 bg-sky-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
                  style={{
                    left: `${photoState.crop.x * 100}%`,
                    top: `${photoState.crop.y * 100}%`,
                    width: `${photoState.crop.width * 100}%`,
                    height: `${photoState.crop.height * 100}%`,
                  }}
                >
                  {/* 3x3 Grid Lines */}
                  <div className="absolute inset-x-0 top-1/3 border-b border-sky-300/40" />
                  <div className="absolute inset-x-0 top-2/3 border-b border-sky-300/40" />
                  <div className="absolute inset-y-0 left-1/3 border-r border-sky-300/40" />
                  <div className="absolute inset-y-0 left-2/3 border-r border-sky-300/40" />
                </div>
              )}
            </div>
          )}

          {(isVideo || isAnimation) && (
            <div className="relative max-w-full max-h-full flex flex-col items-center justify-center">
              <video
                ref={videoRef}
                src={previewUrl}
                playsInline
                muted={videoState.isMuted}
                onLoadedMetadata={handleVideoLoadedMetadata}
                onTimeUpdate={handleVideoTimeUpdate}
                onClick={togglePlayPause}
                className="max-w-full max-h-[46vh] object-contain rounded shadow-lg cursor-pointer"
                style={{
                  filter: videoState.hasSpoiler ? "blur(22px)" : "none",
                }}
              />
              <button
                type="button"
                onClick={togglePlayPause}
                className="absolute p-3 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition transform hover:scale-105"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
            </div>
          )}
        </div>

        {/* Toolbar & Controls */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-[#1e232e] flex flex-col gap-4">
          {isPhoto && (
            <>
              {/* Photo Tool Tab Navigation */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPhotoTool("crop")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      photoTool === "crop"
                        ? "bg-sky-500 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                    }`}
                  >
                    <Crop className="w-3.5 h-3.5" /> Crop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoTool("transform")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      photoTool === "transform"
                        ? "bg-sky-500 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                    }`}
                  >
                    <RotateCw className="w-3.5 h-3.5" /> Rotate & Flip
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoTool("draw")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      photoTool === "draw"
                        ? "bg-sky-500 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                    }`}
                  >
                    <Brush className="w-3.5 h-3.5" /> Draw
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoTool("text")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      photoTool === "text"
                        ? "bg-sky-500 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                    }`}
                  >
                    <Type className="w-3.5 h-3.5" /> Text
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoState((prev) => ({ ...prev, hasSpoiler: !prev.hasSpoiler }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      photoState.hasSpoiler
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5" /> Spoiler
                  </button>
                </div>

                {/* Draw Undo / Redo */}
                {photoTool === "draw" && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={undoStack.length === 0}
                      onClick={handleUndoDraw}
                      title="Undo stroke"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 dark:hover:bg-white/10"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={redoStack.length === 0}
                      onClick={handleRedoDraw}
                      title="Redo stroke"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 dark:hover:bg-white/10"
                    >
                      <Redo2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Sub-toolbar Panels */}
              <div className="flex flex-wrap items-center gap-4 min-h-[38px]">
                {photoTool === "crop" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Aspect Ratio:
                    </span>
                    {(["free", "original", "1:1", "4:3", "16:9", "9:16", "3:2"] as AspectRatioPreset[]).map(
                      (preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleAspectRatioChange(preset)}
                          className={`px-2.5 py-1 rounded text-xs font-medium uppercase transition ${
                            photoState.aspectRatio === preset
                              ? "bg-sky-500 text-white"
                              : "bg-slate-200/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/10"
                          }`}
                        >
                          {preset}
                        </button>
                      ),
                    )}
                  </div>
                )}

                {photoTool === "transform" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRotate}
                      className="px-3 py-1.5 rounded-lg bg-slate-200/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/10 text-xs font-medium flex items-center gap-1.5 transition"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Rotate 90°
                    </button>
                    <button
                      type="button"
                      onClick={handleFlipH}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                        photoState.flipH
                          ? "bg-sky-500 text-white"
                          : "bg-slate-200/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/10"
                      }`}
                    >
                      <FlipHorizontal className="w-3.5 h-3.5" /> Flip Horizontal
                    </button>
                    <button
                      type="button"
                      onClick={handleFlipV}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                        photoState.flipV
                          ? "bg-sky-500 text-white"
                          : "bg-slate-200/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/10"
                      }`}
                    >
                      <FlipVertical className="w-3.5 h-3.5" /> Flip Vertical
                    </button>
                  </div>
                )}

                {photoTool === "draw" && (
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Brush Size */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Size:
                      </span>
                      {[3, 6, 12, 20].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setBrushWidth(size)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition ${
                            brushWidth === size ? "ring-2 ring-sky-500" : ""
                          }`}
                        >
                          <span
                            className="rounded-full bg-slate-700 dark:bg-white"
                            style={{ width: `${size}px`, height: `${size}px` }}
                          />
                        </button>
                      ))}
                    </div>

                    {/* Color Palette */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Color:
                      </span>
                      {COLOR_PALETTE.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={`w-5 h-5 rounded-full border border-black/20 dark:border-white/20 transition ${
                            selectedColor === color ? "scale-125 ring-2 ring-sky-500" : ""
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {photoTool === "text" && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={handleAddText}
                      className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:bg-sky-600 transition"
                    >
                      <Type className="w-3.5 h-3.5" /> Add Text
                    </button>

                    {selectedText && (
                      <>
                        <input
                          type="text"
                          value={selectedText.text}
                          onChange={(e) =>
                            handleUpdateText(selectedText.id, { text: e.target.value })
                          }
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/30 font-medium text-slate-900 dark:text-white"
                          placeholder="Type text..."
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateText(selectedText.id, {
                              hasBackground: !selectedText.hasBackground,
                            })
                          }
                          className={`px-2 py-1 rounded text-xs font-medium transition ${
                            selectedText.hasBackground
                              ? "bg-slate-800 text-white"
                              : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          Background
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteText(selectedText.id)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                          title="Delete text"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {(isVideo || isAnimation) && (
            <div className="flex flex-col gap-3">
              {/* Timeline & Scrubber */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <span>
                    Current: {formatDuration(currentTime)} / {formatDuration(videoDuration)}
                  </span>
                  <span>
                    Trimmed: {formatDuration(trimmedDuration)} (Est: {formatFileSize(estimatedSize)})
                  </span>
                </div>

                {/* Range Sliders for Trimming */}
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <span>Start:</span>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0.1, videoState.endTime - 0.2)}
                      step={0.1}
                      value={videoState.startTime}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setVideoState((prev) => ({ ...prev, startTime: val }));
                        handleSeek(val);
                      }}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                    <span className="font-mono w-12 text-right">
                      {formatDuration(videoState.startTime)}
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <span>End:</span>
                    <input
                      type="range"
                      min={Math.min(videoDuration, videoState.startTime + 0.2)}
                      max={videoDuration}
                      step={0.1}
                      value={videoState.endTime}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setVideoState((prev) => ({ ...prev, endTime: val }));
                        handleSeek(val);
                      }}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                    <span className="font-mono w-12 text-right">
                      {formatDuration(videoState.endTime)}
                    </span>
                  </label>
                </div>
              </div>

              {/* Video Specific Controls */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setVideoState((prev) => ({ ...prev, isMuted: !prev.isMuted }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      videoState.isMuted
                        ? "bg-amber-500 text-white"
                        : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                    }`}
                  >
                    {videoState.isMuted ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                    {videoState.isMuted ? "Muted (Silent Video)" : "Audio On"}
                  </button>

                  <button
                    type="button"
                    onClick={handleCaptureCover}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Camera className="w-3.5 h-3.5" /> Set Cover Frame
                  </button>

                  {thumbnailPreviewUrl && (
                    <div className="flex items-center gap-1.5">
                      <img
                        src={thumbnailPreviewUrl}
                        alt="Cover"
                        className="w-7 h-7 object-cover rounded border border-sky-400"
                      />
                      <span className="text-[10px] text-sky-500 font-medium">Cover Set</span>
                    </div>
                  )}

                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={videoState.hasSpoiler}
                      onChange={(e) =>
                        setVideoState((prev) => ({ ...prev, hasSpoiler: e.target.checked }))
                      }
                      className="accent-sky-500 rounded"
                    />
                    <span>Spoiler</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isProcessing}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-[0.98] text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-sky-500/20 transition disabled:opacity-50"
            >
              {isProcessing ? (
                <span>Processing...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Apply Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
