const state = {
  config: null,
  ws: null,
  reconnectTimer: null,
  connected: false,
  paused: false,
  activeAction: "idle",
  recentEvents: [],
  qaBusy: false,
  petScale: 1
};

const appEl = document.getElementById("app");
const bubbleEl = document.getElementById("bubble");
const petStageEl = document.getElementById("petStage");
const petVisualEl = document.getElementById("petVisual");
const videoEl = document.getElementById("petVideo");
const fallbackEl = document.getElementById("petFallback");
const actionMarkEl = document.getElementById("actionMark");
const panelEl = document.getElementById("eventPanel");
const panelTitleEl = document.getElementById("panelTitle");
const eventListEl = document.getElementById("eventList");
const qaPanelEl = document.getElementById("qaPanel");
const qaMessagesEl = document.getElementById("qaMessages");
const qaFormEl = document.getElementById("qaForm");
const qaInputEl = document.getElementById("qaInput");
const qaSubmitEl = document.getElementById("qaSubmit");
const qaCloseButton = document.getElementById("closeQaPanel");
const closePanelButton = document.getElementById("closePanel");
const menuButton = document.getElementById("menuButton");

const PET_LAYOUT = {
  minScale: 0.7,
  maxScale: 2.4,
  baseStageWidth: 260,
  baseStageHeight: 310,
  baseVisualWidth: 220,
  baseVisualHeight: 250,
  defaultScale: 1
};

function syncPetScaleToMain(scale) {
  window.clearTimeout(syncPetScaleToMain.timer);
  syncPetScaleToMain.timer = window.setTimeout(() => {
    window.petPresence.setPetScale(scale).catch(() => {});
  }, 40);
}

function normalizeAction(action) {
  const requested = String(action || "").trim();
  if (requested && state.config?.assets?.[requested]) {
    return requested;
  }
  if (requested === "idle" && state.config?.assets?.[state.config?.idle_action]) {
    return state.config.idle_action;
  }
  return state.config?.default_action || "idle";
}

function currentAsset(action) {
  return state.config?.assets?.[action] || null;
}

function idleAction() {
  return normalizeAction(state.config?.idle_action || state.config?.default_action || "idle");
}

function showBubble(message) {
  if (!message) return;
  bubbleEl.textContent = message;
  bubbleEl.hidden = false;
  window.clearTimeout(showBubble.timer);
  showBubble.timer = window.setTimeout(() => {
    bubbleEl.hidden = true;
  }, 5200);
}

function applyPetScale(scale) {
  const next = Math.min(PET_LAYOUT.maxScale, Math.max(PET_LAYOUT.minScale, scale));
  const stageWidth = Math.round(PET_LAYOUT.baseStageWidth * next);
  const stageHeight = Math.round(PET_LAYOUT.baseStageHeight * next);
  const visualWidth = Math.round(PET_LAYOUT.baseVisualWidth * next);
  const visualHeight = Math.round(PET_LAYOUT.baseVisualHeight * next);
  state.petScale = next;
  appEl.style.setProperty("--pet-scale", String(next));
  petStageEl.style.setProperty("--pet-stage-width", `${stageWidth}px`);
  petStageEl.style.setProperty("--pet-stage-height", `${stageHeight}px`);
  petVisualEl.style.setProperty("--pet-visual-width", `${visualWidth}px`);
  petVisualEl.style.setProperty("--pet-visual-height", `${visualHeight}px`);
  window.localStorage.setItem("petpresence.petScale", String(next));
  syncPetScaleToMain(next);
}

function adjustPetScale(delta) {
  applyPetScale(Math.round((state.petScale + delta) * 100) / 100);
}

function resetPetScale() {
  applyPetScale(PET_LAYOUT.defaultScale);
  showBubble("已恢复默认大小。");
}

function installPetDragging() {
  let dragState = null;

  petVisualEl.addEventListener("pointerdown", async (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const startWindow = await window.petPresence.beginWindowDrag();
    dragState = {
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      startWindowX: startWindow?.x || 0,
      startWindowY: startWindow?.y || 0
    };
    petVisualEl.classList.add("dragging");
    petVisualEl.setPointerCapture(event.pointerId);
  });

  petVisualEl.addEventListener("pointermove", (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const deltaX = event.screenX - dragState.startScreenX;
    const deltaY = event.screenY - dragState.startScreenY;
    window.petPresence.setWindowPosition(dragState.startWindowX + deltaX, dragState.startWindowY + deltaY);
  });

  function finishDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    if (petVisualEl.hasPointerCapture(event.pointerId)) {
      petVisualEl.releasePointerCapture(event.pointerId);
    }
    petVisualEl.classList.remove("dragging");
    dragState = null;
  }

  petVisualEl.addEventListener("pointerup", finishDrag);
  petVisualEl.addEventListener("pointercancel", finishDrag);
}

