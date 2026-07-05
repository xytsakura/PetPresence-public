import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const smokeRunId = `${Date.now()}_${process.pid}`;
const petId = `pet_alpha_smoke_${smokeRunId}`;
const action = "wave_paw";
const tempRoot = path.join(repoRoot, "outputs", `smoke-alpha-${smokeRunId}`);
const sourceMp4 = path.join(tempRoot, `${action}.mp4`);
const expectedWebm = path.join(repoRoot, "assets", "pets", petId, action, `${action}.webm`);
const ffmpegPath = await resolveFfmpegPath();

try {
  await cleanup();
  await mkdir(tempRoot, { recursive: true });
  await generateSyntheticMp4(sourceMp4);
  await runTsxScript("scripts/creator/pet-cli.ts", [
    "init",
    "--pet-id",
    petId,
    "--name",
    "AlphaSmoke",
    "--species",
    "synthetic",
    "--description",
    "Temporary alpha conversion smoke pet",
    "--force",
  ]);
  await runTsxScript("scripts/creator/pet-cli.ts", [
    "add-action",
    "--pet-id",
    petId,
    "--action",
    action,
    "--input",
    sourceMp4,
    "--convert-alpha",
    "--alpha-fps",
    "6",
    "--alpha-height",
    "160",
    "--alpha-crf",
    "36",
    "--alpha-color-mask-threshold",
    "18",
    "--loop",
    "false",
    "--duration-ms",
    "1800",
    "--message",
    "Alpha smoke passed~",
  ]);
  await assertExists(expectedWebm);
  await runTsxScript("scripts/creator/pet-cli.ts", ["validate", "--pet-id", petId]);
  await runNpm(["--prefix", "apps/desktop", "run", "smoke", "--", "--pet-id", petId]);
  console.log("creator alpha conversion smoke passed");
} finally {
  await cleanup();
}

async function generateSyntheticMp4(outputPath: string): Promise<void> {
  const filter = [
    "color=c=0xF4F1EA:s=240x240:d=1.6:r=6,format=rgb24",
    "drawbox=x='82+8*sin(2*PI*t*1.5)':y=82:w=76:h=76:color=0x22A699:t=fill",
    "drawbox=x='106+8*sin(2*PI*t*1.5)':y=52:w=28:h=34:color=0x22A699:t=fill",
    "drawbox=x='76+8*sin(2*PI*t*1.5)':y=116:w=24:h=46:color=0x1B7F79:t=fill",
    "drawbox=x='142+8*sin(2*PI*t*1.5)':y='116-20*sin(2*PI*t*2)':w=24:h=46:color=0x1B7F79:t=fill",
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

async function runTsxScript(scriptPath: string, args: string[]): Promise<void> {
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  await run(process.execPath, [tsxCli, path.join(repoRoot, scriptPath), ...args]);
}

async function runNpm(args: string[]): Promise<void> {
  if (process.platform === "win32") {
    await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", ["npm", ...args].join(" ")]);
    return;
  }
  await run("npm", args);
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
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function assertExists(filePath: string): Promise<void> {
  try {
    await stat(filePath);
  } catch {
    throw new Error(`Expected alpha smoke output was not found: ${filePath}`);
  }
}

async function cleanup(): Promise<void> {
  await Promise.all([
    rm(tempRoot, { force: true, recursive: true }),
    rm(path.join(repoRoot, "data", "pets", petId), { force: true, recursive: true }),
    rm(path.join(repoRoot, "assets", "pets", petId), { force: true, recursive: true }),
  ]);
}
