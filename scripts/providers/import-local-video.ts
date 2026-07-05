import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

type Flags = Record<string, string | boolean>;

type ProviderResult = {
  ok: true;
  provider: "local-import";
  pet_id: string;
  action: string;
  source_video: string;
  prompt: string;
  reference_images: string[];
  next_command: string;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const flags = readFlags(process.argv.slice(2));

try {
  const result = await importLocalVideo(flags);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function importLocalVideo(flags: Flags): Promise<ProviderResult> {
  const petId = requiredFlag(flags, "pet-id");
  const action = requiredFlag(flags, "action");
  const input = path.resolve(requiredFlag(flags, "input"));
  assertSafeId(petId, "pet-id");
  assertSafeId(action, "action");

  if (path.extname(input).toLowerCase() !== ".mp4") {
    throw new Error("--input must point to an .mp4 file");
  }
  if (!(await exists(input))) {
    throw new Error(`Input file does not exist: ${input}`);
  }

  const prompt = await promptFromFlags(flags, action);
  const referenceImages = stringListFlag(flags, "reference-image").map((item) => path.resolve(item));
  const output = path.resolve(
    stringFlag(flags, "output", path.join(repoRoot, "outputs", "generated", petId, `${action}.mp4`)),
  );

  await mkdir(path.dirname(output), { recursive: true });
  if (path.resolve(input).toLowerCase() !== path.resolve(output).toLowerCase()) {
    await copyFile(input, output);
  }

  const sourceVideo = toRepoRelative(output);
  return {
    ok: true,
    provider: "local-import",
    pet_id: petId,
    action,
    source_video: sourceVideo,
    prompt,
    reference_images: referenceImages.map(toRepoRelativeOrAbsolute),
    next_command: [
      "npm run pet:add-action --",
      `--pet-id ${petId}`,
      `--action ${action}`,
      `--input "${sourceVideo}"`,
      "--convert-alpha",
      `--loop ${String(action === "idle" || action === "sleep")}`,
      `--message "${defaultMessage(action)}"`,
    ].join(" "),
  };
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

  return `Imported local source video for ${action}.`;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
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

function stringFlag(flags: Flags, key: string, fallback: string): string {
  const value = flags[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
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

function toRepoRelativeOrAbsolute(filePath: string): string {
  const relative = path.relative(repoRoot, filePath).replace(/\\/g, "/");
  return relative.startsWith("..") ? filePath : relative;
}
