import type {
  PetAction,
  PetActionEventInput,
  PetAlertLevel,
  PetTriggerType,
} from "../../packages/protocol/src/index.js";

export type DemoEventTemplate = {
  action: PetAction;
  triggerType: PetTriggerType;
  confidence: number;
  visualSummary: string;
  ownerMessage: string;
  alertLevel: PetAlertLevel;
  needsOwnerAttention: boolean;
  evidenceFrames: string[];
};

export const DEMO_EVENT_TEMPLATES: Record<PetAction, DemoEventTemplate> = {
  idle: {
    action: "idle",
    triggerType: "manual_check",
    confidence: 0.76,
    visualSummary: "演示模式：小白在客厅安静待着，没有明显动作变化。",
    ownerMessage: "我在这里，汪~",
    alertLevel: "normal",
    needsOwnerAttention: false,
    evidenceFrames: [],
  },
  eat: {
    action: "eat",
    triggerType: "manual_check",
    confidence: 0.99,
    visualSummary: "演示模式：小白靠近饭碗，正在低头干饭。",
    ownerMessage: "我在干饭，汪~",
    alertLevel: "normal",
    needsOwnerAttention: false,
    evidenceFrames: ["frames/demo_eat_03.jpg", "frames/demo_eat_08.jpg"],
  },
  sleep: {
    action: "sleep",
    triggerType: "manual_check",
    confidence: 0.93,
    visualSummary: "演示模式：一分钟后再次查看，小白已经趴在窝边休息。",
    ownerMessage: "窝边好舒服~",
    alertLevel: "normal",
    needsOwnerAttention: false,
    evidenceFrames: ["frames/demo_sleep_04.jpg"],
  },
  play: {
    action: "play",
    triggerType: "heartbeat",
    confidence: 0.86,
    visualSummary: "演示模式：陪伴心跳观察到小白在客厅小范围跑动，像是在玩玩具。",
    ownerMessage: "我玩一会儿~",
    alertLevel: "normal",
    needsOwnerAttention: false,
    evidenceFrames: ["frames/demo_play_06.jpg"],
  },
  alert: {
    action: "alert",
    triggerType: "heartbeat",
    confidence: 0.82,
    visualSummary: "演示模式：小白在垃圾桶旁边停留，建议主人稍后关注。",
    ownerMessage: "主人看一下~",
    alertLevel: "warning",
    needsOwnerAttention: true,
    evidenceFrames: ["frames/demo_alert_07.jpg"],
  },
  out_of_view: {
    action: "out_of_view",
    triggerType: "manual_check",
    confidence: 0.9,
    visualSummary: "演示模式：这次查看时画面中暂时没有看到小白。",
    ownerMessage: "我去躲猫猫啦~",
    alertLevel: "normal",
    needsOwnerAttention: false,
    evidenceFrames: [],
  },
};

export const STAGE_SEQUENCE: PetAction[] = [
  "eat",
  "sleep",
  "play",
];

export function buildDemoEvent(input: {
  action: PetAction;
  petId: string;
  timestamp: string;
  eventId?: string;
  triggerType?: PetTriggerType;
  ownerMessage?: string;
  visualSummary?: string;
}): PetActionEventInput {
  const template = DEMO_EVENT_TEMPLATES[input.action];

  return {
    schema_version: "1.0",
    event_id: input.eventId,
    pet_id: input.petId,
    timestamp: input.timestamp,
    trigger_type: input.triggerType ?? template.triggerType,
    routed_action: template.action,
    confidence: template.confidence,
    visual_summary: input.visualSummary ?? template.visualSummary,
    owner_message: input.ownerMessage ?? template.ownerMessage,
    alert_level: template.alertLevel,
    evidence_frames: template.evidenceFrames,
    needs_owner_attention: template.needsOwnerAttention,
  };
}

export function isPetAction(value: string): value is PetAction {
  return value in DEMO_EVENT_TEMPLATES;
}

export function toOffsetIsoString(date: Date): string {
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
