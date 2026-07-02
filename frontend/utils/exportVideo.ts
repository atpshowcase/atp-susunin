import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { Clip, TextOverlay } from "@/lib/types";

let ffmpeg: FFmpeg | null = null;

export async function exportVideoWithFFmpeg(
  videoFile: File,
  clips: Clip[],
  textOverlays: TextOverlay[],
  scaleFactor: number,
  onProgress: (progress: number) => void
): Promise<Blob> {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
      wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
    });
    
    // Add log listener to debug ffmpeg errors
    ffmpeg.on("log", ({ message }) => {
      console.log("[ffmpeg]", message);
    });
  }

  ffmpeg.on("progress", ({ progress }) => {
    onProgress(progress * 100);
  });

  const inputName = "input" + videoFile.name.substring(videoFile.name.lastIndexOf("."));
  const outputName = "output.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

  // Build the complex filter graph
  let filterGraph = "";
  
  // 1. Trim clips and concatenate
  const clipOutputs: string[] = [];
  clips.forEach((clip, index) => {
    const outLabel = `[v${index}]`;
    const audioLabel = `[a${index}]`;
    filterGraph += `[0:v]trim=start=${clip.start}:end=${clip.end},setpts=PTS-STARTPTS${outLabel}; `;
    filterGraph += `[0:a]atrim=start=${clip.start}:end=${clip.end},asetpts=PTS-STARTPTS${audioLabel}; `;
    clipOutputs.push(outLabel, audioLabel);
  });

  // Concatenate all trimmed clips
  let lastVideoOutput = "";
  let lastAudioOutput = "";

  if (clips.length === 1) {
    lastVideoOutput = clipOutputs[0];
    lastAudioOutput = clipOutputs[1];
  } else {
    const concatInput = clipOutputs.join("");
    filterGraph += `${concatInput}concat=n=${clips.length}:v=1:a=1[v_concat][a_concat]; `;
    lastVideoOutput = "[v_concat]";
    lastAudioOutput = "[a_concat]";
  }


  // 2. Add text overlays
  // Since we don't have a reliable font file, we will use the default font.
  // Note: drawtext requires a fontfile, but in some builds the default font works if we omit it.
  // Wait, in ffmpeg.wasm, default font is NOT available. We MUST fetch a font.
  
  const fontName = "/font.ttf";
  // Fetch a basic font from our local public folder to avoid CORS/COEP issues
  const fontData = await fetch("/fonts/Roboto-Regular.ttf");
  if (!fontData.ok) {
    throw new Error(`Failed to fetch font: ${fontData.status} ${fontData.statusText}`);
  }
  await ffmpeg.writeFile(fontName, new Uint8Array(await fontData.arrayBuffer()));

  if (textOverlays.length === 0) {
    filterGraph += `${lastVideoOutput}copy[v_out]`; // Just pass through if no text
  } else {
    textOverlays.forEach((text, index) => {
      const nextOutput = index === textOverlays.length - 1 ? "[v_out]" : `[v_text${index}]`;
      
      // Calculate font size relative to typical 720p height since we don't know the exact resolution
      // We will just pass the raw fontSize for now.
      const escapedText = text.content.replace(/'/g, "'\\\\''").replace(/:/g, "\\:");
      const hexColor = text.color.replace("#", "");
      const scaledFontSize = Math.round(text.fontSize * scaleFactor);
      
      // x and y in TextOverlay represent the center of the text.
      // In FFmpeg, we calculate the top-left corner by subtracting text_w/2 and text_h/2.
      filterGraph += `${lastVideoOutput}drawtext=fontfile=${fontName}:text='${escapedText}':fontcolor=0x${hexColor}:fontsize=${scaledFontSize}:x=(w*${text.x}/100)-(text_w/2):y=(h*${text.y}/100)-(text_h/2):enable='between(t,${text.start},${text.end})'${nextOutput}; `;
      
      lastVideoOutput = nextOutput;
    });
  }

  // Ensure filterGraph doesn't end with a semicolon
  filterGraph = filterGraph.replace(/; $/, "");

  const args = [
    "-i", inputName,
    "-filter_complex", filterGraph,
    "-map", "[v_out]",
    "-map", lastAudioOutput,
    "-c:v", "libx264",
    "-preset", "ultrafast", // Use ultrafast for web
    "-c:a", "aac",
    outputName
  ];

  console.log("[ffmpeg] filterGraph:", filterGraph);

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName);
  
  // Clean up
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  await ffmpeg.deleteFile(fontName);

  return new Blob([data as Uint8Array], { type: "video/mp4" });
}
