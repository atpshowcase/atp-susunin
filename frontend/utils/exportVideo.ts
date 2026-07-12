import { exportVideo } from "@/lib/application/exportVideo";
import { Clip, TextOverlay } from "@/lib/types";

export function exportVideoWithGoBackend(
  videoFile: File,
  clips: Clip[],
  textOverlays: TextOverlay[],
  scaleFactor: number,
  resolution: string,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return exportVideo(
    {
      videoFile,
      clips,
      textOverlays,
      scaleFactor,
      resolution,
    },
    onProgress
  );
}
