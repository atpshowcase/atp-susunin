"use client";

import { useEffect, useRef, useState } from "react";

const globalAudioPeaksCache: Record<string, Promise<number[]>> = {};

interface AudioWaveformProps {
  videoUrl: string;
  duration: number;
  zoomLevel: number;
  height?: number;
}

export default function AudioWaveform({ videoUrl, duration, zoomLevel, height = 40 }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function extractPeaks() {
      if (!videoUrl) return;
      
      if (!globalAudioPeaksCache[videoUrl]) {
        globalAudioPeaksCache[videoUrl] = (async () => {
          const response = await fetch(videoUrl);
          const arrayBuffer = await response.arrayBuffer();
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const channelData = audioBuffer.getChannelData(0);
          const sampleRate = audioBuffer.sampleRate;
          const samplesPerPixel = sampleRate / 10;
          const numPeaks = Math.floor(channelData.length / samplesPerPixel);
          const newPeaks: number[] = [];
          for (let i = 0; i < numPeaks; i++) {
            let min = 1.0;
            let max = -1.0;
            const start = Math.floor(i * samplesPerPixel);
            const end = Math.floor(start + samplesPerPixel);
            for (let j = start; j < end; j++) {
              const datum = channelData[j];
              if (datum < min) min = datum;
              if (datum > max) max = datum;
            }
            newPeaks.push(Math.max(Math.abs(min), Math.abs(max)));
          }
          return newPeaks;
        })();
      }

      setIsProcessing(true);
      try {
        const resultPeaks = await globalAudioPeaksCache[videoUrl];
        if (!isCancelled) setPeaks(resultPeaks);
        
      } catch (err) {
        console.error("Error generating waveform:", err);
      } finally {
        if (!isCancelled) setIsProcessing(false);
      }
    }
    
    extractPeaks();

    return () => {
      isCancelled = true;
    };
  }, [videoUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0 || !duration) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = duration * zoomLevel;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";

    const peaksPerSecond = peaks.length / duration;
    
    for (let i = 0; i < peaks.length; i++) {
      const time = i / peaksPerSecond;
      const x = time * zoomLevel;
      const peakHeight = Math.max(1, peaks[i] * height); 
      
      const drawY = (height - peakHeight) / 2;
      ctx.fillRect(x, drawY, Math.max(1, zoomLevel / peaksPerSecond - 0.5), peakHeight);
    }
  }, [peaks, zoomLevel, duration, height]);

  return (
    <div className="relative w-full h-full pointer-events-none opacity-60">
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted">
          Analyzing audio...
        </div>
      )}
      <canvas ref={canvasRef} className="absolute left-0 top-0 h-full" />
    </div>
  );
}
