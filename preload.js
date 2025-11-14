const { contextBridge, ipcRenderer } = require('electron');

// Expõe funções seguras para o "mundo" do seu HTML (o Renderer Process)
contextBridge.exposeInMainWorld(
    'api',
    {
        run: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
        all: (sql, params) => ipcRenderer.invoke('db:all', sql, params),

        printContrato: (dados) => ipcRenderer.invoke('print-contract', dados),
        printAnamnese: (dados) => ipcRenderer.invoke('print-anamnese', dados),

        minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
        maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
        closeWindow: () => ipcRenderer.invoke('window-close'),
        onWindowMaximized: (callback) => ipcRenderer.on('window-maximized', (event, value) => callback(value)),
        loadMainWindow: () => ipcRenderer.invoke('load-main-window'),

        exportarBackup: () => ipcRenderer.invoke('exportar-backup')
    }
);