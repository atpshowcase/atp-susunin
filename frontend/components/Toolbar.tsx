"use client";

import { Download, Film, Type, Upload } from "lucide-react";

interface ToolbarProps {
  fileName: string | null;
  onUploadClick: () => void;
  onExportClick: () => void;
  onAddTextClick: () => void;
  hasVideo: boolean;
}

export default function Toolbar({
  fileName,
  onUploadClick,
  onExportClick,
  onAddTextClick,
  hasVideo,
}: ToolbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent">
          <Film size={15} strokeWidth={2} />
        </div>
        <span className="text-[13px] font-medium tracking-wide2 text-muted">
          {fileName ?? "Untitled project"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onAddTextClick}
          disabled={!hasVideo}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-text transition-colors hover:border-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Type size={13} strokeWidth={2} />
          Add Text
        </button>
        <button
          onClick={onUploadClick}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-text transition-colors hover:border-muted"
        >
          <Upload size={13} strokeWidth={2} />
          {hasVideo ? "Replace" : "Import"}
        </button>
        <button
          onClick={onExportClick}
          disabled={!hasVideo}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:opacity-30"
        >
          <Download size={13} strokeWidth={2.5} />
          Export
        </button>
      </div>
    </header>
  );
}
