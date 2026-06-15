const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Управление окном
  minimize:       ()      => ipcRenderer.send('minimize-window'),
  close:          ()      => ipcRenderer.send('close-window'),
  setAlwaysOnTop: (flag)  => ipcRenderer.send('set-always-on-top', flag),
  setOpacity:     (val)   => ipcRenderer.send('set-opacity', val),
  openLogs:       ()      => ipcRenderer.send('open-logs'),
  openSettings:   ()      => ipcRenderer.send('open-settings'),
  openExternal:   (url)   => ipcRenderer.send('open-external', url),
  getVersion:     ()      => ipcRenderer.invoke('get-version'),
  platform:       process.platform,

  // Обновления
  checkForUpdates: ()      => ipcRenderer.send('check-for-updates'),
  downloadUpdate:  ()      => ipcRenderer.send('download-update'),
  installUpdate:   ()      => ipcRenderer.send('install-update'),
  onUpdateStatus:  (cb)    => ipcRenderer.on('update-status', (_, payload) => cb(payload)),

  // Настройки
  saveStratzToken: (token) => ipcRenderer.send('save-stratz-token', token),
  saveSettings:    (s)     => ipcRenderer.send('save-settings', s),
  onAppVersion:    (cb)    => ipcRenderer.on('app-version', (_, v) => cb(v)),

  // Логи
  onLog:        (cb) => ipcRenderer.on('log',         (_, entry)   => cb(entry)),
  onLogHistory: (cb) => ipcRenderer.on('log-history', (_, entries) => cb(entries)),
  onLogBadge:   (cb) => ipcRenderer.on('log-badge',   ()           => cb()),
});
