const {
  app, BrowserWindow, ipcMain, screen,
  globalShortcut, Tray, Menu, nativeImage, shell
} = require('electron');
const path    = require('path');
const { fork } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow   = null;
let logsWindow   = null;
let settingsWindow = null;
let tray         = null;
let gsiProcess   = null;
const isDev = !app.isPackaged;

// ─── Лог-буфер ───────────────────────────────────────────────────────────────
const logBuffer = [];
function pushLog(level, text) {
  const entry = { level, text, time: new Date().toLocaleTimeString('ru-RU') };
  logBuffer.push(entry);
  if (logBuffer.length > 500) logBuffer.shift();
  logsWindow?.webContents?.send('log', entry);
  mainWindow?.webContents?.send('log-badge');
}
const _log = console.log.bind(console);
const _err = console.error.bind(console);
console.log   = (...a) => { _log(...a);  pushLog('info',  a.join(' ')); };
console.error = (...a) => { _err(...a);  pushLog('error', a.join(' ')); };

// ─── Автообновление ───────────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload    = false;   // скачиваем только по запросу
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    pushLog('info', '🔍 Проверяем обновления...');
    settingsWindow?.webContents?.send('update-status', { status: 'checking' });
    mainWindow?.webContents?.send('update-status',     { status: 'checking' });
  });

  autoUpdater.on('update-available', info => {
    pushLog('info', `⬆ Доступно обновление: v${info.version}`);
    const payload = { status: 'available', version: info.version, notes: info.releaseNotes };
    settingsWindow?.webContents?.send('update-status', payload);
    mainWindow?.webContents?.send('update-status',     payload);
  });

  autoUpdater.on('update-not-available', () => {
    pushLog('info', '✓ Установлена последняя версия');
    const payload = { status: 'latest', version: app.getVersion() };
    settingsWindow?.webContents?.send('update-status', payload);
    mainWindow?.webContents?.send('update-status',     payload);
  });

  autoUpdater.on('download-progress', prog => {
    const p = Math.round(prog.percent);
    pushLog('info', `⬇ Загрузка обновления: ${p}%`);
    const payload = { status: 'downloading', percent: p, speed: Math.round(prog.bytesPerSecond / 1024) };
    settingsWindow?.webContents?.send('update-status', payload);
    mainWindow?.webContents?.send('update-status',     payload);
  });

  autoUpdater.on('update-downloaded', info => {
    pushLog('info', `✅ Обновление v${info.version} загружено — готово к установке`);
    const payload = { status: 'downloaded', version: info.version };
    settingsWindow?.webContents?.send('update-status', payload);
    mainWindow?.webContents?.send('update-status',     payload);
  });

  autoUpdater.on('error', err => {
    pushLog('error', `Ошибка обновления: ${err.message}`);
    const payload = { status: 'error', message: err.message };
    settingsWindow?.webContents?.send('update-status', payload);
    mainWindow?.webContents?.send('update-status',     payload);
  });

  // Проверяем при старте через 5 сек (не сразу чтобы окно успело открыться)
  if (!isDev) {
    setTimeout(() => autoUpdater.checkForUpdates(), 5000);
  }
}

// ─── GSI сервер ───────────────────────────────────────────────────────────────
function startGSIServer() {
  pushLog('info', '▶ Запуск GSI сервера...');
  const serverPath = isDev
    ? path.join(__dirname, '../gsi-server/server.js')
    : path.join(process.resourcesPath, 'app/gsi-server/server.js');

  gsiProcess = fork(serverPath, [], {
    env: { ...process.env, USER_ENV_PATH: path.join(app.getPath('userData'), '.env') },
    silent: true
  });
  gsiProcess.stdout.on('data', d =>
    d.toString().split('\n').filter(Boolean).forEach(l => pushLog('info', l)));
  gsiProcess.stderr.on('data', d =>
    d.toString().split('\n').filter(Boolean).forEach(l => pushLog('error', l)));
  gsiProcess.on('error', err => pushLog('error', `GSI error: ${err.message}`));
  gsiProcess.on('exit',  code => pushLog('warn',  `GSI exited (${code})`));
}

// ─── Главное окно ─────────────────────────────────────────────────────────────
function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: 420, height: 720,
    x: width - 440, y: 20,
    frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: false,
    resizable: true, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    }
  });
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true);

  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else       mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  mainWindow.on('closed', () => { mainWindow = null; });
  pushLog('info', '✓ Главное окно создано');
}

