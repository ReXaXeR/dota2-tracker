// gsi-server/server.js
const path = require('path');
const fs   = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
if (process.env.USER_ENV_PATH && fs.existsSync(process.env.USER_ENV_PATH)) {
  require('dotenv').config({ path: process.env.USER_ENV_PATH, override: true });
}

const express = require('express');
const http    = require('http');
const axios   = require('axios');

const app    = express();
const server = http.createServer(app);

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const OPENDOTA = 'https://api.opendota.com/api';

let currentState   = null;
let playerCache    = {};
let heroesCache    = {};
let currentMatchId = null;

// ─── Герои ────────────────────────────────────────────────────────────────────
async function loadHeroes() {
  try {
    const { data } = await axios.get(`${OPENDOTA}/heroes`, { timeout: 8000 });
    data.forEach(h => { heroesCache[h.id] = h.localized_name; });
    console.log(`[OpenDota] Загружено ${data.length} героев`);
  } catch (e) {
    console.error('[OpenDota] Ошибка загрузки героев:', e.message);
  }
}

// ─── Полный профиль игрока за 100 матчей ──────────────────────────────────────
async function fetchPlayerProfile(accountId) {
  if (!accountId || accountId === 0) return null;
  const id = Number(accountId);
  if (playerCache[id]) return playerCache[id];

  try {
    // Параллельные запросы
    const [profile, wl, recent, heroes, rankings, totals] = await Promise.allSettled([
      axios.get(`${OPENDOTA}/players/${id}`,                            { timeout: 8000 }),
      axios.get(`${OPENDOTA}/players/${id}/wl?limit=100`,              { timeout: 8000 }),
      axios.get(`${OPENDOTA}/players/${id}/recentMatches`,             { timeout: 8000 }),
      axios.get(`${OPENDOTA}/players/${id}/heroes?limit=10`,           { timeout: 8000 }),
      axios.get(`${OPENDOTA}/players/${id}/rankings`,                  { timeout: 8000 }),
      axios.get(`${OPENDOTA}/players/${id}/totals?limit=100`,          { timeout: 8000 }),
    ]);

    const p       = profile.value?.data;
    const wlD     = wl.value?.data;
    const rec     = recent.value?.data?.slice(0, 20) || [];
    const heroList= heroes.value?.data?.slice(0, 10) || [];
    const ranks   = rankings.value?.data || [];
    const tots    = totals.value?.data || [];

    const wins  = wlD?.win  || 0;
    const losses= wlD?.lose || 0;
    const total = wins + losses;
    const wr    = total > 0 ? Math.round(wins / total * 100) : null;

    const avg = (arr, fn) => arr.length
      ? +(arr.reduce((s, x) => s + (fn(x) || 0), 0) / arr.length).toFixed(1) : 0;

    // Средние за последние 20 матчей
    const avgKDA = rec.length ? {
      k: avg(rec, x => x.kills),
      d: avg(rec, x => x.deaths),
      a: avg(rec, x => x.assists),
    } : null;
    const avgGPM = Math.round(avg(rec, x => x.gold_per_min));
    const avgXPM = Math.round(avg(rec, x => x.xp_per_min));
    const avgHD  = Math.round(avg(rec, x => x.hero_damage));
    const avgLH  = Math.round(avg(rec, x => x.last_hits));
    const avgDur = Math.round(avg(rec, x => x.duration));

    // Основная роль из последних матчей (lane_role 1-4)
    const roles = rec.map(m => m.lane_role).filter(Boolean);
    const roleCount = [1,2,3,4].map(r => ({ role: r, count: roles.filter(x=>x===r).length }))
                                .sort((a,b)=>b.count-a.count);
    const mainRole = roleCount[0]?.count > 0 ? roleCount[0].role : null;
    const roleNames = { 1:'Carry', 2:'Mid', 3:'Offlane', 4:'Support' };

    // Винрейт по позициям
    const roleWR = {};
    [1,2,3,4].forEach(r => {
      const rMatches = rec.filter(m => m.lane_role === r);
      if (rMatches.length >= 3) {
        const rWins = rMatches.filter(m => m.radiant_win === (m.player_slot < 128)).length;
        roleWR[r] = { wr: Math.round(rWins/rMatches.length*100), games: rMatches.length };
      }
    });

    // Топ герои (из heroList — за все матчи)
    const topHeroes = heroList
      .filter(h => h.games >= 5)
      .slice(0, 5)
      .map(h => ({
        id:      h.hero_id,
        name:    heroesCache[h.hero_id] || `Hero ${h.hero_id}`,
        games:   h.games,
        win:     h.win,
        winrate: h.games > 0 ? Math.round(h.win / h.games * 100) : 0,
        kda:     h.kda?.toFixed(2) || '—',
        // Последний раз играл
        last:    h.last_played ? new Date(h.last_played * 1000).toLocaleDateString('ru-RU') : null,
      }));

    // Лучшие герои по ranking (относительно всех игроков)
    const heroRankings = ranks.slice(0, 3).map(r => ({
      hero:    heroesCache[r.hero_id] || `Hero ${r.hero_id}`,
      percent: r.percent_rank ? Math.round(r.percent_rank * 100) : null,
    })).filter(r => r.percent !== null);

    // Тайминги из totals
    const totalField = (field) => tots.find(t => t.field === field);
    const avgNetworth25 = null; // Нет прямого поля в totals
    const tLH = totalField('last_hits');
    const tGPM = totalField('gold_per_min');
    const tDMG = totalField('hero_damage');
    const tDur = totalField('duration');

    // Средние тайминги предметов из последних матчей (purchase_log недоступен в recentMatches)
    // Используем косвенные данные
    const avgFirstBlood = Math.round(avg(rec, x => x.firstblood_claimed ? 1 : 0) * 100);

    const result = {
      accountId: id,
      name:      p?.profile?.personaname || 'Аноним',
      avatar:    p?.profile?.avatarmedium || null,
      avatarFull:p?.profile?.avatarfull || null,
      rank:      p?.rank_tier || null,
      leaderboardRank: p?.leaderboard_rank || null,
      winrate: wr,
      totalGames: total,
      wins,
      losses,
      // Средние показатели
      avgKDA,
      avgGPM,
      avgXPM,
      avgHD,
      avgLH,
      avgDur,  // средняя продолжительность матча в секундах
      // Роли
      mainRole,
      mainRoleName: mainRole ? roleNames[mainRole] : null,
      roleWR,
      roleCount: roleCount.filter(r => r.count > 0),
      // Герои
      topHeroes,
      heroRankings,
      // Profiling
      profileUrl: `https://www.opendota.com/players/${id}`,
    };

    playerCache[id] = result;
    return result;
  } catch (e) {
    console.error(`[OpenDota] Профиль ${accountId}:`, e.message);
    return { accountId: id, name: 'Ошибка загрузки', winrate: null, avgKDA: null };
  }
}

