import {
  completePetActionEvent,
  createFallbackPetActionEvent,
  PET_ACTIONS,
  PET_ALERT_LEVELS,
  PET_TRIGGER_TYPES,
  type PetAction,
  type PetActionEvent,
  type PetActionEventInput,
  type PetAlertLevel,
  type PetTriggerType,
} from "../../../packages/protocol/src/index.js";
import { DEFAULT_PET_ID, eventServerUrl } from "./config.js";

export type ObserverAction = Extract<PetAction, "eat" | "sleep" | "alert" | "out_of_view">;

export type MockObserveInput = {
  pet_id?: string;
  action?: ObserverAction;
  trigger_type?: PetTriggerType;
  post_event?: boolean;
  evidence_frames?: string[];
};

export type ModelObservation = {
  schema_version: "1.0";
  event_id?: string;
  pet_id: string;
  timestamp?: string;
  trigger_type: PetTriggerType;
  observed_window_sec: number;
  frame_count: number;
  pet_visible: boolean;
  model_state: string;
  routed_action: PetAction;
  confidence: number;
  location: string;
  visual_summary: string;
  owner_message: string;
  alert_level: PetAlertLevel;
  evidence_frame_indices: number[];
  needs_owner_attention: boolean;
};

export type PostEventResult =
  | { ok: true; response: unknown }
  | { ok: false; status?: number; error: string; response?: unknown };

const MOCK_EVENTS: Record<ObserverAction, Omit<PetActionEventInput, "pet_id">> = {
  eat: {
    schema_version: "1.0",
    trigger_type: "manual_check",
    routed_action: "eat",
    confidence: 0.99,
    visual_summary: "演示模式：小白靠近饭碗，正在干饭。",
    owner_message: "我在干饭，汪~",
    alert_level: "normal",
    evidence_frames: [],
    needs_owner_attention: false,
  },
  sleep: {
    schema_version: "1.0",
    trigger_type: "manual_check",
    routed_action: "sleep",
    confidence: 0.97,
    visual_summary: "演示模式：小白趴着休息，动作很少。",
    owner_message: "睡着啦，别吵我~",
    alert_level: "normal",
    evidence_frames: [],
    needs_owner_attention: false,
  },
  alert: {
    schema_version: "1.0",
    trigger_type: "heartbeat",
    routed_action: "alert",
    confidence: 0.86,
    visual_summary: "演示模式：小白停在垃圾桶旁边，建议主人关注。",
    owner_message: "主人看一下我这边~",
    alert_level: "warning",
    evidence_frames: [],
    needs_owner_attention: true,
  },
  out_of_view: {
    schema_version: "1.0",
    trigger_type: "manual_check",
    routed_action: "out_of_view",
    confidence: 0.92,
    visual_summary: "演示模式：画面里暂时没有看到小白。",
    owner_message: "我跑出画面啦~",
    alert_level: "normal",
    evidence_frames: [],
    needs_owner_attention: false,
  },
};

export function createMockEvent(input: MockObserveInput = {}): PetActionEvent {
  const action = input.action ?? "eat";
  const template = MOCK_EVENTS[action];

  return completePetActionEvent({
    ...template,
    pet_id: input.pet_id ?? DEFAULT_PET_ID,
    trigger_type: input.trigger_type ?? template.trigger_type,
    evidence_frames: input.evidence_frames ?? template.evidence_frames,
  });
}

export function observationToEvent(
  observation: ModelObservation,
  framePaths: string[],
): PetActionEvent {
  const evidenceFrames = observation.evidence_frame_indices
    .filter((index) => Number.isInteger(index) && index >= 1 && index <= framePaths.length)
    .map((index) => framePaths[index - 1])
    .filter((value): value is string => Boolean(value));

  return completePetActionEvent({
    schema_version: "1.0",
    event_id: observation.event_id || undefined,
    pet_id: observation.pet_id,
    timestamp: observation.timestamp,
    trigger_type: observation.trigger_type,
    routed_action: observation.routed_action,
    confidence: observation.confidence,
    visual_summary: observation.visual_summary,
    owner_message: observation.owner_message,
    alert_level: observation.alert_level,
    evidence_frames: evidenceFrames,
    needs_owner_attention: observation.needs_owner_attention,
  });
}

