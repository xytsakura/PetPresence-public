import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const petId = "pet_demo";
const ffmpegPath = await resolveFfmpegPath();

await generateDemoFixture();

async function generateDemoFixture(): Promise<void> {
  await mkdir(path.join(repoRoot, "assets", "pets", petId, "idle"), { recursive: true });
  await mkdir(path.join(repoRoot, "assets", "pets", petId, "wave_paw"), { recursive: true });
  await mkdir(path.join(repoRoot, "data", "pets", petId), { recursive: true });
  await mkdir(path.join(repoRoot, "data", "pets", petId, "prompts"), { recursive: true });

  await generateAction("idle", path.join(repoRoot, "assets", "pets", petId, "idle", "idle.webm"));
  await generateAction("wave_paw", path.join(repoRoot, "assets", "pets", petId, "wave_paw", "wave_paw.webm"));

  await writeJson(path.join(repoRoot, "data", "pets", petId, "profile.json"), {
    pet_id: petId,
    name: "Demo Pet",
    species: "synthetic",
    description: "A synthetic public fixture used to verify the open-source creator pipeline.",
    speech_style: {
      max_chars: 24,
      tone: "short, warm, low-interruption",
      catchphrases: ["boop"],
    },
  });

  await writeFile(
    path.join(repoRoot, "data", "pets", petId, "agent.md"),
    [
      "# Demo Pet Agent Notes",
      "",
      "## Purpose",
      "",
      "- This is a synthetic public fixture for PetPresence.",
      "- It is not based on a real person's private pet media.",
      "- Use it for smoke tests, screenshots, docs, and first-run demos.",
      "",
      "## Voice",
      "",
      "- Keep messages short and gentle.",
      "- Do not make medical, psychological, or health claims.",
      "",
    ].join("\n"),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "pets", petId, "creator_brief.md"),
    [
      "# Demo Pet Creator Brief",
      "",
      "This brief is the user-confirmed starting point for an Agent-assisted PetPresence workflow.",
      "It does not call a video API, upload media, or register assets. Review it before generating prompts or using external providers.",
      "",
      "## Pet Identity",
      "",
      "- pet_id: pet_demo",
      "- name: Demo Pet",
      "- species: synthetic",
      "- personality: A synthetic public fixture used to verify the open-source creator pipeline.",
      "- local_only_default: true",
      "",
      "## Requested Actions",
      "",
      "- idle",
      "- wave_paw",
      "",
      "## Available Media",
      "",
      "- Synthetic WebM fixture generated locally by `npm run release:generate-demo-fixture`.",
      "- No real private pet photo, video, event log, frame, or report is used.",
      "",
      "## Video Generation",
      "",
      "- video_api_status: not configured; public fixture is generated locally",
      "- upload_consent: no upload needed for this synthetic public fixture",
      "- provider_boundary: Do not upload reference images or videos unless the user explicitly confirms that provider and upload.",
      "- api_key_boundary: Do not write real API keys into repository files, docs, screenshots, or issues.",
      "",
      "## Privacy Boundary",
      "",
      "- Treat `assets/pets/<pet_id>/` as private user media unless the user confirms publication rights.",
      "- Treat `outputs/`, extracted frames, event logs, and generated reports as private local data.",
      "- Do not commit paid-model outputs unless the provider terms and user permission allow publication.",
      "- Do not make medical, psychological, health, or safety diagnosis claims.",
      "",
      "## Acceptance Checks",
      "",
      "- `npm run pet:doctor -- --pet-id pet_demo` has no `ERROR`.",
      "- `npm run pet:validate -- --pet-id pet_demo` passes.",
      "- `npm --prefix apps/desktop run smoke -- --pet-id pet_demo` passes.",
      "- `npm run desktop -- --pet-id pet_demo` opens a preview the user can inspect.",
      "- The user can identify which files are private and should not be committed.",
      "",
      "## Recommended Next Commands",
      "",
      "```powershell",
      "npm run pet:scaffold-actions -- --pet-id pet_demo --actions idle,wave_paw",
      "npm run pet:doctor -- --pet-id pet_demo",
      "```",
      "",
    ].join("\n"),
    "utf8",
  );

  await writeJson(path.join(repoRoot, "data", "pets", petId, "action_assets.json"), {
    pet_id: petId,
    default_action: "idle",
    idle_action: "idle",
    version: "public-demo-v1",
    coordinate_system: {
      width: 512,
      height: 512,
      transparent_background: true,
    },
    event_server: {
      http_base: "http://127.0.0.1:4317",
      ws_url: `ws://127.0.0.1:4317/events/stream?pet_id=${petId}`,
    },
    observer: {
      mock_url: "http://127.0.0.1:3002/observe/mock",
      current_url: "http://127.0.0.1:3002/observe/current",
      qa_url: "http://127.0.0.1:3002/qa/today",
    },
    assets: {
      idle: {
        type: "webm",
        path: "assets/pets/pet_demo/idle/idle.webm",
        transparent_background: true,
        loop: true,
        duration_ms: 3000,
        fallback_message: "Demo pet is here.",
      },
      wave_paw: {
        type: "webm",
        path: "assets/pets/pet_demo/wave_paw/wave_paw.webm",
        transparent_background: true,
        loop: false,
        duration_ms: 2200,
        fallback_message: "Tiny wave.",
      },
    },
  });

  await writeFile(
    path.join(repoRoot, "data", "pets", petId, "prompts", "idle.txt"),
    [
      'Create a short 4.0-second video of Demo Pet, a synthetic, for a desktop pet "idle" animation.',
      "Pet identity notes: A synthetic public fixture used to verify the open-source creator pipeline.",
      "Motion: front-facing, mostly still, subtle breathing, tiny head or body movement.",
      "Keep the camera stable and the full body visible.",
      "Use a clean plain background with soft lighting.",
      "The pet should remain recognizable and centered enough for foreground extraction.",
      "No text, no watermark, no subtitles, no extra objects, no camera shake.",
      "",
    ].join("\n"),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "pets", petId, "prompts", "wave_paw.txt"),
    [
      'Create a short 3.0-second video of Demo Pet, a synthetic, for a desktop pet "wave_paw" animation.',
      "Pet identity notes: A synthetic public fixture used to verify the open-source creator pipeline.",
      "Motion: raising one paw or making a tiny greeting movement.",
      "Keep the camera stable and the full body visible.",
      "Use a clean plain background with soft lighting.",
      "The pet should remain recognizable and centered enough for foreground extraction.",
      "No text, no watermark, no subtitles, no extra objects, no camera shake.",
      "",
    ].join("\n"),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "pets", petId, "action_plan.md"),
    [
      "# Demo Pet Action Plan",
      "",
      "This file is generated for an Agent-assisted PetPresence workflow.",
      "It does not call a video API, upload media, or register assets. Use it to prepare prompts and source clips.",
      "",
      "## Pet",
      "",
      "- pet_id: pet_demo",
      "- name: Demo Pet",
      "- species: synthetic",
      "- description: A synthetic public fixture used to verify the open-source creator pipeline.",
      "",
      "## Actions",
      "",
      "### idle",
      "",
      "- purpose: default calm presence",
      "- motion: front-facing, mostly still, subtle breathing, tiny head or body movement",
      "- loop: true",
      "- duration_ms: 4000",
      "- fallback_message: I am here~",
      "- prompt_file: data/pets/pet_demo/prompts/idle.txt",
      "",
      "Suggested local synthetic provider command:",
      "",
      "```powershell",
      'npm run provider:example -- --pet-id pet_demo --action idle --prompt-file "data/pets/pet_demo/prompts/idle.txt"',
      "```",
      "",
      "After a real or synthetic provider writes an MP4, register it with:",
      "",
      "```powershell",
      'npm run pet:add-action -- --pet-id pet_demo --action idle --input "outputs/generated/pet_demo/idle.mp4" --convert-alpha --loop true --duration-ms 4000 --message "I am here~"',
      "```",
      "",
      "### wave_paw",
      "",
      "- purpose: friendly greeting",
      "- motion: raising one paw or making a tiny greeting movement",
      "- loop: false",
      "- duration_ms: 3000",
      "- fallback_message: Hi~",
      "- prompt_file: data/pets/pet_demo/prompts/wave_paw.txt",
      "",
      "Suggested local synthetic provider command:",
      "",
      "```powershell",
      'npm run provider:example -- --pet-id pet_demo --action wave_paw --prompt-file "data/pets/pet_demo/prompts/wave_paw.txt"',
      "```",
      "",
      "After a real or synthetic provider writes an MP4, register it with:",
      "",
      "```powershell",
      'npm run pet:add-action -- --pet-id pet_demo --action wave_paw --input "outputs/generated/pet_demo/wave_paw.mp4" --convert-alpha --loop false --duration-ms 3000 --message "Hi~"',
      "```",
      "",
      "## Final Checks",
      "",
      "```powershell",
      "npm run pet:doctor -- --pet-id pet_demo",
      "npm run pet:validate -- --pet-id pet_demo",
      "npm run desktop -- --pet-id pet_demo",
      "```",
      "",
    ].join("\n"),
    "utf8",
  );

  console.log("Generated public demo fixture: pet_demo");
}