// ─── Матч ─────────────────────────────────────────────────────────────────────
async function fetchMatch(matchId) {
  const { data } = await axios.get(`${OPENDOTA}/matches/${matchId}`, { timeout: 15000 });
  if (!data?.players) throw new Error('Матч не найден или не спарсен');

  const profiles = await Promise.all(data.players.map(p => fetchPlayerProfile(p.account_id)));

  const players = data.players.map((p, i) => ({
    account_id:   p.account_id,
    personaname:  p.personaname || profiles[i]?.name || 'Аноним',
    hero_id:      p.hero_id,
    heroName:     heroesCache[p.hero_id] || `Hero ${p.hero_id}`,
    team_number:  p.player_slot < 128 ? 0 : 1,
    player_slot:  p.player_slot,
    lane_role:    p.lane_role,
    is_roaming:   p.is_roaming,
    kills:        p.kills,
    deaths:       p.deaths,
    assists:      p.assists,
    gold_per_min: p.gold_per_min,
    xp_per_min:   p.xp_per_min,
    net_worth:    p.net_worth,
    hero_damage:  p.hero_damage,
    tower_damage: p.tower_damage,
    hero_healing: p.hero_healing,
    last_hits:    p.last_hits,
    denies:       p.denies,
    win:          data.radiant_win ? (p.player_slot < 128) : (p.player_slot >= 128),
    rank_tier:    p.rank_tier,
    profile:      profiles[i],
  }));

  return {
    match_id:    data.match_id,
    radiant_win: data.radiant_win,
    duration:    data.duration,
    game_mode:   data.game_mode,
    players,
  };
}

