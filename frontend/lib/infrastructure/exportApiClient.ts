import { Clip, TextOverlay } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_EXPORT_API_URL ?? "http://localhost:8085";
const POLL_INTERVAL_MS = 500;

type ExportJobResponse = {
  jobId: string;
};

type ExportJobStatus = {
  id: string;
  progress: number;
  status: "processing" | "done" | "error";
  error?: string;
};

export type ExportRequest = {
  videoFile: File;
  clips: Clip[];
  textOverlays: TextOverlay[];
  scaleFactor: number;
  resolution: string;
};

export async function startExportJob(request: ExportRequest): Promise<string> {
  const formData = new FormData();
  formData.append("video", request.videoFile);
  formData.append(
    "payload",
    JSON.stringify({
      clips: request.clips,
      textOverlays: request.textOverlays,
      scaleFactor: request.scaleFactor,
      resolution: request.resolution,
    })
  );

  const response = await fetch(`${API_BASE_URL}/api/export`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.status} - ${await response.text()}`);
  }

  const body = (await response.json()) as ExportJobResponse;
  return body.jobId;
}

export async function getExportStatus(jobId: string): Promise<ExportJobStatus> {
  const response = await fetch(`${API_BASE_URL}/api/status?id=${jobId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch status");
  }

  return response.json();
}

export async function downloadExport(jobId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/download?id=${jobId}`);

  if (!response.ok) {
    throw new Error("Failed to download file");
  }

  return response.blob();
}

export function waitForExport(jobId: string, onProgress?: (progress: number) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const interval = window.setInterval(async () => {
      try {
        const status = await getExportStatus(jobId);

        if (status.status === "error") {
          window.clearInterval(interval);
          reject(new Error(status.error || "Unknown error during export"));
          return;
        }

        onProgress?.(status.progress);

        if (status.status === "done") {
          window.clearInterval(interval);
          resolve(await downloadExport(jobId));
        }
      } catch (error) {
        window.clearInterval(interval);
        reject(error);
      }
    }, POLL_INTERVAL_MS);
  });
}
