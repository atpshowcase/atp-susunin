"use client";

import { Trash2 } from "lucide-react";
import { MouseEvent, useMemo, useRef, useState, useEffect } from "react";
import { Clip, TextOverlay, formatTimecode } from "@/lib/types";

interface TimelineProps {
  duration: number;
  currentTime: number;
  clips: Clip[];
  selectedClipId: string | null;
  textOverlays?: TextOverlay[];
  selectedTextId?: string | null;
  onSeek: (time: number) => void;
  onSelectClip: (id: string) => void;
  onDeleteClip: (id: string) => void;
  onReorderClips: (startIndex: number, endIndex: number) => void;
  onSelectText?: (id: string) => void;
  onDeleteText?: (id: string) => void;
  onUpdateTextTiming?: (id: string, start: number, end: number) => void;
  textLayerCount?: number;
  onAddTextLayer?: () => void;
  onAddTextToLayer?: (layerIndex: number) => void;
  onMoveTextLayer?: (id: string, layerIndex: number) => void;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
}

function buildTicks(duration: number, zoomLevel: number) {
  if (!duration) return [];
  // Calculate how many seconds correspond to a reasonable gap (e.g., 100px)
  const rough = 100 / zoomLevel;
  const steps = [0.1, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const step = steps.find((s) => s >= rough) ?? steps[steps.length - 1];
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += step) ticks.push(t);
  return ticks;
}

