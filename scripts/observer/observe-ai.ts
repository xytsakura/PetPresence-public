import { DEFAULT_PET_ID } from "../../services/observer/src/config.js";
import {
  DEFAULT_VIDEO_PATH,
  defaultPrefix,
  extractFrames,
  parseKeyValues,
} from "./frame-extractor.js";

const DEFAULT_OBSERVER_URL = "http://localhost:3002";

async function main(): Promise<void> {
  const args = parseKeyValues(process.argv.slice(2));
  const observerUrl = (args.get("observer-url") ?? DEFAULT_OBSERVER_URL).replace(/\/+$/, "");
  const frames = await resolveFrames(args);

  const response = await fetch(`${observerUrl}/observe/ai`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pet_id: args.get("pet-id") ?? DEFAULT_PET_ID,
      pet_name: args.get("pet-name") ?? "灏忕櫧",
      pet_type: args.get("pet-type") ?? "dog",
      trigger_type: args.get("trigger-type") ?? "manual_check",
      frame_paths: frames,
      post_event: args.get("post-event") !== "false",
    }),
  });
  const body = await response.json().catch(async () => ({
    text: await response.text(),
  }));

  console.log(JSON.stringify(body, null, 2));
  if (!response.ok) {
    process.exitCode = 1;
  }
}

async function resolveFrames(args: Map<string, string>): Promise<string[]> {
  const explicitFrames = args.get("frames");
  if (explicitFrames) {
    return explicitFrames
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return extractFrames({
    video: args.get("video") ?? DEFAULT_VIDEO_PATH,
    outputDir: args.get("output-dir") ?? "data/pets/pet_demo/frames",
    frameCount: Number(args.get("frame-count") ?? 10),
    intervalSec: Number(args.get("interval-sec") ?? 0.5),
    startSec: args.has("start-sec") ? Number(args.get("start-sec")) : undefined,
    prefix: args.get("prefix") ?? defaultPrefix(),
  });
}

await main();
