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
import { useHistory } from "@/lib/application/useHistory";
import { exportVideo } from "@/lib/application/exportVideo";
import {
  ProjectState,
  canSplitAtOriginalTime,
  copyTextOverlayAtTime,
  createExportFileName,
  createTextOverlay,
  deleteClip as deleteClipFromProject,
  getOriginalTime as mapTimelineToOriginalTime,
  getTimelineTime as mapOriginalToTimelineTime,
  reorderByIndex,
  resolveTextLayer,
  splitClipAtOriginalTime,
  totalClipDuration,
  updateTextOverlay,
} from "@/lib/domain/editor";
import { createSequentialIdFactory } from "@/lib/application/idFactory";

const nextClipId = createSequentialIdFactory("clip");
const nextTextId = createSequentialIdFactory("text");

export default function VideoEditor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [originalDuration, setOriginalDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0); // This is now timeline time
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportResolution, setExportResolution] = useState("original");
  const {
    state: projectState,
    setWithHistory: setProjectState,
    undo,
    redo
  } = useHistory<ProjectState>({ clips: [], textOverlays: [] });

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

  const totalDuration = totalClipDuration(clips);

  const getOriginalTime = useCallback((tlTime: number) => {
    return mapTimelineToOriginalTime(clips, tlTime);
  }, [clips]);

  const getTimelineTime = useCallback((origTime: number) => {
    return mapOriginalToTimelineTime(clips, origTime);
  }, [clips]);

  const handleAddText = useCallback((targetLayerIndex?: number) => {
    const previewText = createTextOverlay("", currentTime, totalDuration, 0);
    const textLayer = resolveTextLayer(
      textOverlays,
      textLayerCount,
      previewText.start,
      previewText.end,
      targetLayerIndex
    );

    setTextLayerCount(textLayer.textLayerCount);

    setTextOverlays((prev) => [
      ...prev,
      createTextOverlay(nextTextId(), currentTime, totalDuration, textLayer.layerIndex),
    ]);
  }, [currentTime, totalDuration, textLayerCount, textOverlays]);

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
    setOriginalDuration(d);
    const id = nextClipId();
    setClips([{ id, start: 0, end: d }]);
    setSelectedClipId(id);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const origTime = video.currentTime;
    
    const isInside = clips.some(c => origTime >= c.start && origTime <= c.end);

    if (!isInside && clips.length > 0) {
      const nextClip = clips.find(c => c.start > origTime);
      if (nextClip) {
        video.currentTime = nextClip.start;
        setCurrentTime(getTimelineTime(nextClip.start));
        return;
      } else {
        const maxEnd = Math.max(...clips.map(c => c.end));
        if (origTime > maxEnd) {
           video.pause();
           setIsPlaying(false);
           video.currentTime = maxEnd;
           setCurrentTime(totalDuration);
           return;
        }
      }
    }
    
    setCurrentTime(getTimelineTime(video.currentTime));
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
    const origTime = getOriginalTime(time);
    video.currentTime = origTime;
    setCurrentTime(time);
  }, [getOriginalTime]);

  const handleSplit = useCallback(() => {
    setClips((prev) => {
      const origTime = videoRef.current?.currentTime ?? getOriginalTime(currentTime);
      const result = splitClipAtOriginalTime(prev, origTime, nextClipId);
      if (result.selectedClipId) setSelectedClipId(result.selectedClipId);
      return result.clips;
    });
  }, [currentTime, getOriginalTime]);

  const handleDeleteClip = useCallback((id: string) => {
    setClips((prev) => {
      const result = deleteClipFromProject(prev, id);
      if (result.selectedClipId !== null) setSelectedClipId(result.selectedClipId);
      return result.clips;
    });
  }, []);

  const splitTime = videoRef.current?.currentTime ?? getOriginalTime(currentTime);
  const canSplit = canSplitAtOriginalTime(clips, splitTime);

  const handleExport = useCallback(async () => {
    if (!videoFile || !fileName || clips.length === 0) return;
    
    setIsExporting(true);

    const video = videoRef.current;
    const scaleFactor = video ? video.videoHeight / video.getBoundingClientRect().height : 1;

    try {
      const exportedBlob = await exportVideo(
        {
          videoFile,
          clips,
          textOverlays,
          scaleFactor,
          resolution: exportResolution,
        },
        (progress) => setExportProgress(progress)
      );
      
      const a = document.createElement("a");
      a.href = URL.createObjectURL(exportedBlob);
      a.download = createExportFileName(fileName, clips);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

    } catch (e: any) {
      console.error(e);
      alert(`Export failed: ${e.message}. Make sure the Go backend is running (docker-compose up)`);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [videoFile, fileName, clips, textOverlays, exportResolution]);

  const handleReorderClips = useCallback((startIndex: number, endIndex: number) => {
    setClips((prev) => {
      return reorderByIndex(prev, startIndex, endIndex);
    });
  }, []);

  const handleUpdateTextTiming = useCallback((id: string, start: number, end: number) => {
    setTextOverlays((prev) => 
      updateTextOverlay(prev, id, { start, end })
    );
  }, []);

  const handleMoveTextLayer = useCallback((id: string, layerIndex: number) => {
    setTextOverlays((prev) => {
      const existing = prev.find(t => t.id === id);
      if (existing && existing.layerIndex !== layerIndex) {
        return updateTextOverlay(prev, id, { layerIndex });
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
          const newOverlay = copyTextOverlayAtTime(clipboardRef.current, nextTextId(), currentTime, totalDuration);
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
  }, [videoUrl, togglePlay, handleSplit, handleDeleteClip, currentTime, totalDuration, undo, redo]);

  const selectedText = textOverlays.find(t => t.id === selectedTextId);
  const selectedTextContent = selectedText?.content;

  return (
    <div className="flex h-screen flex-col bg-[#111111] text-text overflow-hidden">
      <Toolbar
        fileName={fileName}
        onUploadClick={() => fileInputRef.current?.click()}
        onExportClick={handleExport}
        hasVideo={!!videoUrl}
        exportResolution={exportResolution}
        onExportResolutionChange={setExportResolution}
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
                  duration={totalDuration}
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
                    setTextOverlays(prev => updateTextOverlay(prev, selectedTextId, { content }));
                  }
                }}
                onFontSizeChange={(fontSize) => {
                  if (selectedTextId) {
                    setTextOverlays(prev => updateTextOverlay(prev, selectedTextId, { fontSize }));
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
              videoUrl={videoUrl}
              originalDuration={originalDuration}
              duration={totalDuration}
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
                  <p className="text-[13px] text-muted">Processing via native FFmpeg, please wait.</p>
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
