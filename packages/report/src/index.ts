import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PetAction, PetActionEvent } from "../../protocol/src/index.js";

export type DailyReportOptions = {
  repoRoot: string;
  petId: string;
  date: string;
  petName?: string;
};

export type DailyReportResult = {
  reportPath: string;
  markdown: string;
  eventCount: number;
  skippedLineCount: number;
};

export type DailyReportHtmlResult = {
  reportPath: string;
  html: string;
  eventCount: number;
  skippedLineCount: number;
};

type ParsedJsonl<T> = {
  rows: T[];
  skippedLineCount: number;
};

const ACTION_ORDER: PetAction[] = [
  "idle",
  "sleep",
  "eat",
  "play",
  "alert",
  "out_of_view",
];

const ACTION_LABELS: Record<PetAction, string> = {
  idle: "安静陪伴",
  sleep: "睡觉休息",
  eat: "吃饭喝水",
  play: "玩耍活动",
  alert: "需要关注",
  out_of_view: "不在画面中",
};

const TRIGGER_LABELS: Record<string, string> = {
  manual_check: "主动查看",
  heartbeat: "陪伴心跳",
  pet_button: "按钮事件",
  demo: "演示事件",
};

export function eventsFileForDate(options: DailyReportOptions): string {
  return path.join(
    options.repoRoot,
    "data",
    "pets",
    options.petId,
    "events",
    `${options.date}.jsonl`,
  );
}

export function dailyReportPath(options: DailyReportOptions): string {
  return path.join(
    options.repoRoot,
    "data",
    "pets",
    options.petId,
    "reports",
    `daily_${options.date}.md`,
  );
}

export function dailyReportHtmlPath(options: DailyReportOptions): string {
  return path.join(
    options.repoRoot,
    "data",
    "pets",
    options.petId,
    "reports",
    `daily_${options.date}.html`,
  );
}

export async function readDailyEvents(
  options: DailyReportOptions,
): Promise<ParsedJsonl<PetActionEvent>> {
  const filePath = eventsFileForDate(options);

  try {
    const content = await readFile(filePath, "utf8");
    return parseJsonl<PetActionEvent>(content);
  } catch (error) {
    if (isNotFound(error)) {
      return { rows: [], skippedLineCount: 0 };
    }
    throw error;
  }
}

export function generateDailyReportMarkdown(
  events: PetActionEvent[],
  options: Omit<DailyReportOptions, "repoRoot">,
): string {
  const petName = options.petName ?? petNameFromPetId(options.petId);
  const sortedEvents = [...events].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  const actionCounts = countActions(sortedEvents);
  const topActions = topActionLabels(actionCounts);
  const attentionEvents = sortedEvents.filter(
    (event) =>
      event.needs_owner_attention ||
      event.alert_level === "warning" ||
      event.routed_action === "alert",
  );
  const timeline = sortedEvents.map(formatTimelineItem);
  const highlights = chooseHighlights(sortedEvents);
  const petVoice = choosePetVoiceSummary(sortedEvents, petName);

  return [
    `# ${petName}的今日陪伴日报：${options.date}`,
    "",
    "## 今日概览",
    "",
    `- 今日观察 ${sortedEvents.length} 次。`,
    `- 主要状态：${topActions || "暂无可统计状态"}。`,
    `- 主动查看 ${countByTrigger(sortedEvents, "manual_check")} 次，陪伴心跳 ${countByTrigger(sortedEvents, "heartbeat")} 次，按钮事件 ${countByTrigger(sortedEvents, "pet_button")} 次。`,
    `- 需要主人关注的记录 ${attentionEvents.length} 条。`,
    "",
    "## Action 统计",
    "",
    ...formatActionStats(actionCounts),
    "",
    "## 时间线",
    "",
    ...(timeline.length ? timeline : ["- 暂无事件记录。"]),
    "",
    "## 值得回看的瞬间",
    "",
    ...(highlights.length ? highlights : ["- 暂无明显高光瞬间。"]),
    "",
    "## 小结",
    "",
    buildSummaryParagraph(sortedEvents, topActions, attentionEvents.length, petName),
    "",
    `## ${petName}想说`,
    "",
    petVoice,
    "",
  ].join("\n");
}

