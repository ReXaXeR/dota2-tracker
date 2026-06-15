@echo off
title Dota 2 Tracker — Launcher
color 0A

echo.
echo  ╔══════════════════════════════════════╗
echo  ║       DOTA 2 TRACKER LAUNCHER        ║
echo  ╚══════════════════════════════════════╝
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  [ОШИБКА] Node.js не найден!
    echo  Скачай с https://nodejs.org
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0"

if not exist "node_modules" (
    echo  [!] Первый запуск - устанавливаем зависимости...
    echo      (займёт около минуты)
    echo.
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo  [ОШИБКА] npm install не удался.
        pause
        exit /b 1
    )
    echo  [OK] Готово!
    echo.
)

if not exist ".env" (
    echo  [!] Создаём .env файл...
    echo ANTHROPIC_API_KEY=sk-ant-ВСТАВЬ_КЛЮЧ_ЗДЕСЬ > .env
    echo  Открываем .env - вставь API ключ с console.anthropic.com
    notepad .env
    echo.
)

echo  [>>] Запуск Dota 2 Tracker...
echo  [>>] Alt+D - показать/скрыть overlay
echo  [>>] Закрой это окно чтобы остановить
echo.

npm run dev

echo.
echo  Трекер остановлен.
pause