async function generateAction(action: "idle" | "wave_paw", outputPath: string): Promise<void> {
  const duration = action === "idle" ? "3" : "2.2";
  const pawOffset = action === "idle" ? "0" : "12*sin(2*PI*t*2)";
  const bodyBob = action === "idle" ? "5*sin(2*PI*t/3)" : "4*sin(2*PI*t*1.8)";
  const filter = [
    `color=c=0x00000000:s=512x512:d=${duration}:r=24,format=rgba`,
    `drawbox=x=176:y='210+${bodyBob}':w=160:h=150:color=0x78C7C7ff:t=fill`,
    `drawbox=x=196:y='150+${bodyBob}':w=120:h=100:color=0x8EDDD6ff:t=fill`,
    `drawbox=x=190:y='132+${bodyBob}':w=34:h=38:color=0x8EDDD6ff:t=fill`,
    `drawbox=x=288:y='132+${bodyBob}':w=34:h=38:color=0x8EDDD6ff:t=fill`,
    `drawbox=x=226:y='188+${bodyBob}':w=18:h=18:color=0x1D2939ff:t=fill`,
    `drawbox=x=268:y='188+${bodyBob}':w=18:h=18:color=0x1D2939ff:t=fill`,
    `drawbox=x=247:y='216+${bodyBob}':w=18:h=14:color=0xFF8FA3ff:t=fill`,
    `drawbox=x=150:y='285+${bodyBob}+${pawOffset}':w=34:h=80:color=0x78C7C7ff:t=fill`,
    `drawbox=x=328:y='285+${bodyBob}-${pawOffset}':w=34:h=80:color=0x78C7C7ff:t=fill`,
    `drawbox=x=205:y='352+${bodyBob}':w=34:h=48:color=0x5DB9B2ff:t=fill`,
    `drawbox=x=273:y='352+${bodyBob}':w=34:h=48:color=0x5DB9B2ff:t=fill`,
  ].join(",");

  await runProcess(ffmpegPath, [
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
    "libvpx-vp9",
    "-pix_fmt",
    "yuva420p",
    "-auto-alt-ref",
    "0",
    "-b:v",
    "0",
    "-crf",
    "32",
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

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function runProcess(command: string, args: string[]): Promise<void> {
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
