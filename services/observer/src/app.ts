import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { extractFrames } from "../../../scripts/observer/frame-extractor.js";
import { DEFAULT_PET_ID, demoVideoPath, eventServerUrl } from "./config.js";
import {
  createMockEvent,
  fallbackEventFromError,
  observationToEvent,
  parseAction,
  parseTriggerType,
  postEventToEventServer,
  type MockObserveInput,
} from "./events.js";
import { IeCrsGpt55Client, type ModelClient } from "./model-client.js";
import type {
  PetActionEvent,
  PetTriggerType,
} from "../../../packages/protocol/src/index.js";

type ObserverServerOptions = {
  logger?: boolean;
  eventServerBaseUrl?: string;
  modelClient?: ModelClient;
  demoVideoPath?: string;
};

type ObserveAiBody = {
  pet_id?: string;
  pet_name?: string;
  pet_type?: string;
  trigger_type?: string;
  frame_paths?: string[];
  post_event?: boolean;
};

type ObserveCurrentBody = {
  pet_id?: string;
  pet_name?: string;
  pet_type?: string;
  trigger_type?: string;
  video_path?: string;
  current_time_sec?: number;
  post_event?: boolean;
  use_cache?: boolean;
  prewarm?: boolean;
};

type TodayQaBody = {
  pet_id?: string;
  pet_name?: string;
  question?: string;
};

type DemoVideoStateBody = {
  video_path?: string;
  current_time_sec?: number;
  paused?: boolean;
  duration_sec?: number;
};

type DemoVideoState = {
  video_path: string;
  current_time_sec: number | null;
  paused: boolean;
  duration_sec: number | null;
  updated_at: string | null;
};

type CurrentObservationCache = {
  video_path: string;
  current_time_sec: number | null;
  observed_window_sec: number;
  frames: string[];
  observation: unknown;
  event: PetActionEvent;
  created_at_ms: number;
};

const DEMO_FRAME_COUNT = 10;
const DEMO_FRAME_INTERVAL_SEC = 0.5;
const DEMO_WINDOW_SEC = DEMO_FRAME_COUNT * DEMO_FRAME_INTERVAL_SEC;
const CACHE_MAX_AGE_MS = 120_000;
const CACHE_TIME_TOLERANCE_SEC = 30;

