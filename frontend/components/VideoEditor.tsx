"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import Toolbar from "./Toolbar";
import PreviewPlayer from "./PreviewPlayer";
import Timeline from "./Timeline";
import LeftSidebar from "./LeftSidebar";
import LeftPanel from "./LeftPanel";
import RightPropertiesPanel from "./RightPropertiesPanel";
import { Clip, TextOverlay } from "@/lib/types";
import { useHistory } from "./useHistory";
import { exportVideoWithFFmpeg } from "@/utils/exportVideo";

let clipIdCounter = 0;
const nextClipId = () => `clip-${clipIdCounter++}`;
let textIdCounter = 0;
const nextTextId = () => `text-${textIdCounter++}`;

export default function VideoEditor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const {
    state: projectState,
    setWithHistory: setProjectState,
    undo,
    redo
  } = useHistory<{ clips: Clip[], textOverlays: TextOverlay[] }>({ clips: [], textOverlays: [] });

  const clips = projectState.clips;
  const textOverlays = projectState.textOverlays;

  const setClips = useCallback((updater: Clip[] | ((prev: Clip[]) => Clip[])) => {
    setProjectState(prev => ({
      ...prev,
      clips: typeof updater === 'function' ? updater(prev.clips) : updater
    }));
  }, [setProjectState]);

  const setTextOverlays = useCallback((updater: TextOverlay[] | ((prev: TextOverlay[]) => TextOverlay[])) => {
    setProjectState(prev => ({
      ...prev,
      textOverlays: typeof updater === 'function' ? updater(prev.textOverlays) : updater
    }));
  }, [setProjectState]);

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [textLayerCount, setTextLayerCount] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(50);
  const clipboardRef = useRef<TextOverlay | null>(null);
  const editorStateRef = useRef({ selectedTextId, textOverlays, selectedClipId });
  editorStateRef.current = { selectedTextId, textOverlays, selectedClipId };

  const handleAddText = useCallback((targetLayerIndex?: number) => {
    const durationOfNewText = 3;
    const newStart = currentTime;
    const newEnd = Math.min(currentTime + durationOfNewText, duration || currentTime + durationOfNewText);

    let layerIndex = targetLayerIndex;

    if (layerIndex === undefined) {
      // Find lowest layer without overlap
      for (let i = 0; i < textLayerCount; i++) {
        const layerTexts = textOverlays.filter(t => t.layerIndex === i);
        const overlaps = layerTexts.some(t => Math.max(t.start, newStart) < Math.min(t.end, newEnd));
        if (!overlaps) {
          layerIndex = i;
          break;
        }
      }
      
      // If all existing layers overlap, create a new one
      if (layerIndex === undefined) {
        layerIndex = textLayerCount;
        setTextLayerCount(prev => prev + 1);
      }
    }

    setTextOverlays((prev) => [
      ...prev,
      {
        id: nextTextId(),
        content: "New Text",
        x: 50,
        y: 50,
        color: "#ffffff",
        fontSize: 48,
        start: newStart,
        end: newEnd,
        layerIndex: layerIndex!,
      },
    ]);
  }, [currentTime, duration, textLayerCount, textOverlays]);

  const handleAddTextLayer = useCallback(() => {
    setTextLayerCount(prev => prev + 1);
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFileName(file.name);
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setClips([]);
    setSelectedClipId(null);
    setTextOverlays([]);
    setSelectedTextId(null);
    setTextLayerCount(1);
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
    if (!videoFile || !fileName || clips.length === 0) return;
    
    setIsExporting(true);
    setExportProgress(0);

    const video = videoRef.current;
    const scaleFactor = video ? video.videoHeight / video.getBoundingClientRect().height : 1;

    try {
      const exportedBlob = await exportVideoWithFFmpeg(
        videoFile,
        clips,
        textOverlays,
        scaleFactor,
        (progress) => setExportProgress(progress)
      );
      
      const totalDuration = clips.reduce((acc, clip) => acc + (clip.end - clip.start), 0);
      const durationStr = totalDuration.toFixed(1);

      const a = document.createElement("a");
      a.href = URL.createObjectURL(exportedBlob);
      a.download = `exported-${durationStr}s-${fileName.split('.')[0]}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

    } catch (e) {
      console.error(e);
      alert("Export failed");
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [videoFile, fileName, clips, textOverlays]);

  const handleReorderClips = useCallback((startIndex: number, endIndex: number) => {
    setClips((prev) => {
      const next = [...prev];
      const [removed] = next.splice(startIndex, 1);
      next.splice(endIndex, 0, removed);
      return next;
    });
  }, []);

  const handleUpdateTextTiming = useCallback((id: string, start: number, end: number) => {
    setTextOverlays((prev) => 
      prev.map(t => t.id === id ? { ...t, start, end } : t)
    );
  }, []);

  const handleMoveTextLayer = useCallback((id: string, layerIndex: number) => {
    setTextOverlays((prev) => {
      const existing = prev.find(t => t.id === id);
      if (existing && existing.layerIndex !== layerIndex) {
        return prev.map(t => t.id === id ? { ...t, layerIndex } : t);
      }
      return prev;
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
      } else if (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleSplit();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        const { selectedTextId, textOverlays } = editorStateRef.current;
        if (selectedTextId) {
          const textToCopy = textOverlays.find(t => t.id === selectedTextId);
          if (textToCopy) {
            clipboardRef.current = { ...textToCopy };
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (clipboardRef.current) {
          e.preventDefault();
          const t = videoRef.current?.currentTime ?? 0;
          const d = videoRef.current?.duration ?? 0;
          const durationOfCopied = clipboardRef.current.end - clipboardRef.current.start;
          const newStart = t;
          const newEnd = Math.min(t + durationOfCopied, d || t + durationOfCopied);
          
          const newOverlay: TextOverlay = {
            ...clipboardRef.current,
            id: nextTextId(),
            start: newStart,
            end: newEnd,
          };
          setTextOverlays(prev => [...prev, newOverlay]);
          setSelectedTextId(newOverlay.id);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedTextId, selectedClipId } = editorStateRef.current;
        if (selectedTextId) {
          e.preventDefault();
          setTextOverlays(prev => prev.filter(t => t.id !== selectedTextId));
          setSelectedTextId(null);
        } else if (selectedClipId) {
          e.preventDefault();
          handleDeleteClip(selectedClipId);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo(); // Cmd+Shift+Z for redo
        } else {
          undo(); // Cmd+Z for undo
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo(); // Ctrl+Y for redo
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [videoUrl, togglePlay, handleSplit, handleDeleteClip, undo, redo]);

  const selectedText = textOverlays.find(t => t.id === selectedTextId);
  const selectedTextContent = selectedText?.content;

  return (
    <div className="flex h-screen flex-col bg-[#111111] text-text overflow-hidden">
      <Toolbar
        fileName={fileName}
        onUploadClick={() => fileInputRef.current?.click()}
        onExportClick={handleExport}
        hasVideo={!!videoUrl}
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/*"
        className="hidden"
      />
      {videoUrl ? (
        <div className="flex flex-1 overflow-hidden">
          <LeftSidebar />
          <LeftPanel onAddTextClick={() => handleAddText()} hasVideo={!!videoUrl} />
          
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 relative bg-black flex flex-col justify-center border-b border-border/50">
                <PreviewPlayer
                  videoUrl={videoUrl}
                  videoRef={videoRef}
                  isPlaying={isPlaying}
                  onTogglePlay={togglePlay}
                  currentTime={currentTime}
                  duration={duration}
                  canSplit={canSplit}
                  onSplit={handleSplit}
                  textOverlays={textOverlays}
                  setTextOverlays={setTextOverlays}
                  selectedTextId={selectedTextId}
                />
              </div>
              <RightPropertiesPanel 
                isItemSelected={!!selectedTextId} 
                textContent={selectedTextContent}
                fontSize={selectedText?.fontSize}
                onTextChange={(content) => {
                  if (selectedTextId) {
                    setTextOverlays(prev => prev.map(t => t.id === selectedTextId ? { ...t, content } : t));
                  }
                }}
                onFontSizeChange={(fontSize) => {
                  if (selectedTextId) {
                    setTextOverlays(prev => prev.map(t => t.id === selectedTextId ? { ...t, fontSize } : t));
                  }
                }}
              />
            </div>

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
              textOverlays={textOverlays}
              selectedTextId={selectedTextId}
              textLayerCount={textLayerCount}
              onSeek={handleSeek}
              onSelectClip={setSelectedClipId}
              onDeleteClip={handleDeleteClip}
              onReorderClips={handleReorderClips}
              onSelectText={setSelectedTextId}
              onDeleteText={(id) => setTextOverlays(prev => prev.filter(t => t.id !== id))}
              onUpdateTextTiming={handleUpdateTextTiming}
              onMoveTextLayer={handleMoveTextLayer}
              onAddTextLayer={handleAddTextLayer}
              onAddTextToLayer={(layerIndex) => handleAddText(layerIndex)}
              zoomLevel={zoomLevel}
              onZoomChange={setZoomLevel}
            />

            {isExporting && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
                  <p className="text-[15px] font-medium text-text">Exporting video: {exportProgress.toFixed(0)}%</p>
                  <p className="text-[13px] text-muted">Please wait, do not close the window.</p>
                </div>
              </div>
            )}
          </div>
        </div>
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
