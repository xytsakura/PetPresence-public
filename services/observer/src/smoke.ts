import assert from "node:assert/strict";

import { createObserverServer } from "./app.js";
import type { ModelClient } from "./model-client.js";

async function main(): Promise<void> {
  const received: unknown[] = [];
  const fakeEventServer = await createFakeEventServer(received);
  const eventAddress = await fakeEventServer.listen({ host: "127.0.0.1", port: 0 });
  const observer = await createObserverServer({
    logger: false,
    eventServerBaseUrl: eventAddress,
    modelClient: createFakeModelClient(),
  });
  const observerAddress = await observer.listen({ host: "127.0.0.1", port: 0 });

  try {
    const response = await fetch(`${observerAddress}/observe/mock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "sleep",
        pet_id: "pet_demo",
      }),
    });
    assert.equal(response.status, 201);
    const body = (await response.json()) as {
      ok: boolean;
      event: { routed_action: string; pet_id: string };
      post_result: { ok: boolean };
    };

    assert.equal(body.ok, true);
    assert.equal(body.event.routed_action, "sleep");
    assert.equal(body.event.pet_id, "pet_demo");
    assert.equal(body.post_result.ok, true);
    assert.equal(received.length, 1);

    const invalidResponse = await fetch(`${observerAddress}/observe/mock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "play" }),
    });
    assert.equal(invalidResponse.status, 400);

    const qaResponse = await fetch(`${observerAddress}/qa/today`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pet_id: "pet_demo",
        question: "What did the demo pet do today?",
      }),
    });
    assert.equal(qaResponse.status, 200);
    const qaBody = (await qaResponse.json()) as {
      ok: boolean;
      answer: string;
      event_count: number;
    };
    assert.equal(qaBody.ok, true);
    assert.equal(qaBody.answer, "The demo pet mostly rested today.");
    assert.equal(qaBody.event_count, 1);

    console.log("observer smoke test passed");
  } finally {
    await observer.close();
    await fakeEventServer.close();
  }
}

async function createFakeEventServer(received: unknown[]) {
  const { default: Fastify } = await import("fastify");
  const app = Fastify({ logger: false });
  app.post("/events", async (request, reply) => {
    received.push(request.body);
    return reply.status(201).send({ ok: true, event: request.body });
  });
  app.get("/events/today", async () => ({
    ok: true,
    events: [
      {
        schema_version: "1.0",
        event_id: "evt_smoke_qa_001",
        pet_id: "pet_demo",
        timestamp: "2026-05-25T10:00:00.000+08:00",
        trigger_type: "manual_check",
        routed_action: "sleep",
        confidence: 0.98,
        visual_summary: "Demo pet is resting.",
        owner_message: "I am resting.",
        alert_level: "normal",
        evidence_frames: [],
        needs_owner_attention: false,
      },
    ],
  }));
  return app;
}

function createFakeModelClient(): ModelClient {
  return {
    async observe() {
      throw new Error("observe should not be called in this smoke test");
    },
    async answerTodayQuestion(input) {
      assert.equal(input.pet_id, "pet_demo");
      assert.equal(input.events.length, 1);
      return {
        answer: "The demo pet mostly rested today.",
        raw: { fake: true },
      };
    },
  };
}

await main();