export default function Timeline({
  duration,
  currentTime,
  clips,
  selectedClipId,
  textOverlays = [],
  selectedTextId = null,
  onSeek,
  onSelectClip,
  onDeleteClip,
  onReorderClips,
  onSelectText,
  onDeleteText,
  onUpdateTextTiming,
  textLayerCount = 1,
  onAddTextLayer,
  onAddTextToLayer,
  onMoveTextLayer,
  zoomLevel,
  onZoomChange,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [draggedTextId, setDraggedTextId] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [draggingText, setDraggingText] = useState<{
    id: string;
    action: 'move' | 'left' | 'right';
    startX: number;
    initialStart: number;
    initialEnd: number;
  } | null>(null);
  const ticks = useMemo(() => buildTicks(duration, zoomLevel), [duration, zoomLevel]);

  useEffect(() => {
    if (!isScrubbing) return;

    const handlePointerMove = (e: PointerEvent) => {
      const el = trackRef.current;
      if (!el || !duration) return;
      const rect = el.getBoundingClientRect();
      const time = (e.clientX - rect.left) / zoomLevel;
      onSeek(Math.min(duration, Math.max(0, time)));
    };

    const handlePointerUp = () => {
      setIsScrubbing(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isScrubbing, duration, onSeek]);

  useEffect(() => {
    if (!draggingText) return;

    const handlePointerMove = (e: PointerEvent) => {
      const el = trackRef.current;
      if (!el || !duration || !onUpdateTextTiming) return;
      const deltaX = e.clientX - draggingText.startX;
      const deltaSec = deltaX / zoomLevel;

      let newStart = draggingText.initialStart;
      let newEnd = draggingText.initialEnd;

      if (draggingText.action === 'move') {
        newStart = Math.max(0, draggingText.initialStart + deltaSec);
        newEnd = newStart + (draggingText.initialEnd - draggingText.initialStart);
        if (newEnd > duration) {
          newEnd = duration;
          newStart = newEnd - (draggingText.initialEnd - draggingText.initialStart);
        }

        // Magnetic snapping to other texts in the same layer
        const snapThreshold = 15 / zoomLevel; // 15 pixels snapping radius
        const currentText = textOverlays.find(t => t.id === draggingText.id);
        if (currentText) {
          const others = textOverlays.filter(t => t.layerIndex === currentText.layerIndex && t.id !== currentText.id);
          for (const other of others) {
            if (Math.abs(newStart - other.end) < snapThreshold) {
              newStart = other.end;
              newEnd = newStart + (draggingText.initialEnd - draggingText.initialStart);
              break; // Snapped
            } else if (Math.abs(newEnd - other.start) < snapThreshold) {
              newEnd = other.start;
              newStart = newEnd - (draggingText.initialEnd - draggingText.initialStart);
              break; // Snapped
            }
          }
        }

        // Layer changing via drag
        if (onMoveTextLayer) {
          // Temporarily disable pointer events on the dragged element itself if needed,
          // but elementFromPoint usually hits the background if we moved vertically out of the element.
          const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
          const trackContainer = elementUnderCursor?.closest('[data-layer-index]');
          if (trackContainer) {
            const targetLayerStr = trackContainer.getAttribute('data-layer-index');
            if (targetLayerStr != null) {
              const targetLayer = parseInt(targetLayerStr, 10);
              onMoveTextLayer(draggingText.id, targetLayer);
            }
          }
        }
      } else if (draggingText.action === 'left') {
        newStart = Math.max(0, Math.min(draggingText.initialStart + deltaSec, newEnd - 0.5));
      } else if (draggingText.action === 'right') {
        newEnd = Math.min(duration, Math.max(draggingText.initialEnd + deltaSec, newStart + 0.5));
      }

      onUpdateTextTiming(draggingText.id, newStart, newEnd);
    };

    const handlePointerUp = () => setDraggingText(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingText, duration, onUpdateTextTiming, textOverlays, zoomLevel]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // prevent browser zoom
        const zoomDelta = e.deltaY > 0 ? -15 : 15;
        onZoomChange(Math.max(10, Math.min(200, zoomLevel + zoomDelta)));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoomLevel, onZoomChange]);

  const seekFromEvent = (e: React.MouseEvent) => {
      const el = trackRef.current;
      if (!el || !duration) return;
      const rect = el.getBoundingClientRect();
      const time = (e.clientX - rect.left) / zoomLevel;
      onSeek(Math.min(duration, Math.max(0, time)));
  };

  const playheadPx = currentTime * zoomLevel;
  const trackWidthPx = Math.max(duration * zoomLevel, 800); // minimum width so it doesn't look empty if short

  return (
    <div className="flex shrink-0 flex-col border-t border-border bg-surface relative z-10">
      {/* Zoom Toolbar */}
      <div className="flex h-10 items-center justify-end px-6 border-b border-border/50 gap-3">
        <span className="text-[11px] font-medium text-muted">Zoom</span>
        <input 
          type="range" 
          min="10" 
          max="200" 
          value={zoomLevel} 
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="w-24 accent-accent"
        />
      </div>

      <div ref={scrollRef} className="overflow-x-auto px-6 pb-5 pt-3 custom-scrollbar">
        <div style={{ width: `${trackWidthPx}px` }} className="relative min-w-full">
          {/* Ruler */}
          <div className="relative h-5 select-none">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-muted"
                style={{ left: `${t * zoomLevel}px` }}
              >
                {formatTimecode(t).slice(0, -3)}
              </span>
            ))}
          </div>

          {/* Track Container + playhead */}
          <div className="relative mt-1">
            {/* Playhead line, spans ruler tick + all tracks */}
            <div
              className="absolute -top-6 bottom-0 z-20 w-px bg-accent cursor-ew-resize"
              style={{ left: `${playheadPx}px` }}
              onPointerDown={(e) => {
                e.preventDefault();
                setIsScrubbing(true);
              }}
            >
              <div className="absolute -top-6 left-1/2 h-3 w-3 -translate-x-1/2 rounded-sm bg-accent" />
            </div>

            <div
              ref={trackRef}
              onClick={seekFromEvent}
              className="relative flex flex-col gap-2 rounded-md bg-bg p-[3px] cursor-pointer"
            >
          {/* Video Track */}
          <div className="relative flex h-16 items-stretch gap-[3px] rounded bg-surface-2 p-[2px]">
            {clips.map((clip, index) => {
              const width = (clip.end - clip.start) * zoomLevel;
              const isSelected = clip.id === selectedClipId;
              return (
                <div
                  key={clip.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedIdx(index);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIdx !== null && draggedIdx !== index) {
                      onReorderClips(draggedIdx, index);
                    }
                    setDraggedIdx(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectClip(clip.id);
                    if (currentTime < clip.start || currentTime >= clip.end) {
                      onSeek(clip.start);
                    }
                  }}
                  style={{ width: `${width}px`, flexShrink: 0 }}
                  className={`group animate-clip-in relative flex min-w-[4px] items-center justify-center overflow-hidden rounded-[4px] border transition-colors ${
                    isSelected
                      ? "border-accent bg-accent-soft"
                      : "border-transparent bg-surface-3 hover:bg-surface-4"
                  } ${draggedIdx === index ? "opacity-50" : ""}`}
                >
                  <div
                    className="absolute inset-0 opacity-[0.06]"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, #F2F1ED 0px, #F2F1ED 1px, transparent 1px, transparent 8px)",
                    }}
                  />
                  {width > 40 && (
                    <span className="pointer-events-none z-10 truncate px-2 font-mono text-[10px] text-muted">
                      {formatTimecode(clip.end - clip.start).slice(0, -3)}
                    </span>
                  )}
                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClip(clip.id);
                      }}
                      className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded bg-bg/80 text-muted transition-colors hover:text-danger"
                    >
                      <Trash2 size={11} strokeWidth={2} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Text Tracks */}
          {Array.from({ length: textLayerCount }).map((_, layerIndex) => {
            const overlaysInLayer = textOverlays.filter(t => t.layerIndex === layerIndex);
            return (
              <div 
                key={layerIndex} 
                data-layer-index={layerIndex}
                className={`relative h-12 w-full rounded p-[2px] group/layer transition-colors ${
                  draggedTextId && !overlaysInLayer.find(t => t.id === draggedTextId) 
                    ? "bg-surface-2/80 ring-1 ring-accent/50 ring-inset" 
                    : "bg-surface-2"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedTextId && onMoveTextLayer) {
                    onMoveTextLayer(draggedTextId, layerIndex);
                  }
                  setDraggedTextId(null);
                }}
              >
                {/* Empty track placeholder / Add button */}
                {overlaysInLayer.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/layer:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onAddTextToLayer?.(layerIndex)}
                      className="text-[11px] text-muted hover:text-text bg-bg/50 px-2 py-1 rounded"
                    >
                      + Add text to layer {layerIndex + 1}
                    </button>
                  </div>
                )}
                {overlaysInLayer.map((text) => {
                  const leftPx = text.start * zoomLevel;
                  const widthPx = (text.end - text.start) * zoomLevel;
                  const isSelected = text.id === selectedTextId;

                  return (
                    <div
                      key={text.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectText?.(text.id);
                      }}
                      style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                      className={`absolute top-[2px] bottom-[2px] flex items-center overflow-visible rounded-[4px] border transition-colors ${
                        isSelected
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-border/50 bg-[#2C2C35] text-text hover:bg-[#353540] shadow-sm"
                      } ${draggedTextId === text.id ? "opacity-50" : ""}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onSelectText?.(text.id);
                        if (currentTime < text.start || currentTime >= text.end) {
                          onSeek?.(text.start);
                        }
                        setDraggingText({
                          id: text.id,
                          action: 'move',
                          startX: e.clientX,
                          initialStart: text.start,
                          initialEnd: text.end,
                        });
                      }}
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/10 z-20"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onSelectText?.(text.id);
                          setDraggingText({
                            id: text.id,
                            action: 'left',
                            startX: e.clientX,
                            initialStart: text.start,
                            initialEnd: text.end,
                          });
                        }}
                      />
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/10 z-20"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onSelectText?.(text.id);
                          setDraggingText({
                            id: text.id,
                            action: 'right',
                            startX: e.clientX,
                            initialStart: text.start,
                            initialEnd: text.end,
                          });
                        }}
                      />
                      
                      {/* Drag handle for layer moving */}
                      <div
                        className="absolute left-2 top-1/2 flex h-5 w-3 -translate-y-1/2 cursor-grab flex-col items-center justify-center gap-[2px] opacity-40 hover:opacity-100 z-30"
                        draggable
                        onPointerDown={(e) => e.stopPropagation()}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDraggedTextId(text.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDraggedTextId(null)}
                      >
                        <div className="h-[2px] w-[2px] rounded-full bg-current" />
                        <div className="h-[2px] w-[2px] rounded-full bg-current" />
                        <div className="h-[2px] w-[2px] rounded-full bg-current" />
                      </div>

                      <span className="truncate pl-7 pr-2 font-mono text-[11px] font-medium select-none pointer-events-none">
                        T: {text.content}
                      </span>
                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteText?.(text.id);
                          }}
                          className="absolute right-1 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded bg-bg/80 text-muted transition-colors hover:text-danger"
                        >
                          <Trash2 size={11} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