export function generateDailyReportHtml(
  events: PetActionEvent[],
  options: Omit<DailyReportOptions, "repoRoot">,
): string {
  const petName = options.petName ?? petNameFromPetId(options.petId);
  const sortedEvents = [...events].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  const actionCounts = countActions(sortedEvents);
  const topActions = topActionLabels(actionCounts);
  const attentionEvents = sortedEvents.filter(
    (event) =>
      event.needs_owner_attention ||
      event.alert_level === "warning" ||
      event.routed_action === "alert",
  );
  const highlights = chooseHighlights(sortedEvents);
  const petVoice = choosePetVoiceSummary(sortedEvents, petName);
  const wellnessCards = buildWellnessCards(sortedEvents);
  const heroStats = [
    { label: "今日观察", value: `${sortedEvents.length}` },
    { label: "重点提醒", value: `${attentionEvents.length}` },
    {
      label: "主状态",
      value: topActions ? (topActions.split("、")[0] ?? "暂无记录") : "暂无记录",
    },
  ];

  const actionBars = ACTION_ORDER.map((action) => {
    const count = actionCounts.get(action) ?? 0;
    const total = Math.max(sortedEvents.length, 1);
    return {
      action,
      label: ACTION_LABELS[action],
      count,
      width: `${Math.max((count / total) * 100, count > 0 ? 12 : 4)}%`,
    };
  });

  const timelineCards = sortedEvents.map((event) => ({
    time: formatTime(event.timestamp),
    trigger: TRIGGER_LABELS[event.trigger_type] ?? event.trigger_type,
    action: labelForAction(event.routed_action),
    summary: cleanDisplayText(event.visual_summary, "该条记录说明疑似损坏。"),
    message: cleanDisplayText(event.owner_message, "无气泡"),
    evidence: event.evidence_frames,
  }));

  const evidenceGallery = sortedEvents
    .filter((event) => event.evidence_frames.length > 0)
    .slice(-6)
    .map((event) => ({
      action: labelForAction(event.routed_action),
      time: formatTime(event.timestamp),
      imageUrl: relativeEvidenceImage(event.evidence_frames[0] ?? ""),
      summary: cleanDisplayText(event.visual_summary, "暂无观察说明。"),
    }))
    .filter((item) => item.imageUrl.length > 0);

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(petName)}的今日陪伴日报</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #1f2a24;
        --muted: #6b756f;
        --line: rgba(31, 42, 36, 0.1);
        --paper: #fffdf8;
        --paper-strong: #fff8ed;
        --mint: #6dbfa7;
        --mint-soft: rgba(109, 191, 167, 0.16);
        --rose: #efaa90;
        --rose-soft: rgba(239, 170, 144, 0.16);
        --gold: #e6ba5f;
        --sky: #89b5d9;
        --shadow: 0 20px 50px rgba(33, 43, 38, 0.12);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(255,255,255,0.9), transparent 30%),
          linear-gradient(180deg, #f8f2e8 0%, #f7fbf8 48%, #eef4f8 100%);
      }

      .page {
        width: min(1180px, calc(100vw - 32px));
        margin: 24px auto 40px;
        display: grid;
        gap: 18px;
      }

      .hero {
        display: grid;
        grid-template-columns: 1.25fr 0.75fr;
        gap: 18px;
        padding: 22px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(255, 253, 248, 0.92);
        box-shadow: var(--shadow);
      }

      .hero-title {
        display: grid;
        gap: 10px;
      }

      .eyebrow {
        display: inline-flex;
        width: fit-content;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--mint-soft);
        color: #245748;
        font-size: 12px;
        font-weight: 700;
      }

      h1 {
        margin: 0;
        font-size: clamp(28px, 4vw, 42px);
        line-height: 1.04;
      }

      .hero-copy {
        color: var(--muted);
        font-size: 15px;
        line-height: 1.6;
      }

      .hero-stats {
        display: grid;
        gap: 12px;
        align-content: start;
      }

      .stat-card {
        padding: 16px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,248,237,0.88));
      }

      .stat-label {
        color: var(--muted);
        font-size: 12px;
      }

      .stat-value {
        margin-top: 6px;
        font-size: 24px;
        font-weight: 700;
        line-height: 1.1;
      }

      .grid {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 18px;
      }

      .panel {
        padding: 18px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.82);
        box-shadow: var(--shadow);
      }

      .panel h2 {
        margin: 0 0 12px;
        font-size: 18px;
      }

      .panel-note {
        margin-top: -4px;
        margin-bottom: 14px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .wellness-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .wellness-card {
        padding: 14px;
        border-radius: 16px;
        background: var(--paper);
        border: 1px solid var(--line);
      }

      .wellness-name {
        color: var(--muted);
        font-size: 12px;
      }

      .wellness-score {
        margin-top: 6px;
        font-size: 26px;
        font-weight: 700;
      }

      .wellness-text {
        margin-top: 8px;
        font-size: 13px;
        line-height: 1.5;
      }

      .activity-list {
        display: grid;
        gap: 12px;
      }

      .activity-row {
        display: grid;
        gap: 6px;
      }

      .activity-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
      }

      .activity-track {
        height: 10px;
        border-radius: 999px;
        background: rgba(137, 181, 217, 0.12);
        overflow: hidden;
      }

      .activity-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--mint), var(--sky));
      }

      .timeline {
        display: grid;
        gap: 12px;
      }

      .timeline-item {
        display: grid;
        gap: 8px;
        padding: 14px;
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,248,237,0.78));
        border: 1px solid var(--line);
      }

      .timeline-top {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: baseline;
      }

      .timeline-chip {
        display: inline-flex;
        padding: 5px 9px;
        border-radius: 999px;
        background: var(--mint-soft);
        color: #245748;
        font-size: 11px;
        font-weight: 700;
      }

      .timeline-summary {
        font-size: 14px;
        line-height: 1.6;
      }

      .timeline-meta {
        color: var(--muted);
        font-size: 12px;
      }

      .highlights {
        display: grid;
        gap: 10px;
      }

      .highlight-item {
        padding: 14px;
        border-radius: 16px;
        background: linear-gradient(135deg, var(--rose-soft), rgba(255,255,255,0.92));
        border: 1px solid rgba(239, 170, 144, 0.22);
        line-height: 1.6;
        font-size: 14px;
      }

      .voice-card {
        padding: 18px;
        border-radius: 18px;
        background: linear-gradient(135deg, rgba(109,191,167,0.18), rgba(255,255,255,0.94));
        border: 1px solid rgba(109, 191, 167, 0.24);
        font-size: 20px;
        line-height: 1.5;
      }

      .gallery {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .gallery-card {
        overflow: hidden;
        border-radius: 16px;
        background: rgba(255,255,255,0.9);
        border: 1px solid var(--line);
      }

      .gallery-card img {
        display: block;
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
        background: #eef2ef;
      }

      .gallery-copy {
        padding: 12px;
        display: grid;
        gap: 6px;
      }

      .footer-note {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.6;
      }

      @media (max-width: 920px) {
        .hero,
        .grid {
          grid-template-columns: 1fr;
        }

        .gallery {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="hero-title">
          <div class="eyebrow">PetPresence Daily Story</div>
          <h1>${escapeHtml(petName)}的陪伴日报</h1>
          <div class="hero-copy">
            ${escapeHtml(options.date)} 的记录一共收到了 ${sortedEvents.length} 次观察。主要状态是 ${escapeHtml(topActions || "暂无可统计状态")}。
            下面这份页面直接由今日 JSONL 事件记录生成，用来回看小白今天的状态、活动节奏和需要注意的片段。
          </div>
        </div>
        <div class="hero-stats">
          ${heroStats
            .map(
              (stat) => `<article class="stat-card">
                <div class="stat-label">${escapeHtml(stat.label)}</div>
                <div class="stat-value">${escapeHtml(stat.value)}</div>
              </article>`,
            )
            .join("")}
        </div>
      </section>

      <section class="grid">
        <article class="panel">
          <h2>健康与状态观察</h2>
          <div class="panel-note">这是基于今日记录的轻量观察，不作医疗诊断，用来帮助主人快速扫一眼整体状态。</div>
          <div class="wellness-grid">
            ${wellnessCards
              .map(
                (card) => `<section class="wellness-card">
                  <div class="wellness-name">${escapeHtml(card.name)}</div>
                  <div class="wellness-score">${escapeHtml(card.score)}</div>
                  <div class="wellness-text">${escapeHtml(card.text)}</div>
                </section>`,
              )
              .join("")}
          </div>
        </article>

        <article class="panel">
          <h2>活动分布</h2>
          <div class="panel-note">按 action 统计今天的主要行为分布，方便快速看出休息、进食、玩耍和找主人的节奏。</div>
          <div class="activity-list">
            ${actionBars
              .map(
                (bar) => `<div class="activity-row">
                  <div class="activity-head">
                    <span>${escapeHtml(bar.label)}</span>
                    <span>${bar.count} 次</span>
                  </div>
                  <div class="activity-track"><div class="activity-fill" style="width: ${bar.width};"></div></div>
                </div>`,
              )
              .join("")}
          </div>
        </article>
      </section>

      <section class="grid">
        <article class="panel">
          <h2>今日时间线</h2>
          <div class="timeline">
            ${
              timelineCards.length
                ? timelineCards
                    .map(
                      (item) => `<article class="timeline-item">
                        <div class="timeline-top">
                          <strong>${escapeHtml(item.time)} ${escapeHtml(item.action)}</strong>
                          <span class="timeline-chip">${escapeHtml(item.trigger)}</span>
                        </div>
                        <div class="timeline-summary">${escapeHtml(item.summary)}</div>
                        <div class="timeline-meta">气泡消息：${escapeHtml(item.message)}</div>
                      </article>`,
                    )
                    .join("")
                : `<article class="timeline-item"><div class="timeline-summary">今天还没有可展示的事件记录。</div></article>`
            }
          </div>
        </article>

        <article class="panel">
          <h2>值得回看的瞬间</h2>
          <div class="highlights">
            ${
              highlights.length
                ? highlights
                    .map(
                      (item) => `<div class="highlight-item">${escapeHtml(item.slice(2))}</div>`,
                    )
                    .join("")
                : `<div class="highlight-item">今天还没有特别突出的高光片段。</div>`
            }
          </div>
          <h2 style="margin-top: 18px;">${escapeHtml(petName)}想说</h2>
          <div class="voice-card">${escapeHtml(petVoice)}</div>
        </article>
      </section>

      <section class="panel">
        <h2>证据片段回看</h2>
        <div class="panel-note">如果记录里带了证据截图，这里会尝试展示最近几张，帮助这份日报更像真实陪伴记录，而不是纯文本总结。</div>
        <div class="gallery">
          ${
            evidenceGallery.length
              ? evidenceGallery
                  .map(
                    (item) => `<article class="gallery-card">
                      <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.action)}" />
                      <div class="gallery-copy">
                        <strong>${escapeHtml(item.time)} ${escapeHtml(item.action)}</strong>
                        <div class="footer-note">${escapeHtml(item.summary)}</div>
                      </div>
                    </article>`,
                  )
                  .join("")
              : `<article class="gallery-card"><div class="gallery-copy"><strong>暂无证据截图</strong><div class="footer-note">今天的事件里还没有可展示的证据图片。</div></div></article>`
          }
        </div>
      </section>

      <section class="footer-note">
        本页由 PetPresence 根据 ${sortedEvents.length} 条今日记录生成，用于陪伴回顾与轻量观察，不替代专业医疗建议。
      </section>
    </main>
  </body>
</html>`;
}

export async function writeDailyReport(
  options: DailyReportOptions,
): Promise<DailyReportResult> {
  const parsed = await readDailyEvents(options);
  const markdown = generateDailyReportMarkdown(parsed.rows, {
    petId: options.petId,
    date: options.date,
    petName: options.petName,
  });
  const reportPath = dailyReportPath(options);

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");

  return {
    reportPath,
    markdown,
    eventCount: parsed.rows.length,
    skippedLineCount: parsed.skippedLineCount,
  };
}

export async function writeDailyReportHtml(
  options: DailyReportOptions,
): Promise<DailyReportHtmlResult> {
  const parsed = await readDailyEvents(options);
  const html = generateDailyReportHtml(parsed.rows, {
    petId: options.petId,
    date: options.date,
    petName: options.petName,
  });
  const reportPath = dailyReportHtmlPath(options);

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, html, "utf8");

  return {
    reportPath,
    html,
    eventCount: parsed.rows.length,
    skippedLineCount: parsed.skippedLineCount,
  };
}

function parseJsonl<T>(content: string): ParsedJsonl<T> {
  const rows: T[] = [];
  let skippedLineCount = 0;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      rows.push(JSON.parse(trimmed) as T);
    } catch {
      skippedLineCount += 1;
    }
  }

  return { rows, skippedLineCount };
}

function countActions(events: PetActionEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.routed_action, (counts.get(event.routed_action) ?? 0) + 1);
  }
  return counts;
}

function topActionLabels(actionCounts: Map<string, number>): string {
  return [...actionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([action, count]) => `${labelForAction(action)} ${count} 次`)
    .join("、");
}

function countByTrigger(events: PetActionEvent[], triggerType: string): number {
  return events.filter((event) => event.trigger_type === triggerType).length;
}

function formatActionStats(actionCounts: Map<string, number>): string[] {
  return ACTION_ORDER.map((action) => {
    const count = actionCounts.get(action) ?? 0;
    return `- ${labelForAction(action)}：${count} 次`;
  });
}

function formatTimelineItem(event: PetActionEvent): string {
  const time = formatTime(event.timestamp);
  const trigger = TRIGGER_LABELS[event.trigger_type] ?? event.trigger_type;
  const message = cleanDisplayText(event.owner_message, "气泡文字疑似编码损坏")
    ? `「${cleanDisplayText(event.owner_message, "气泡文字疑似编码损坏")}」`
    : "无气泡";
  const summary = cleanDisplayText(
    event.visual_summary,
    "该条记录的说明疑似编码损坏，保留 action 统计。",
  );
  const evidence = event.evidence_frames.length
    ? ` 证据：${event.evidence_frames.join(", ")}。`
    : "";

  return `- ${time}｜${trigger}｜${labelForAction(event.routed_action)}：${summary} ${message}${evidence}`;
}

function chooseHighlights(events: PetActionEvent[]): string[] {
  const priority = events.filter(
    (event) =>
      event.trigger_type === "pet_button" ||
      event.alert_level !== "normal" ||
      event.needs_owner_attention ||
      event.evidence_frames.length > 0,
  );
  const fallback = events.filter((event) => event.routed_action !== "idle");
  const source = priority.length ? priority : fallback;

  return source.slice(-3).map((event) => {
    const time = formatTime(event.timestamp);
    const message = cleanDisplayText(event.owner_message, "") || "";
    const suffix = message ? ` ${message}` : "";
    const summary = cleanDisplayText(event.visual_summary, "暂无观察说明。");
    return `- ${time} 的${labelForAction(event.routed_action)}：${summary}${suffix}`;
  });
}

function choosePetVoiceSummary(events: PetActionEvent[], petName: string): string {
  const latestMessage = [...events]
    .reverse()
    .map((event) => cleanDisplayText(event.owner_message, ""))
    .find((message) => message.trim().length > 0);

  if (latestMessage) {
    return latestMessage;
  }

  if (events.length === 0) {
    return `今天还没有看到${petName}的新记录，汪~`;
  }

  return "今天也在好好陪你，汪~";
}

function buildSummaryParagraph(
  events: PetActionEvent[],
  topActions: string,
  attentionCount: number,
  petName: string,
): string {
  if (events.length === 0) {
    return `今天暂时没有${petName}的观察记录。路演时可以先运行 demo 状态序列，再重新生成日报。`;
  }

  const attentionText =
    attentionCount > 0
      ? `其中有 ${attentionCount} 条记录需要主人关注，建议优先回看。`
      : "没有出现明确的异常提醒。";

  return `今天共记录 ${events.length} 次观察，主要状态是${topActions || "暂无明显主状态"}。${attentionText} 这份日报直接来自 JSONL 行为记录，可用于证明桌宠动作和气泡不是随机模板。`;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function petNameFromPetId(petId: string): string {
  return petId;
}

function labelForAction(action: string): string {
  return ACTION_LABELS[action as PetAction] ?? "已移除动作";
}

function cleanDisplayText(value: unknown, fallback: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return "";
  }

  if (/\?{2,}/.test(trimmed) || trimmed.includes("\uFFFD")) {
    return fallback;
  }

  return trimmed;
}

function buildWellnessCards(events: PetActionEvent[]): Array<{
  name: string;
  score: string;
  text: string;
}> {
  const counts = countActions(events);
  const attentionCount = events.filter(
    (event) =>
      event.needs_owner_attention ||
      event.alert_level === "warning" ||
      event.routed_action === "alert",
  ).length;
  const eatCount = counts.get("eat") ?? 0;
  const playCount = counts.get("play") ?? 0;
  const sleepCount = counts.get("sleep") ?? 0;
  const hiddenCount = counts.get("out_of_view") ?? 0;

  return [
    {
      name: "进食状态",
      score: eatCount > 0 ? "稳定" : "待观察",
      text:
        eatCount > 0
          ? `今天记录到 ${eatCount} 次吃饭喝水相关状态，说明至少有明确进食片段被捕捉到。`
          : "今天没有明显进食片段记录，可能只是观察窗口没有拍到。",
    },
    {
      name: "活动活力",
      score: playCount > 0 ? "活跃" : "平稳",
      text:
        playCount > 0
          ? `今天有 ${playCount} 次玩耍活动记录，说明状态不只是静止休息。`
          : "今天以平稳状态为主，没有明显玩耍高峰。",
    },
    {
      name: "休息节奏",
      score: sleepCount > 0 ? "有休息" : "偏少",
      text:
        sleepCount > 0
          ? `记录到了 ${sleepCount} 次休息片段，整体节奏看起来比较自然。`
          : "今天没有明显睡觉记录，可能是采样时段主要落在活动状态。",
    },
    {
      name: "可见度与提醒",
      score: attentionCount > 0 || hiddenCount > 0 ? "需留意" : "顺畅",
      text:
        attentionCount > 0
          ? `今天有 ${attentionCount} 条记录值得优先回看。`
          : hiddenCount > 0
            ? `今天有 ${hiddenCount} 次不在画面或暂时看不清，摄像头视角可以继续优化。`
            : "今天记录整体顺畅，没有明显异常提醒。",
    },
  ];
}

function relativeEvidenceImage(framePath: string): string {
  const filename = path.basename(framePath);
  if (!filename) {
    return "";
  }

  return `../frames/${filename.replace(/\\/g, "/")}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
