import { DEFAULT_PET_ID } from "../../services/observer/src/config.js";

const DEFAULT_OBSERVER_URL = "http://localhost:3002";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const observerUrl = args.get("observer-url") ?? DEFAULT_OBSERVER_URL;
  const action = args.get("action") ?? "eat";

  const response = await fetch(`${observerUrl.replace(/\/+$/, "")}/observe/mock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pet_id: args.get("pet-id") ?? DEFAULT_PET_ID,
      action,
      trigger_type: args.get("trigger-type") ?? "manual_check",
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

function parseArgs(args: string[]): Map<string, string> {
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

await main();
