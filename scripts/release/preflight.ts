import { spawn } from "node:child_process";

type PreflightStep = {
  name: string;
  command: string;
  args: string[];
};

const steps: PreflightStep[] = [
  {
    name: "Refresh first public stage plan",
    command: "npm",
    args: ["run", "release:stage-plan", "--", "--write-md"],
  },
  { name: "Full release verification", command: "npm", args: ["run", "release:verify"] },
  { name: "Clean export smoke", command: "npm", args: ["run", "release:smoke-clean-export"] },
  {
    name: "Strict public asset audit",
    command: "npm",
    args: ["run", "release:audit-assets", "--", "--fail-on-unresolved"],
  },
  { name: "Staged public release check", command: "npm", args: ["run", "release:check-staged"] },
  { name: "Whitespace diff check", command: "git", args: ["diff", "--check"] },
];

console.log("PetPresence first public release preflight");
console.log("");

for (const [index, step] of steps.entries()) {
  console.log(`[${index + 1}/${steps.length}] ${step.name}`);
  await runStep(step);
  console.log("");
}

console.log("release preflight passed");

async function runStep(step: PreflightStep): Promise<void> {
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
