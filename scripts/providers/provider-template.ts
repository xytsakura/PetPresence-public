import { readFile } from "node:fs/promises";
import path from "node:path";

type Flags = Record<string, string | boolean>;

type ProviderResult = {
  ok: true;
  provider: string;
  pet_id: string;
  action: string;
  source_video: string;
  prompt: string;
  reference_images: string[];
  next_command: string;
};

type ProviderError = {
  ok: false;
  provider: string;
  pet_id?: string;
  action?: string;
  error: string;
  retryable: boolean;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const flags = readFlags(process.argv.slice(2));

try {
  const result = await runProviderTemplate(flags);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const providerError: ProviderError = {
    ok: false,
    provider: process.env.PETPRESENCE_VIDEO_PROVIDER || "provider-template",
    pet_id: stringFlag(flags, "pet-id", undefined),
    action: stringFlag(flags, "action", undefined),
    error: error instanceof Error ? error.message : String(error),
    retryable: false,
  };
  console.error(JSON.stringify(providerError, null, 2));
  process.exit(1);
}

async function runProviderTemplate(flags: Flags): Promise<ProviderResult> {
  const petId = requiredFlag(flags, "pet-id");
  const action = requiredFlag(flags, "action");
  assertSafeId(petId, "pet-id");
  assertSafeId(action, "action");

  const provider = process.env.PETPRESENCE_VIDEO_PROVIDER || "provider-template";
  const apiKey = process.env.PETPRESENCE_VIDEO_API_KEY || "";
  const apiBase = process.env.PETPRESENCE_VIDEO_API_BASE || "";
  const prompt = await promptFromFlags(flags, action);
  const referenceImages = stringListFlag(flags, "reference-image").map((item) => path.resolve(item));
  const output = path.resolve(
    stringFlag(flags, "output", path.join(repoRoot, "outputs", "generated", petId, `${action}.mp4`)),
  );

  if (!apiKey) {
    throw new Error("PETPRESENCE_VIDEO_API_KEY is required for a real provider adapter.");
  }
  if (!apiBase) {
    throw new Error("PETPRESENCE_VIDEO_API_BASE is required for a real provider adapter.");
  }
  if (referenceImages.length > 0 && !booleanFlag(flags, "confirm-upload")) {
    throw new Error("Reference images were provided. Re-run with --confirm-upload after the user approves upload.");
  }

  // Adapter authors should replace this block with the real provider flow:
  // 1. submit prompt and approved reference images/videos;
  // 2. poll the provider job until it succeeds or fails;
  // 3. download the final MP4 to `output`;
  // 4. keep provider IDs, raw responses, and private URLs out of committed files.
  throw new Error(
    [
      "provider-template is a scaffold only and did not call a real API.",
      "Replace the template provider call block, write a real .mp4 to the output path,",
      output,
      "then validate the JSON with npm run provider:validate-result.",
    ].join(" "),
  );
}

async function promptFromFlags(flags: Flags, action: string): Promise<string> {
  const prompt = stringFlag(flags, "prompt", "");
  if (prompt) {
    return prompt;
  }

  const promptFile = stringFlag(flags, "prompt-file", "");
  if (promptFile) {
    return (await readFile(path.resolve(promptFile), "utf8")).trim();
  }

  return `Create a short 4-second ${action} animation for this pet.`;
}

function nextCommand(petId: string, action: string, sourceVideo: string): string {
  return [
    "npm run pet:add-action --",
    `--pet-id ${petId}`,
    `--action ${action}`,
    `--input "${sourceVideo}"`,
    "--convert-alpha",
    `--loop ${String(action === "idle" || action === "sleep")}`,
    `--message "${defaultMessage(action)}"`,
  ].join(" ");
}

function defaultMessage(action: string): string {
  const messages: Record<string, string> = {
    idle: "I am here~",
    sleep: "I am sleeping~",
    eat: "I am eating~",
    play: "Let's play~",
    wave_paw: "Hi~",
  };
  return messages[action] ?? "I am here~";
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

function stringFlag(flags: Flags, key: string, fallback: string): string;
function stringFlag(flags: Flags, key: string, fallback: undefined): string | undefined;
function stringFlag(flags: Flags, key: string, fallback: string | undefined): string | undefined {
  const value = flags[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function booleanFlag(flags: Flags, key: string): boolean {
  return flags[key] === true || flags[key] === "true" || flags[key] === "1";
}

function stringListFlag(flags: Flags, key: string): string[] {
  const value = flags[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertSafeId(value: string, label: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`--${label} may only contain letters, numbers, underscores, and hyphens`);
  }
}

function toRepoRelative(filePath: string): string {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

export function buildProviderResult(input: {
  provider: string;
  petId: string;
  action: string;
  outputPath: string;
  prompt: string;
  referenceImages: string[];
}): ProviderResult {
  const sourceVideo = toRepoRelative(input.outputPath);
  return {
    ok: true,
    provider: input.provider,
    pet_id: input.petId,
    action: input.action,
    source_video: sourceVideo,
    prompt: input.prompt,
    reference_images: input.referenceImages.map((item) => {
      const relative = path.relative(repoRoot, item).replace(/\\/g, "/");
      return relative.startsWith("..") ? item : relative;
    }),
    next_command: nextCommand(input.petId, input.action, sourceVideo),
  };
}
