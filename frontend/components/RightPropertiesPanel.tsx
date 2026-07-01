"use client";

export default function RightPropertiesPanel({ 
  isItemSelected = true,
  textContent = "",
  fontSize = 48,
  onTextChange,
  onFontSizeChange
}: { 
  isItemSelected?: boolean;
  textContent?: string;
  fontSize?: number;
  onTextChange?: (val: string) => void;
  onFontSizeChange?: (val: number) => void;
}) {
  if (!isItemSelected) {
    return (
      <div className="w-[300px] shrink-0 border-l border-border/50 bg-[#171719] flex flex-col items-center justify-center text-muted text-[13px]">
        Select an item to view properties
      </div>
    );
  }

  return (
    <div className="w-[300px] shrink-0 border-l border-border/50 bg-[#171719] flex flex-col z-10 overflow-hidden">
      {/* Header Tabs */}
      <div className="flex px-4 pt-4 pb-2 border-b border-border/10">
        <button className="text-[14px] font-semibold text-text border-b-2 border-[#00F0FF] pb-2 px-2">Teks</button>
        <button className="text-[14px] font-medium text-muted hover:text-text pb-2 px-4 transition-colors">Animasi</button>
        <button className="text-[14px] font-medium text-muted hover:text-text pb-2 px-4 transition-colors">TTS</button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-6">
        {/* Dasar Section */}
        <div>
          <h3 className="text-[14px] font-semibold text-text mb-4">Dasar</h3>
          <textarea 
            className="w-full bg-[#1F1F22] border border-border/50 rounded-md p-3 text-[13px] text-text outline-none focus:border-[#00F0FF]/50 min-h-[80px] resize-none"
            value={textContent}
            onChange={(e) => onTextChange?.(e.target.value)}
          />
        </div>

        <hr className="border-border/10" />

        {/* Transformasi Section */}
        <div>
          <h3 className="text-[14px] font-semibold text-text mb-4">Transformasi</h3>
          
          {/* Skala (Scale) */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[13px] text-muted">Skala</span>
              <span className="text-[13px] text-text font-mono">{Math.round((fontSize / 48) * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="range" 
                min="10" 
                max="200" 
                value={fontSize} 
                onChange={(e) => onFontSizeChange?.(Number(e.target.value))}
                className="flex-1 accent-[#00F0FF] h-1 bg-[#2A2A2E] rounded-lg appearance-none" 
              />
              <div className="w-4 h-4 rounded-sm border border-border/50 flex items-center justify-center bg-[#2A2A2E]">
                <div className="w-1.5 h-1.5 rounded-full bg-muted"></div>
              </div>
            </div>
          </div>

          {/* Posisi (Position) */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[13px] text-muted">Posisi</span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-[#1F1F22] border border-border/50 rounded flex items-center px-3 py-1.5">
                <span className="text-muted text-[12px] w-4">X</span>
                <input type="text" defaultValue="0" className="bg-transparent w-full outline-none text-[13px] text-text text-right font-mono" />
              </div>
              <div className="flex-1 bg-[#1F1F22] border border-border/50 rounded flex items-center px-3 py-1.5">
                <span className="text-muted text-[12px] w-4">Y</span>
                <input type="text" defaultValue="0" className="bg-transparent w-full outline-none text-[13px] text-text text-right font-mono" />
              </div>
            </div>
          </div>

          {/* Putar (Rotation) */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[13px] text-muted">Putar</span>
            </div>
            <div className="flex gap-2 items-center">
              <div className="w-24 bg-[#1F1F22] border border-border/50 rounded flex items-center px-3 py-1.5">
                <input type="text" defaultValue="0°" className="bg-transparent w-full outline-none text-[13px] text-text text-right font-mono" />
              </div>
              <button className="w-8 h-8 rounded bg-[#1F1F22] border border-border/50 flex items-center justify-center text-muted hover:text-text">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
