import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_DEMO_VIDEO_PATH } from "../../services/observer/src/config.js";
import { buildDemoEvent, toOffsetIsoString } from "./demo_events.js";

type CliOptions = {
  video: string;
  delayMs: number;
  baseUrl: string;
  petId: string;
  dryRun: boolean;
};

const options = parseArgs(process.argv.slice(2));

await access(options.video);

if (options.dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        dry_run: true,
        video: options.video,
        delay_ms: options.delayMs,
        base_url: options.baseUrl,
        action: "sleep",
      },
      null,
      2,
    ),
  );
} else {
  openVideo(options.video);
  console.log(`Opened sleep video: ${options.video}`);
  console.log(`Waiting ${options.delayMs}ms before sending sleep event...`);
  await sleep(options.delayMs);

  const event = buildDemoEvent({
    action: "sleep",
    petId: options.petId,
    timestamp: toOffsetIsoString(new Date()),
    eventId: `evt_demo_sleep_video_${Date.now()}`,
    triggerType: "demo",
    ownerMessage: "鎴戠潯鐫€鍟",
    visualSummary: "婕旂ず妯″紡锛氱潯瑙夎棰戞挱鏀剧害 10 绉掑悗锛屾瀹犲悓姝ュ垏鎹㈠埌鐫¤鐘舵€併€?,
  });

  const response = await fetch(`${stripTrailingSlash(options.baseUrl)}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`POST /events failed: ${response.status} ${body}`);
  }

  console.log(`Sent sleep event: ${body}`);
}

function parseArgs(args: string[]): CliOptions {
  const values = readFlags(args);
  return {
    video: path.resolve(values.video ?? process.env.DEMO_SLEEP_VIDEO_PATH ?? DEFAULT_DEMO_VIDEO_PATH),
    delayMs: Number(values["delay-ms"] ?? 10_000),
    baseUrl: values["base-url"] ?? process.env.EVENT_SERVER_URL ?? "http://127.0.0.1:4317",
    petId: values["pet-id"] ?? "pet_demo",
    dryRun: values["dry-run"] === "true" || values["dry-run"] === "",
  };
}

function readFlags(args: string[]): Record<string, string> {
  const values: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) {
      continue;
    }

    const withoutPrefix = arg.slice(2);
    const [key, inlineValue] = withoutPrefix.split("=", 2);
    const next = args[index + 1];

    if (inlineValue !== undefined) {
      values[key] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      values[key] = next;
      index += 1;
    } else {
      values[key] = "";
    }
  }

  return values;
}

function openVideo(videoPath: string): void {
  const child = spawn("explorer.exe", [videoPath], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
