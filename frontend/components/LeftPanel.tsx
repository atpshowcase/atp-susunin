"use client";

import { ChevronRight } from "lucide-react";

export default function LeftPanel({ onAddTextClick, hasVideo }: { onAddTextClick: () => void; hasVideo: boolean }) {
  return (
    <div className="w-[320px] shrink-0 border-r border-border/50 bg-[#171719] flex flex-col z-10 overflow-hidden">
      {/* Tabs */}
      <div className="flex px-4 pt-4 pb-2 border-b border-border/10">
        <button className="text-[14px] font-semibold text-[#00F0FF] border-b-2 border-[#00F0FF] pb-2 px-2">Template teks</button>
        <button className="text-[14px] font-medium text-[#A0A0A5] hover:text-text pb-2 px-4 transition-colors">Efek teks</button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-6">
        {/* Chips */}
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded bg-[#2A2A2E] text-[12px] text-text font-medium border border-border/50">Semua</button>
          <button className="px-3 py-1 rounded bg-transparent hover:bg-[#2A2A2E] text-[12px] text-muted font-medium transition-colors flex items-center gap-1">
            Komersial <span className="text-[10px] w-4 h-4 rounded-full border border-muted flex items-center justify-center ml-1">i</span>
          </button>
        </div>

        {/* Basic section */}
        <div>
          <h3 className="text-[13px] font-medium text-text mb-3">Dasar</h3>
          <button 
            disabled={!hasVideo}
            onClick={onAddTextClick}
            className="w-full bg-[#2A2A2E] hover:bg-[#343438] transition-colors border border-border/50 rounded-lg py-3 flex items-center justify-center text-[15px] font-semibold text-text mb-2 disabled:opacity-50"
          >
            Tambahkan judul
          </button>
          <button 
            disabled={!hasVideo}
            onClick={onAddTextClick}
            className="w-full bg-[#2A2A2E] hover:bg-[#343438] transition-colors border border-border/50 rounded-lg py-3 flex items-center justify-center text-[14px] font-medium text-text disabled:opacity-50"
          >
            Tambah teks isi
          </button>
        </div>

        {/* Trending Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium text-text">Sedang tren</h3>
            <button className="text-[11px] text-muted flex items-center hover:text-text transition-colors">Lihat semua <ChevronRight size={12} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[4/3] bg-[#2A2A2E] rounded-lg border border-border/30 hover:border-[#00F0FF]/50 transition-colors cursor-pointer flex items-center justify-center">
                {/* Dummy thumbnails */}
                <div className="w-12 h-4 bg-gradient-to-r from-accent to-purple-500 rounded-sm opacity-50 skew-x-[-10deg]"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Classic Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium text-text">Klasik</h3>
            <button className="text-[11px] text-muted flex items-center hover:text-text transition-colors">Lihat semua <ChevronRight size={12} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[4/3] bg-[#2A2A2E] rounded-lg border border-border/30 hover:border-[#00F0FF]/50 transition-colors cursor-pointer flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-dashed border-muted/50 rounded-full flex items-center justify-center text-muted font-serif">T</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
