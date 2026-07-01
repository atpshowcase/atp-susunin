"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import Toolbar from "./Toolbar";
import PreviewPlayer from "./PreviewPlayer";
import Timeline from "./Timeline";
import { Clip, TextOverlay } from "@/lib/types";

let clipIdCounter = 0;
const nextClipId = () => `clip-${clipIdCounter++}`;
let textIdCounter = 0;
const nextTextId = () => `text-${textIdCounter++}`;

export default function VideoEditor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);

  const handleAddText = useCallback(() => {
    setTextOverlays((prev) => [
      ...prev,
      {
        id: nextTextId(),
        content: "New Text",
        x: 50,
        y: 50,
        color: "#ffffff",
        fontSize: 48,
      },
    ]);
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFileName(file.name);
    setVideoUrl(URL.createObjectURL(file));
    setClips([]);
    setSelectedClipId(null);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration;
    setDuration(d);
    const id = nextClipId();
    setClips([{ id, start: 0, end: d }]);
    setSelectedClipId(id);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleSplit = useCallback(() => {
    setClips((prev) => {
      const t = videoRef.current?.currentTime ?? currentTime;
      const targetIndex = prev.findIndex(
        (c) => t > c.start + 0.05 && t < c.end - 0.05
      );
      if (targetIndex === -1) return prev;

      const target = prev[targetIndex];
      const left: Clip = { id: nextClipId(), start: target.start, end: t };
      const right: Clip = { id: nextClipId(), start: t, end: target.end };

      const next = [...prev];
      next.splice(targetIndex, 1, left, right);
      setSelectedClipId(right.id);
      return next;
    });
  }, [currentTime]);

  const handleDeleteClip = useCallback((id: string) => {
    setClips((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((c) => c.id !== id);
      setSelectedClipId(next[0]?.id ?? null);
      return next;
    });
  }, []);

  const canSplit = clips.some(
    (c) => currentTime > c.start + 0.05 && currentTime < c.end - 0.05
  );

  const handleExport = useCallback(async () => {
    if (!videoUrl || !fileName || clips.length === 0) return;
    
    const video = videoRef.current;
    if (!video) return;

    setIsExporting(true);

    try {
      // @ts-ignore
      const videoStream = (video.captureStream || video.mozCaptureStream).call(video);

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      const canvasStream = canvas.captureStream(30);
      const audioTracks = videoStream.getAudioTracks();
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks
      ]);

      // Determine MIME type supported
      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
        ? 'video/webm; codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(combinedStream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      const exportComplete = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      });

      recorder.start();

      let rAF: number;
      const drawFrame = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        for (const text of textOverlays) {
          ctx.font = `bold ${text.fontSize}px sans-serif`;
          ctx.fillStyle = text.color;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          
          // Draw a slight shadow for readability
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;

          const x = (text.x / 100) * canvas.width;
          const y = (text.y / 100) * canvas.height;
          ctx.fillText(text.content, x, y);
          
          // Reset shadow
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        rAF = requestAnimationFrame(drawFrame);
      };
      drawFrame();

      const origTime = video.currentTime;
      const origPaused = video.paused;

      // Play through all clips sequentially
      for (const clip of clips) {
        video.currentTime = clip.start;
        await video.play();
        
        await new Promise<void>((resolve) => {
          const checkTime = () => {
            if (video.currentTime >= clip.end) {
              video.removeEventListener('timeupdate', checkTime);
              resolve();
            }
          };
          video.addEventListener('timeupdate', checkTime);
        });
        
        video.pause();
      }

      cancelAnimationFrame(rAF);
      recorder.stop();
      
      const exportedBlob = await exportComplete;
      video.currentTime = origTime;
      if (!origPaused) video.play();
      
      const totalDuration = clips.reduce((acc, clip) => acc + (clip.end - clip.start), 0);
      const durationStr = totalDuration.toFixed(1);

      const a = document.createElement("a");
      a.href = URL.createObjectURL(exportedBlob);
      a.download = `exported-${durationStr}s-${fileName.split('.')[0]}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

    } catch (e) {
      console.error(e);
      alert("Export failed.");
    }

    setIsExporting(false);
  }, [videoUrl, fileName, clips, textOverlays]);

  const handleReorderClips = useCallback((startIndex: number, endIndex: number) => {
    setClips((prev) => {
      const next = [...prev];
      const [removed] = next.splice(startIndex, 1);
      next.splice(endIndex, 0, removed);
      return next;
    });
  }, []);

  // Keyboard shortcuts: space = play/pause, S = split
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (!videoUrl) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSplit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [videoUrl, togglePlay, handleSplit]);

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <Toolbar
        fileName={fileName}
        hasVideo={!!videoUrl}
        onUploadClick={() => fileInputRef.current?.click()}
        onExportClick={handleExport}
        onAddTextClick={handleAddText}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {videoUrl ? (
        <>
          <PreviewPlayer
            videoRef={videoRef}
            videoUrl={videoUrl}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            canSplit={canSplit}
            onTogglePlay={togglePlay}
            onSplit={handleSplit}
            textOverlays={textOverlays}
            setTextOverlays={setTextOverlays}
          />
          {/* Hook up playback + metadata events */}
          <VideoEventBridge
            videoRef={videoRef}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          <Timeline
            duration={duration}
            currentTime={currentTime}
            clips={clips}
            selectedClipId={selectedClipId}
            onSeek={handleSeek}
            onSelectClip={setSelectedClipId}
            onDeleteClip={handleDeleteClip}
            onReorderClips={handleReorderClips}
          />

          {isExporting && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
                <p className="text-[15px] font-medium text-text">Exporting video in real-time...</p>
                <p className="text-[13px] text-muted">Please wait, do not close the window.</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState onBrowse={() => fileInputRef.current?.click()} />
      )}
    </div>
  );
}

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border text-muted">
        <UploadCloud size={22} strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <p className="text-[15px] font-medium text-text">
          Import a video to get started
        </p>
        <p className="mt-1 text-[13px] text-muted">
          Drop a file here, or browse from your computer
        </p>
      </div>
      <button
        onClick={onBrowse}
        className="mt-2 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90"
      >
        Browse files
      </button>
    </div>
  );
}

/** Wires imperative <video> events into React state without re-mounting the element. */
function VideoEventBridge({
  videoRef,
  onLoadedMetadata,
  onTimeUpdate,
  onPlay,
  onPause,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  onLoadedMetadata: () => void;
  onTimeUpdate: () => void;
  onPlay: () => void;
  onPause: () => void;
}) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [videoRef, onLoadedMetadata, onTimeUpdate, onPlay, onPause]);

  return null;
}
