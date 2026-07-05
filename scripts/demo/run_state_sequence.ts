import type { PetAction } from "../../packages/protocol/src/index.js";
import {
  STAGE_SEQUENCE,
  buildDemoEvent,
  isPetAction,
  toOffsetIsoString,
} from "./demo_events.js";

type CliOptions = {
  petId: string;
  baseUrl: string;
  waitMs: number;
  timestampSpacingMinutes: number;
  actions: PetAction[];
  dryRun: boolean;
};

const options = parseArgs(process.argv.slice(2));
const startedAt = new Date();

for (const [index, action] of options.actions.entries()) {
  const timestamp = new Date(
    startedAt.getTime() + index * options.timestampSpacingMinutes * 60_000,
  );
  const event = buildDemoEvent({
    action,
    petId: options.petId,
    timestamp: toOffsetIsoString(timestamp),
    eventId: `evt_demo_sequence_${Date.now()}_${String(index + 1).padStart(2, "0")}`,
  });

  if (options.dryRun) {
    console.log(JSON.stringify(event, null, 2));
  } else {
    const response = await fetch(`${stripTrailingSlash(options.baseUrl)}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`POST /events failed for ${action}: ${response.status} ${body}`);
    }

    console.log(`[${index + 1}/${options.actions.length}] sent ${action}: ${body}`);
  }

  if (index < options.actions.length - 1 && options.waitMs > 0) {
    await sleep(options.waitMs);
  }
}

function parseArgs(args: string[]): CliOptions {
  const values = readFlags(args);
  const actions = parseActions(values.actions);

  return {
    petId: values["pet-id"] ?? "pet_demo",
    baseUrl: values["base-url"] ?? process.env.EVENT_SERVER_URL ?? "http://127.0.0.1:4317",
    waitMs: Number(values["wait-ms"] ?? 5000),
    timestampSpacingMinutes: Number(values["timestamp-spacing-minutes"] ?? 1),
    actions,
    dryRun: values["dry-run"] === "true" || values["dry-run"] === "",
  };
}

function parseActions(value: string | undefined): PetAction[] {
  if (!value) {
    return STAGE_SEQUENCE;
  }

  const actions = value.split(",").map((item) => item.trim()).filter(Boolean);
  for (const action of actions) {
    if (!isPetAction(action)) {
      throw new Error(`Unsupported action in sequence: ${action}`);
    }
  }

  return actions;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
