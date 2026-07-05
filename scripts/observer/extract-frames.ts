import path from "node:path";

import { extractFrames, parseArgs } from "./frame-extractor.js";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const frames = await extractFrames(options);

  console.log(
    JSON.stringify(
      {
        ok: true,
        video: options.video,
        output_dir: path.resolve(options.outputDir),
        frame_count: frames.length,
        interval_sec: options.intervalSec,
        observed_window_sec: options.frameCount * options.intervalSec,
        frames,
      },
      null,
      2,
    ),
  );
}

await main();
