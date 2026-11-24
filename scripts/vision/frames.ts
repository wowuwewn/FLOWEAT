/** Decodes a video into RGB frames at a fixed fps using ffmpeg (no extra deps). */
import { spawn } from "node:child_process";

export interface Frame { index: number; t: number; data: Buffer; width: number; height: number }

export async function* readFrames(file: string, fps: number, width: number, height: number): AsyncGenerator<Frame> {
  const ff = spawn("ffmpeg", ["-v", "error", "-i", file, "-vf", `fps=${fps},scale=${width}:${height}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]);
  const size = width * height * 3;
  let buf = Buffer.alloc(0);
  let index = 0;
  for await (const chunk of ff.stdout) {
    buf = Buffer.concat([buf, chunk as Buffer]);
    while (buf.length >= size) {
      const data = buf.subarray(0, size);
      buf = buf.subarray(size);
      yield { index, t: index / fps, data: Buffer.from(data), width, height };
      index++;
    }
  }
}

export function probe(file: string): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file]);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", () => {
      try {
        const j = JSON.parse(out);
        resolve({ width: j.streams[0].width, height: j.streams[0].height, duration: Number(j.format.duration) });
      } catch (e) {
        reject(e);
      }
    });
  });
}
