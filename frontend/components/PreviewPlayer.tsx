"use client";

import { Pause, Play, Scissors } from "lucide-react";
import { RefObject, useState, useRef, useEffect } from "react";
import { formatTimecode, TextOverlay } from "@/lib/types";

interface PreviewPlayerProps {
  videoRef: RefObject<HTMLVideoElement>;
  videoUrl: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  canSplit: boolean;
  onTogglePlay: () => void;
  onSplit: () => void;
  textOverlays: TextOverlay[];
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlay[]>>;
  selectedTextId?: string | null;
}

export default function PreviewPlayer({
  videoRef,
  videoUrl,
  isPlaying,
  currentTime,
  duration,
  canSplit,
  onTogglePlay,
  onSplit,
  textOverlays,
  setTextOverlays,
}: PreviewPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!videoRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;
        if (video.videoHeight > 0) {
          setScale(entry.contentRect.height / video.videoHeight);
        }
      }
    });
    observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, [videoUrl, videoRef]);

  useEffect(() => {
    if (!draggingId) return;

    const handlePointerMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      
      setTextOverlays(prev => prev.map(t => 
        t.id === draggingId ? { ...t, x, y } : t
      ));
    };

    const handlePointerUp = () => setDraggingId(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingId, setTextOverlays]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-8 py-6">
      <div 
        ref={containerRef}
        className="relative flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-lg bg-black shadow-[0_0_0_1px_theme(colors.border)]"
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-h-[52vh] max-w-full"
        />
        
        {textOverlays.filter(t => currentTime >= t.start && currentTime < t.end).map(text => (
          <div
            key={text.id}
            className="absolute cursor-move select-none whitespace-nowrap outline-none"
            style={{
              left: `${text.x}%`,
              top: `${text.y}%`,
              transform: 'translate(-50%, -50%)',
              color: text.color,
              fontSize: `${Math.max(12, text.fontSize * scale)}px`,
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              setDraggingId(text.id);
            }}
          >
            <span
              contentEditable
              suppressContentEditableWarning
              onPointerDown={(e) => {
                // If they are focusing to edit text, don't drag immediately
                // Actually, if we want them to edit, we should stop propagation on double click, or just allow editing
                if (document.activeElement === e.currentTarget) {
                  e.stopPropagation();
                }
              }}
              onBlur={(e) => {
                const newText = e.currentTarget.textContent || "Text";
                setTextOverlays(prev => prev.map(t => 
                  t.id === text.id ? { ...t, content: newText } : t
                ));
              }}
              className="outline-none"
            >
              {text.content}
            </span>
            {/* Delete button when hovered/focused can be added later if needed */}
          </div>
          ))}
      </div>

      <div className="flex w-full max-w-md items-center justify-center gap-3">
        <span className="w-[92px] font-mono text-[12px] tabular-nums text-muted">
          {formatTimecode(currentTime)}
        </span>

        <button
          onClick={onTogglePlay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text transition-colors hover:bg-surface-3"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause size={15} fill="currentColor" strokeWidth={0} />
          ) : (
            <Play size={15} fill="currentColor" strokeWidth={0} className="ml-0.5" />
          )}
        </button>

        <button
          onClick={onSplit}
          disabled={!canSplit}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-text transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:text-text"
          aria-label="Split at playhead"
          title="Split at playhead (S)"
        >
          <Scissors size={14} strokeWidth={2} />
        </button>

        <span className="w-[92px] text-right font-mono text-[12px] tabular-nums text-muted">
          {formatTimecode(duration)}
        </span>
      </div>
    </div>
  );
}
