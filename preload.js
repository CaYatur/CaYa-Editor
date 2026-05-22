const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  openFileInBrowser: (filePath) => ipcRenderer.invoke('open-file-in-browser', filePath),
  loadAppSettings: () => ipcRenderer.invoke('app-settings-load'),
  saveAppSettings: (payload) => ipcRenderer.invoke('app-settings-save', payload),
  logAppEvent: (payload) => ipcRenderer.send('app-log-event', payload),

  // Directory operations
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  trustDirectory: (dirPath) => ipcRenderer.invoke('trust-directory', dirPath),
  isTrusted: (dirPath) => ipcRenderer.invoke('is-trusted', dirPath),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  watchProjectTree: (dirPath) => ipcRenderer.invoke('watch-project-tree', dirPath),
  unwatchProjectTree: () => ipcRenderer.invoke('unwatch-project-tree'),
  onProjectTreeChanged: (callback) => ipcRenderer.on('project-tree-changed', (event, payload) => callback(payload)),
  removeProjectTreeChangedListeners: () => ipcRenderer.removeAllListeners('project-tree-changed'),

  // File operations
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  createFile: (filePath, content) => ipcRenderer.invoke('create-file', filePath, content),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  deleteFileSilent: (filePath) => ipcRenderer.invoke('delete-file-silent', filePath),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),

  // Path operations
  pathJoin: (...parts) => ipcRenderer.invoke('path-join', ...parts),
  pathBasename: (filePath) => ipcRenderer.invoke('path-basename', filePath),
  pathDirname: (filePath) => ipcRenderer.invoke('path-dirname', filePath),
  pathRelative: (from, to) => ipcRenderer.invoke('path-relative', from, to),
  pathResolve: (...parts) => ipcRenderer.invoke('path-resolve', ...parts),
  isPathSafe: (filePath, projectDir) => ipcRenderer.invoke('is-path-safe', filePath, projectDir),

  // Ollama
  ollamaListModels: (providerConfig) => ipcRenderer.invoke('ollama-list-models', providerConfig),
  ollamaChat: (params) => ipcRenderer.invoke('ollama-chat', params),
  ollamaChatSync: (params) => ipcRenderer.invoke('ollama-chat-sync', params),
  ollamaGenerate: (params) => ipcRenderer.invoke('ollama-generate', params),
  ollamaAbort: (requestId) => ipcRenderer.invoke('ollama-abort', requestId),
  onOllamaStream: (callback) => ipcRenderer.on('ollama-stream', (event, data) => callback(data)),
  removeOllamaStreamListeners: () => ipcRenderer.removeAllListeners('ollama-stream'),

  // DevTools helpers
  openDevTools: () => ipcRenderer.send('open-devtools'),
  openDevToolsAndInspect: (x, y) => ipcRenderer.send('open-devtools-inspect', x, y),

  // Terminal
  terminalCreate: (cwd) => ipcRenderer.invoke('terminal-create', cwd),
  terminalInput: (data) => ipcRenderer.send('terminal-input', data),
  terminalResize: (size) => ipcRenderer.send('terminal-resize', size),
  terminalKill: () => ipcRenderer.invoke('terminal-kill'),
  onTerminalData: (callback) => ipcRenderer.on('terminal-data', (event, data) => callback(data)),
  onTerminalExit: (callback) => ipcRenderer.on('terminal-exit', (event, code) => callback(code)),
  removeTerminalListeners: () => {
    ipcRenderer.removeAllListeners('terminal-data');
    ipcRenderer.removeAllListeners('terminal-exit');
  },

  // Menu events
  onMenuSave: (callback) => ipcRenderer.on('menu-save', () => callback()),
  onProjectDirectorySelected: (callback) => ipcRenderer.on('project-directory-selected', (event, dir) => callback(dir))
});
