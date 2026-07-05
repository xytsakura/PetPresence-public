import type { PetAction, PetTriggerType } from "../../packages/protocol/src/index.js";
import { buildDemoEvent, isPetAction, toOffsetIsoString } from "./demo_events.js";

type CliOptions = {
  action: PetAction;
  petId: string;
  baseUrl: string;
  timestamp: string;
  triggerType?: PetTriggerType;
  ownerMessage?: string;
  visualSummary?: string;
  dryRun: boolean;
};

const options = parseArgs(process.argv.slice(2));
const event = buildDemoEvent({
  action: options.action,
  petId: options.petId,
  timestamp: options.timestamp,
  triggerType: options.triggerType,
  ownerMessage: options.ownerMessage,
  visualSummary: options.visualSummary,
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
    throw new Error(`POST /events failed: ${response.status} ${body}`);
  }

  console.log(body);
}

function parseArgs(args: string[]): CliOptions {
  const values = readFlags(args);
  const actionValue = values.action ?? args.find((arg) => !arg.startsWith("--")) ?? "eat";

  if (!isPetAction(actionValue)) {
    throw new Error(`Unsupported action: ${actionValue}`);
  }

  const triggerType = values["trigger-type"] as PetTriggerType | undefined;

  return {
    action: actionValue,
    petId: values["pet-id"] ?? "pet_demo",
    baseUrl: values["base-url"] ?? process.env.EVENT_SERVER_URL ?? "http://127.0.0.1:4317",
    timestamp: values.timestamp ?? toOffsetIsoString(new Date()),
    triggerType,
    ownerMessage: values.message,
    visualSummary: values.summary,
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

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
