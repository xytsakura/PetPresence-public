import { z } from "zod";

export const PET_ACTIONS = [
  "idle",
  "sleep",
  "eat",
  "play",
  "alert",
  "out_of_view",
] as const;

export const PET_TRIGGER_TYPES = [
  "manual_check",
  "heartbeat",
  "pet_button",
  "demo",
] as const;

export const PET_ALERT_LEVELS = ["normal", "message", "warning"] as const;

export const PetActionSchema = z.enum(PET_ACTIONS);
export const PetTriggerTypeSchema = z.enum(PET_TRIGGER_TYPES);
export const PetAlertLevelSchema = z.enum(PET_ALERT_LEVELS);

export const PetActionEventInputSchema = z.object({
  schema_version: z.literal("1.0").default("1.0"),
  event_id: z.string().min(1).optional(),
  pet_id: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }).optional(),
  trigger_type: PetTriggerTypeSchema,
  routed_action: PetActionSchema,
  confidence: z.number().min(0).max(1).default(0),
  visual_summary: z.string().default(""),
  owner_message: z.string().default(""),
  alert_level: PetAlertLevelSchema.default("normal"),
  evidence_frames: z.array(z.string()).default([]),
  needs_owner_attention: z.boolean().default(false),
});

export const PetActionEventSchema = PetActionEventInputSchema.extend({
  event_id: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
});

export type PetAction = (typeof PET_ACTIONS)[number];
export type PetTriggerType = (typeof PET_TRIGGER_TYPES)[number];
export type PetAlertLevel = (typeof PET_ALERT_LEVELS)[number];
export type PetActionEventInput = z.input<typeof PetActionEventInputSchema>;
export type PetActionEvent = z.infer<typeof PetActionEventSchema>;

export type EventValidationResult =
  | { ok: true; event: PetActionEvent }
  | { ok: false; errors: string[] };

let eventCounter = 0;

export function createEventId(date = new Date()): string {
  eventCounter = (eventCounter + 1) % 1000;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const seq = String(eventCounter).padStart(3, "0");

  return `evt_${yyyy}${mm}${dd}_${hh}${mi}${ss}_${seq}`;
}

export function toOffsetIsoString(date = new Date()): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMins = String(absOffset % 60).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}${sign}${offsetHours}:${offsetMins}`;
}

export function completePetActionEvent(
  input: PetActionEventInput,
  now = new Date(),
): PetActionEvent {
  const parsed = PetActionEventInputSchema.parse(input);
  return PetActionEventSchema.parse({
    ...parsed,
    event_id: parsed.event_id ?? createEventId(now),
    timestamp: parsed.timestamp ?? toOffsetIsoString(now),
  });
}

export function validatePetActionEvent(input: unknown): EventValidationResult {
  const result = PetActionEventInputSchema.safeParse(input);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      }),
    };
  }

  try {
    return { ok: true, event: completePetActionEvent(result.data) };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export function createFallbackPetActionEvent(
  partial: Partial<PetActionEventInput> & { pet_id: string },
  reason = "Unable to route pet action.",
  now = new Date(),
): PetActionEvent {
  return completePetActionEvent(
    {
      schema_version: "1.0",
      pet_id: partial.pet_id,
      trigger_type: partial.trigger_type ?? "demo",
      routed_action: partial.routed_action ?? "idle",
      confidence: partial.confidence ?? 0,
      visual_summary: partial.visual_summary ?? reason,
      owner_message: partial.owner_message ?? "我还没看清，汪~",
      alert_level: partial.alert_level ?? "message",
      evidence_frames: partial.evidence_frames ?? [],
      needs_owner_attention: partial.needs_owner_attention ?? false,
      event_id: partial.event_id,
      timestamp: partial.timestamp,
    },
    now,
  );
}
