import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type Flags = Record<string, string | boolean>;

type ActionAsset = {
  type: "webm" | "mp4" | "gif";
  path: string;
  transparent_background?: boolean;
  loop: boolean;
  duration_ms: number;
  fallback_message: string;
};

type ActionAssetsConfig = {
  pet_id: string;
  default_action: string;
  idle_action: string;
  version: string;
  coordinate_system: {
    width: number;
    height: number;
    transparent_background: boolean;
  };
  event_server: {
    http_base: string;
    ws_url: string;
  };
  observer: {
    mock_url: string;
    current_url: string;
    qa_url: string;
  };
  assets: Record<string, ActionAsset>;
};

type ValidationReport = {
  schema_version: 1;
  pet_id: string;
  summary: {
    ok: boolean;
    error: number;
    warn: number;
  };
  errors: string[];
  warnings: string[];
};

const repoRoot = path.resolve(import.meta.dirname, "../..");

const command = process.argv[2];
const flags = readFlags(process.argv.slice(3));

try {
  switch (command) {
    case "init":
      await initPet(flags);
      break;
    case "add-action":
      await addAction(flags);
      break;
    case "validate":
      await validatePet(flags);
      break;
    case "print-plan":
      printPlan(flags);
      break;
    default:
      printHelp();
      process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function initPet(flags: Flags): Promise<void> {
  const petId = requiredFlag(flags, "pet-id");
  assertSafePetId(petId);
  const name = requiredFlag(flags, "name");
  const species = stringFlag(flags, "species", "other");
  const description = stringFlag(flags, "description", "");
  const force = booleanFlag(flags, "force");
  const petDataDir = petDataPath(petId);
  const petAssetDir = petAssetPath(petId);

  await mkdir(petDataDir, { recursive: true });
  await mkdir(petAssetDir, { recursive: true });
  await mkdir(path.join(petDataDir, "events"), { recursive: true });
  await mkdir(path.join(petDataDir, "frames"), { recursive: true });
  await mkdir(path.join(petDataDir, "reports"), { recursive: true });

  await writeJsonIfAllowed(
    path.join(petDataDir, "profile.json"),
    {
      pet_id: petId,
      name,
      species,
      description,
      speech_style: {
        max_chars: 24,
        tone: "short, gentle, low-interruption",
        catchphrases: [],
      },
    },
    force,
  );

  await writeTextIfAllowed(
    path.join(petDataDir, "agent.md"),
    [
      `# ${name} Agent Notes`,
      "",
      "## Identity",
      "",
      `- pet_id: ${petId}`,
      `- name: ${name}`,
      `- species: ${species}`,
      description ? `- description: ${description}` : "- description: TBD",
      "",
      "## Voice",
      "",
      "- Use short, warm, low-interruption messages.",
      "- Do not make medical, psychological, or health diagnoses.",
      "- Only describe observable behavior or user-provided personality.",
      "",
    ].join("\n"),
    force,
  );

  await writeJsonIfAllowed(path.join(petDataDir, "action_assets.json"), defaultAssetsConfig(petId), force);

  console.log(`Created pet workspace: ${path.relative(repoRoot, petDataDir)}`);
  console.log(`Created asset workspace: ${path.relative(repoRoot, petAssetDir)}`);
  console.log(`Next: npm run pet:print-plan -- --pet-id ${petId}`);
}

async function addAction(flags: Flags): Promise<void> {
  const petId = requiredFlag(flags, "pet-id");
  assertSafePetId(petId);
  const action = requiredFlag(flags, "action");
  assertSafeAction(action);
  const input = path.resolve(requiredFlag(flags, "input"));
  const message = stringFlag(flags, "message", defaultMessage(action));
  const loop = booleanFlag(flags, "loop", action === "idle" || action === "sleep");
  const skipAlpha = booleanFlag(flags, "skip-alpha");
  const convertAlpha = booleanFlag(flags, "convert-alpha");
  const keepWorkDir = booleanFlag(flags, "keep-workdir");
  const durationMs = numberFlag(flags, "duration-ms", 4000);
  const alphaFps = numberFlag(flags, "alpha-fps", 24);
  const alphaHeight = numberFlag(flags, "alpha-height", 512);
  const alphaCrf = numberFlag(flags, "alpha-crf", 30);
  const alphaColorMaskThreshold = numberFlag(flags, "alpha-color-mask-threshold", 12);
  const ext = path.extname(input).toLowerCase();

  if (!(await exists(input))) {
    throw new Error(`Input file does not exist: ${input}`);
  }
  if (![".mp4", ".webm", ".gif"].includes(ext)) {
    throw new Error("Input must be .mp4, .webm, or .gif");
  }

  const config = await readAssetsConfig(petId);
  const actionDir = path.join(petAssetPath(petId), action);
  const hadRegisteredAssets = Object.keys(config.assets || {}).length > 0;
  await mkdir(actionDir, { recursive: true });

  if (convertAlpha && ext !== ".mp4") {
    throw new Error("--convert-alpha currently requires an .mp4 input");
  }
  if (convertAlpha && skipAlpha) {
    throw new Error("--convert-alpha and --skip-alpha cannot be used together");
  }

  const targetExt = ext;
  const target = path.join(actionDir, `${action}${targetExt}`);
  await copyFileIfDifferent(input, target);

  let registeredTarget = target;
  if (convertAlpha) {
    await runAlphaConversion({
      action,
      colorMaskThreshold: alphaColorMaskThreshold,
      crf: alphaCrf,
      fps: alphaFps,
      height: alphaHeight,
      inputPath: input,
      keepWorkDir,
      petId,
    });
    const convertedTarget = path.join(actionDir, `${action}.webm`);
    if (!(await exists(convertedTarget))) {
      throw new Error(`Alpha conversion finished but output was not found: ${toRepoRelative(convertedTarget)}`);
    }
    registeredTarget = convertedTarget;
  }

  const relativeTarget = toRepoRelative(registeredTarget);
  const registeredExt = path.extname(registeredTarget).toLowerCase();
  config.assets[action] = {
    type: registeredExt.slice(1) as "webm" | "mp4" | "gif",
    path: relativeTarget,
    transparent_background: registeredExt === ".webm" ? true : false,
    loop,
    duration_ms: durationMs,
    fallback_message: message,
  };
  if (!hadRegisteredAssets || action === "idle" || !config.default_action || !config.assets[config.default_action]) {
    config.default_action = action;
  }
  if (!hadRegisteredAssets || action === "idle" || !config.idle_action || !config.assets[config.idle_action]) {
    config.idle_action = action;
  }

  await writeJson(path.join(petDataPath(petId), "action_assets.json"), config);

  console.log(`Registered action "${action}" for ${petId}: ${relativeTarget}`);
  if (convertAlpha) {
    console.log(`Alpha WebM generated and registered: assets/pets/${petId}/${action}/${action}.webm`);
  } else if (targetExt === ".mp4" && !skipAlpha) {
    console.log("Note: MP4 was registered as a source asset. Run the alpha WebM pipeline before release.");
    console.log(
      [
        "Suggested command:",
        `.\\scripts\\assets\\remove_background_to_alpha_webm.ps1 -PetId ${petId} -Action ${action} -InputPath "${toRepoRelative(target)}"`,
      ].join("\n"),
    );
    console.log(`Expected output path: assets/pets/${petId}/${action}/${action}.webm`);
  }
  console.log(`Next: npm run pet:validate -- --pet-id ${petId}`);
}

async function runAlphaConversion(input: {
  petId: string;
  action: string;
  inputPath: string;
  keepWorkDir: boolean;
  fps: number;
  height: number;
  crf: number;
  colorMaskThreshold: number;
}): Promise<void> {
  const scriptPath = path.join(repoRoot, "scripts", "assets", "remove_background_to_alpha_webm.ps1");
  const command = process.platform === "win32" ? "powershell.exe" : "pwsh";
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    "-PetId",
    input.petId,
    "-Action",
    input.action,
    "-InputPath",
    input.inputPath,
    "-Fps",
    String(input.fps),
    "-Height",
    String(input.height),
    "-Crf",
    String(input.crf),
    "-ColorMaskThreshold",
    String(input.colorMaskThreshold),
  ];
  if (input.keepWorkDir) {
    args.push("-KeepWorkDir");
  }

  console.log(`Running alpha conversion for ${input.petId}/${input.action}...`);
  await runProcess(command, args);
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

async function validatePet(flags: Flags): Promise<void> {
  const petId = requiredFlag(flags, "pet-id");
  assertSafePetId(petId);
  const jsonOutput = booleanFlag(flags, "json");
  const errors: string[] = [];
  const warnings: string[] = [];
  const profilePath = path.join(petDataPath(petId), "profile.json");
  const configPath = path.join(petDataPath(petId), "action_assets.json");

  if (!(await exists(profilePath))) {
    errors.push(`Missing profile.json: ${toRepoRelative(profilePath)}`);
  }
  if (!(await exists(configPath))) {
    errors.push(`Missing action_assets.json: ${toRepoRelative(configPath)}`);
  }
  if (errors.length) {
    printValidationResult(petId, errors, warnings, jsonOutput);
    process.exit(1);
  }

  const profile = await readJson<Record<string, unknown>>(profilePath);
  if (profile.pet_id !== petId) {
    errors.push(`profile.json pet_id must be "${petId}"`);
  }

  const config = await readAssetsConfig(petId);
  if (config.pet_id !== petId) {
    errors.push(`action_assets.json pet_id must be "${petId}"`);
  }
  if (!config.default_action) {
    errors.push("default_action is required");
  } else if (!config.assets[config.default_action]) {
    errors.push(`default_action "${config.default_action}" is not registered in assets`);
  }

  for (const [action, asset] of Object.entries(config.assets)) {
    if (!asset.path) {
      errors.push(`${action}: path is required`);
      continue;
    }
    const assetPath = path.resolve(repoRoot, asset.path);
    if (!(await exists(assetPath))) {
      errors.push(`${action}: missing asset file ${asset.path}`);
    }
    const ext = path.extname(asset.path).toLowerCase().slice(1);
    if (ext !== asset.type) {
      errors.push(`${action}: type "${asset.type}" does not match file extension ".${ext}"`);
    }
    if (!asset.fallback_message) {
      warnings.push(`${action}: fallback_message is empty`);
    }
  }

  if (!config.assets.idle && config.idle_action === "idle") {
    warnings.push("idle action is not registered; set idle_action to a registered action or add an idle asset");
  }

  printValidationResult(petId, errors, warnings, jsonOutput);
  if (errors.length) {
    process.exit(1);
  }
}

function printPlan(flags: Flags): void {
  const petId = stringFlag(flags, "pet-id", "<pet_id>");
  console.log([
    `PetPresence action plan for ${petId}`,
    "",
    "Recommended first actions:",
    "- idle: front-facing, subtle breathing, stable loop.",
    "- sleep: curled up or lying down, subtle breathing, stable loop.",
    "- eat: lowering head or eating, short action.",
    "- play: small jump, turn, paw movement, or toy interaction.",
    "",
    "Source video tips:",
    "- Keep each clip around 3-6 seconds.",
    "- Use a simple background and stable camera.",
    "- Keep the full body visible.",
    "- Avoid text, watermark, extra objects, and fast camera motion.",
    "",
    "Next commands:",
    `npm run pet:add-action -- --pet-id ${petId} --action idle --input <idle.mp4> --message "I am here~" --loop true`,
    `npm run pet:validate -- --pet-id ${petId}`,
  ].join("\n"));
}

function defaultAssetsConfig(petId: string): ActionAssetsConfig {
  return {
    pet_id: petId,
    default_action: "idle",
    idle_action: "idle",
    version: "creator-v1",
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
    assets: {},
  };
}

function defaultMessage(action: string): string {
  const messages: Record<string, string> = {
    idle: "I am here~",
    sleep: "I am sleeping~",
    eat: "I am eating~",
    play: "Let's play~",
    alert: "Please check on me~",
    out_of_view: "I stepped away~",
  };
  return messages[action] ?? "I am here~";
}

async function readAssetsConfig(petId: string): Promise<ActionAssetsConfig> {
  const configPath = path.join(petDataPath(petId), "action_assets.json");
  if (!(await exists(configPath))) {
    throw new Error(`Missing action_assets.json. Run: npm run pet:init -- --pet-id ${petId} --name <name>`);
  }
  const config = await readJson<ActionAssetsConfig>(configPath);
  config.assets ??= {};
  return config;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function copyFileIfDifferent(source: string, target: string): Promise<void> {
  if (path.resolve(source).toLowerCase() === path.resolve(target).toLowerCase()) {
    return;
  }
  await copyFile(source, target);
}

async function writeJsonIfAllowed(filePath: string, value: unknown, force: boolean): Promise<void> {
  if (!force && (await exists(filePath))) {
    console.log(`Keep existing file: ${toRepoRelative(filePath)}`);
    return;
  }
  await writeJson(filePath, value);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeTextIfAllowed(filePath: string, value: string, force: boolean): Promise<void> {
  if (!force && (await exists(filePath))) {
    console.log(`Keep existing file: ${toRepoRelative(filePath)}`);
    return;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function petDataPath(petId: string): string {
  return path.join(repoRoot, "data", "pets", petId);
}

function petAssetPath(petId: string): string {
  return path.join(repoRoot, "assets", "pets", petId);
}

function toRepoRelative(filePath: string): string {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
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

function booleanFlag(flags: Flags, key: string, fallback = false): boolean {
  const value = flags[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function numberFlag(flags: Flags, key: string, fallback: number): number {
  const value = flags[key];
  if (typeof value !== "string") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function assertSafePetId(petId: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(petId)) {
    throw new Error("--pet-id may only contain letters, numbers, underscores, and hyphens");
  }
}

function assertSafeAction(action: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(action)) {
    throw new Error("--action may only contain letters, numbers, underscores, and hyphens");
  }
}

function printValidationResult(petId: string, errors: string[], warnings: string[], jsonOutput = false): void {
  if (jsonOutput) {
    const report: ValidationReport = {
      schema_version: 1,
      pet_id: petId,
      summary: {
        ok: errors.length === 0,
        error: errors.length,
        warn: warnings.length,
      },
      errors,
      warnings,
    };
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  for (const warning of warnings) {
    console.warn(`WARN ${warning}`);
  }
  for (const error of errors) {
    console.error(`ERROR ${error}`);
  }
  if (errors.length === 0) {
    console.log("pet validation passed");
  }
}

function printHelp(): void {
  console.log([
    "PetPresence creator CLI",
    "",
    "Commands:",
    "  init --pet-id <id> --name <name> [--species cat]",
    "  add-action --pet-id <id> --action <action> --input <file> [--message text] [--loop true]",
    "  validate --pet-id <id> [--json]",
    "  print-plan --pet-id <id>",
  ].join("\n"));
}
