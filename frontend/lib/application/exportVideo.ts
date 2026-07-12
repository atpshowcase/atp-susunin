import { ExportRequest, startExportJob, waitForExport } from "@/lib/infrastructure/exportApiClient";

export async function exportVideo(request: ExportRequest, onProgress?: (progress: number) => void): Promise<Blob> {
  const jobId = await startExportJob(request);
  return waitForExport(jobId, onProgress);
}