// ─── Окно настроек ────────────────────────────────────────────────────────────
function createSettingsWindow() {
  if (settingsWindow) { settingsWindow.focus(); return; }

  settingsWindow = new BrowserWindow({
    width: 520, height: 580,
    title: 'Dota 2 Tracker — Настройки',
    backgroundColor: '#0a0c12',
    frame: true, resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    }
  });
  settingsWindow.setMenuBarVisibility(false);

  const fs = require('fs');
  const tmpPath = path.join(app.getPath('temp'), 'dota2tracker-settings.html');
  try {
    fs.writeFileSync(tmpPath, buildSettingsHTML(), 'utf8');
    settingsWindow.loadFile(tmpPath);
  } catch (e) {
    console.error('Не удалось записать settings.html: ' + e.message);
    settingsWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(buildSettingsHTML()));
  }

  settingsWindow.webContents.on('console-message', (e, level, message, line) => {
    if (level >= 2) console.error(`[Settings JS error] ${message} (line ${line})`);
  });

  settingsWindow.webContents.on('did-finish-load', () => {
    settingsWindow.webContents.send('app-version', app.getVersion());
  });
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function buildSettingsHTML() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Настройки</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0c12;color:#c8d0e0;font-family:'Inter',sans-serif;font-size:13px;padding:0}
.header{background:linear-gradient(135deg,#1a1f2e,#111520);padding:20px 24px;border-bottom:1px solid #1e2535}
.header h1{font-size:16px;font-weight:600;color:#e8eaf0;font-family:'Rajdhani',sans-serif;letter-spacing:.05em}
.header p{font-size:11px;color:#4a5168;margin-top:4px}
.body{padding:20px 24px;overflow-y:auto;height:calc(100vh - 90px)}
.section{margin-bottom:24px}
.section-title{font-size:10px;font-weight:700;color:#4a5168;letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #1e2535}
.card{background:#111520;border:1px solid #1e2535;border-radius:8px;padding:16px;margin-bottom:8px}
.card-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.card-label{font-size:13px;color:#c8d0e0}
.card-sub{font-size:11px;color:#4a5168;margin-top:2px}
.btn{padding:8px 18px;border-radius:6px;border:none;font-size:12px;font-weight:600;cursor:pointer;font-family:'Rajdhani',sans-serif;letter-spacing:.05em;transition:opacity .15s}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-primary{background:#6c8cff;color:#fff}
.btn-primary:hover:not(:disabled){background:#5a7aee}
.btn-green{background:#4ade80;color:#0a1a0f}
.btn-green:hover:not(:disabled){background:#3bc96e}
.btn-ghost{background:rgba(255,255,255,.07);color:#7a8299;border:1px solid #1e2535}
.btn-ghost:hover:not(:disabled){background:rgba(255,255,255,.1)}
.btn-danger{background:rgba(248,113,113,.15);color:#f87171;border:1px solid rgba(248,113,113,.3)}
.input{height:34px;padding:0 10px;background:rgba(255,255,255,.06);border:1px solid #1e2535;border-radius:6px;color:#c8d0e0;font-size:12px;outline:none;width:100%}
.input:focus{border-color:#6c8cff}
.tag{font-size:10px;padding:2px 7px;border-radius:20px;font-weight:600}
.tag-green{background:rgba(74,222,128,.12);color:#4ade80}
.tag-blue{background:rgba(108,140,255,.12);color:#6c8cff}
.tag-red{background:rgba(248,113,113,.12);color:#f87171}
.tag-gray{background:rgba(255,255,255,.07);color:#7a8299}
.progress-wrap{margin-top:10px;display:none}
.progress-bar{height:4px;background:#1e2535;border-radius:2px;overflow:hidden;margin-bottom:6px}
.progress-fill{height:100%;background:#6c8cff;border-radius:2px;transition:width .3s}
.progress-text{font-size:11px;color:#7a8299}
.notes{font-size:11px;color:#7a8299;line-height:1.6;margin-top:8px;background:rgba(255,255,255,.03);padding:8px;border-radius:6px;max-height:80px;overflow-y:auto;display:none}
.link{color:#6c8cff;font-size:11px;cursor:pointer;text-decoration:none}
.link:hover{text-decoration:underline}
.divider{height:1px;background:#1e2535;margin:8px 0}
</style>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Rajdhani:wght@600;700&display=swap" rel="stylesheet">
</head><body>
<div class="header">
  <h1>⚙ НАСТРОЙКИ</h1>
  <p id="ver-line">Dota 2 Tracker v— </p>
</div>
<div class="body">

  <!-- ОБНОВЛЕНИЯ -->
  <div class="section">
    <div class="section-title">Обновления</div>
    <div class="card">
      <div class="card-row">
        <div>
          <div class="card-label">Версия приложения</div>
          <div class="card-sub">Текущая: <span id="cur-ver">—</span> · Последняя: <span id="latest-ver">—</span></div>
        </div>
        <span id="update-tag" class="tag tag-gray">—</span>
      </div>
      <div class="divider"></div>
      <div class="card-row" style="margin-top:4px">
        <div id="update-msg" style="font-size:12px;color:#7a8299">Нажми для проверки</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost" id="check-btn" onclick="checkUpdates()">Проверить</button>
          <button class="btn btn-primary" id="download-btn" style="display:none" onclick="downloadUpdate()">Скачать</button>
          <button class="btn btn-green"  id="install-btn"  style="display:none" onclick="installUpdate()">Установить</button>
        </div>
      </div>
      <div class="progress-wrap" id="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
        <div class="progress-text" id="progress-text">0 KB/s</div>
      </div>
      <div class="notes" id="release-notes"></div>
    </div>
    <div class="card">
      <div class="card-row">
        <div>
          <div class="card-label">Авто-проверка при запуске</div>
          <div class="card-sub">Проверять обновления каждый раз при старте</div>
        </div>
        <label style="cursor:pointer;display:flex;align-items:center;gap:6px;font-size:12px;color:#7a8299">
          <input type="checkbox" id="auto-check" checked onchange="saveSettings()"> Вкл
        </label>
      </div>
    </div>
  </div>

  <!-- STEAM API -->
  <div class="section">
    <div class="section-title">Steam Web API</div>
    <div class="card">
      <div style="margin-bottom:10px">
        <div class="card-label">Steam API Key</div>
        <div class="card-sub" style="margin-top:3px">Нужен для загрузки статистики игроков во время матча (пик/игра). Бесплатно, выдаётся мгновенно.</div>
      </div>
      <div style="display:flex;gap:6px">
        <input class="input" type="password" id="steam-key" placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" style="flex:1">
        <button class="btn btn-ghost" id="show-key-btn" onclick="toggleShowKey()" title="Показать/скрыть">👁</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <div id="steam-status" style="font-size:11px;color:#7a8299">—</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost" onclick="openGetSteamKeyAuto()">1. Получить ключ</button>
          <button class="btn btn-ghost" id="paste-btn" style="display:none;background:rgba(108,140,255,0.12);color:#6c8cff;border-color:rgba(108,140,255,0.3)" onclick="pasteFromClipboard()">2. Вставить</button>
          <button class="btn btn-primary" onclick="saveSteamKey()">Проверить и сохранить</button>
        </div>
      </div>
      <div style="margin-top:10px;padding:8px;background:rgba(108,140,255,0.06);border-radius:6px;border:1px solid rgba(108,140,255,0.15)" id="steam-banner">
        <div style="font-size:10px;color:#6c8cff;font-weight:600;margin-bottom:4px">КАК ПОЛУЧИТЬ — 2 ШАГА:</div>
        <div style="font-size:11px;color:#7a8299;line-height:1.8">
          1. Нажми <b style="color:#c8d0e0">«1. Получить ключ»</b> — откроется Steam в браузере<br>
          2. Введи домен <code style="background:#1e2535;padding:1px 5px;border-radius:3px;color:#c8d0e0">localhost</code>, нажми «Зарегистрировать» → <b style="color:#4ade80">скопируй ключ (Ctrl+C)</b><br>
          3. Вернись сюда — ключ <b style="color:#6c8cff">вставится и сохранится автоматически</b> ✓
        </div>
      </div>
    </div>
  </div>

  <!-- OVERLAY -->
  <div class="section">
    <div class="section-title">Оверлей</div>
    <div class="card">
      <div class="card-row">
        <div>
          <div class="card-label">Прозрачность</div>
          <div class="card-sub" id="opacity-val">90%</div>
        </div>
        <input type="range" min="30" max="100" value="90" id="opacity-slider" style="width:120px" oninput="updateOpacity(this.value)">
      </div>
    </div>
    <div class="card">
      <div class="card-row">
        <div>
          <div class="card-label">Горячие клавиши</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;font-size:11px;color:#7a8299">
        <div><code style="background:#1e2535;padding:2px 6px;border-radius:3px;color:#c8d0e0">Alt+D</code> Показать/скрыть</div>
        <div><code style="background:#1e2535;padding:2px 6px;border-radius:3px;color:#c8d0e0">Alt+L</code> Логи</div>
        <div><code style="background:#1e2535;padding:2px 6px;border-radius:3px;color:#c8d0e0">Alt+S</code> Настройки</div>
        <div><code style="background:#1e2535;padding:2px 6px;border-radius:3px;color:#c8d0e0">Alt+Shift+D</code> Сбросить позицию</div>
      </div>
    </div>
  </div>

  <!-- ОБ ПРИЛОЖЕНИИ -->
  <div class="section">
    <div class="section-title">AI — Сборки и анализ</div>
    <div class="card">
      <div style="margin-bottom:12px">
        <div class="card-label">Провайдер AI</div>
        <div class="card-sub" style="margin-top:3px">Используется для генерации сборок и анализа матча</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px" id="provider-grid">
        ${['anthropic','openai','gemini','deepseek'].map(id => {
          const labels = { anthropic:'Claude (Anthropic)', openai:'GPT-4o (OpenAI)', gemini:'Gemini (Google)', deepseek:'DeepSeek' };
          const colors = { anthropic:'#e07a5f', openai:'#74aa9c', gemini:'#4285f4', deepseek:'#5e72e4' };
          return `<button onclick="selectProvider('${id}')" id="prov-${id}" style="padding:8px;border-radius:6px;border:1px solid #1e2535;background:rgba(255,255,255,0.04);color:#7a8299;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;text-align:left">
            <div style="width:8px;height:8px;border-radius:50%;background:${colors[id]};display:inline-block;margin-right:6px"></div>
            ${labels[id]}
          </button>`;
        }).join('')}
      </div>
      <div id="ai-key-block">
        <div style="display:flex;gap:6px;align-items:center">
          <input class="input" type="password" id="ai-key" placeholder="Вставь API ключ..." style="flex:1">
          <button class="btn btn-ghost" onclick="toggleAiKey()" title="Показать">👁</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <div id="ai-key-status" style="font-size:11px;color:#7a8299">—</div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost" id="ai-get-key-btn" onclick="openAiKeyPage()">Получить ключ</button>
            <button class="btn btn-primary" onclick="saveAiKey()">Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ОБ ПРИЛОЖЕНИИ -->
  <div class="section">
    <div class="section-title">О приложении</div>
    <div class="card" style="font-size:11px;color:#4a5168;line-height:2">
      <div>Dota 2 Tracker by <a class="link" href="https://github.com/ReXaXeR/dota2-tracker" onclick="openExternal('https://github.com/ReXaXeR/dota2-tracker');return false">ReXaXeR</a></div>
      <div>Данные: <a class="link" href="https://stratz.com" onclick="openExternal('https://stratz.com');return false">Stratz API</a></div>
      <div>GSI: Valve Game State Integration</div>
    </div>
  </div>

</div>
<script>
const api = window.electronAPI;

// Получаем версию
api?.onAppVersion(v => {
  document.getElementById('cur-ver').textContent = 'v' + v;
  document.getElementById('ver-line').textContent = 'Dota 2 Tracker v' + v;
});

// Слушаем статус обновления
api?.onUpdateStatus(info => {
  const tag   = document.getElementById('update-tag');
  const msg   = document.getElementById('update-msg');
  const dlBtn = document.getElementById('download-btn');
  const instBtn = document.getElementById('install-btn');
  const checkBtn = document.getElementById('check-btn');
  const prog  = document.getElementById('progress-wrap');
  const fill  = document.getElementById('progress-fill');
  const ptext = document.getElementById('progress-text');
  const notes = document.getElementById('release-notes');

  if (info.status === 'checking') {
    tag.className='tag tag-gray'; tag.textContent='Проверяем...';
    msg.textContent='Подключаемся к GitHub...';
    checkBtn.disabled=true;
  }
  else if (info.status === 'available') {
    tag.className='tag tag-blue'; tag.textContent='Есть обновление';
    document.getElementById('latest-ver').textContent = 'v' + info.version;
    msg.textContent = 'Доступна версия v' + info.version;
    dlBtn.style.display='inline-block'; checkBtn.disabled=false;
    if (info.notes) {
      notes.style.display='block';
      notes.textContent = typeof info.notes === 'string'
        ? info.notes.replace(/<[^>]+>/g,'')
        : JSON.stringify(info.notes);
    }
  }
  else if (info.status === 'latest') {
    tag.className='tag tag-green'; tag.textContent='Актуально';
    document.getElementById('latest-ver').textContent = 'v' + info.version;
    msg.textContent='Установлена последняя версия';
    checkBtn.disabled=false; dlBtn.style.display='none';
  }
  else if (info.status === 'downloading') {
    tag.className='tag tag-blue'; tag.textContent='Загрузка...';
    prog.style.display='block';
    fill.style.width = info.percent + '%';
    ptext.textContent = info.percent + '% · ' + info.speed + ' KB/s';
    dlBtn.disabled=true;
  }
  else if (info.status === 'downloaded') {
    tag.className='tag tag-green'; tag.textContent='Готово к установке';
    prog.style.display='none';
    dlBtn.style.display='none';
    instBtn.style.display='inline-block';
    msg.textContent='Обновление загружено. Установить сейчас?';
  }
  else if (info.status === 'error') {
    tag.className='tag tag-red'; tag.textContent='Ошибка';
    msg.textContent = info.message || 'Ошибка обновления';
    checkBtn.disabled=false; dlBtn.disabled=false;
  }
});

function checkUpdates()   { api?.checkForUpdates(); }
function downloadUpdate() { api?.downloadUpdate(); }
function installUpdate()  { api?.installUpdate(); }
function openExternal(url){ api?.openExternal(url); }

// ─── AI Провайдеры ────────────────────────────────────────────────────────────
const AI_PROVIDERS = {
  anthropic: { label: 'Claude (Anthropic)', url: 'https://console.anthropic.com/settings/keys',  placeholder: 'sk-ant-...',  envKey: 'ANTHROPIC_API_KEY' },
  openai:    { label: 'GPT-4o (OpenAI)',    url: 'https://platform.openai.com/api-keys',          placeholder: 'sk-...',       envKey: 'OPENAI_API_KEY' },
  gemini:    { label: 'Gemini (Google)',     url: 'https://aistudio.google.com/app/apikey',        placeholder: 'AIza...',      envKey: 'GEMINI_API_KEY' },
  deepseek:  { label: 'DeepSeek',           url: 'https://platform.deepseek.com/api_keys',        placeholder: 'sk-...',       envKey: 'DEEPSEEK_API_KEY' },
};
const PROVIDER_COLORS = { anthropic:'#e07a5f', openai:'#74aa9c', gemini:'#4285f4', deepseek:'#5e72e4' };
let currentProvider = 'anthropic'; // подтягивается через IPC при загрузке окна

function selectProvider(id) {
  currentProvider = id;
  api?.saveSettings({ ai_provider: id });

  // UI update
  Object.keys(AI_PROVIDERS).forEach(p => {
    const btn = document.getElementById('prov-' + p);
    if (!btn) return;
    btn.style.borderColor = p === id ? PROVIDER_COLORS[p] : '#1e2535';
    btn.style.background  = p === id ? PROVIDER_COLORS[p] + '22' : 'rgba(255,255,255,0.04)';
    btn.style.color       = p === id ? PROVIDER_COLORS[p] : '#7a8299';
  });

  const pr = AI_PROVIDERS[id];
  document.getElementById('ai-key').placeholder = pr.placeholder;
  document.getElementById('ai-get-key-btn').textContent = 'Получить ключ → ' + pr.label.split(' ')[0];

  // Проверяем есть ли уже ключ
  api?.getAiKeyStatus(id).then(has => {
    const st = document.getElementById('ai-key-status');
    if (has) { st.textContent = '✓ Ключ установлен'; st.style.color = '#4ade80'; }
    else      { st.textContent = '✗ Ключ не задан';  st.style.color = '#f87171'; }
  }).catch(() => {});
}

function openAiKeyPage() {
  const url = AI_PROVIDERS[currentProvider]?.url;
  if (url) openExternal(url);
}

function toggleAiKey() {
  const inp = document.getElementById('ai-key');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function saveAiKey() {
  const key = document.getElementById('ai-key').value.trim();
  const st  = document.getElementById('ai-key-status');
  if (!key) { st.textContent = 'Введи ключ'; st.style.color = '#fb923c'; return; }
  st.textContent = 'Сохраняем...'; st.style.color = '#6c8cff';
  api?.saveAiKey(currentProvider, key);
  setTimeout(() => {
    st.textContent = '✓ Сохранено! Перезапусти приложение если ключ не работает.';
    st.style.color = '#4ade80';
    document.getElementById('ai-key').value = '';
    document.getElementById('ai-key').type = 'password';
  }, 500);
}

// Инициализация — выбираем текущий провайдер
window.addEventListener('load', () => {
  api?.getCurrentProvider?.().then(p => selectProvider(p || 'anthropic')).catch(() => selectProvider('anthropic'));
});


function updateOpacity(v) {
  document.getElementById('opacity-val').textContent = v + '%';
  api?.setOpacity(v / 100);
}

function toggleShowKey() {
  const inp = document.getElementById('steam-key');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function openGetSteamKey() {
  api?.openExternal('https://steamcommunity.com/dev/apikey');
  // Через 3 секунды показываем кнопку "Вставить из буфера"
  setTimeout(() => {
    document.getElementById('paste-btn').style.display = 'inline-block';
    document.getElementById('steam-status').textContent = 'Скопируй ключ на сайте Steam и нажми «Вставить»';
    document.getElementById('steam-status').style.color = '#6c8cff';
  }, 3000);
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    const key = text.trim();
    if (key.length >= 20) {
      document.getElementById('steam-key').value = key;
      document.getElementById('steam-key').type = 'text';
      document.getElementById('steam-status').textContent = '✓ Ключ вставлен — нажми «Проверить и сохранить»';
      document.getElementById('steam-status').style.color = '#facc15';
    } else {
      document.getElementById('steam-status').textContent = '⚠ В буфере нет ключа — скопируй его на странице Steam';
      document.getElementById('steam-status').style.color = '#fb923c';
    }
  } catch(e) {
    // Если clipboard API недоступен — просто фокус на поле
    document.getElementById('steam-key').focus();
    document.getElementById('steam-status').textContent = 'Вставь ключ вручную (Ctrl+V) в поле выше';
    document.getElementById('steam-status').style.color = '#7a8299';
  }
}

async function validateAndSaveSteamKey() {
  const key = document.getElementById('steam-key').value.trim();
  const status = document.getElementById('steam-status');
  const btn = document.getElementById('save-steam-btn');

  if (!key) { status.textContent = '⚠ Введи ключ'; status.style.color = '#fb923c'; return; }
  if (key.length < 20) { status.textContent = '⚠ Ключ слишком короткий'; status.style.color = '#f87171'; return; }

  btn.disabled = true;
  btn.textContent = 'Проверка...';
  status.textContent = 'Проверяем ключ...';
  status.style.color = '#7a8299';

  try {
    // Проверяем ключ реальным запросом к Steam API
    const res = await fetch(
      'https://api.steampowered.com/ISteamWebAPIUtil/GetSupportedAPIList/v1/?key=' + key,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data?.apilist) throw new Error('Неверный ответ');

    // Ключ рабочий — сохраняем
    api?.saveSteamKey(key);
    status.textContent = '✓ Ключ проверен и сохранён!';
    status.style.color = '#4ade80';
    document.getElementById('steam-key').value = key.slice(0,4) + '•'.repeat(key.length - 8) + key.slice(-4);
    document.getElementById('steam-key').type = 'password';
    document.getElementById('steam-banner').style.display = 'none';
  } catch(e) {
    status.textContent = '✗ Ключ недействителен — проверь и попробуй снова';
    status.style.color = '#f87171';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Проверить и сохранить';
  }
}

function saveSteamKey() { validateAndSaveSteamKey(); }

function saveSettings() {
  const auto = document.getElementById('auto-check').checked;
  api?.saveSettings({ autoCheck: auto });
}

// Проверяем есть ли уже ключ
window.addEventListener('load', () => {
  api?.hasSteamKey().then(has => {
    if (has) {
      document.getElementById('steam-status').textContent = '✓ Ключ установлен';
      document.getElementById('steam-status').style.color = '#4ade80';
      document.getElementById('steam-key').placeholder = '••••••••••••••••••••••••••••••••';
      document.getElementById('steam-banner').style.display = 'none';
    } else {
      document.getElementById('steam-status').textContent = '✗ Ключ не задан — live данные недоступны';
      document.getElementById('steam-status').style.color = '#f87171';
    }
  }).catch(() => {});
});

// Автовставка при возврате фокуса — если пользователь открыл страницу Steam и скопировал ключ
let steamPageOpened = false;
function openGetSteamKeyAuto() {
  steamPageOpened = true;
  openGetSteamKey();
}

window.addEventListener('focus', async () => {
  if (!steamPageOpened) return;
  try {
    const text = await navigator.clipboard.readText();
    const key = text.trim();
    // Ключ Steam — 32 символа, только буквы и цифры
    if (/^[A-F0-9]{32}$/i.test(key) || (key.length >= 25 && key.length <= 40 && /^[A-Za-z0-9]+$/.test(key))) {
      const inp = document.getElementById('steam-key');
      const status = document.getElementById('steam-status');
      inp.value = key;
      inp.type = 'text';
      status.textContent = '🔑 Ключ найден в буфере — проверяем...';
      status.style.color = '#6c8cff';
      steamPageOpened = false;
      // Автопроверка и сохранение
      await validateAndSaveSteamKey();
    }
  } catch {}
});
</script>
</body></html>`;
}

// ─── Окно логов ───────────────────────────────────────────────────────────────
function createLogsWindow() {
  if (logsWindow) { logsWindow.focus(); return; }
  logsWindow = new BrowserWindow({
    width: 700, height: 500,
    title: 'Dota 2 Tracker — Логи',
    backgroundColor: '#0a0c12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    }
  });
  logsWindow.setMenuBarVisibility(false);

  const fs = require('fs');
  const tmpPath = path.join(app.getPath('temp'), 'dota2tracker-logs.html');
  try {
    fs.writeFileSync(tmpPath, buildLogsHTML(), 'utf8');
    logsWindow.loadFile(tmpPath);
  } catch (e) {
    logsWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(buildLogsHTML()));
  }

  logsWindow.webContents.on('console-message', (e, level, message, line) => {
    if (level >= 2) console.error(`[Logs window JS error] ${message} (line ${line})`);
  });

  logsWindow.webContents.on('did-finish-load', () =>
    logsWindow.webContents.send('log-history', logBuffer));
  logsWindow.on('closed', () => { logsWindow = null; });
}

function buildLogsHTML() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0c12;color:#c8d0e0;font-family:'Consolas','Courier New',monospace;font-size:12px;display:flex;flex-direction:column;height:100vh;overflow:hidden}
#toolbar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#111520;border-bottom:1px solid #1e2535;flex-shrink:0}
#toolbar span{font-size:13px;font-weight:600;color:#6c8cff;letter-spacing:.05em;font-family:Rajdhani,sans-serif}
.tbtn{padding:4px 10px;border:1px solid #1e2535;border-radius:4px;background:transparent;color:#7a8299;font-size:11px;cursor:pointer}
.tbtn:hover{background:#1e2535;color:#c8d0e0}
#filter{flex:1;max-width:200px;height:26px;padding:0 8px;background:#111520;border:1px solid #1e2535;border-radius:4px;color:#c8d0e0;font-size:11px;outline:none}
#logs{flex:1;overflow-y:auto;padding:4px 0}
.line{display:flex;gap:8px;padding:2px 12px;line-height:1.5}
.line:hover{background:rgba(255,255,255,.03)}
.time{color:#3d4f6b;flex-shrink:0;font-size:11px;padding-top:1px}
.msg{word-break:break-all;white-space:pre-wrap}
.line.error .msg{color:#f87171}.line.warn .msg{color:#facc15}.line.info .msg{color:#c8d0e0}
#status{padding:4px 12px;font-size:11px;color:#3d4f6b;background:#111520;border-top:1px solid #1e2535;flex-shrink:0}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1e2535;border-radius:2px}
</style></head><body>
<div id="toolbar">
  <span>📋 ЛОГИ</span>
  <input id="filter" placeholder="Фильтр...">
  <button class="tbtn" onclick="clearLogs()">Очистить</button>
  <button class="tbtn" onclick="copyAll()">Копировать</button>
  <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#7a8299;cursor:pointer">
    <input type="checkbox" id="as" checked> Автоскролл
  </label>
</div>
<div id="logs"></div>
<div id="status">0 строк</div>
<script>
const el=document.getElementById('logs'),fi=document.getElementById('filter'),st=document.getElementById('status');
let all=[],ft='';
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')}
function cls(e){return e.level==='error'?'error':e.level==='warn'?'warn':'info'}
function mkLine(e){const d=document.createElement('div');d.className='line '+cls(e);d.innerHTML='<span class="time">'+e.time+'</span><span class="msg">'+esc(e.text)+'</span>';return d}
function add(e){all.push(e);if(ft&&!e.text.toLowerCase().includes(ft))return;el.appendChild(mkLine(e));st.textContent=all.length+' строк';if(document.getElementById('as').checked)el.scrollTop=el.scrollHeight}
function rerender(){el.innerHTML='';all.filter(e=>!ft||e.text.toLowerCase().includes(ft)).forEach(e=>el.appendChild(mkLine(e)));if(document.getElementById('as').checked)el.scrollTop=el.scrollHeight}
function clearLogs(){all=[];el.innerHTML='';st.textContent='0 строк'}
function copyAll(){navigator.clipboard.writeText(all.map(e=>'['+e.time+'] '+e.text).join('\n'))}
fi.addEventListener('input',()=>{ft=fi.value.toLowerCase();rerender()});
if(window.electronAPI){
  window.electronAPI.onLog(e=>add(e));
  window.electronAPI.onLogHistory(es=>{all=es;rerender();st.textContent=all.length+' строк'});
}
</script></body></html>`;
}

// ─── Трей ─────────────────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Dota 2 Tracker');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Dota 2 Tracker', enabled: false },
    { type: 'separator' },
    { label: 'Показать трекер',  click: () => mainWindow?.show() },
    { label: 'Настройки',        click: () => createSettingsWindow() },
    { label: 'Логи',             click: () => createLogsWindow() },
    { type: 'separator' },
    { label: 'Выход',            click: () => app.quit() }
  ]));
  tray.on('double-click', () => mainWindow?.show());
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
ipcMain.on('open-logs',     () => createLogsWindow());
ipcMain.on('open-settings', () => createSettingsWindow());
ipcMain.on('minimize-window', () => mainWindow?.minimize());
ipcMain.on('close-window',    () => mainWindow?.hide());
ipcMain.on('set-always-on-top', (_, f) => mainWindow?.setAlwaysOnTop(f, 'screen-saver'));
ipcMain.on('set-opacity',       (_, v) => mainWindow?.setOpacity(v));
ipcMain.on('open-external',     (_, url) => shell.openExternal(url));

// Обновления
ipcMain.on('check-for-updates', () => {
  if (isDev) {
    pushLog('warn', 'auto-update отключён в dev-режиме');
    settingsWindow?.webContents?.send('update-status', { status: 'error', message: 'Недоступно в dev-режиме' });
  } else {
    autoUpdater.checkForUpdates();
  }
});
ipcMain.on('download-update', () => autoUpdater.downloadUpdate());
ipcMain.on('install-update',  () => autoUpdater.quitAndInstall(false, true));

ipcMain.on('save-settings', (_, settings) => {
  const fs = require('fs');
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  try {
    let existing = {};
    if (fs.existsSync(settingsPath)) {
      try { existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
    }
    fs.writeFileSync(settingsPath, JSON.stringify({ ...existing, ...settings }, null, 2));
    pushLog('info', 'Настройки сохранены');

    if (settings.ai_provider) {
      const envPath = path.join(app.getPath('userData'), '.env');
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      if (content.includes('AI_PROVIDER=')) {
        content = content.replace(/AI_PROVIDER=.*/, `AI_PROVIDER=${settings.ai_provider}`);
      } else {
        content += `\nAI_PROVIDER=${settings.ai_provider}`;
      }
      fs.writeFileSync(envPath, content.trim() + '\n');
      pushLog('info', `[AI] Провайдер переключён на: ${settings.ai_provider}`);

      const http = require('http');
      const req = http.request({ hostname: 'localhost', port: 3001, path: '/reload-env', method: 'POST' });
      req.on('error', () => {});
      req.end();
    }
  } catch (e) {
    pushLog('error', 'Ошибка сохранения настроек: ' + e.message);
  }
});

ipcMain.on('save-ai-key', (_, provider, key) => {
  const fs = require('fs');
  const envPath = path.join(app.getPath('userData'), '.env');
  const ENV_KEYS = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai:    'OPENAI_API_KEY',
    gemini:    'GEMINI_API_KEY',
    deepseek:  'DEEPSEEK_API_KEY',
  };
  const envKey = ENV_KEYS[provider];
  if (!envKey) return;
  try {
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (content.includes(envKey + '=')) {
      content = content.replace(new RegExp(envKey + '=.*'), `${envKey}=${key}`);
    } else {
      content += `\n${envKey}=${key}`;
    }
    // Сохраняем выбранный провайдер
    if (content.includes('AI_PROVIDER=')) {
      content = content.replace(/AI_PROVIDER=.*/, `AI_PROVIDER=${provider}`);
    } else {
      content += `\nAI_PROVIDER=${provider}`;
    }
    fs.writeFileSync(envPath, content.trim() + '\n');
    pushLog('info', `[AI] ${provider} ключ сохранён`);
    // Уведомляем сервер
    const http = require('http');
    const req = http.request({ hostname: 'localhost', port: 3001, path: '/reload-env', method: 'POST' });
    req.on('error', () => {});
    req.end();
  } catch (e) {
    pushLog('error', 'Ошибка сохранения AI ключа: ' + e.message);
  }
});

ipcMain.handle('get-ai-key-status', (_, provider) => {
  const fs = require('fs');
  const ENV_KEYS = { anthropic:'ANTHROPIC_API_KEY', openai:'OPENAI_API_KEY', gemini:'GEMINI_API_KEY', deepseek:'DEEPSEEK_API_KEY' };
  const envKey = ENV_KEYS[provider];
  if (!envKey) return false;
  const paths = [path.join(app.getPath('userData'), '.env'), path.join(__dirname, '../.env')];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const m = fs.readFileSync(p, 'utf8').match(new RegExp(`^${envKey}=(.+)$`, 'm'));
        if (m?.[1]?.trim().length > 10) return true;
      }
    } catch {}
  }
  return !!(process.env[envKey]);
});

ipcMain.handle('get-current-provider', () => {
  const fs = require('fs');
  const paths = [path.join(app.getPath('userData'), '.env'), path.join(__dirname, '../.env')];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const m = fs.readFileSync(p, 'utf8').match(/^AI_PROVIDER=(.+)$/m);
        if (m?.[1]?.trim()) return m[1].trim();
      }
    } catch {}
  }
  return process.env.AI_PROVIDER || 'anthropic';
});

ipcMain.on('save-steam-key', (_, key) => {
  const fs = require('fs');
  const envPath = path.join(app.getPath('userData'), '.env');
  try {
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (content.includes('STEAM_API_KEY=')) {
      content = content.replace(/STEAM_API_KEY=.*/g, `STEAM_API_KEY=${key}`);
    } else {
      content += `\nSTEAM_API_KEY=${key}`;
    }
    fs.writeFileSync(envPath, content.trim() + '\n');
    pushLog('info', 'Steam API Key сохранён в ' + envPath);

    // Сразу уведомляем GSI сервер чтобы перечитал .env без перезапуска
    const http = require('http');
    const req = http.request({ hostname: 'localhost', port: 3001, path: '/reload-env', method: 'POST' });
    req.on('response', r => pushLog('info', `[Server] ENV перезагружен, hasSteamKey: ${r.statusCode === 200}`));
    req.on('error', () => pushLog('warn', 'GSI сервер не ответил на reload-env — перезапусти приложение'));
    req.end();
  } catch (e) {
    pushLog('error', 'Ошибка сохранения Steam Key: ' + e.message);
  }
});

ipcMain.handle('has-steam-key', () => {
  const fs = require('fs');
  // Проверяем оба места — .env проекта и userData
  const paths = [
    path.join(app.getPath('userData'), '.env'),
    path.join(__dirname, '../.env'),
  ];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const match = content.match(/STEAM_API_KEY=(.+)/);
        if (match && match[1].trim().length > 10) return true;
      }
    } catch { /* ignore */ }
  }
  return !!process.env.STEAM_API_KEY;
});

ipcMain.on('save-stratz-token', (_, token) => {
  const fs   = require('fs');
  const envPath = path.join(app.getPath('userData'), '.env');
  try {
    let content = '';
    if (fs.existsSync(envPath)) content = fs.readFileSync(envPath, 'utf8');
    if (content.includes('STRATZ_TOKEN=')) {
      content = content.replace(/STRATZ_TOKEN=.*/g, `STRATZ_TOKEN=${token}`);
    } else {
      content += `\nSTRATZ_TOKEN=${token}`;
    }
    fs.writeFileSync(envPath, content.trim() + '\n');
    pushLog('info', 'Stratz токен сохранён — перезапусти трекер');
  } catch (e) {
    pushLog('error', 'Ошибка сохранения токена: ' + e.message);
  }
});

ipcMain.handle('get-version', () => app.getVersion());

// ─── Boot ─────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  pushLog('info', `═══ Dota 2 Tracker v${app.getVersion()} ═══`);
  startGSIServer();
  createWindow();
  createTray();
  setupAutoUpdater();

  globalShortcut.register('Alt+D', () => {
    if (mainWindow?.isVisible()) mainWindow.hide(); else mainWindow?.show();
  });
  globalShortcut.register('Alt+L', () => createLogsWindow());
  globalShortcut.register('Alt+S', () => createSettingsWindow());
  globalShortcut.register('Alt+Shift+D', () => {
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    mainWindow?.setPosition(width - 440, 20);
  });

  // Проверяем наличие Steam API Key через 3 сек после запуска
  setTimeout(() => {
    const fsCheck = require('fs');
    const checkPaths = [
      path.join(app.getPath('userData'), '.env'),
      path.join(__dirname, '../.env'),
    ];
    let hasKey = !!process.env.STEAM_API_KEY;
    for (const ep of checkPaths) {
      try {
        if (fsCheck.existsSync(ep)) {
          const m = fsCheck.readFileSync(ep, 'utf8').match(/STEAM_API_KEY=(.+)/);
          if (m && m[1].trim().length > 10) { hasKey = true; break; }
        }
      } catch { /* ignore */ }
    }
    if (!hasKey) {
      pushLog('warn', '⚠ Steam API Key не задан — открываем настройки...');
      mainWindow?.webContents?.send('no-steam-key');
      // Автооткрытие настроек через 2 сек после старта
      setTimeout(() => createSettingsWindow(), 2000);
    } else {
      pushLog('info', '✓ Steam API Key найден');
    }
  }, 3000);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  gsiProcess?.kill();
});
app.on('window-all-closed', () => { /* остаёмся в трее */ });
app.on('activate', () => { if (!mainWindow) createWindow(); });
