import { readFile, stat } from "node:fs/promises";
import path from "node:path";

type Flags = Record<string, string | boolean>;

type ProviderResult = {
  ok?: unknown;
  provider?: unknown;
  pet_id?: unknown;
  action?: unknown;
  source_video?: unknown;
  prompt?: unknown;
  reference_images?: unknown;
  next_command?: unknown;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const flags = readFlags(process.argv.slice(2));
const jsonPath = path.resolve(requiredFlag(flags, "input"));
const expectedPetId = stringFlag(flags, "pet-id", "");
const expectedAction = stringFlag(flags, "action", "");
const errors: string[] = [];

const result = JSON.parse(await readFile(jsonPath, "utf8")) as ProviderResult;

expectEqual(result.ok, true, "ok must be true");
expectString(result.provider, "provider");
expectSafeId(result.pet_id, "pet_id");
expectSafeId(result.action, "action");
expectString(result.source_video, "source_video");
expectString(result.prompt, "prompt");
expectString(result.next_command, "next_command");

if (!Array.isArray(result.reference_images)) {
  errors.push("reference_images must be an array");
} else {
  for (const [index, item] of result.reference_images.entries()) {
    if (typeof item !== "string") {
      errors.push(`reference_images[${index}] must be a string`);
    }
  }
}

if (expectedPetId && result.pet_id !== expectedPetId) {
  errors.push(`pet_id must be ${expectedPetId}`);
}
if (expectedAction && result.action !== expectedAction) {
  errors.push(`action must be ${expectedAction}`);
}

if (typeof result.source_video === "string") {
  const sourcePath = path.resolve(repoRoot, result.source_video);
  if (path.extname(sourcePath).toLowerCase() !== ".mp4") {
    errors.push("source_video must point to an .mp4 file");
  }
  if (!(await exists(sourcePath))) {
    errors.push(`source_video does not exist: ${result.source_video}`);
  }
}

if (typeof result.next_command === "string" && !result.next_command.includes("npm run pet:add-action")) {
  errors.push("next_command must include npm run pet:add-action");
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR ${error}`);
  }
  process.exit(1);
}

console.log("provider result validation passed");

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function expectEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    errors.push(message);
  }
}

function expectString(value: unknown, label: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${label} must be a non-empty string`);
  }
}

function expectSafeId(value: unknown, label: string): void {
  expectString(value, label);
  if (typeof value === "string" && !/^[A-Za-z0-9_-]+$/.test(value)) {
    errors.push(`${label} may only contain letters, numbers, underscores, and hyphens`);
  }
}

function readFlags(args: string[]): Flags {
  const values: Flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) {
      continue;
    }
    const parts = arg.slice(2).split("=", 2);
    const key = parts[0];
    const inlineValue = parts[1];
    if (!key) {
      continue;
    }
    const next = args[index + 1];
    if (inlineValue !== undefined) {
      values[key] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      values[key] = next;
      index += 1;
    } else {
      values[key] = true;
    }
  }
  return values;
}

function requiredFlag(flags: Flags, key: string): string {
  const value = flags[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`--${key} is required`);
  }
  return value.trim();
}

function stringFlag(flags: Flags, key: string, fallback: string): string {
  const value = flags[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
