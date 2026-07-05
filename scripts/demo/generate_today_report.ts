import path from "node:path";

import { writeDailyReport } from "../../packages/report/src/index.js";

type CliOptions = {
  repoRoot: string;
  petId: string;
  petName?: string;
  date: string;
  stdout: boolean;
};

const options = parseArgs(process.argv.slice(2));
const result = await writeDailyReport(options);

if (options.stdout) {
  console.log(result.markdown);
} else {
  console.log(
    JSON.stringify(
      {
        ok: true,
        reportPath: result.reportPath,
        eventCount: result.eventCount,
        skippedLineCount: result.skippedLineCount,
      },
      null,
      2,
    ),
  );
}

function parseArgs(args: string[]): CliOptions {
  const values = readFlags(args);

  return {
    repoRoot: path.resolve(values["repo-root"] ?? process.cwd()),
    petId: values["pet-id"] ?? "pet_demo",
    petName: values["pet-name"],
    date: values.date ?? todayLocalDate(),
    stdout: values.stdout === "true" || values.stdout === "",
  };
}

function readFlags(args: string[]): Record<string, string> {
  const values: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) {
      continue;
    }

    const withoutPrefix = arg.slice(2);
    const [key, inlineValue] = withoutPrefix.split("=", 2);
    const next = args[index + 1];

    if (inlineValue !== undefined) {
      values[key] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      values[key] = next;
      index += 1;
    } else {
      values[key] = "";
    }
  }

  return values;
}

function todayLocalDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