export function fallbackEventFromError(
  petId: string,
  triggerType: PetTriggerType,
  error: unknown,
  framePaths: string[] = [],
): PetActionEvent {
  return createFallbackPetActionEvent({
    pet_id: petId,
    trigger_type: triggerType,
    routed_action: "idle",
    confidence: 0,
    visual_summary: `本次多模态输出未能解析为合法 JSON：${stringifyError(error)}`,
    owner_message: "我还没看清，汪~",
    alert_level: "normal",
    evidence_frames: framePaths.slice(0, 3),
    needs_owner_attention: false,
  });
}

export async function postEventToEventServer(
  event: PetActionEvent,
  baseUrl = eventServerUrl(),
): Promise<PostEventResult> {
  try {
    const response = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    const body = await response.json().catch(() => undefined);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `event-server returned ${response.status}`,
        response: body,
      };
    }

    return { ok: true, response: body };
  } catch (error) {
    return { ok: false, error: stringifyError(error) };
  }
}

export function parseAction(value: unknown): ObserverAction {
  if (
    value === "eat" ||
    value === "sleep" ||
    value === "alert" ||
    value === "out_of_view"
  ) {
    return value;
  }

  throw new Error("action must be one of: eat, sleep, alert, out_of_view");
}

export function parseTriggerType(value: unknown): PetTriggerType {
  if (typeof value === "string" && PET_TRIGGER_TYPES.includes(value as PetTriggerType)) {
    return value as PetTriggerType;
  }

  throw new Error("trigger_type must be one of: manual_check, heartbeat, pet_button, demo");
}

export function validateModelObservation(value: unknown): ModelObservation {
  if (!value || typeof value !== "object") {
    throw new Error("model output is not an object");
  }

  const candidate = value as Record<string, unknown>;
  const routedAction = candidate.routed_action;
  const triggerType = candidate.trigger_type;
  const alertLevel = candidate.alert_level;
  const confidence = candidate.confidence;
  const evidenceIndices = candidate.evidence_frame_indices;

  if (candidate.schema_version !== "1.0") {
    throw new Error("schema_version must be 1.0");
  }
  if (typeof candidate.pet_id !== "string" || candidate.pet_id.length === 0) {
    throw new Error("pet_id is required");
  }
  if (typeof triggerType !== "string" || !PET_TRIGGER_TYPES.includes(triggerType as PetTriggerType)) {
    throw new Error("invalid trigger_type");
  }
  if (typeof routedAction !== "string" || !PET_ACTIONS.includes(routedAction as PetAction)) {
    throw new Error("invalid routed_action");
  }
  if (typeof alertLevel !== "string" || !PET_ALERT_LEVELS.includes(alertLevel as PetAlertLevel)) {
    throw new Error("invalid alert_level");
  }
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    throw new Error("confidence must be between 0 and 1");
  }
  if (!Array.isArray(evidenceIndices)) {
    throw new Error("evidence_frame_indices must be an array");
  }

  return {
    schema_version: "1.0",
    event_id: typeof candidate.event_id === "string" ? candidate.event_id : "",
    pet_id: candidate.pet_id,
    timestamp: typeof candidate.timestamp === "string" ? candidate.timestamp : undefined,
    trigger_type: triggerType as PetTriggerType,
    observed_window_sec: numberOrDefault(candidate.observed_window_sec, 5),
    frame_count: numberOrDefault(candidate.frame_count, 10),
    pet_visible: Boolean(candidate.pet_visible),
    model_state: stringOrDefault(candidate.model_state, "unknown"),
    routed_action: routedAction as PetAction,
    confidence,
    location: stringOrDefault(candidate.location, "unknown"),
    visual_summary: stringOrDefault(candidate.visual_summary, ""),
    owner_message: stringOrDefault(candidate.owner_message, ""),
    alert_level: alertLevel as PetAlertLevel,
    evidence_frame_indices: evidenceIndices
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item)),
    needs_owner_attention: Boolean(candidate.needs_owner_attention),
  };
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
