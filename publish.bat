@echo off
cd /d "%~dp0"
git add -A
git commit -m "update" --allow-empty
for /f "tokens=2 delims==" %%a in ('findstr /r "\"version\"" package.json') do set VER=%%a
set VER=%VER: =%
set VER=%VER:"=%
set VER=%VER:,=%
for /f "tokens=1,2,3 delims=." %%a in ("%VER%") do (
    set /a PATCH=%%c+1
    set NEWVER=%%a.%%b.!PATCH!
)
setlocal enabledelayedexpansion
:findver
git ls-remote --tags origin | findstr "v!NEWVER!" >nul && (set /a PATCH+=1 & set NEWVER=%%a.%%b.!PATCH! & goto findver)
node -e "const f='package.json',p=require('./'+f);p.version='!NEWVER!';require('fs').writeFileSync(f,JSON.stringify(p,null,2))"
git add package.json
git commit -m "v!NEWVER!"
git tag v!NEWVER!
git push && git push origin v!NEWVER!
echo Done - v!NEWVER! pushed, GitHub Actions is building...
pause