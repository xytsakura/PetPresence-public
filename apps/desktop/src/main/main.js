const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const appRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(appRoot, "../..");
const defaultPetId = resolvePetId();
const WINDOW_MODES = {
  compact: {
    baseWidth: 260,
    baseHeight: 360,
    minWidth: 220,
    minHeight: 280,
    maxWidth: 540,
    maxHeight: 760
  },
  qa: {
    baseWidth: 300,
    baseHeight: 520,
    minWidth: 270,
    minHeight: 430,
    maxWidth: 580,
    maxHeight: 920
  }
};

let mainWindow;
let currentWindowMode = "compact";
let currentPetScale = 1;

function resolvePetId() {
  const args = process.argv.slice(1);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--pet-id" && args[index + 1]) {
      return sanitizePetId(args[index + 1]);
    }
    if (arg && arg.startsWith("--pet-id=")) {
      return sanitizePetId(arg.slice("--pet-id=".length));
    }
  }

  return sanitizePetId(process.env.PETPRESENCE_PET_ID || "pet_demo");
}

function sanitizePetId(value) {
  const petId = String(value || "").trim();
  if (/^[A-Za-z0-9_-]+$/.test(petId)) {
    return petId;
  }
  return "pet_demo";
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function getActionAssets() {
  const configPath = path.join(repoRoot, "data", "pets", defaultPetId, "action_assets.json");
  const fallback = {
    pet_id: defaultPetId,
    default_action: "idle",
    idle_action: "idle",
    event_server: {
      http_base: "http://127.0.0.1:4317",
      ws_url: `ws://127.0.0.1:4317/events/stream?pet_id=${defaultPetId}`
    },
    observer: {
      mock_url: "http://127.0.0.1:3002/observe/mock",
      current_url: "http://127.0.0.1:3002/observe/current",
      qa_url: "http://127.0.0.1:3002/qa/today"
    },
    assets: {}
  };

  const rawConfig = readJson(configPath, fallback);
  const assets = Object.fromEntries(
    Object.entries(rawConfig.assets || {}).map(([action, asset]) => {
      const configuredPath = asset.path || "";
      const absolutePath = configuredPath ? path.resolve(repoRoot, configuredPath) : "";
      const exists = absolutePath ? fs.existsSync(absolutePath) : false;

      return [
        action,
        {
          ...asset,
          action,
          absolute_path: absolutePath || null,
          file_url: exists ? pathToFileURL(absolutePath).toString() : null,
          available: exists
        }
      ];
    })
  );

  return {
    ...fallback,
    ...rawConfig,
    event_server: {
      ...fallback.event_server,
      ...(rawConfig.event_server || {})
    },
    observer: {
      ...fallback.observer,
      ...(rawConfig.observer || {})
    },
    assets,
    config_path: configPath,
    repo_root: repoRoot
  };
}

function getConfiguredActions(config = getActionAssets()) {
  const assets = config.assets || {};
  const configured = Object.keys(assets).filter((action) => assets[action]?.available);
  const preferred = [config.default_action, config.idle_action, "idle"].filter(Boolean);
  const ordered = [];

  for (const action of [...preferred, ...configured]) {
    if (!ordered.includes(action) && assets[action]) {
      ordered.push(action);
    }
  }

  return ordered.length ? ordered : ["idle"];
}

function resolveConfiguredAction(action, config = getActionAssets()) {
  const requested = String(action || "").trim();
  const actions = getConfiguredActions(config);

  if (requested && config.assets?.[requested]) {
    return requested;
  }

  if (requested === "idle" && config.assets?.[config.idle_action]) {
    return config.idle_action;
  }

  return actions[0] || "idle";
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function buildMockEvent(action = "eat") {
  const config = getActionAssets();
  const routedAction = resolveConfiguredAction(action, config);
  const asset = config.assets?.[routedAction] || {};
  const ownerMessage = asset.fallback_message || "我在这里~";
  const visualSummary = `本地演示：切换到 ${routedAction} 动作。`;

  return {
    schema_version: "1.0",
    event_id: `evt_desktop_${Date.now()}`,
    pet_id: defaultPetId,
    timestamp: new Date().toISOString(),
    trigger_type: "demo",
    routed_action: routedAction,
    confidence: 0.99,
    visual_summary: visualSummary,
    owner_message: ownerMessage,
    alert_level: routedAction === "alert" ? "warning" : "normal",
    evidence_frames: [],
    needs_owner_attention: routedAction === "alert"
  };
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  const body = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const detail = body?.errors?.length ? `: ${body.errors.join("；")}` : "";
    throw new Error(`${response.status} ${response.statusText}${detail}`);
  }

  return body;
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
}

async function triggerMockObserve(action = "eat") {
  const config = getActionAssets();
  const routedAction = resolveConfiguredAction(action, config);
  const event = buildMockEvent(routedAction);

  try {
    await postJson(config.observer.mock_url, {
      pet_id: defaultPetId,
      action: routedAction,
      routed_action: routedAction
    });
    return;
  } catch (observerError) {
    try {
      const postedEvent = await postJson(`${config.event_server.http_base}/events`, event);
      sendToRenderer("desktop:local-event", postedEvent?.event || event);
      return;
    } catch (eventServerError) {
      sendToRenderer("desktop:notice", {
        type: "warn",
        message: "event-server 未连接，使用本地演示事件。"
      });
      sendToRenderer("desktop:local-event", event);
    }
  }
}

async function triggerCurrentObserve(triggerType = "manual_check") {
  const config = getActionAssets();

  try {
    sendToRenderer("desktop:notice", { type: "info", message: "正在查看小白最近 5 秒..." });
    const result = await postJson(config.observer.current_url, {
      pet_id: defaultPetId,
      trigger_type: triggerType
    });

    if (result?.post_result?.ok) {
      sendToRenderer("desktop:notice", { type: "ok", message: "已根据视频快照更新状态。" });
      return;
    }

    if (result?.event) {
      sendToRenderer("desktop:local-event", result.event);
    }
    sendToRenderer("desktop:notice", {
      type: result?.fallback ? "warn" : "ok",
      message: result?.fallback ? "观察结果使用兜底事件。" : "已生成观察事件。"
    });
  } catch (error) {
    await triggerMockObserve();
  }
}

async function askTodayQuestion(question) {
  const config = getActionAssets();
  const trimmed = String(question || "").trim();

  if (!trimmed) {
    throw new Error("请输入问题。");
  }

  const response = await postJson(config.observer.qa_url, {
    pet_id: defaultPetId,
    question: trimmed
  });

  if (!response?.ok) {
    const errors = Array.isArray(response?.errors) ? response.errors.join("；") : "今日问答失败。";
    throw new Error(errors);
  }

  return response;
}

async function openTodayReport() {
  const date = todayLocalDate();
  const existingPath = path.join(
    repoRoot,
    "data",
    "pets",
    defaultPetId,
    "reports",
    `daily_${date}.html`
  );
  const result = fs.existsSync(existingPath)
    ? { reportPath: existingPath }
    : await runReportHtmlScript(date);
  const openError = await shell.openPath(result.reportPath);

  if (openError) {
    throw new Error(`日报已生成，但打开失败：${openError}`);
  }

  sendToRenderer("desktop:notice", {
    type: "ok",
    message: "已打开今日日报。"
  });

  return result;
}

function runReportHtmlScript(date) {
  return new Promise((resolve, reject) => {
    const command = `npm.cmd run report:html -- --date ${date}`;
    const child = spawn(
      process.env.ComSpec || "cmd.exe",
      ["/d", "/s", "/c", command],
      {
        cwd: repoRoot,
        windowsHide: true,
        shell: false
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `report:html exited with code ${code}`));
        return;
      }

      try {
        const parsed = extractJsonObject(stdout);
        resolve(parsed);
      } catch (error) {
        reject(new Error(`无法解析日报生成结果：${stdout.trim() || stderr.trim()}`));
      }
    });
  });
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  const start = trimmed.lastIndexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("JSON payload not found");
  }

  return JSON.parse(trimmed.slice(start, end + 1));
}

function todayLocalDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function showDesktopMenu() {
  const config = getActionAssets();
  const actions = getConfiguredActions(config);
  const template = [
    {
      label: "看看现在",
      click: () => triggerCurrentObserve("manual_check")
    },
    {
      label: "heartbeat 观察",
      click: () => triggerCurrentObserve("heartbeat")
    },
    {
      label: "按钮事件模拟",
      click: () => triggerCurrentObserve("pet_button")
    },
    {
      label: "今日记录",
      click: () => sendToRenderer("desktop:command", { type: "show-today" })
    },
    {
      label: "今日问答",
      click: () => sendToRenderer("desktop:command", { type: "show-qa" })
    },
    {
      label: "今日日报",
      click: () => {
        openTodayReport().catch((error) => {
          sendToRenderer("desktop:notice", {
            type: "warn",
            message: error.message || "今日日报生成失败。"
          });
        });
      }
    },
    {
      label: "最近截图",
      click: () => sendToRenderer("desktop:command", { type: "show-evidence" })
    },
    { type: "separator" },
    {
      label: "暂停/恢复陪伴",
      click: () => sendToRenderer("desktop:command", { type: "toggle-paused" })
    },
    {
      label: "手动切换 action",
      submenu: actions.map((action) => ({
        label: action,
        click: () => sendToRenderer("desktop:command", { type: "manual-action", action })
      }))
    },
    { type: "separator" },
    {
      label: "退出",
      role: "quit"
    }
  ];

  Menu.buildFromTemplate(template).popup({ window: mainWindow });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getWindowSizeForMode(mode = "compact", scale = currentPetScale) {
  const next = WINDOW_MODES[mode] || WINDOW_MODES.compact;
  const normalizedScale = clamp(Number(scale) || 1, 0.7, 2.4);
  const width = clamp(Math.round(next.baseWidth * normalizedScale), next.minWidth, next.maxWidth);
  const height = clamp(Math.round(next.baseHeight * normalizedScale), next.minHeight, next.maxHeight);
  return { ...next, width, height };
}

function setWindowMode(mode = "compact") {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  currentWindowMode = WINDOW_MODES[mode] ? mode : "compact";
  const next = getWindowSizeForMode(currentWindowMode, currentPetScale);
  mainWindow.setMinimumSize(next.minWidth, next.minHeight);
  mainWindow.setSize(next.width, next.height, true);
}

function setPetScale(scale) {
  currentPetScale = clamp(Number(scale) || 1, 0.7, 2.4);
  setWindowMode(currentWindowMode);
}

function beginWindowDrag() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { x: 0, y: 0 };
  }

  const [x, y] = mainWindow.getPosition();
  return { x, y };
}

