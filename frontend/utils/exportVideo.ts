import { Clip, TextOverlay } from "@/lib/types";

export async function exportVideoWithGoBackend(
  videoFile: File,
  clips: Clip[],
  textOverlays: TextOverlay[],
  scaleFactor: number,
  resolution: string,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const formData = new FormData();
  formData.append("video", videoFile);
  
  const payload = {
    clips,
    textOverlays,
    scaleFactor,
    resolution,
  };
  
  formData.append("payload", JSON.stringify(payload));

  // 1. Start the job
  const response = await fetch("http://localhost:8085/api/export", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Export failed: ${response.status} - ${errText}`);
  }

  const { jobId } = await response.json();

  // 2. Poll for status
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const statusRes = await fetch(`http://localhost:8085/api/status?id=${jobId}`);
        if (!statusRes.ok) {
          clearInterval(interval);
          reject(new Error("Failed to fetch status"));
          return;
        }

        const data = await statusRes.json();
        
        if (data.status === "error") {
          clearInterval(interval);
          reject(new Error(data.error || "Unknown error during export"));
          return;
        }

        if (onProgress) {
          onProgress(data.progress);
        }

        if (data.status === "done") {
          clearInterval(interval);
          
          // 3. Download the result
          const dlRes = await fetch(`http://localhost:8085/api/download?id=${jobId}`);
          if (!dlRes.ok) {
            reject(new Error("Failed to download file"));
            return;
          }
          const blob = await dlRes.blob();
          resolve(blob);
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 500); // Poll every 500ms
  });
}