export async function createObserverServer(
  options: ObserverServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true });
  const eventServerBaseUrl = options.eventServerBaseUrl ?? eventServerUrl();
  const modelClient = options.modelClient ?? new IeCrsGpt55Client();
  const demoState: DemoVideoState = {
    video_path: path.resolve(options.demoVideoPath ?? demoVideoPath()),
    current_time_sec: null,
    paused: true,
    duration_sec: null,
    updated_at: null,
  };
  let currentCache: CurrentObservationCache | null = null;

  app.get("/health", async () => ({
    ok: true,
    service: "petpresence-observer",
    event_server_url: eventServerBaseUrl,
    demo_video_path: demoState.video_path,
  }));

  app.get("/demo-video", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderDemoVideoPage());
  });

  app.get("/demo-video/state", async () => ({
    ok: true,
    state: demoState,
  }));

  app.post(
    "/demo-video/state",
    async (request: FastifyRequest<{ Body: DemoVideoStateBody }>) => {
      const body = request.body ?? {};
      if (typeof body.video_path === "string" && body.video_path.length > 0) {
        demoState.video_path = path.resolve(body.video_path);
      }
      if (typeof body.current_time_sec === "number" && Number.isFinite(body.current_time_sec)) {
        demoState.current_time_sec = Math.max(0, body.current_time_sec);
      }
      if (typeof body.paused === "boolean") {
        demoState.paused = body.paused;
      }
      if (typeof body.duration_sec === "number" && Number.isFinite(body.duration_sec)) {
        demoState.duration_sec = Math.max(0, body.duration_sec);
      }
      demoState.updated_at = new Date().toISOString();

      return {
        ok: true,
        state: demoState,
      };
    },
  );

  app.get("/demo-video/source", async (_request, reply) => {
    try {
      await access(demoState.video_path);
    } catch {
      return reply.status(404).send({
        ok: false,
        error: `Demo video not found: ${demoState.video_path}`,
      });
    }

    return reply.type("video/mp4").send(createReadStream(demoState.video_path));
  });

  app.post(
    "/observe/mock",
    async (
      request: FastifyRequest<{ Body: MockObserveInput }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = request.body ?? {};
        const event = createMockEvent({
          ...body,
          action: body.action === undefined ? undefined : parseAction(body.action),
          trigger_type:
            body.trigger_type === undefined
              ? undefined
              : parseTriggerType(body.trigger_type),
        });
        const shouldPost = body.post_event ?? true;
        const post_result = shouldPost
          ? await postEventToEventServer(event, eventServerBaseUrl)
          : undefined;

        if (post_result && !post_result.ok) {
          return reply.status(502).send({
            ok: false,
            event,
            post_result,
          });
        }

        return reply.status(201).send({
          ok: true,
          mode: "mock",
          event,
          post_result,
        });
      } catch (error) {
        return reply.status(400).send({
          ok: false,
          errors: [stringifyError(error)],
        });
      }
    },
  );

  app.post(
    "/observe/ai",
    async (
      request: FastifyRequest<{ Body: ObserveAiBody }>,
      reply: FastifyReply,
    ) => {
      const body = request.body ?? {};
      const petId = body.pet_id ?? DEFAULT_PET_ID;
      const framePaths = body.frame_paths ?? [];
      let triggerType: PetTriggerType = "manual_check";

      try {
        triggerType =
          body.trigger_type === undefined
            ? "manual_check"
            : parseTriggerType(body.trigger_type);
        const result = await modelClient.observe({
          pet_id: petId,
          pet_name: body.pet_name,
          pet_type: body.pet_type,
          trigger_type: triggerType,
          frame_paths: framePaths,
        });
        const event = observationToEvent(result.observation, relativeFramePaths(framePaths));
        const shouldPost = body.post_event ?? true;
        const post_result = shouldPost
          ? await postEventToEventServer(event, eventServerBaseUrl)
          : undefined;

        if (post_result && !post_result.ok) {
          return reply.status(502).send({
            ok: false,
            mode: "ai",
            observation: result.observation,
            event,
            post_result,
          });
        }

        return reply.status(201).send({
          ok: true,
          mode: "ai",
          observation: result.observation,
          event,
          post_result,
        });
      } catch (error) {
        const event = fallbackEventFromError(
          petId,
          triggerType,
          error,
          relativeFramePaths(framePaths),
        );
        const post_result =
          body.post_event ?? true
            ? await postEventToEventServer(event, eventServerBaseUrl)
            : undefined;

        return reply.status(200).send({
          ok: false,
          mode: "ai",
          fallback: true,
          errors: [stringifyError(error)],
          event,
          post_result,
        });
      }
    },
  );

  app.post(
    "/observe/current",
    async (
      request: FastifyRequest<{ Body: ObserveCurrentBody }>,
      reply: FastifyReply,
    ) => {
      const body = request.body ?? {};
      const petId = body.pet_id ?? DEFAULT_PET_ID;
      const videoPath = path.resolve(body.video_path ?? demoState.video_path);
      const currentTimeSec =
        typeof body.current_time_sec === "number" && Number.isFinite(body.current_time_sec)
          ? body.current_time_sec
          : demoState.current_time_sec;
      let triggerType: PetTriggerType = "manual_check";
      let framePaths: string[] = [];

      try {
        triggerType =
          body.trigger_type === undefined
            ? "manual_check"
            : parseTriggerType(body.trigger_type);

        await access(videoPath);

        const cached = cachedObservation(currentCache, videoPath, currentTimeSec);
        if (body.use_cache !== false && cached) {
          const shouldPost = body.post_event ?? true;
          const post_result = shouldPost
            ? await postEventToEventServer(cached.event, eventServerBaseUrl)
            : undefined;

          return reply.status(201).send({
            ok: true,
            mode: "current_cache",
            cached: true,
            video_path: videoPath,
            current_time_sec: currentTimeSec,
            observed_window_sec: cached.observed_window_sec,
            frames: cached.frames,
            observation: cached.observation,
            event: cached.event,
            post_result,
          });
        }

        const startSec =
          typeof currentTimeSec === "number"
            ? Math.max(0, currentTimeSec - DEMO_WINDOW_SEC)
            : undefined;
        const prefix = [
          petId,
          triggerType,
          new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14),
        ].join("_");

        framePaths = await extractFrames({
          video: videoPath,
          outputDir: path.join("data", "pets", petId, "frames"),
          frameCount: DEMO_FRAME_COUNT,
          intervalSec: DEMO_FRAME_INTERVAL_SEC,
          maxWidth: 512,
          jpegQuality: 5,
          startSec,
          prefix,
        });

        const result = await modelClient.observe({
          pet_id: petId,
          pet_name: body.pet_name,
          pet_type: body.pet_type,
          trigger_type: triggerType,
          timestamp: new Date().toISOString(),
          frame_paths: framePaths,
        });
        const event = observationToEvent(result.observation, relativeFramePaths(framePaths));
        currentCache = {
          video_path: videoPath,
          current_time_sec: currentTimeSec,
          observed_window_sec: DEMO_WINDOW_SEC,
          frames: framePaths,
          observation: result.observation,
          event,
          created_at_ms: Date.now(),
        };
        const shouldPost = body.post_event ?? true;
        const post_result = shouldPost
          ? await postEventToEventServer(event, eventServerBaseUrl)
          : undefined;

        if (post_result && !post_result.ok) {
          return reply.status(502).send({
            ok: false,
            mode: "current",
            video_path: videoPath,
            current_time_sec: currentTimeSec,
            observed_window_sec: DEMO_WINDOW_SEC,
            frames: framePaths,
            observation: result.observation,
            event,
            post_result,
          });
        }

        return reply.status(201).send({
          ok: true,
          mode: "current",
          video_path: videoPath,
          current_time_sec: currentTimeSec,
          observed_window_sec: DEMO_WINDOW_SEC,
          frames: framePaths,
          observation: result.observation,
          event,
          post_result,
        });
      } catch (error) {
        const event = fallbackEventFromError(
          petId,
          triggerType,
          error,
          relativeFramePaths(framePaths),
        );
        const post_result =
          body.post_event ?? true
            ? await postEventToEventServer(event, eventServerBaseUrl)
            : undefined;

        return reply.status(200).send({
          ok: false,
          mode: "current",
          fallback: true,
          errors: [stringifyError(error)],
          video_path: videoPath,
          current_time_sec: currentTimeSec,
          observed_window_sec: DEMO_WINDOW_SEC,
          frames: framePaths,
          event,
          post_result,
        });
      }
    },
  );

  app.post(
    "/qa/today",
    async (
      request: FastifyRequest<{ Body: TodayQaBody }>,
      reply: FastifyReply,
    ) => {
      const body = request.body ?? {};
      const petId = body.pet_id ?? DEFAULT_PET_ID;
      const question = body.question?.trim();

      if (!question) {
        return reply.status(400).send({
          ok: false,
          errors: ["question is required"],
        });
      }

      try {
        const events = await fetchTodayEvents(eventServerBaseUrl, petId);
        const result = await modelClient.answerTodayQuestion({
          pet_id: petId,
          pet_name: body.pet_name,
          question,
          events,
        });

        return reply.status(200).send({
          ok: true,
          mode: "today_qa",
          pet_id: petId,
          question,
          answer: result.answer,
          event_count: events.length,
        });
      } catch (error) {
        const events = await fetchTodayEvents(eventServerBaseUrl, petId).catch(
          async () => readLocalTodayEvents(petId),
        );
        const fallbackAnswer = buildLocalTodayQaAnswer({
          petName: body.pet_name ?? "小白",
          question,
          events,
        });

        return reply.status(200).send({
          ok: true,
          mode: "today_qa_local_fallback",
          fallback: true,
          pet_id: petId,
          question,
          answer: fallbackAnswer,
          event_count: events.length,
          warnings: [stringifyError(error)],
        });
      }
    },
  );

  return app;
}