function setWindowPosition(x, y) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.setPosition(Math.round(Number(x) || 0), Math.round(Number(y) || 0), true);
}

function createWindow() {
  const initialSize = getWindowSizeForMode(currentWindowMode, currentPetScale);
  mainWindow = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    minWidth: initialSize.minWidth,
    minHeight: initialSize.minHeight,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.loadFile(path.join(appRoot, "src", "renderer", "index.html"));

  mainWindow.webContents.on("context-menu", () => {
    showDesktopMenu();
  });
}

ipcMain.handle("desktop:get-bootstrap-data", () => getActionAssets());
ipcMain.handle("desktop:trigger-observe", (_event, action) => triggerMockObserve(action || "eat"));
ipcMain.handle("desktop:ask-today-question", (_event, question) => askTodayQuestion(question));
ipcMain.handle("desktop:set-window-mode", (_event, mode) => setWindowMode(String(mode || "compact")));
ipcMain.handle("desktop:set-pet-scale", (_event, scale) => setPetScale(scale));
ipcMain.handle("desktop:begin-window-drag", () => beginWindowDrag());
ipcMain.handle("desktop:set-window-position", (_event, x, y) => setWindowPosition(x, y));
ipcMain.handle("desktop:open-today-report", () => openTodayReport());
ipcMain.handle("desktop:show-context-menu", () => showDesktopMenu());

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
