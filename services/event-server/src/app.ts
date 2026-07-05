import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import websocket from "@fastify/websocket";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import {
  completePetActionEvent,
  toOffsetIsoString,
  validatePetActionEvent,
  type PetActionEvent,
} from "../../../packages/protocol/src/index.js";
import {
  appendEvent,
  assertSafePetId,
  readEventsForDate,
  readLatestEvent,
} from "./storage.js";

type LaunchPetBody = {
  pet_id?: string;
};

type EventServerOptions = {
  dataRoot: string;
  logger?: boolean;
};

type WebSocketClient = {
  readyState: number;
  send: (data: string) => void;
  close?: () => void;
  on: (event: "close" | "error", handler: () => void) => void;
};

type PetIdQuery = {
  pet_id?: string;
};

const OPEN_READY_STATE = 1;

export async function createEventServer(
  options: EventServerOptions,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true });
  const subscribers = new Map<string, Set<WebSocketClient>>();

  await app.register(websocket);

  app.get("/health", async () => ({
    ok: true,
    service: "petpresence-event-server",
  }));

  app.post("/events", async (request: FastifyRequest, reply: FastifyReply) => {
    const result = validatePetActionEvent(request.body);
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        errors: result.errors,
      });
    }

    const event = completePetActionEvent(result.event);
    const stored_at = await appendEvent(options.dataRoot, event);
    broadcast(subscribers, event);

    return reply.status(201).send({
      ok: true,
      event,
      stored_at,
    });
  });

  app.get(
    "/events/latest",
    async (
      request: FastifyRequest<{ Querystring: PetIdQuery }>,
      reply: FastifyReply,
    ) => {
      const petId = request.query.pet_id;
      if (!petId) {
        return reply.status(400).send({
          ok: false,
          errors: ["pet_id query parameter is required"],
        });
      }

      try {
        assertSafePetId(petId);
        return {
          ok: true,
          event: await readLatestEvent(options.dataRoot, petId),
        };
      } catch (error) {
        return reply.status(400).send({
          ok: false,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      }
    },
  );

  app.get(
    "/events/today",
    async (
      request: FastifyRequest<{ Querystring: PetIdQuery }>,
      reply: FastifyReply,
    ) => {
      const petId = request.query.pet_id;
      if (!petId) {
        return reply.status(400).send({
          ok: false,
          errors: ["pet_id query parameter is required"],
        });
      }

      try {
        assertSafePetId(petId);
        const today = toOffsetIsoString().slice(0, 10);
        return {
          ok: true,
          events: await readEventsForDate(options.dataRoot, petId, today),
        };
      } catch (error) {
        return reply.status(400).send({
          ok: false,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      }
    },
  );

  app.get(
    "/events/stream",
    { websocket: true },
    (socket: WebSocketClient, request: FastifyRequest<{ Querystring: PetIdQuery }>) => {
      const petId = request.query.pet_id;
      if (!petId) {
        socket.send(
          JSON.stringify({
            ok: false,
            errors: ["pet_id query parameter is required"],
          }),
        );
        return socket.close?.();
      }

      try {
        assertSafePetId(petId);
      } catch (error) {
        socket.send(
          JSON.stringify({
            ok: false,
            errors: [error instanceof Error ? error.message : String(error)],
          }),
        );
        return socket.close?.();
      }

      const petSubscribers = subscribers.get(petId) ?? new Set<WebSocketClient>();
      petSubscribers.add(socket);
      subscribers.set(petId, petSubscribers);

      socket.send(
        JSON.stringify({
          ok: true,
          type: "connected",
          pet_id: petId,
        }),
      );

      const cleanup = () => {
        petSubscribers.delete(socket);
        if (petSubscribers.size === 0) {
          subscribers.delete(petId);
        }
      };

      socket.on("close", cleanup);
      socket.on("error", cleanup);
    },
  );

  // ===== Experimental demo routes =====

  const projectRoot = path.resolve(options.dataRoot);

  // Serve the legacy hackathon launcher page. This is intentionally kept
  // outside the default creator pipeline.
  app.get("/shelter", async (_request: FastifyRequest, reply: FastifyReply) => {
    const htmlPath = path.join(projectRoot, "apps", "web", "index.html");
    const html = await fs.promises.readFile(htmlPath, "utf-8");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  // Serve sample demo pet data for the legacy launcher page.
  app.get("/api/shelter-pets", async (_request: FastifyRequest, reply: FastifyReply) => {
    const dataPath = path.join(projectRoot, "data", "shelter_pets.json");
    let pets: unknown;
    try {
      const raw = await fs.promises.readFile(dataPath, "utf-8");
      pets = JSON.parse(raw);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : "";
      if (code !== "ENOENT") {
        throw error;
      }
      pets = [
        {
          id: "pet_demo",
          name: "Pet Demo",
          breed: "Synthetic fixture",
          age: "Demo",
          weight: "Local",
          gender: "neutral",
          status: "available",
          adoptable: true,
          image: "/assets/pets/pet_demo/idle/idle.webm",
          description: "Synthetic public fixture for the creator pipeline.",
        },
      ];
    }
    return reply.type("application/json").send(pets);
  });

  // Serve demo images and pet assets as static files.
  app.get("/assets/*", async (request: FastifyRequest, reply: FastifyReply) => {
    const relPath = (request.params as Record<string, string>)["*"];
    if (!relPath) {
      return reply.status(404).send({ ok: false, error: "Not found" });
    }

    const absPath = path.join(projectRoot, "assets", relPath);

    if (!absPath.startsWith(path.join(projectRoot, "assets"))) {
      return reply.status(403).send({ ok: false, error: "Forbidden" });
    }

    try {
      await fs.promises.access(absPath);
    } catch {
      return reply.status(404).send({ ok: false, error: "Not found" });
    }

    const ext = path.extname(absPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".webm": "video/webm",
      ".mp4": "video/mp4",
    };

    const buffer = await fs.promises.readFile(absPath);
    return reply.type(mimeMap[ext] ?? "application/octet-stream").send(buffer);
  });

  // Launch the desktop pet selected by the experimental launcher page.
  app.post(
    "/api/launch-pet",
    async (request: FastifyRequest<{ Body: LaunchPetBody }>, reply: FastifyReply) => {
      const petId = request.body?.pet_id;
      if (!petId) {
        return reply.status(400).send({ ok: false, error: "pet_id is required" });
      }

      try {
        assertSafePetId(petId);
      } catch {
        return reply.status(400).send({ ok: false, error: "Invalid pet_id" });
      }

      const desktopDir = path.join(projectRoot, "apps", "desktop");

      try {
        const electronExe = path.join(
          desktopDir, "node_modules", "electron", "dist", "electron.exe",
        );

        const child = spawn(electronExe, [".", "--pet-id", petId], {
          cwd: desktopDir,
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        });
        child.unref();
      } catch {
        return reply.status(500).send({ ok: false, error: "Failed to launch desktop pet" });
      }

      return { ok: true, pet_id: petId };
    },
  );

  return app;
}

function broadcast(
  subscribers: Map<string, Set<WebSocketClient>>,
  event: PetActionEvent,
): void {
  const sockets = subscribers.get(event.pet_id);
  if (!sockets) {
    return;
  }

  const payload = JSON.stringify({
    ok: true,
    type: "event",
    event,
  });

  for (const socket of sockets) {
    if (socket.readyState === OPEN_READY_STATE) {
      socket.send(payload);
    }
  }
}
