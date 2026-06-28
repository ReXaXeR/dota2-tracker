// scripts/bump-version.js
// Надёжное обновление версии через Node.js без batch-переменных
const fs   = require('fs');
const { execSync } = require('child_process');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

// Читаем текущую версию
const pkg  = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const ver  = pkg.version.match(/^(\d+)\.(\d+)\.(\d+)/);
if (!ver) { console.error('Неверная версия в package.json:', pkg.version); process.exit(1); }

let [, major, minor, patch] = ver.map(Number);

// Получаем теги с GitHub
let remoteTags = '';
try { remoteTags = run('git ls-remote --tags origin'); } catch {}

// Находим следующую свободную версию
let newVer;
do {
  patch++;
  newVer = `${major}.${minor}.${patch}`;
} while (remoteTags.includes(`refs/tags/v${newVer}`));

// Записываем новую версию
pkg.version = newVer;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

// Обновляем package-lock.json если есть
if (fs.existsSync('package-lock.json')) {
  try {
    const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    lock.version = newVer;
    if (lock.packages?.['']) lock.packages[''].version = newVer;
    fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  } catch {}
}

console.log(`Version bumped: ${ver[1]}.${ver[2]}.${ver[3]-1+1-1} → ${newVer}`);
