import path from "node:path";

import { createEventServer } from "./app.js";

const dataRoot = path.resolve(process.cwd());
const port = Number(process.env.PORT ?? 4317);
const host = process.env.HOST ?? "127.0.0.1";

const app = await createEventServer({ dataRoot });

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
