import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

type Flags = Record<string, string | boolean>;

type ProviderResult = {
  ok: true;
  provider: "example-local-synthetic";
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
  const result = await runExampleProvider(flags);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function runExampleProvider(flags: Flags): Promise<ProviderResult> {
  const petId = requiredFlag(flags, "pet-id");
  const action = requiredFlag(flags, "action");
  assertSafeId(petId, "pet-id");
  assertSafeId(action, "action");

  const prompt = await promptFromFlags(flags, action);
  const referenceImages = stringListFlag(flags, "reference-image").map((item) => path.resolve(item));
  const output = path.resolve(
    stringFlag(flags, "output", path.join(repoRoot, "outputs", "generated", petId, `${action}.mp4`)),
  );

  await mkdir(path.dirname(output), { recursive: true });
  await generateSyntheticClip(output, action);

  const sourceVideo = toRepoRelative(output);
  return {
    ok: true,
    provider: "example-local-synthetic",
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
      "--loop true",
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

  return defaultPrompt(action);
}

async function generateSyntheticClip(outputPath: string, action: string): Promise<void> {
  const ffmpegPath = await resolveFfmpegPath();
  const color = action === "sleep" ? "0x6C5CE7" : action === "eat" ? "0xE17055" : "0x22A699";
  const filter = [
    "color=c=0xF4F1EA:s=240x240:d=1.6:r=6,format=rgb24",
    `drawbox=x='82+8*sin(2*PI*t*1.5)':y=82:w=76:h=76:color=${color}:t=fill`,
    `drawbox=x='106+8*sin(2*PI*t*1.5)':y=52:w=28:h=34:color=${color}:t=fill`,
    "drawbox=x='102+8*sin(2*PI*t*1.5)':y=104:w=10:h=10:color=0x111827:t=fill",
    "drawbox=x='130+8*sin(2*PI*t*1.5)':y=104:w=10:h=10:color=0x111827:t=fill",
  ].join(",");

  await run(ffmpegPath, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    filter,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    outputPath,
  ]);
}

async function resolveFfmpegPath(): Promise<string> {
  const configuredPath = process.env.FFMPEG_PATH || process.env.FFMPEG_BIN;
  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  const module = await import("ffmpeg-static");
  const candidate = module.default || module;
  if (typeof candidate === "string" && existsSync(candidate)) {
    return candidate;
  }
  throw new Error("ffmpeg was not found. Set FFMPEG_PATH or reinstall dependencies so ffmpeg-static can provide a binary.");
}

async function run(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function defaultPrompt(action: string): string {
  return [
    `Create a short 4-second ${action} animation for this pet.`,
    "Keep the pet identity recognizable, the camera stable, and the full body visible.",
    "Use a clean plain background. No text, no watermark, no extra objects.",
  ].join(" ");
}

function defaultMessage(action: string): string {
  const messages: Record<string, string> = {
    idle: "I am here~",
    sleep: "I am sleeping~",
    eat: "I am eating~",
    play: "Let's play~",
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
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!key) {
      continue;
    }
    if (next && !next.startsWith("--")) {
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
