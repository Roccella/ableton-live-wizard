const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wizardDesktop", {
  bootstrap: () => ipcRenderer.invoke("wizard:bootstrap"),
  submitPrompt: (input) => ipcRenderer.invoke("wizard:submit-prompt", input),
  chooseOption: (optionId) => ipcRenderer.invoke("wizard:choose-option", optionId),
});
