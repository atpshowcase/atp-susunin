"use client";

import { Box, Film, Image as ImageIcon, Music, Type, Sparkles, Wand2, Layers } from "lucide-react";

export default function LeftSidebar() {
  const tools = [
    { icon: <Film size={18} />, label: "Media" },
    { icon: <Box size={18} />, label: "Template" },
    { icon: <ImageIcon size={18} />, label: "Elemen" },
    { icon: <Music size={18} />, label: "Audio" },
    { icon: <Type size={18} />, label: "Teks", active: true },
    { icon: <Sparkles size={18} />, label: "Efek" },
    { icon: <Wand2 size={18} />, label: "Transisi" },
    { icon: <Layers size={18} />, label: "Filter" },
  ];

  return (
    <div className="w-[72px] shrink-0 border-r border-border/50 bg-[#121214] flex flex-col items-center py-4 gap-2 overflow-y-auto hide-scrollbar z-20">
      {tools.map((tool, idx) => (
        <button
          key={idx}
          className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg transition-colors gap-1.5 ${
            tool.active
              ? "text-[#00F0FF] bg-[#222226]"
              : "text-[#A0A0A5] hover:text-white hover:bg-[#1E1E22]"
          }`}
        >
          {tool.icon}
          <span className="text-[10px] font-medium">{tool.label}</span>
        </button>
      ))}
    </div>
  );
}