// ─── Динамическое чтение ключей ───────────────────────────────────────────────
// Читаем каждый раз из файла — чтобы ключ подхватывался без перезапуска сервера
function getEnvKey(keyName) {
  // Сначала из process.env (задан при старте)
  if (process.env[keyName]) return process.env[keyName];

  // Затем из userData .env (сохранён через настройки)
  const userEnvPath = process.env.USER_ENV_PATH;
  if (userEnvPath && fs.existsSync(userEnvPath)) {
    try {
      const content = fs.readFileSync(userEnvPath, 'utf8');
      const match = content.match(new RegExp(`^${keyName}=(.+)$`, 'm'));
      if (match?.[1]?.trim()) return match[1].trim();
    } catch {}
  }

  // Фоллбэк — локальный .env (dev режим)
  const localEnvPath = path.join(__dirname, '../.env');
  if (fs.existsSync(localEnvPath)) {
    try {
      const content = fs.readFileSync(localEnvPath, 'utf8');
      const match = content.match(new RegExp(`^${keyName}=(.+)$`, 'm'));
      if (match?.[1]?.trim()) return match[1].trim();
    } catch {}
  }

  return null;
}

// Endpoint для перезагрузки env после сохранения из настроек
app.post('/reload-env', (req, res) => {
  const userEnvPath = process.env.USER_ENV_PATH;
  if (userEnvPath && fs.existsSync(userEnvPath)) {
    require('dotenv').config({ path: userEnvPath, override: true });
    console.log('[Server] ENV перезагружен из', userEnvPath);
  }
  const steamKey = getEnvKey('STEAM_API_KEY');
  res.json({ ok: true, hasSteamKey: !!steamKey, hasAnthropicKey: !!getEnvKey('ANTHROPIC_API_KEY') });
});

app.get('/env-status', (req, res) => {
  res.json({
    hasSteamKey:    !!getEnvKey('STEAM_API_KEY'),
    hasAnthropicKey:!!getEnvKey('ANTHROPIC_API_KEY'),
  });
});


async function fetchLiveOpenDota(matchId) {
  const { data } = await axios.get(`${OPENDOTA}/live`, { timeout: 8000 });
  const m = data?.find(x => String(x.match_id) === String(matchId));
  if (!m) throw new Error('Матч не в трансляции');

  const allP = [...(m.players||[]), ...(m.radiant_team?.players||[]), ...(m.dire_team?.players||[])]
    .filter(p => p.account_id);
  if (!allP.length) throw new Error('Нет игроков');

  const profiles = await Promise.all(allP.map(p => fetchPlayerProfile(p.account_id)));
  const players = allP.map((p, i) => ({
    account_id:   p.account_id,
    hero_id:      p.hero_id,
    heroName:     heroesCache[p.hero_id] || `Hero ${p.hero_id}`,
    team_number:  (p.team === 'radiant' || p.is_radiant) ? 0 : 1,
    player_slot:  i,
    lane_role:    null, is_roaming: false,
    kills: p.kills||0, deaths: p.deaths||0, assists: p.assists||0,
    gold_per_min: p.gold_per_min||0, net_worth: p.net_worth||0,
    hero_damage: p.hero_damage||0, last_hits: p.last_hits||0,
    personaname: profiles[i]?.name || 'Игрок',
    rank_tier:   profiles[i]?.rank,
    profile:     profiles[i],
  }));

  return { match_id: Number(matchId), radiant_win: null, duration: m.duration, live: true, players };
}

async function fetchLiveValve(matchId) {
  const key = getEnvKey('STEAM_API_KEY');
  if (!key) throw new Error('Нет STEAM_API_KEY');
  const { data } = await axios.get('https://api.steampowered.com/IDOTA2Match_570/GetMatchDetails/v1/', {
    params: { match_id: matchId, key }, timeout: 8000 });
  const m = data?.result;
  if (!m || m.error) throw new Error(m?.error || 'Не найден');
  const profiles = await Promise.all((m.players||[]).map(p => fetchPlayerProfile(p.account_id)));
  const players = (m.players||[]).map((p, i) => ({
    account_id: p.account_id, hero_id: p.hero_id,
    heroName: heroesCache[p.hero_id] || `Hero ${p.hero_id}`,
    team_number: p.player_slot < 128 ? 0 : 1, player_slot: p.player_slot,
    lane_role: null, is_roaming: false,
    kills: p.kills||0, deaths: p.deaths||0, assists: p.assists||0,
    gold_per_min: p.gold_per_min||0, net_worth: p.net_worth||0,
    hero_damage: p.hero_damage||0, last_hits: p.last_hits||0,
    personaname: profiles[i]?.name || 'Игрок',
    rank_tier: profiles[i]?.rank, profile: profiles[i],
  }));
  return { match_id: Number(matchId), radiant_win: m.radiant_win, duration: m.duration, live: true, players };
}

