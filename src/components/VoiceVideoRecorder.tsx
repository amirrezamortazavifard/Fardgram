import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  Video,
  Pause,
  Play,
  Square,
  Trash2,
  Send,
  RotateCcw,
  SwitchCamera,
  X,
  Volume2,
} from "lucide-react";

export type RecordingKind = "voice" | "video";

export interface VoiceVideoRecorderProps {
  activeKind: RecordingKind;
  onClose: () => void;
  onSendRecording: (file: File, durationSec: number, kind: "voice" | "videoNote") => Promise<boolean>;
}

export const VoiceVideoRecorder: React.FC<VoiceVideoRecorderProps> = ({
  activeKind,
  onClose,
  onSendRecording,
}) => {
  const [recordingState, setRecordingState] = useState<"recording" | "paused" | "preview">("recording");
  const [durationSec, setDurationSec] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const finalFileRef = useRef<File | null>(null);

  const cleanupStreams = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Audio waveform visualizer loop
  const drawWaveform = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const numBars = 32;
      const barWidth = 3;
      const gap = 3;
      const totalWidth = numBars * (barWidth + gap);
      const startX = Math.max(0, (canvas.width - totalWidth) / 2);

      for (let i = 0; i < numBars; i++) {
        // Average sampling across frequency bins
        const binIndex = Math.floor((i / numBars) * (bufferLength / 2));
        const rawValue = dataArray[binIndex] || 0;
        const normalized = rawValue / 255;
        const minHeight = 4;
        const maxHeight = canvas.height - 4;
        const barHeight = Math.max(minHeight, normalized * maxHeight);

        const x = startX + i * (barWidth + gap);
        const y = (canvas.height - barHeight) / 2;

        ctx.fillStyle = normalized > 0.4 ? "#38bdf8" : "rgba(255, 255, 255, 0.45)";
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
  }, []);

  // Initialize Recording
  const startRecording = useCallback(async () => {
    try {
      cleanupStreams();
      recordedChunksRef.current = [];
      setDurationSec(0);
      setRecordingState("recording");
      setErrorMessage(null);

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setErrorMessage("Microphone or Camera access is not supported in this environment.");
        return;
      }

      // Check available video devices
      if (activeKind === "video" && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(videoDevs.length > 1);
      }

      const constraints: MediaStreamConstraints =
        activeKind === "video"
          ? {
              audio: { echoCancellation: true, noiseSuppression: true },
              video: {
                width: { ideal: 480 },
                height: { ideal: 480 },
                aspectRatio: 1,
                facingMode,
              },
            }
          : {
              audio: { echoCancellation: true, noiseSuppression: true },
            };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      // Attach stream to live video if video note
      if (activeKind === "video" && liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        void liveVideoRef.current.play().catch(() => {});
      }

      // Setup audio analyzer for waveform
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;
        drawWaveform();
      }

      // Select supported MIME type — try OGG/Opus first for voice (Telegram standard)
      let mimeType = "";
      if (activeKind === "voice") {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
          mimeType = "audio/ogg;codecs=opus";
        } else if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else {
          mimeType = "audio/webm";
        }
      } else {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
          mimeType = "video/webm;codecs=vp8,opus";
        } else if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/mp4")) {
          mimeType = "video/mp4";
        } else {
          mimeType = "video/webm";
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.start(250); // collect in 250ms chunks

      // Start duration counter
      timerRef.current = window.setInterval(() => {
        setDurationSec((prev) => {
          // Telegram video note limit is 60 seconds
          if (activeKind === "video" && prev >= 59) {
            void stopAndPreview();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Permission") || message.includes("denied")) {
        setErrorMessage("Permission denied. Please grant microphone and camera access.");
      } else {
        setErrorMessage("Could not initialize recording device: " + message);
      }
    }
  }, [activeKind, cleanupStreams, drawWaveform, facingMode]);

  useEffect(() => {
    void startRecording();
    return () => {
      cleanupStreams();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [startRecording]);

  // Pause / Resume
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (recordingState === "recording") {
      mediaRecorderRef.current.pause();
      setRecordingState("paused");
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } else if (recordingState === "paused") {
      mediaRecorderRef.current.resume();
      setRecordingState("recording");
      timerRef.current = window.setInterval(() => {
        setDurationSec((prev) => prev + 1);
      }, 1000);
    }
  };

  // Stop & build preview
  const stopAndPreview = () => {
    if (!mediaRecorderRef.current) return;
    const recorder = mediaRecorderRef.current;

    recorder.onstop = () => {
      const mime = recorder.mimeType || (activeKind === "voice" ? "audio/webm" : "video/webm");
      const blob = new Blob(recordedChunksRef.current, { type: mime });
      // Voice notes always use .ogg (Telegram standard); video notes match actual container
      const ext = activeKind === "voice"
        ? "ogg"
        : mime.includes("mp4") ? "mp4" : "webm";
      const voiceMime = activeKind === "voice" ? "audio/ogg" : mime;
      const filename = activeKind === "voice" ? `voice_message.${ext}` : `video_note.${ext}`;
      const file = new File([blob], filename, { type: voiceMime });
      finalFileRef.current = file;

      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setRecordingState("preview");
      cleanupStreams();
    };

    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  // Cancel / Trash
  const handleCancel = () => {
    cleanupStreams();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  };

  // Direct Send
  const handleSend = async () => {
    if (recordingState !== "preview") {
      if (!mediaRecorderRef.current) return;
      const recorder = mediaRecorderRef.current;
      recorder.onstop = async () => {
        const mime = recorder.mimeType || (activeKind === "voice" ? "audio/webm" : "video/webm");
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        // Voice notes always use .ogg (Telegram standard); video notes use the actual container format
        const ext = activeKind === "voice"
          ? "ogg"
          : mime.includes("mp4") ? "mp4" : "webm";
        const voiceMime = activeKind === "voice" ? "audio/ogg" : mime;
        const filename = activeKind === "voice" ? `voice_message.${ext}` : `video_note.${ext}`;
        const file = new File([blob], filename, { type: voiceMime });
        cleanupStreams();
        await onSendRecording(file, durationSec || 1, activeKind === "voice" ? "voice" : "videoNote");
        onClose();
      };
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    } else if (finalFileRef.current) {
      await onSendRecording(finalFileRef.current, durationSec || 1, activeKind === "voice" ? "voice" : "videoNote");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onClose();
    }
  };

  // Switch camera for video note
  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  // Video note circular progress ring
  const maxVideoDuration = 60;
  const progressPercent = activeKind === "video" ? Math.min(100, (durationSec / maxVideoDuration) * 100) : 0;
  const circleRadius = 140;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference - (progressPercent / 100) * circleCircumference;

  return (
    <div
      className={`voice-video-recorder-container ${activeKind === "video" ? "is-video-note" : "is-voice-bar"}`}
      role="region"
      aria-label={activeKind === "video" ? "Video Note Recorder" : "Voice Message Recorder"}
    >
      {errorMessage ? (
        <div className="recorder-error-banner">
          <span>{errorMessage}</span>
          <button type="button" className="icon-button" onClick={handleCancel}>
            <X size={16} />
          </button>
        </div>
      ) : activeKind === "video" ? (
        /* Video Note Circular Telescope Viewfinder */
        <div className="video-note-viewfinder-overlay">
          <div className="video-note-circle-wrapper">
            <svg className="video-note-progress-ring" viewBox="0 0 300 300">
              <circle
                cx="150"
                cy="150"
                r={circleRadius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="5"
              />
              <circle
                cx="150"
                cy="150"
                r={circleRadius}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="5"
                strokeDasharray={circleCircumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 150 150)"
                style={{ transition: "stroke-dashoffset 0.8s linear" }}
              />
            </svg>

            <div className="video-note-media-circle">
              {recordingState !== "preview" ? (
                <video
                  ref={liveVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`video-note-camera-feed ${facingMode === "user" ? "is-mirrored" : ""}`}
                />
              ) : (
                <video
                  ref={previewVideoRef}
                  src={previewUrl ?? undefined}
                  autoPlay
                  loop
                  playsInline
                  className="video-note-camera-feed"
                />
              )}

              {recordingState === "recording" && (
                <div className="video-note-rec-badge">
                  <span className="pulsing-rec-dot" />
                  <span>REC</span>
                </div>
              )}
            </div>

            {hasMultipleCameras && recordingState !== "preview" && (
              <button
                type="button"
                className="video-note-switch-cam-btn"
                title="Switch Camera"
                onClick={handleSwitchCamera}
              >
                <SwitchCamera size={18} />
              </button>
            )}
          </div>

          <div className="video-note-controls-strip">
            <span className="video-note-timer">
              {formatTime(durationSec)} <small>/ 1:00</small>
            </span>

            <div className="video-note-btn-row">
              <button
                type="button"
                className="recorder-action-btn is-danger"
                title="Discard Recording"
                onClick={handleCancel}
              >
                <Trash2 size={18} />
              </button>

              {recordingState !== "preview" ? (
                <button
                  type="button"
                  className="recorder-action-btn is-secondary"
                  title="Stop and Preview"
                  onClick={stopAndPreview}
                >
                  <Square size={16} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  className="recorder-action-btn is-secondary"
                  title="Record Again"
                  onClick={() => void startRecording()}
                >
                  <RotateCcw size={18} />
                </button>
              )}

              <button
                type="button"
                className="recorder-action-btn is-primary"
                title="Send Video Message"
                onClick={() => void handleSend()}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Voice Recording Floating Bar */
        <div className="voice-recorder-bar">
          <div className="voice-recorder-status">
            <span className={`pulsing-rec-dot ${recordingState === "paused" ? "is-paused" : ""}`} />
            <span className="voice-recorder-timer">{formatTime(durationSec)}</span>
          </div>

          {recordingState !== "preview" ? (
            <div className="voice-recorder-waveform-area">
              <canvas
                ref={canvasRef}
                width={200}
                height={32}
                className="voice-recorder-waveform-canvas"
              />
            </div>
          ) : (
            <div className="voice-recorder-preview-player">
              <button
                type="button"
                className="voice-preview-play-btn"
                onClick={() => {
                  if (!previewAudioRef.current) return;
                  if (isPlayingPreview) {
                    previewAudioRef.current.pause();
                    setIsPlayingPreview(false);
                  } else {
                    void previewAudioRef.current.play();
                    setIsPlayingPreview(true);
                  }
                }}
              >
                {isPlayingPreview ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <audio
                ref={previewAudioRef}
                src={previewUrl ?? undefined}
                onEnded={() => setIsPlayingPreview(false)}
              />
              <span className="voice-preview-label">
                <Volume2 size={14} style={{ opacity: 0.7 }} />
                <span>Ready to send</span>
              </span>
            </div>
          )}

          <div className="voice-recorder-actions">
            <button
              type="button"
              className="recorder-icon-btn is-trash"
              title="Delete Voice Recording"
              onClick={handleCancel}
            >
              <Trash2 size={17} />
            </button>

            {recordingState !== "preview" && (
              <button
                type="button"
                className="recorder-icon-btn"
                title={recordingState === "paused" ? "Resume" : "Pause"}
                onClick={togglePause}
              >
                {recordingState === "paused" ? <Play size={16} /> : <Pause size={16} />}
              </button>
            )}

            {recordingState !== "preview" ? (
              <button
                type="button"
                className="recorder-icon-btn"
                title="Stop and Listen"
                onClick={stopAndPreview}
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                className="recorder-icon-btn"
                title="Re-record"
                onClick={() => void startRecording()}
              >
                <RotateCcw size={16} />
              </button>
            )}

            <button
              type="button"
              className="recorder-send-btn"
              title="Send Voice Message"
              onClick={() => void handleSend()}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
