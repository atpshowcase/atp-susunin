export interface Clip {
  id: string;
  /** Start time in seconds, relative to the original source video */
  start: number;
  /** End time in seconds, relative to the original source video */
  end: number;
}

export interface TextOverlay {
  id: string;
  content: string;
  x: number; // Percentage 0-100 relative to video width
  y: number; // Percentage 0-100 relative to video height
  color: string;
  fontSize: number;
  start: number;
  end: number;
  layerIndex: number;
}

export function formatTimecode(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frames = Math.floor((totalSeconds % 1) * 30); // assume 30fps display

  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}