async function fetchTodayEvents(
  eventServerBaseUrl: string,
  petId: string,
): Promise<PetActionEvent[]> {
  try {
    const url = `${eventServerBaseUrl}/events/today?pet_id=${encodeURIComponent(petId)}`;
    const response = await fetch(url);
    const body = await response.json().catch(() => undefined);

    if (!response.ok) {
      throw new Error(`event-server returned ${response.status}: ${JSON.stringify(body)}`);
    }

    const events = Array.isArray(body)
      ? body
      : (body as { events?: unknown[] } | undefined)?.events;

    if (!Array.isArray(events)) {
      throw new Error("event-server response did not include events");
    }

    return events as PetActionEvent[];
  } catch (error) {
    const localEvents = await readLocalTodayEvents(petId);
    if (localEvents.length > 0) {
      return localEvents;
    }

    throw error;
  }
}

async function readLocalTodayEvents(petId: string): Promise<PetActionEvent[]> {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const date = `${yyyy}-${mm}-${dd}`;
  const filePath = path.resolve(
    process.cwd(),
    "data",
    "pets",
    petId,
    "events",
    `${date}.jsonl`,
  );

  try {
    const text = await readFile(filePath, "utf8");
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PetActionEvent);
  } catch {
    return [];
  }
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function cachedObservation(
  cache: CurrentObservationCache | null,
  videoPath: string,
  currentTimeSec: number | null,
): CurrentObservationCache | null {
  if (!cache || cache.video_path !== videoPath) {
    return null;
  }
  if (Date.now() - cache.created_at_ms > CACHE_MAX_AGE_MS) {
    return null;
  }
  if (typeof currentTimeSec === "number" && typeof cache.current_time_sec === "number") {
    const distance = Math.abs(currentTimeSec - cache.current_time_sec);
    if (distance > CACHE_TIME_TOLERANCE_SEC) {
      return null;
    }
  }
  return cache;
}

