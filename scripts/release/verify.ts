import { spawn } from "node:child_process";

type VerifyStep = {
  name: string;
  command: string;
  args: string[];
  quick?: boolean;
};

const steps: VerifyStep[] = [
  { name: "Public config check", command: "npm", args: ["run", "release:check-config"], quick: true },
  { name: "Public hygiene check", command: "npm", args: ["run", "release:check-hygiene"], quick: true },
  { name: "Release readiness check", command: "npm", args: ["run", "release:readiness"], quick: true },
  { name: "TypeScript typecheck", command: "npm", args: ["run", "typecheck"], quick: true },
  { name: "Protocol tests", command: "npm", args: ["run", "test:protocol"], quick: true },
  { name: "Root dependency audit", command: "npm", args: ["run", "audit:root"] },
  { name: "Desktop dependency audit", command: "npm", args: ["run", "audit:desktop"] },
  { name: "Example provider smoke", command: "npm", args: ["run", "smoke:provider-example"], quick: true },
  { name: "Provider import smoke", command: "npm", args: ["run", "smoke:provider-import"], quick: true },
  { name: "Public hygiene smoke", command: "npm", args: ["run", "smoke:public-hygiene"], quick: true },
  { name: "Staged release smoke", command: "npm", args: ["run", "smoke:staged-release"], quick: true },
  { name: "Creator smoke", command: "npm", args: ["run", "smoke:creator"], quick: true },
  { name: "Creator scaffold smoke", command: "npm", args: ["run", "smoke:creator-scaffold"], quick: true },
  { name: "Agent pipeline smoke", command: "npm", args: ["run", "smoke:agent-pipeline"], quick: true },
  { name: "Quickstart smoke", command: "npm", args: ["run", "smoke:quickstart"], quick: true },
  { name: "Creator alpha-conversion smoke", command: "npm", args: ["run", "smoke:creator-alpha"] },
  {
    name: "Validate public demo pet",
    command: "npm",
    args: ["run", "pet:validate", "--", "--pet-id", "pet_demo"],
    quick: true,
  },
  {
    name: "Public Bichon demo smoke",
    command: "npm",
    args: ["run", "smoke:bichon"],
    quick: true,
  },
  { name: "Desktop config smoke", command: "npm", args: ["--prefix", "apps/desktop", "run", "smoke"], quick: true },
  {
    name: "Strict public asset audit",
    command: "npm",
    args: ["run", "release:audit-assets", "--", "--fail-on-unresolved"],
    quick: true,
  },
];
const flags = new Set(process.argv.slice(2));
const quickMode = flags.has("--quick");
const selectedSteps = quickMode ? steps.filter((step) => step.quick) : steps;

console.log(quickMode ? "PetPresence quick verification" : "PetPresence release verification");
console.log("");

for (const [index, step] of selectedSteps.entries()) {
  console.log(`[${index + 1}/${selectedSteps.length}] ${step.name}`);
  await runStep(step);
  console.log("");
}

console.log(quickMode ? "quick verification passed" : "release verification passed");

async function runStep(step: VerifyStep): Promise<void> {
  const command =
    process.platform === "win32" && step.command === "npm" ? process.env.ComSpec || "cmd.exe" : step.command;
  const args =
    process.platform === "win32" && step.command === "npm"
      ? ["/d", "/s", "/c", ["npm", ...step.args].join(" ")]
      : step.args;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
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
      reject(new Error(`${step.name} failed with exit code ${code}`));
    });
  });
}
