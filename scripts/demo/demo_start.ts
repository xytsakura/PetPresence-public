import { spawn } from "node:child_process";

import type { PetAction } from "../../packages/protocol/src/index.js";
import { buildDemoEvent, isPetAction, toOffsetIsoString } from "./demo_events.js";

type CliOptions = {
  delayMs: number;
  baseUrl: string;
  petId: string;
  initialAction: PetAction;
  dryRun: boolean;
};

const options = parseArgs(process.argv.slice(2));
const shelterUrl = `${stripTrailingSlash(options.baseUrl)}/shelter`;

if (options.dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        dry_run: true,
        shelter_url: shelterUrl,
        base_url: options.baseUrl,
        initial_action: options.initialAction,
        transition_action: "sleep",
        delay_ms: options.delayMs,
      },
      null,
      2,
    ),
  );
} else {
  await assertEventServerReady(options.baseUrl);
  openUrl(shelterUrl);
  console.log(`Opened shelter demo page: ${shelterUrl}`);

  await sendAction(options, options.initialAction, {
    ownerMessage: "鎴戝湪杩欓噷锛屾豹~",
    visualSummary: "婕旂ず鍚姩锛氭墦寮€鍏泭鏁戝姪绔欎簯棰嗗吇椤甸潰锛屾瀹犲厛鍥炲埌鍒濆闄即鐘舵€併€?,
  });
  console.log(`Sent initial ${options.initialAction} event.`);

  console.log(`Waiting ${options.delayMs}ms before switching to sleep...`);
  await sleep(options.delayMs);

  await sendAction(options, "sleep", {
    ownerMessage: "鎴戠潯鐫€鍟",
    visualSummary: "婕旂ず妯″紡锛氱潯瑙夎棰戞挱鏀剧害 10 绉掑悗锛屾瀹犲悓姝ュ垏鎹㈠埌鐫¤鐘舵€併€?,
  });
  console.log("Sent sleep event. Desktop pet should now stay in sleep mode.");
}

async function sendAction(
  options: CliOptions,
  action: PetAction,
  overrides: {
    ownerMessage: string;
    visualSummary: string;
  },
): Promise<void> {
  const event = buildDemoEvent({
    action,
    petId: options.petId,
    timestamp: toOffsetIsoString(new Date()),
    eventId: `evt_demo_start_${Date.now()}_${action}`,
    triggerType: "demo",
    ownerMessage: overrides.ownerMessage,
    visualSummary: overrides.visualSummary,
  });

  const response = await fetch(`${stripTrailingSlash(options.baseUrl)}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`POST /events failed for ${action}: ${response.status} ${body}`);
  }
}

async function assertEventServerReady(baseUrl: string): Promise<void> {
  const response = await fetch(`${stripTrailingSlash(baseUrl)}/health`);
  if (!response.ok) {
    throw new Error(`event-server health check failed: ${response.status}`);
  }
}

function parseArgs(args: string[]): CliOptions {
  const values = readFlags(args);
  const initialAction = values["initial-action"] ?? "idle";
  if (!isPetAction(initialAction)) {
    throw new Error(`Unsupported initial action: ${initialAction}`);
  }

  return {
    delayMs: Number(values["delay-ms"] ?? 10_000),
    baseUrl: values["base-url"] ?? process.env.EVENT_SERVER_URL ?? "http://127.0.0.1:4317",
    petId: values["pet-id"] ?? "pet_demo",
    initialAction,
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

function openUrl(url: string): void {
  const child = spawn("explorer.exe", [url], {
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
