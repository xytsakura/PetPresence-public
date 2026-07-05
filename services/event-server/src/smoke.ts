import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createEventServer } from "./app.js";
import { eventsFileForDate, readEventsFile } from "./storage.js";

type JsonObject = Record<string, unknown>;

const petId = "pet_demo";
const dataRoot = await mkdtemp(path.join(os.tmpdir(), "petpresence-event-server-"));
const app = await createEventServer({ dataRoot, logger: false });

try {
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  const baseUrl = address.replace("http://", "http://");
  const wsUrl = address.replace("http://", "ws://");

  const receivedEvents: JsonObject[] = [];
  const ws = new WebSocket(`${wsUrl}/events/stream?pet_id=${petId}`);
  await waitForWebSocketOpen(ws);
  ws.addEventListener("message", (message) => {
    const parsed = JSON.parse(String(message.data)) as JsonObject;
    if (parsed.type === "event") {
      receivedEvents.push(parsed);
    }
  });

  const eventInput = {
    pet_id: petId,
    trigger_type: "manual_check",
    routed_action: "eat",
    confidence: 0.99,
    visual_summary: "Demo pet is near the food bowl and eating.",
    owner_message: "I am eating.",
    alert_level: "normal",
    evidence_frames: [],
  };

  const postResponse = await fetch(`${baseUrl}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(eventInput),
  });
  assert.equal(postResponse.status, 201);
  const postBody = (await postResponse.json()) as {
    ok: boolean;
    event: { event_id: string; timestamp: string; routed_action: string };
    stored_at: string;
  };
  assert.equal(postBody.ok, true);
  assert.equal(postBody.event.routed_action, "eat");
  assert.ok(postBody.event.event_id);
  assert.ok(postBody.event.timestamp);

  const invalidResponse = await fetch(`${baseUrl}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...eventInput, routed_action: "dance" }),
  });
  assert.equal(invalidResponse.status, 400);

  const latestResponse = await fetch(
    `${baseUrl}/events/latest?pet_id=${petId}`,
  );
  assert.equal(latestResponse.status, 200);
  const latestBody = (await latestResponse.json()) as {
    ok: boolean;
    event: { event_id: string };
  };
  assert.equal(latestBody.ok, true);
  assert.equal(latestBody.event.event_id, postBody.event.event_id);

  const todayResponse = await fetch(`${baseUrl}/events/today?pet_id=${petId}`);
  assert.equal(todayResponse.status, 200);
  const todayBody = (await todayResponse.json()) as {
    ok: boolean;
    events: Array<{ event_id: string }>;
  };
  assert.equal(todayBody.ok, true);
  assert.ok(
    todayBody.events.some((event) => event.event_id === postBody.event.event_id),
  );

  await waitFor(() => receivedEvents.length > 0);
  assert.equal(
    (receivedEvents.at(-1)?.event as { event_id?: string } | undefined)
      ?.event_id,
    postBody.event.event_id,
  );

  const date = postBody.event.timestamp.slice(0, 10);
  const eventsFile = eventsFileForDate(dataRoot, petId, date);
  const fileEvents = await readEventsFile(eventsFile);
  assert.ok(
    fileEvents.some((event) => event.event_id === postBody.event.event_id),
  );

  ws.close();
  console.log("event-server smoke test passed");
  console.log(`isolated jsonl verified: ${eventsFile}`);
} finally {
  await app.close();
  await rm(dataRoot, { recursive: true, force: true });
}

async function waitForWebSocketOpen(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for WebSocket open")),
      3000,
    );
    ws.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve();
    });
    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket failed to open"));
    });
  });
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 3000,
): Promise<void> {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
