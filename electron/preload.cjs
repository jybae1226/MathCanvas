const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mathCanvas", {
  openProject: () => ipcRenderer.invoke("project:open"),
  saveFile: (kind, content) =>
    ipcRenderer.invoke("file:save", { kind, content }),
});
