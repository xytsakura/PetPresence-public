const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petPresence", {
  getBootstrapData: () => ipcRenderer.invoke("desktop:get-bootstrap-data"),
  triggerObserve: (action) => ipcRenderer.invoke("desktop:trigger-observe", action),
  askTodayQuestion: (question) => ipcRenderer.invoke("desktop:ask-today-question", question),
  setWindowMode: (mode) => ipcRenderer.invoke("desktop:set-window-mode", mode),
  setPetScale: (scale) => ipcRenderer.invoke("desktop:set-pet-scale", scale),
  beginWindowDrag: () => ipcRenderer.invoke("desktop:begin-window-drag"),
  setWindowPosition: (x, y) => ipcRenderer.invoke("desktop:set-window-position", x, y),
  showContextMenu: () => ipcRenderer.invoke("desktop:show-context-menu"),
  onCommand: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("desktop:command", listener);
    return () => ipcRenderer.removeListener("desktop:command", listener);
  },
  onLocalEvent: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("desktop:local-event", listener);
    return () => ipcRenderer.removeListener("desktop:local-event", listener);
  },
  onNotice: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("desktop:notice", listener);
    return () => ipcRenderer.removeListener("desktop:notice", listener);
  }
});
