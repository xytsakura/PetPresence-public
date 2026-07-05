import { spawn } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static") as string | null;

export const DEFAULT_VIDEO_PATH = "";
export const DEFAULT_OUTPUT_DIR = "data/pets/pet_demo/frames";
export const DEFAULT_FRAME_COUNT = 10;
export const DEFAULT_INTERVAL_SEC = 0.5;
export const DEFAULT_MAX_WIDTH = 512;
export const DEFAULT_JPEG_QUALITY = 5;

export type ExtractOptions = {
  video: string;
  outputDir: string;
  frameCount: number;
  intervalSec: number;
  maxWidth: number;
  jpegQuality: number;
  startSec?: number;
  prefix: string;
};

export async function extractFrames(options: ExtractOptions): Promise<string[]> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
  }

  const outputDir = path.resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });

  const outputPattern = path.join(outputDir, `${options.prefix}_%02d.jpg`);
  const fps = 1 / options.intervalSec;
  const scale = `scale='min(${options.maxWidth},iw)':-2`;
  const args = [
    "-y",
    ...(options.startSec === undefined
      ? ["-sseof", `-${options.frameCount * options.intervalSec}`]
      : ["-ss", String(options.startSec)]),
    "-i",
    path.resolve(options.video),
    "-vf",
    `fps=${fps},${scale}`,
    "-frames:v",
    String(options.frameCount),
    "-q:v",
    String(options.jpegQuality),
    outputPattern,
  ];

  await run(ffmpegPath, args);

  const files = (await readdir(outputDir))
    .filter((file) => file.startsWith(`${options.prefix}_`) && file.endsWith(".jpg"))
    .sort()
    .map((file) => path.join(outputDir, file));

  if (files.length === 0) {
    throw new Error("ffmpeg completed but did not write any frame files");
  }

  return files;
}

export function parseArgs(args: string[]): ExtractOptions {
  const values = parseKeyValues(args);
  const frameCount = Number(values.get("frame-count") ?? DEFAULT_FRAME_COUNT);
  const intervalSec = Number(values.get("interval-sec") ?? DEFAULT_INTERVAL_SEC);
  const maxWidth = Number(values.get("max-width") ?? DEFAULT_MAX_WIDTH);
  const jpegQuality = Number(values.get("jpeg-quality") ?? DEFAULT_JPEG_QUALITY);
  const startSecValue = values.get("start-sec");

  return {
    video: values.get("video") ?? requiredVideoPath(),
    outputDir: values.get("output-dir") ?? DEFAULT_OUTPUT_DIR,
    frameCount,
    intervalSec,
    maxWidth,
    jpegQuality,
    startSec: startSecValue === undefined ? undefined : Number(startSecValue),
    prefix: values.get("prefix") ?? defaultPrefix(),
  };
}

function requiredVideoPath(): string {
  if (DEFAULT_VIDEO_PATH) {
    return DEFAULT_VIDEO_PATH;
  }
  throw new Error("Missing --video <path>. Frame extraction does not use a bundled default video.");
}

export function parseKeyValues(args: string[]): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key?.startsWith("--")) {
      continue;
    }
    const value = args[index + 1];
    if (value && !value.startsWith("--")) {
      values.set(key.slice(2), value);
      index += 1;
    } else {
      values.set(key.slice(2), "true");
    }
  }
  return values;
}

export function defaultPrefix(prefix = "pet_demo"): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${prefix}_${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      }
    });
  });
}