function setAction(action, event = null, options = {}) {
  const requestedAction = String(action || "idle");
  const isIdleMode = requestedAction === "idle";
  const displayAction = isIdleMode ? idleAction() : normalizeAction(requestedAction);
  const holdAction = Boolean(options.hold ?? event?.routed_action);

  state.activeAction = isIdleMode ? "idle" : displayAction;
  appEl.dataset.action = displayAction;
  actionMarkEl.textContent = isIdleMode ? `idle:${displayAction}` : displayAction;

  const asset = currentAsset(displayAction);
  const hasVideoAsset = asset?.file_url && ["webm", "mp4", "gif"].includes(asset.type);
  const useVideo = Boolean(hasVideoAsset);

  videoEl.pause();
  videoEl.classList.toggle("active", Boolean(useVideo));
  videoEl.classList.toggle("nontransparent", Boolean(useVideo && asset.transparent_background === false));
  fallbackEl.classList.toggle("hidden", Boolean(useVideo));

  if (useVideo) {
    videoEl.loop = isIdleMode || holdAction || Boolean(asset.loop);
    if (videoEl.src !== asset.file_url) {
      videoEl.src = asset.file_url;
    }
    videoEl.currentTime = 0;
    videoEl.play().catch(() => {
      videoEl.classList.remove("active");
      fallbackEl.classList.remove("hidden");
    });
  }

  if (event?.owner_message) {
    showBubble(event.owner_message);
  } else if (asset?.fallback_message) {
    showBubble(asset.fallback_message);
  }

  window.clearTimeout(setAction.returnTimer);
  if (!isIdleMode && !holdAction && !asset?.loop) {
    const duration = Number(asset?.duration_ms || 2600);
    setAction.returnTimer = window.setTimeout(() => setAction("idle"), duration);
  }
}

function rememberEvent(event) {
  if (event.event_id && state.recentEvents.some((known) => known.event_id === event.event_id)) {
    return;
  }

  state.recentEvents.unshift(event);
  state.recentEvents = state.recentEvents.slice(0, 20);
}

function handleEvent(event, source = "stream") {
  if (!event || event.pet_id !== state.config.pet_id) {
    return;
  }

  rememberEvent({ ...event, _source: source });

  if (state.paused) {
    showBubble("陪伴已暂停，事件已记录。");
    refreshOpenPanel();
    return;
  }

  setAction(event.routed_action, event);
  refreshOpenPanel();
}

function connectWebSocket() {
  if (!state.config?.event_server?.ws_url) return;

  window.clearTimeout(state.reconnectTimer);

  try {
    state.ws = new WebSocket(state.config.event_server.ws_url);
  } catch (error) {
    scheduleReconnect();
    return;
  }

  state.ws.addEventListener("open", () => {
    state.connected = true;
  });

  state.ws.addEventListener("message", (message) => {
    try {
      const payload = JSON.parse(message.data);
      if (payload?.type === "connected") {
        return;
      }
      handleEvent(payload?.event || payload, "ws");
    } catch (error) {
      showBubble("收到了一条无法解析的事件。");
    }
  });

  state.ws.addEventListener("close", () => {
    state.connected = false;
    scheduleReconnect();
  });

  state.ws.addEventListener("error", () => {
    state.ws.close();
  });
}

function scheduleReconnect() {
  window.clearTimeout(state.reconnectTimer);
  state.reconnectTimer = window.setTimeout(connectWebSocket, 3500);
}

