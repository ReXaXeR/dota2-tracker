@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Dota 2 Tracker — Publisher

echo.
echo  ================================
echo   DOTA 2 TRACKER — AUTO PUBLISH
echo  ================================
echo.

echo [1/5] Синхронизация с GitHub...
git pull --rebase --autostash 2>nul

echo [2/5] Коммит изменений...
git add -A
git commit -m "chore: update" --allow-empty

echo [3/5] Определяем версию...
node scripts\bump-version.js
if errorlevel 1 ( echo ОШИБКА версии & pause & exit /b 1 )

for /f "usebackq delims=" %%v in (`node -e "process.stdout.write(require('./package.json').version)"`) do set NEWVER=%%v
echo     Новая версия: v%NEWVER%

echo [4/5] Коммит версии...
git add package.json package-lock.json 2>nul
git commit -m "v%NEWVER%"

echo [5/5] Пуш на GitHub...
git push
git tag v%NEWVER%
git push origin v%NEWVER%

echo.
echo  ================================
echo   Готово! v%NEWVER% на GitHub
echo   https://github.com/ReXaXeR/dota2-tracker/actions
echo  ================================
echo.
pause
