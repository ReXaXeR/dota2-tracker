# Dota 2 Tracker — Overlay приложение

Overlay в стиле Tracker.gg с автоматическим подтягиванием статистики во время пика героев.

## Что умеет

- **Автоматический пик** — GSI получает данные прямо из Dota 2 в реальном времени
- **Статистика всех 10 игроков** — winrate, KDA, GPM, топ герои, ранг
- **Поиск матчей** — вставь ID и смотри полную статистику
- **Поиск игроков** — по нику или Steam ID
- **AI-анализ** — Claude анализирует матч и даёт советы
- **Всегда поверх игры** — прозрачное окно не мешает

---

## Установка

### 1. Установи зависимости

```bash
npm install
```

### 2. Скопируй GSI конфиг в Dota 2

Скопируй файл `gamestate_integration_dota2tracker.cfg` в папку:

**Windows:**
```
C:\Program Files (x86)\Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\
```

**Linux:**
```
~/.steam/steam/steamapps/common/dota 2 beta/game/dota/cfg/gamestate_integration/
```

> Папку `gamestate_integration` нужно создать если её нет

### 3. Запусти

**Режим разработки (GSI сервер + React + Electron):**
```bash
npm run dev
```

**Только GSI сервер (без Electron, для браузера):**
```bash
npm start
# Открой http://localhost:3001 в браузере
```

---

## Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Alt+D` | Показать / скрыть окно |
| `Alt+Shift+D` | Сбросить позицию окна |

---

## Как работает

```
Dota 2 → GSI (gamestate_integration_*.cfg)
   ↓ HTTP POST каждые 100ms
GSI Server (localhost:3001)
   ↓ WebSocket / polling
React UI (Electron overlay)
   ↓ при появлении игроков
OpenDota API → профили всех 10 игроков
   ↓
Compact stats overlay
```

---

## Структура проекта

```
dota2-tracker/
├── electron/
│   ├── main.js          # Electron main process (overlay окно)
│   └── preload.js       # IPC bridge
├── gsi-server/
│   └── server.js        # Express + Socket.io GSI сервер
├── src/
│   ├── App.jsx          # Главный компонент
│   ├── hooks/
│   │   └── useTracker.js # Логика данных
│   └── components/
│       └── PlayerCard.jsx # Карточка игрока
├── gamestate_integration_dota2tracker.cfg  # Скопируй в Dota 2
└── package.json
```

---

## Заметки

- OpenDota API бесплатный, но ограничен по количеству запросов
- Профили приватных Steam аккаунтов не доступны
- GSI работает только для активного игрока (не для спектаторов)

---

## 🚀 Релиз новой версии (для разработчика)

Сборка и публикация полностью автоматическая через GitHub Actions.

1. Подними версию в `package.json`:
   ```bash
   npm version patch   # 1.0.0 → 1.0.1
   ```

2. Запушь тег:
   ```bash
   git push && git push --tags
   ```

3. GitHub Actions сам соберёт `.exe` и создаст Release с файлами для `electron-updater`.

4. У всех установленных приложений в **Настройках** появится бейдж "Доступно обновление" — пользователь нажимает **Скачать → Установить**, и приложение перезапускается с новой версией.

### Первая сборка и публикация вручную

Если нужно собрать локально (Windows):

```bash
npm install
npm run release
```

Требуется переменная окружения `GH_TOKEN` (Personal Access Token с правом `repo`) — `electron-builder` использует её для публикации в GitHub Releases.

```bash
set GH_TOKEN=ghp_ваш_токен
npm run release
```