async function fetchTodayEvents() {
  const base = state.config?.event_server?.http_base;
  if (!base) return [];

  const url = `${base}/events/today?pet_id=${encodeURIComponent(state.config.pet_id)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload.events || [];
}

function formatTime(timestamp) {
  if (!timestamp) return "--:--";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function renderPanel(title, events) {
  panelTitleEl.textContent = title;
  eventListEl.hidden = false;
  qaPanelEl.hidden = true;
  window.petPresence.setWindowMode("compact");
  eventListEl.replaceChildren();

  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "event-item";
    empty.textContent = "暂无事件。";
    eventListEl.append(empty);
    panelEl.hidden = false;
    return;
  }

  events.forEach((event) => {
    const item = document.createElement("article");
    item.className = "event-item";
    item.innerHTML = `
      <div class="event-row">
        <span class="event-action"></span>
        <span class="event-time"></span>
      </div>
      <div class="event-message"></div>
      <div class="event-summary"></div>
    `;
    item.querySelector(".event-action").textContent = event.routed_action || "idle";
    item.querySelector(".event-time").textContent = formatTime(event.timestamp);
    item.querySelector(".event-message").textContent = event.owner_message || "无气泡消息";
    item.querySelector(".event-summary").textContent = event.visual_summary || "无观察摘要";
    eventListEl.append(item);
  });

  panelEl.hidden = false;
}

function refreshOpenPanel() {
  if (panelEl.hidden || eventListEl.hidden) {
    return;
  }

  renderPanel(panelTitleEl.textContent || "最近事件", state.recentEvents);
}

async function showTodayPanel() {
  try {
    const events = await fetchTodayEvents();
    events.forEach((event) => {
      if (!state.recentEvents.find((known) => known.event_id === event.event_id)) {
        rememberEvent(event);
      }
    });
    renderPanel("今日记录", events);
  } catch (error) {
    renderPanel("今日记录", state.recentEvents);
    showBubble("今日记录暂时连不上。");
  }
}

function showEvidencePanel() {
  const withEvidence = state.recentEvents.filter((event) => event.evidence_frames?.length);
  renderPanel("最近截图", withEvidence.length ? withEvidence : state.recentEvents.slice(0, 3));
}

function showQaPanel() {
  panelEl.hidden = true;
  qaPanelEl.hidden = false;
  window.petPresence.setWindowMode("qa");

  if (!qaMessagesEl.children.length) {
    addQaMessage("assistant", "可以问我：今天小白在做什么？有没有需要我注意的事？");
  }

  window.setTimeout(() => qaInputEl.focus(), 0);
}

function addQaMessage(role, text, meta = "") {
  const item = document.createElement("div");
  item.className = `qa-message ${role}`;
  item.textContent = text;

  if (meta) {
    const metaEl = document.createElement("div");
    metaEl.className = "qa-meta";
    metaEl.textContent = meta;
    item.append(metaEl);
  }

  qaMessagesEl.append(item);
  qaMessagesEl.scrollTop = qaMessagesEl.scrollHeight;
  return item;
}

function setQaBusy(busy) {
  state.qaBusy = busy;
  qaInputEl.disabled = busy;
  qaSubmitEl.disabled = busy;
  qaSubmitEl.textContent = busy ? "生成中" : "发送";
}

async function submitQaQuestion() {
  const question = qaInputEl.value.trim();
  if (!question || state.qaBusy) {
    return;
  }

  qaInputEl.value = "";
  addQaMessage("user", question);
  const pending = addQaMessage("assistant pending", "正在读取今日记录...");
  setQaBusy(true);

  try {
    const result = await window.petPresence.askTodayQuestion(question);
    pending.className = "qa-message assistant";
    pending.textContent = result.answer || "今天的记录里还没有足够信息回答这个问题。";
    if (typeof result.event_count === "number") {
      const metaEl = document.createElement("div");
      metaEl.className = "qa-meta";
      metaEl.textContent = `基于 ${result.event_count} 条今日记录`;
      pending.append(metaEl);
    }
  } catch (error) {
    pending.className = "qa-message assistant";
    pending.textContent = error.message || "今日问答暂时不可用。";
    showBubble("今日问答暂时不可用。");
  } finally {
    setQaBusy(false);
    qaInputEl.focus();
  }
}

function togglePaused() {
  state.paused = !state.paused;
  showBubble(state.paused ? "陪伴已暂停。" : "陪伴已恢复。");
}

function handleCommand(command) {
  if (!command) return;

  if (command.type === "manual-action") {
    setAction(command.action, {
      pet_id: state.config.pet_id,
      routed_action: command.action,
      owner_message: currentAsset(command.action)?.fallback_message
    });
  }

  if (command.type === "show-today") {
    showTodayPanel();
  }

  if (command.type === "show-qa") {
    showQaPanel();
  }

  if (command.type === "show-evidence") {
    showEvidencePanel();
  }

  if (command.type === "toggle-paused") {
    togglePaused();
  }
}

async function boot() {
  state.config = await window.petPresence.getBootstrapData();
  const savedScale = Number(window.localStorage.getItem("petpresence.petScale") || "1");
  applyPetScale(Number.isFinite(savedScale) ? savedScale : 1);
  setAction("idle");
  connectWebSocket();

  window.petPresence.onCommand(handleCommand);
  window.petPresence.onLocalEvent((event) => handleEvent(event, "local"));
  window.petPresence.onNotice((notice) => showBubble(notice.message));
  installPetDragging();

  closePanelButton.addEventListener("click", () => {
    panelEl.hidden = true;
  });

  qaCloseButton.addEventListener("click", () => {
    qaPanelEl.hidden = true;
    window.petPresence.setWindowMode("compact");
  });

  qaFormEl.addEventListener("submit", (event) => {
    event.preventDefault();
    submitQaQuestion();
  });

  qaInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitQaQuestion();
    }
  });

  petVisualEl.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const direction = event.deltaY < 0 ? 0.1 : -0.1;
      adjustPetScale(direction);
    },
    { passive: false }
  );

  petVisualEl.addEventListener("dblclick", () => {
    resetPetScale();
  });

  menuButton.addEventListener("click", () => {
    window.petPresence.showContextMenu();
  });

  videoEl.addEventListener("ended", () => {
    if (state.activeAction !== "idle" && !videoEl.loop) {
      setAction("idle");
    }
  });
}

boot().catch((error) => {
  showBubble(error.message || "桌宠启动失败。");
});
