const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../../..");
const petId = resolvePetId();
const configPath = path.join(repoRoot, "data", "pets", petId, "action_assets.json");

if (!fs.existsSync(configPath)) {
  throw new Error(`Missing action_assets.json: ${configPath}`);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const requiredActions = uniqueActions([config.default_action, config.idle_action || "idle"]);
const missing = requiredActions.filter((action) => !config.assets?.[action]);

if (missing.length) {
  throw new Error(`Missing required action assets: ${missing.join(", ")}`);
}

for (const [action, asset] of Object.entries(config.assets || {})) {
  if (!asset?.path) {
    throw new Error(`${action}: missing path`);
  }

  const assetPath = path.resolve(repoRoot, asset.path);
  if (!fs.existsSync(assetPath)) {
    throw new Error(`${action}: asset file does not exist: ${asset.path}`);
  }
}

console.log(`desktop config smoke passed for ${petId}`);

function uniqueActions(actions) {
  return [...new Set(actions.filter(Boolean))];
}

function resolvePetId() {
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--pet-id" && args[index + 1]) {
      return sanitizePetId(args[index + 1]);
    }
    if (arg && arg.startsWith("--pet-id=")) {
      return sanitizePetId(arg.slice("--pet-id=".length));
    }
  }
  return sanitizePetId(process.env.PETPRESENCE_PET_ID || "pet_demo");
}

function sanitizePetId(value) {
  const petId = String(value || "").trim();
  if (/^[A-Za-z0-9_-]+$/.test(petId)) {
    return petId;
  }
  return "pet_demo";
}
