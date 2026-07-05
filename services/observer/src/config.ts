import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PET_ID = "pet_demo";
export const DEFAULT_OBSERVER_PORT = 3002;
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_EVENT_SERVER_URL = "http://127.0.0.1:4317";
export const DEFAULT_MODEL = "gpt-5.5";
export const DEFAULT_BASE_URL = "https://ie-crs.haoxiang.ai/v1";
export const DEFAULT_DEMO_VIDEO_PATH = "samples/observer-demo.mp4";

export type ModelConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export function eventServerUrl(): string {
  return stripTrailingSlash(process.env.EVENT_SERVER_URL ?? DEFAULT_EVENT_SERVER_URL);
}

export function observerPort(): number {
  return Number(process.env.PORT ?? DEFAULT_OBSERVER_PORT);
}

export function observerHost(): string {
  return process.env.HOST ?? DEFAULT_HOST;
}

export function demoVideoPath(): string {
  return process.env.DEMO_VIDEO_PATH ?? DEFAULT_DEMO_VIDEO_PATH;
}

export async function loadModelConfig(): Promise<ModelConfig> {
  const envApiKey = process.env.OPENAI_API_KEY ?? process.env.IE_CRS_API_KEY;
  const envBaseUrl = process.env.OPENAI_BASE_URL ?? process.env.IE_CRS_BASE_URL;
  const envModel = process.env.OPENAI_MODEL ?? process.env.IE_CRS_MODEL;

  if (envApiKey) {
    return {
      apiKey: envApiKey,
      baseUrl: stripTrailingSlash(envBaseUrl ?? DEFAULT_BASE_URL),
      model: envModel ?? DEFAULT_MODEL,
    };
  }

  const apiConfigPath = process.env.API_CONFIG_PATH;
  if (!apiConfigPath) {
    throw new Error(
      "OPENAI_API_KEY is not set. Set OPENAI_API_KEY, IE_CRS_API_KEY, or API_CONFIG_PATH before using ai mode.",
    );
  }

  const config = await readApiMd(apiConfigPath);
  return {
    apiKey: config.apiKey,
    baseUrl: stripTrailingSlash(envBaseUrl ?? config.baseUrl ?? DEFAULT_BASE_URL),
    model: envModel ?? DEFAULT_MODEL,
  };
}

async function readApiMd(apiConfigPath: string): Promise<{
  apiKey: string;
  baseUrl?: string;
}> {
  const text = await readFile(path.resolve(apiConfigPath), "utf8");
  const ieCrsSection = sectionAfterHeading(text, "Claude Code Router upstream / ie-crs");
  const keyMatch = ieCrsSection.match(/sk-[A-Za-z0-9_-]+/);
  const urlMatch = ieCrsSection.match(/https?:\/\/\S+/);

  if (!keyMatch) {
    throw new Error(`No ie-crs API key found in ${apiConfigPath}`);
  }

  return {
    apiKey: keyMatch[0],
    baseUrl: urlMatch?.[0],
  };
}

function sectionAfterHeading(text: string, heading: string): string {
  const index = text.indexOf(heading);
  if (index === -1) {
    return text;
  }

  const nextHeading = text.indexOf("\n## ", index + heading.length);
  return nextHeading === -1 ? text.slice(index) : text.slice(index, nextHeading);
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
