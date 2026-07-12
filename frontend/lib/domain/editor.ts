import { Clip, TextOverlay } from "@/lib/types";

export const NEW_TEXT_DURATION_SECONDS = 3;
export const MIN_CLIP_SPLIT_MARGIN_SECONDS = 0.05;

export type ProjectState = {
  clips: Clip[];
  textOverlays: TextOverlay[];
};

export function clipDuration(clip: Pick<Clip, "start" | "end">): number {
  return clip.end - clip.start;
}

export function totalClipDuration(clips: Clip[]): number {
  return clips.reduce((total, clip) => total + clipDuration(clip), 0);
}

export function getOriginalTime(clips: Clip[], timelineTime: number): number {
  let elapsed = 0;

  for (const clip of clips) {
    const duration = clipDuration(clip);
    if (timelineTime >= elapsed && timelineTime <= elapsed + duration) {
      return clip.start + (timelineTime - elapsed);
    }
    elapsed += duration;
  }

  return clips[clips.length - 1]?.end ?? 0;
}

export function getTimelineTime(clips: Clip[], originalTime: number): number {
  let elapsed = 0;
  let lastTimelineTime = 0;

  for (const clip of clips) {
    if (originalTime >= clip.start && originalTime <= clip.end) {
      return elapsed + (originalTime - clip.start);
    }

    elapsed += clipDuration(clip);
    lastTimelineTime = elapsed;

    if (originalTime < clip.start) {
      return lastTimelineTime - clipDuration(clip);
    }
  }

  return elapsed;
}

export function canSplitAtOriginalTime(clips: Clip[], originalTime: number): boolean {
  return clips.some(
    (clip) =>
      originalTime > clip.start + MIN_CLIP_SPLIT_MARGIN_SECONDS &&
      originalTime < clip.end - MIN_CLIP_SPLIT_MARGIN_SECONDS
  );
}

export function splitClipAtOriginalTime(
  clips: Clip[],
  originalTime: number,
  createId: () => string
): { clips: Clip[]; selectedClipId: string | null } {
  const targetIndex = clips.findIndex(
    (clip) =>
      originalTime > clip.start + MIN_CLIP_SPLIT_MARGIN_SECONDS &&
      originalTime < clip.end - MIN_CLIP_SPLIT_MARGIN_SECONDS
  );

  if (targetIndex === -1) {
    return { clips, selectedClipId: null };
  }

  const target = clips[targetIndex];
  const left: Clip = { id: createId(), start: target.start, end: originalTime };
  const right: Clip = { id: createId(), start: originalTime, end: target.end };
  const nextClips = [...clips];
  nextClips.splice(targetIndex, 1, left, right);

  return { clips: nextClips, selectedClipId: right.id };
}

export function deleteClip(clips: Clip[], id: string): { clips: Clip[]; selectedClipId: string | null } {
  if (clips.length <= 1) {
    return { clips, selectedClipId: null };
  }

  const nextClips = clips.filter((clip) => clip.id !== id);
  return { clips: nextClips, selectedClipId: nextClips[0]?.id ?? null };
}

export function reorderByIndex<T>(items: T[], startIndex: number, endIndex: number): T[] {
  const next = [...items];
  const [removed] = next.splice(startIndex, 1);
  next.splice(endIndex, 0, removed);
  return next;
}

export function findAvailableTextLayer(
  textOverlays: TextOverlay[],
  textLayerCount: number,
  start: number,
  end: number
): number | null {
  for (let layerIndex = 0; layerIndex < textLayerCount; layerIndex += 1) {
    const overlaps = textOverlays
      .filter((text) => text.layerIndex === layerIndex)
      .some((text) => Math.max(text.start, start) < Math.min(text.end, end));

    if (!overlaps) {
      return layerIndex;
    }
  }

  return null;
}

export function resolveTextLayer(
  textOverlays: TextOverlay[],
  textLayerCount: number,
  start: number,
  end: number,
  targetLayerIndex?: number
): { layerIndex: number; textLayerCount: number } {
  if (targetLayerIndex !== undefined) {
    return {
      layerIndex: targetLayerIndex,
      textLayerCount: Math.max(textLayerCount, targetLayerIndex + 1),
    };
  }

  const availableLayerIndex = findAvailableTextLayer(textOverlays, textLayerCount, start, end);
  if (availableLayerIndex !== null) {
    return { layerIndex: availableLayerIndex, textLayerCount };
  }

  return { layerIndex: textLayerCount, textLayerCount: textLayerCount + 1 };
}

export function createTextOverlay(
  id: string,
  currentTime: number,
  timelineDuration: number,
  layerIndex: number
): TextOverlay {
  const start = currentTime;
  const end = Math.min(
    currentTime + NEW_TEXT_DURATION_SECONDS,
    timelineDuration || currentTime + NEW_TEXT_DURATION_SECONDS
  );

  return {
    id,
    content: "New Text",
    x: 50,
    y: 50,
    color: "#ffffff",
    fontSize: 48,
    start,
    end,
    layerIndex,
  };
}

export function copyTextOverlayAtTime(
  source: TextOverlay,
  id: string,
  start: number,
  maxDuration: number
): TextOverlay {
  const duration = clipDuration(source);
  return {
    ...source,
    id,
    start,
    end: Math.min(start + duration, maxDuration || start + duration),
  };
}

export function updateTextOverlay(
  textOverlays: TextOverlay[],
  id: string,
  update: Partial<TextOverlay>
): TextOverlay[] {
  return textOverlays.map((text) => (text.id === id ? { ...text, ...update } : text));
}

export function createExportFileName(fileName: string, clips: Clip[]): string {
  const duration = totalClipDuration(clips).toFixed(1);
  const baseName = fileName.split(".")[0];
  return `exported-${duration}s-${baseName}.mp4`;
}