// ─── GSI endpoint ─────────────────────────────────────────────────────────────
app.post('/gsi', (req, res) => {
  const map = req.body?.map || {};
  currentState = {
    gameState: map.game_state || 'UNKNOWN',
    matchId:   map.matchid,
    time:      map.clock_time || 0,
    draft:     req.body?.draft || null,
    player:    req.body?.player || {},
    hero:      req.body?.hero || {},
  };
  if (currentState.matchId && currentState.matchId !== currentMatchId) {
    currentMatchId = currentState.matchId;
    playerCache = {};
    console.log(`[GSI] Новый матч: ${currentMatchId}`);
  }
  res.sendStatus(200);
});

app.get('/state',  (req, res) => res.json(currentState || { gameState: 'WAITING' }));
app.get('/health', (req, res) => res.json({ ok: true, matchId: currentMatchId }));

app.get('/profile/:id', async (req, res) => {
  const raw = req.params.id;
  const id = raw.length > 12
    ? String(BigInt(raw) - BigInt('76561197960265728'))
    : raw;
  const profile = await fetchPlayerProfile(id);
  res.json(profile || { error: 'не найден' });
});

app.get('/live/:matchId', async (req, res) => {
  const mid = req.params.matchId;
  try { return res.json(await fetchLiveValve(mid)); } catch(e) { console.log('[Live] Valve:', e.message); }
  try { return res.json(await fetchLiveOpenDota(mid)); } catch(e) { console.log('[Live] OpenDota:', e.message); }
  // Фоллбэк — только свой игрок
  if (currentState?.player?.steamid) {
    try {
      const aid = String(BigInt(currentState.player.steamid) - BigInt('76561197960265728'));
      const pr = await fetchPlayerProfile(aid);
      return res.json({ match_id: Number(mid), live: true, partial: true, players: [{
        account_id: Number(aid), personaname: pr?.name||'Ты',
        heroName: heroesCache[currentState.hero?.id]||'—', hero_id: currentState.hero?.id,
        team_number: 0, player_slot: 0, lane_role: null, is_roaming: false,
        kills: currentState.player.kills||0, deaths: currentState.player.deaths||0,
        assists: currentState.player.assists||0, gold_per_min: currentState.player.gpm||0,
        net_worth: currentState.player.net_worth||0, hero_damage: 0, last_hits: 0,
        personaname: pr?.name||'Ты', profile: pr,
      }]});
    } catch(e) { console.error('[Live] Fallback:', e.message); }
  }
  res.status(404).json({ error: 'Live недоступен' });
});

app.get('/match/:matchId', async (req, res) => {
  try { res.json(await fetchMatch(req.params.matchId)); }
  catch(e) { res.status(404).json({ error: e.message }); }
});

app.get('/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Нет q' });
  try {
    if (/^\d+$/.test(q.trim())) {
      const p = await fetchPlayerProfile(q.trim());
      return res.json(p ? [{ account_id: p.accountId, personaname: p.name, avatar: p.avatar }] : []);
    }
    const { data } = await axios.get(`${OPENDOTA}/search?q=${encodeURIComponent(q)}`, { timeout: 8000 });
    res.json(data.slice(0, 8));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/ai/analyze', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Нет prompt' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'ANTHROPIC_API_KEY не задан' });
  try {
    const { data } = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 600,
      system: 'Ты тренер Dota 2. 5 пунктов с эмодзи на русском. Коротко и конкретно.',
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' } });
    res.json({ text: data.content?.find(c=>c.type==='text')?.text || '' });
  } catch(e) { res.status(500).json({ error: e.response?.data?.error?.message || e.message }); }
});

server.listen(3001, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║  Dota 2 Tracker — OpenDota API Server ║');
  console.log('║  http://localhost:3001                ║');
  console.log('╚═══════════════════════════════════════╝');
  loadHeroes();
});

module.exports = {};