function relativeFramePaths(framePaths: string[]): string[] {
  return framePaths.map((framePath) => path.relative(process.cwd(), framePath).replace(/\\/g, "/"));
}

function buildLocalTodayQaAnswer(input: {
  petName: string;
  question: string;
  events: PetActionEvent[];
}): string {
  const question = input.question.toLowerCase();
  const events = [...input.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const latest = events.at(-1);
  const eatEvents = events.filter((event) => event.routed_action === "eat");
  const sleepEvents = events.filter((event) => event.routed_action === "sleep");
  const playEvents = events.filter((event) => event.routed_action === "play");
  const alertEvents = events.filter(
    (event) =>
      event.routed_action === "alert" ||
      event.needs_owner_attention ||
      event.alert_level === "warning",
  );

  if (events.length === 0) {
    return "我今天还没有新的记录，暂时还回答不好你这个问题，汪~";
  }

  if (includesAny(question, ["吃", "饭", "干饭", "喝水"])) {
    if (eatEvents.length === 0) {
      return "我今天的记录里还没有拍到我吃饭喝水的样子，可能只是这次没拍到，汪~";
    }
    const latestEat = eatEvents.at(-1);
    return `我今天有 ${eatEvents.length} 次吃饭喝水记录，最近一次是在 ${formatTimeText(latestEat?.timestamp)}，我那会儿在认真干饭，汪~`;
  }

  if (includesAny(question, ["睡", "休息", "困", "午睡"])) {
    if (sleepEvents.length === 0) {
      return "我今天的记录里还没有明显拍到我睡觉，不过也可能是观察窗口刚好错过啦，汪~";
    }
    const latestSleep = sleepEvents.at(-1);
    return `我今天有 ${sleepEvents.length} 次休息记录，最近一次是在 ${formatTimeText(latestSleep?.timestamp)}，那会儿我在安静歇一会儿，汪~`;
  }

  if (includesAny(question, ["玩", "活动", "活跃", "精神"])) {
    if (playEvents.length === 0) {
      return "我今天的记录看起来比较安静，没有太多玩耍片段，不过我状态还算平稳，汪~";
    }
    return `我今天有 ${playEvents.length} 次玩耍活动记录，说明我还是有在动来动去、玩一会儿的，汪！`;
  }

  if (includesAny(question, ["异常", "不对劲", "注意", "提醒", "健康"])) {
    if (alertEvents.length === 0) {
      return "我今天的记录里没有特别明显的不对劲提醒，整体看起来还算平稳，汪~";
    }
    return `我今天有 ${alertEvents.length} 条记录值得你多看一眼，最好顺手回看一下证据截图确认我当时在做什么，汪~`;
  }

  if (latest) {
    return `我今天一共被看到 ${events.length} 次，最近一次是在 ${formatTimeText(latest.timestamp)}，那时我在${actionLabel(latest.routed_action)}。${latest.owner_message || "我今天也在好好陪你，汪~"}`;
  }

  return "我今天有一些记录，不过我现在只敢按看到的内容回答你，汪~";
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function formatTimeText(timestamp?: string): string {
  if (!timestamp) {
    return "今天稍早些时候";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "今天稍早些时候";
  }

  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function actionLabel(action: PetActionEvent["routed_action"]): string {
  switch (action) {
    case "eat":
      return "吃饭喝水";
    case "sleep":
      return "休息";
    case "play":
      return "玩耍";
    case "alert":
      return "有点不安";
    case "out_of_view":
      return "跑出画面";
    case "idle":
    default:
      return "安静待着";
  }
}

function renderDemoVideoPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PetPresence Demo Video</title>
    <style>
      :root { color-scheme: dark; font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #101211; color: #eef4ef; display: grid; grid-template-rows: auto 1fr; }
      header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.12); }
      h1 { margin: 0; font-size: 15px; font-weight: 650; }
      .meta { color: #a8b5ad; font-size: 12px; }
      main { display: grid; place-items: center; padding: 16px; }
      video { width: min(960px, 100%); max-height: calc(100vh - 94px); background: #000; border-radius: 8px; }
    </style>
  </head>
  <body>
    <header>
      <h1>PetPresence Demo Video</h1>
      <div id="meta" class="meta">waiting</div>
    </header>
    <main>
      <video id="video" src="/demo-video/source" controls autoplay muted playsinline></video>
    </main>
    <script>
      const video = document.getElementById("video");
      const meta = document.getElementById("meta");
      let lastSent = 0;
      let lastPrewarm = 0;

      async function sendState(force = false) {
        const now = Date.now();
        if (!force && now - lastSent < 500) return;
        lastSent = now;
        const payload = {
          current_time_sec: Number.isFinite(video.currentTime) ? video.currentTime : 0,
          paused: video.paused,
          duration_sec: Number.isFinite(video.duration) ? video.duration : 0
        };
        meta.textContent = "time " + payload.current_time_sec.toFixed(1) + "s / " + payload.duration_sec.toFixed(1) + "s";
        try {
          await fetch("/demo-video/state", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload)
          });
        } catch {}
      }

      async function prewarmObservation(force = false) {
        const now = Date.now();
        if (!force && now - lastPrewarm < 15000) return;
        lastPrewarm = now;
        await sendState(true);
        try {
          await fetch("/observe/current", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              trigger_type: "manual_check",
              post_event: false,
              use_cache: false,
              prewarm: true
            })
          });
        } catch {}
      }

      video.addEventListener("loadedmetadata", () => { sendState(true); prewarmObservation(true); });
      video.addEventListener("play", () => { sendState(true); prewarmObservation(false); });
      video.addEventListener("pause", () => sendState(true));
      video.addEventListener("seeked", () => { sendState(true); prewarmObservation(true); });
      video.addEventListener("timeupdate", () => sendState(false));
      window.setInterval(() => sendState(false), 1000);
      window.setInterval(() => prewarmObservation(false), 15000);
    </script>
  </body>
</html>`;
}
