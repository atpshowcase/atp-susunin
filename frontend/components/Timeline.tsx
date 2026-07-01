"use client";

import { Trash2 } from "lucide-react";
import { MouseEvent, useMemo, useRef, useState, useEffect } from "react";
import { Clip, formatTimecode } from "@/lib/types";

interface TimelineProps {
  duration: number;
  currentTime: number;
  clips: Clip[];
  selectedClipId: string | null;
  onSeek: (time: number) => void;
  onSelectClip: (id: string) => void;
  onDeleteClip: (id: string) => void;
  onReorderClips: (startIndex: number, endIndex: number) => void;
}

function buildTicks(duration: number) {
  if (!duration) return [];
  // Aim for roughly 6-10 ticks regardless of length
  const rough = duration / 8;
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
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
  onSeek,
  onSelectClip,
  onDeleteClip,
  onReorderClips,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const ticks = useMemo(() => buildTicks(duration), [duration]);

  useEffect(() => {
    if (!isScrubbing) return;

    const handlePointerMove = (e: PointerEvent) => {
      const el = trackRef.current;
      if (!el || !duration) return;
      const rect = el.getBoundingClientRect();
      const fraction = Math.min(
        1,
        Math.max(0, (e.clientX - rect.left) / rect.width)
      );
      onSeek(fraction * duration);
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

  const seekFromEvent = (e: MouseEvent) => {
    const el = trackRef.current;
    if (!el || !duration) return;
    const rect = el.getBoundingClientRect();
    const fraction = Math.min(
      1,
      Math.max(0, (e.clientX - rect.left) / rect.width)
    );
    onSeek(fraction * duration);
  };

  const playheadPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="shrink-0 border-t border-border bg-surface px-6 pb-5 pt-3">
      {/* Ruler */}
      <div className="relative h-5 select-none">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-muted"
            style={{ left: `${(t / duration) * 100}%` }}
          >
            {formatTimecode(t).slice(0, -3)}
          </span>
        ))}
      </div>

      {/* Track + playhead */}
      <div className="relative">
        {/* Playhead line, spans ruler tick + track */}
        <div
          className="absolute -top-6 bottom-0 z-20 w-px bg-accent cursor-ew-resize"
          style={{ left: `${playheadPct}%` }}
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
          className="relative flex h-16 cursor-pointer items-stretch gap-[3px] rounded-md bg-bg p-[3px]"
        >
          {clips.map((clip, index) => {
            const widthPct = ((clip.end - clip.start) / duration) * 100;
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
                }}
                style={{ width: `${widthPct}%` }}
                className={`group animate-clip-in relative flex min-w-[4px] items-center justify-center overflow-hidden rounded-[5px] border transition-colors ${
                  isSelected
                    ? "border-accent bg-accent-soft"
                    : "border-transparent bg-surface-2 hover:bg-surface-3"
                } ${draggedIdx === index ? "opacity-50" : ""}`}
              >
                {/* film-strip texture */}
                <div
                  className="absolute inset-0 opacity-[0.06]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, #F2F1ED 0px, #F2F1ED 1px, transparent 1px, transparent 8px)",
                  }}
                />
                {widthPct > 6 && (
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
                    aria-label="Delete clip"
                  >
                    <Trash2 size={11} strokeWidth={2} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
