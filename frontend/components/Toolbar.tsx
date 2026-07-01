"use client";

import { Download, Film, Type, Upload } from "lucide-react";

interface ToolbarProps {
  fileName: string | null;
  onUploadClick: () => void;
  onExportClick: () => void;
  hasVideo: boolean;
}

export default function Toolbar({
  fileName,
  onUploadClick,
  onExportClick,
  hasVideo,
}: ToolbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 bg-[#121214] px-4">
      <div className="flex items-center gap-4">
        {/* Fake Logo */}
        <div className="flex items-center justify-center">
          <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
            <span className="text-black font-bold text-[10px]">C</span>
          </div>
        </div>
        <div className="w-[1px] h-4 bg-border/50"></div>
        <div className="flex items-center gap-2">
          <Upload size={16} strokeWidth={2} className="text-muted" />
          <span className="text-[13px] font-medium tracking-wide2 text-text">
            {fileName ?? "202607012026"}
          </span>
        </div>
      </div>

      {/* Center Controls (undo, redo) */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4">
        <div className="flex items-center gap-2 text-muted">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onExportClick}
          disabled={!hasVideo}
          className="flex items-center gap-1.5 rounded bg-[#00F0FF] px-4 py-1.5 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:opacity-30"
        >
          <Download size={14} strokeWidth={2.5} />
          Ekspor
        </button>
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-accent to-purple-500 border border-border/50"></div>
      </div>
    </header>
  );
}
