import { readFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";

import { DEFAULT_PET_ID, loadModelConfig, type ModelConfig } from "./config.js";
import { validateModelObservation, type ModelObservation } from "./events.js";
import type {
  PetActionEvent,
  PetTriggerType,
} from "../../../packages/protocol/src/index.js";

export type ObserveAiInput = {
  pet_id?: string;
  pet_name?: string;
  pet_type?: string;
  trigger_type?: PetTriggerType;
  timestamp?: string;
  frame_paths: string[];
};

export type ModelClient = {
  observe(input: ObserveAiInput): Promise<{
    observation: ModelObservation;
    raw: unknown;
  }>;
  answerTodayQuestion(input: TodayRecordQaInput): Promise<{
    answer: string;
    raw: unknown;
  }>;
};

export type TodayRecordQaInput = {
  pet_id: string;
  pet_name?: string;
  question: string;
  events: PetActionEvent[];
};

export class IeCrsGpt55Client implements ModelClient {
  private readonly config?: ModelConfig;
  private readonly promptPath: string;

  constructor(options: { config?: ModelConfig; promptPath?: string } = {}) {
    this.config = options.config;
    this.promptPath =
      options.promptPath ?? path.resolve(process.cwd(), "prompts/pet-observer-system.md");
  }

  async observe(input: ObserveAiInput): Promise<{
    observation: ModelObservation;
    raw: unknown;
  }> {
    if (input.frame_paths.length === 0) {
      throw new Error("frame_paths is required for ai observation");
    }

    const [config, systemPrompt] = await Promise.all([
      this.config ? Promise.resolve(this.config) : loadModelConfig(),
      readFile(this.promptPath, "utf8"),
    ]);

    const images = await Promise.all(
      input.frame_paths.map(async (framePath, index) => ({
        index: index + 1,
        dataUrl: await readImageAsDataUrl(framePath),
      })),
    );

    const response = await postChatCompletion(config, {
      model: config.model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildUserPrompt(input),
            },
            ...images.flatMap((image) => [
              {
                type: "text",
                text: `frame_${String(image.index).padStart(2, "0")}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: image.dataUrl,
                },
              },
            ]),
          ],
        },
      ],
      temperature: 0.1,
    });

    const raw = await response.json().catch(async () => ({
      text: await response.text(),
    }));

    if (!response.ok) {
      throw new Error(`model request failed with ${response.status}: ${JSON.stringify(raw)}`);
    }

    const content = extractMessageContent(raw);
    const parsed = parseJsonObject(content);
    return {
      observation: validateModelObservation(parsed),
      raw,
    };
  }

  async answerTodayQuestion(input: TodayRecordQaInput): Promise<{
    answer: string;
    raw: unknown;
  }> {
    const config = this.config ?? (await loadModelConfig());
    const response = await postChatCompletion(config, {
      model: config.model,
      messages: [
        {
          role: "system",
          content: buildTodayQaSystemPrompt(),
        },
        {
          role: "user",
          content: buildTodayQaUserPrompt(input),
        },
      ],
      temperature: 0.3,
    });

    const raw = await response.json().catch(async () => ({
      text: await response.text(),
    }));

    if (!response.ok) {
      throw new Error(`model request failed with ${response.status}: ${JSON.stringify(raw)}`);
    }

    return {
      answer: normalizePetVoiceAnswer(extractMessageContent(raw).trim(), input.pet_name ?? "小白"),
      raw,
    };
  }
}

async function postChatCompletion(
  config: ModelConfig,
  body: unknown,
): Promise<Response> {
  const url = `${config.baseUrl}/chat/completions`;
  const jsonBody = JSON.stringify(body);

  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: jsonBody,
    });
  } catch (error) {
    try {
      return await postChatCompletionWithHttps(url, config.apiKey, jsonBody);
    } catch (fallbackError) {
      throw new Error(
        [
          `model fetch failed at ${url}: ${formatFetchError(error)}`,
          `https fallback failed: ${formatFetchError(fallbackError)}`,
        ].join(" | "),
      );
    }
  }
}

async function postChatCompletionWithHttps(
  url: string,
  apiKey: string,
  jsonBody: string,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const request = https.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port ? Number(parsedUrl.port) : 443,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(jsonBody),
          accept: "application/json",
          connection: "close",
        },
        timeout: 30000,
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        incoming.on("end", () => {
          const responseBody = Buffer.concat(chunks);
          resolve(
            new Response(responseBody, {
              status: incoming.statusCode ?? 0,
              statusText: incoming.statusMessage ?? "",
              headers: incoming.headers as HeadersInit,
            }),
          );
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("model request timed out after 30000ms"));
    });
    request.on("error", reject);
    request.write(jsonBody);
    request.end();
  });
}

function formatFetchError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const parts = [error.message];
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    parts.push(`cause=${cause.message}`);
    const code = (cause as NodeJS.ErrnoException).code;
    if (code) {
      parts.push(`code=${code}`);
    }
  }

  return parts.join("; ");
}

function buildUserPrompt(input: ObserveAiInput): string {
  const petId = input.pet_id ?? DEFAULT_PET_ID;
  const triggerType = input.trigger_type ?? "manual_check";
  const timestamp = input.timestamp ?? new Date().toISOString();

  return [
    "请分析以下 10 张连续视频快照。",
    "",
    "上下文：",
    `- pet_id: ${petId}`,
    `- pet_name: ${input.pet_name ?? "小白"}`,
    `- pet_type: ${input.pet_type ?? "dog"}`,
    `- trigger_type: ${triggerType}`,
    `- timestamp: ${timestamp}`,
    "- observed_window_sec: 5",
    `- frame_count: ${input.frame_paths.length}`,
    "- frame_order: 按时间从早到晚排列",
    "- frame_interval_sec: 0.5",
    "",
    "请结合这些连续图片之间的变化判断主要动作，并只输出严格 JSON object。",
  ].join("\n");
}

function buildTodayQaSystemPrompt(): string {
  return [
    "你是 PetPresence 里的宠物本人，现在由小白自己回答主人问题。",
    "回答必须使用第一人称，就像小白在直接对主人说话。",
    "禁止使用第三视角，例如“今天记录里小白…”“它…”“宠物…”这类说法。",
    "你只能基于提供的今日宠物事件记录回答，不要编造没有出现在记录里的事实。",
    "如果记录不足以回答，要用第一人称明确说明我今天的记录里还看不出来，不要假装知道。",
    "回答要简短、温柔、可爱、低打扰，优先用中文。",
    "语气参考：短句、像宠物对主人说话，可以自然用“汪~”“汪！”结尾。",
    "不要做医疗诊断或危险判断；如记录显示 warning/alert，只建议主人回看证据或亲自确认。",
  ].join("\n");
}

function buildTodayQaUserPrompt(input: TodayRecordQaInput): string {
  const petName = input.pet_name ?? "小白";
  const timeline = input.events.slice(-40).map((event) => ({
    time: event.timestamp,
    trigger_type: event.trigger_type,
    routed_action: event.routed_action,
    confidence: event.confidence,
    visual_summary: truncateText(event.visual_summary, 160),
    owner_message: truncateText(event.owner_message, 80),
    alert_level: event.alert_level,
    needs_owner_attention: event.needs_owner_attention,
  }));

  return [
    `pet_id: ${input.pet_id}`,
    `pet_name: ${petName}`,
    "",
    "回答要求：",
    "- 用第一人称回答，就像宠物本人在说话。",
    "- 直接对主人说，不要像旁白总结。",
    "- 1 到 3 句话，尽量短。",
    "- 如果记录不足，直接说我今天还看不太出来。",
    "",
    "今日事件记录 JSON：",
    JSON.stringify(timeline, null, 2),
    "",
    `主人问题：${input.question}`,
    "",
    "请基于今日事件记录回答。",
  ].join("\n");
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function normalizePetVoiceAnswer(answer: string, petName: string): string {
  let normalized = answer.trim();

  normalized = normalized
    .replaceAll(`今天记录里${petName}`, "我今天")
    .replaceAll(`${petName}今天`, "我今天")
    .replaceAll(`${petName}有`, "我有")
    .replaceAll(`${petName}在`, "我在")
    .replaceAll(`${petName}已经`, "我已经")
    .replaceAll(`${petName}还`, "我还")
    .replaceAll(`${petName}没有`, "我今天还没有")
    .replaceAll("宠物", "我")
    .replaceAll("它", "我");

  if (
    normalized.length > 0 &&
    !/[汪~！。]$/.test(normalized) &&
    !normalized.includes("我")
  ) {
    normalized = `我今天${normalized}`;
  }

  return normalized;
}

function extractMessageContent(raw: unknown): string {
  const content = (raw as {
    choices?: Array<{ message?: { content?: unknown } }>;
  }).choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "text" in item) {
          return String((item as { text: unknown }).text);
        }
        return "";
      })
      .join("");
  }

  throw new Error("model response did not include choices[0].message.content");
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("model output did not contain a JSON object");
    }
    return JSON.parse(unfenced.slice(start, end + 1));
  }
}

async function readImageAsDataUrl(framePath: string): Promise<string> {
  const buffer = await readFile(path.resolve(framePath));
  const mime = mimeForPath(framePath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function mimeForPath(framePath: string): string {
  const ext = path.extname(framePath).toLowerCase();
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  return "image/jpeg";
}
