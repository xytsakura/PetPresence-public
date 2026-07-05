import { observerHost, observerPort } from "./config.js";
import { createObserverServer } from "./app.js";

const app = await createObserverServer();

try {
  await app.listen({ host: observerHost(), port: observerPort() });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
