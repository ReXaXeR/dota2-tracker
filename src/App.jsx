// src/App.jsx
import React, { useState, useCallback } from 'react';
import { useTracker, getRankName, getRankColor } from './hooks/useTracker';
import PlayerCard from './components/PlayerCard';

const ROLE_COLORS_SEARCH = { 1: '#facc15', 2: '#a78bfa', 3: '#f87171', 4: '#60a5fa' };

const s = {
  app: {
    width: '100%', height: '100vh',
    background: 'var(--bg-base)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  titleBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.55)',
    borderBottom: '1px solid var(--border)',
    WebkitAppRegion: 'drag',
    flexShrink: 0,
    zIndex: 10,
  },
  logo: {
    width: 20, height: 20, borderRadius: 4,
    background: 'linear-gradient(135deg, #6c8cff, #a78bfa)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, color: '#fff',
    WebkitAppRegion: 'no-drag',
  },
  titleText: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em' },
  dot: { width: 6, height: 6, borderRadius: '50%' },
  winBtns: { display: 'flex', gap: 6, WebkitAppRegion: 'no-drag' },
  winBtn: {
    width: 14, height: 14, borderRadius: '50%', border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 9, lineHeight: 1,
  },
  tabs: {
    display: 'flex', borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    background: 'rgba(0,0,0,0.3)',
    zIndex: 9,
  },
  tab: {
    flex: 1, padding: '8px 4px', fontSize: 11, fontWeight: 500,
    background: 'none', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', borderBottom: '2px solid transparent',
    transition: 'color 0.15s',
    fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em',
  },
  tabActive: { color: 'var(--accent)', borderBottomColor: 'var(--accent)' },
  body: { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px' },
  teamLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
    marginBottom: 6, marginTop: 10,
    fontFamily: 'Rajdhani, sans-serif',
  },
  inputRow: { display: 'flex', gap: 6, marginBottom: 10 },
  input: {
    flex: 1, height: 32, padding: '0 10px',
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: 12, outline: 'none',
  },
  btn: {
    height: 32, padding: '0 12px',
    background: 'var(--accent-bg)', border: '1px solid rgba(108,140,255,0.3)',
    borderRadius: 'var(--radius-md)', color: 'var(--accent)',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
    fontFamily: 'Rajdhani, sans-serif',
  },
  status: {
    padding: '8px 10px', borderRadius: 'var(--radius-md)',
    marginBottom: 8, fontSize: 12,
  },
  gsiPhase: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', borderRadius: 'var(--radius-md)',
    background: 'rgba(255,255,255,0.04)', marginBottom: 8,
    border: '1px solid var(--border)',
  },
  searchResult: {
    padding: '8px 10px', background: 'var(--bg-card)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
    marginBottom: 4, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 10,
  },
  serverOff: {
    padding: '16px 10px', textAlign: 'center',
    color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.7,
  },
};

const GAME_STATES = {
  DOTA_GAMERULES_STATE_HERO_SELECTION: '🎯 Выбор героев',
  DOTA_GAMERULES_STATE_STRATEGY_TIME: '📋 Стратегия',
  DOTA_GAMERULES_STATE_PRE_GAME: '⚔️ Начало матча',
  DOTA_GAMERULES_STATE_GAME_IN_PROGRESS: '🎮 Матч идёт',
  DOTA_GAMERULES_STATE_POST_GAME: '🏆 Конец матча',
  WAITING: '⏳ Ожидание',
};

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO = {
  match_id: 7912345678,
  duration: 2847,
  radiant_win: true,
  players: [
    { account_id: 1, personaname: 'Волшебник', heroName: 'Anti-Mage', kills: 12, deaths: 3, assists: 18, net_worth: 24500, team_number: 0,
      profile: { name: 'Волшебник', winrate: 58, totalGames: 1240, wins: 719, losses: 521, avgKDA: { k: '9.2', d: '3.1', a: '11.4' }, avgGPM: 642, rank_tier: 65,
        topHeroes: [{ name: 'Anti-Mage', winrate: 67, games: 148 }, { name: 'Morphling', winrate: 62, games: 89 }, { name: 'Faceless Void', winrate: 55, games: 72 }],
        profileUrl: 'https://www.opendota.com/players/1' } },
    { account_id: 2, personaname: 'SkyWalker', heroName: 'Axe', kills: 8, deaths: 5, assists: 22, net_worth: 19800, team_number: 0,
      profile: { name: 'SkyWalker', winrate: 52, totalGames: 890, wins: 463, losses: 427, avgKDA: { k: '6.1', d: '5.8', a: '14.2' }, avgGPM: 498, rank_tier: 55,
        topHeroes: [{ name: 'Axe', winrate: 59, games: 210 }, { name: 'Dragon Knight', winrate: 54, games: 95 }],
        profileUrl: 'https://www.opendota.com/players/2' } },
    { account_id: 3, personaname: 'NightProwler', heroName: 'Crystal Maiden', kills: 6, deaths: 4, assists: 25, net_worth: 16200, team_number: 0,
      profile: { name: 'NightProwler', winrate: 47, totalGames: 2100, wins: 987, losses: 1113, avgKDA: { k: '3.2', d: '7.1', a: '18.5' }, avgGPM: 318, rank_tier: 45,
        topHeroes: [{ name: 'Crystal Maiden', winrate: 51, games: 340 }],
        profileUrl: 'https://www.opendota.com/players/3' } },
    { account_id: 4, personaname: 'IronFist', heroName: 'Juggernaut', kills: 10, deaths: 6, assists: 14, net_worth: 21300, team_number: 0,
      profile: { name: 'IronFist', winrate: 55, totalGames: 670, wins: 369, losses: 301, avgKDA: { k: '8.4', d: '4.9', a: '9.1' }, avgGPM: 589, rank_tier: 58,
        topHeroes: [{ name: 'Juggernaut', winrate: 62, games: 120 }, { name: 'Phantom Assassin', winrate: 58, games: 88 }],
        profileUrl: 'https://www.opendota.com/players/4' } },
    { account_id: 5, personaname: 'StormBreaker', heroName: 'Lion', kills: 5, deaths: 7, assists: 28, net_worth: 14100, team_number: 0,
      profile: { name: 'StormBreaker', winrate: 44, totalGames: 430, wins: 189, losses: 241, avgKDA: { k: '2.8', d: '8.2', a: '16.7' }, avgGPM: 290, rank_tier: 35,
        topHeroes: [{ name: 'Lion', winrate: 48, games: 78 }],
        profileUrl: 'https://www.opendota.com/players/5' } },
    { account_id: 6, personaname: 'DarkLord', heroName: 'Shadow Fiend', kills: 9, deaths: 8, assists: 11, net_worth: 20100, team_number: 1,
      profile: { name: 'DarkLord', winrate: 61, totalGames: 980, wins: 598, losses: 382, avgKDA: { k: '11.2', d: '4.8', a: '7.3' }, avgGPM: 680, rank_tier: 67,
        topHeroes: [{ name: 'Shadow Fiend', winrate: 71, games: 230 }, { name: 'Invoker', winrate: 64, games: 115 }],
        profileUrl: 'https://www.opendota.com/players/6' } },
    { account_id: 7, personaname: 'BloodRayne', heroName: 'Bloodseeker', kills: 14, deaths: 7, assists: 9, net_worth: 22400, team_number: 1,
      profile: { name: 'BloodRayne', winrate: 53, totalGames: 1560, wins: 827, losses: 733, avgKDA: { k: '10.1', d: '5.6', a: '8.4' }, avgGPM: 605, rank_tier: 48,
        topHeroes: [{ name: 'Bloodseeker', winrate: 58, games: 280 }],
        profileUrl: 'https://www.opendota.com/players/7' } },
    { account_id: 8, personaname: 'VoidWalker', heroName: 'Faceless Void', kills: 3, deaths: 9, assists: 19, net_worth: 13600, team_number: 1,
      profile: { name: 'VoidWalker', winrate: 41, totalGames: 340, wins: 139, losses: 201, avgKDA: { k: '5.4', d: '8.9', a: '12.1' }, avgGPM: 420, rank_tier: 28,
        topHeroes: [{ name: 'Faceless Void', winrate: 44, games: 65 }],
        profileUrl: 'https://www.opendota.com/players/8' } },
    { account_id: 9, personaname: 'PhantomBlade', heroName: 'Phantom Assassin', kills: 7, deaths: 10, assists: 13, net_worth: 18900, team_number: 1,
      profile: { name: 'PhantomBlade', winrate: 50, totalGames: 750, wins: 375, losses: 375, avgKDA: { k: '7.8', d: '6.1', a: '7.9' }, avgGPM: 540, rank_tier: 46,
        topHeroes: [{ name: 'Phantom Assassin', winrate: 55, games: 190 }, { name: 'Anti-Mage', winrate: 51, games: 102 }],
        profileUrl: 'https://www.opendota.com/players/9' } },
    { account_id: 10, personaname: 'ChaosMaster', heroName: 'Chaos Knight', kills: 4, deaths: 9, assists: 16, net_worth: 15200, team_number: 1,
      profile: { name: 'ChaosMaster', winrate: 49, totalGames: 520, wins: 255, losses: 265, avgKDA: { k: '4.9', d: '7.3', a: '10.2' }, avgGPM: 445, rank_tier: 39,
        topHeroes: [{ name: 'Chaos Knight', winrate: 52, games: 98 }],
        profileUrl: 'https://www.opendota.com/players/10' } },
  ]
};

// ─── Математический скоринг по позиции ───────────────────────────────────────

const POS_LABELS = { 1: 'Carry', 2: 'Mid', 3: 'Off', 4: 'Jungle', 5: 'Support' };
const POS_COLORS = { 1: '#facc15', 2: '#a78bfa', 3: '#f87171', 4: '#34d399', 5: '#60a5fa' };

// Реальные бенчмарки по позиции — [плохо, нормально, хорошо, отлично]
// Всё основано на средних по MMR-дивизионам (~2k–8k MMR диапазон)
const BENCHMARKS = {
  //           плохо  норм  хорошо  топ
  gpm: {
    1: [350,  500,  650,  780], // Carry: 400 — плохо, 650 — хорошо, 780 — топ
    2: [300,  450,  580,  700], // Mid
    3: [250,  380,  500,  620], // Offlane
    4: [280,  400,  530,  650], // Jungle
    5: [150,  230,  320,  420], // Support: 400 — уже хорошо
  },
  lh: {
    1: [80,  150,  230,  310], // Carry: 80 — плохо, 230 — хорошо
    2: [60,  120,  190,  260],
    3: [40,   90,  150,  210],
    4: [50,  100,  160,  220],
    5: [10,   30,   60,   90], // Support: 30 — норм, 90 — топ
  },
  nw: {
    1: [8000,  14000, 20000, 28000],
    2: [7000,  12000, 17000, 24000],
    3: [6000,  10000, 15000, 21000],
    4: [6500,  11000, 16000, 22000],
    5: [3000,   6000,  9000, 13000],
  },
  dmg: {
    1: [8000,  16000, 26000, 38000],
    2: [10000, 20000, 32000, 46000],
    3: [9000,  18000, 29000, 42000],
    4: [8000,  15000, 24000, 36000],
    5: [5000,  11000, 19000, 28000],
  },
  kda: {
    // KDA ratio [плохо, норм, хорошо, топ] — одинаково для всех позиций
    all: [0.8, 1.8, 3.2, 5.5],
  },
  wr: {
    all: [40, 48, 55, 65],
  },
};

// Веса по позиции
const POS_WEIGHTS = {
  1: { kda: 0.20, gpm: 0.28, nw: 0.22, lh: 0.18, dmg: 0.08, wr: 0.04 },
  2: { kda: 0.24, gpm: 0.22, nw: 0.18, lh: 0.14, dmg: 0.16, wr: 0.06 },
  3: { kda: 0.28, gpm: 0.16, nw: 0.14, lh: 0.10, dmg: 0.22, wr: 0.10 },
  4: { kda: 0.24, gpm: 0.18, nw: 0.16, lh: 0.14, dmg: 0.18, wr: 0.10 },
  5: { kda: 0.30, gpm: 0.08, nw: 0.06, lh: 0.04, dmg: 0.14, wr: 0.38 },
};

// Нормализация значения по бенчмарку [плохо, норм, хорошо, топ] → 0–100
function benchScore(val, bench) {
  const [bad, avg, good, top] = bench;
  if (val <= bad)  return Math.max(0,  (val / bad) * 20);          // 0–20
  if (val <= avg)  return 20 + ((val - bad)  / (avg  - bad))  * 30; // 20–50
  if (val <= good) return 50 + ((val - avg)  / (good - avg))  * 30; // 50–80
  if (val <= top)  return 80 + ((val - good) / (top  - good)) * 15; // 80–95
  return 95 + Math.min(5, (val - top) / top * 20);                   // 95–100
}

function detectPosition(p) {
  if (p.is_roaming) return 5;
  const lr = p.lane_role;
  if (lr === 1) {
    // safe lane — эвристика carry vs support
    const nw = p.net_worth || 0;
    const lh = p.last_hits || 0;
    const gpm = p.gold_per_min || 0;
    return (nw > 11000 || lh > 90 || gpm > 380) ? 1 : 5;
  }
  if (lr === 2) return 2;
  if (lr === 3) {
    // Offlane vs Jungle — jungle обычно больше LH
    return (p.last_hits || 0) > 140 ? 4 : 3;
  }
  if (lr === 4) return 5;
  // Фоллбэк по слоту
  const slot = p.player_slot ?? 0;
  const s = slot >= 128 ? slot - 128 : slot;
  return Math.min(5, Math.max(1, s + 1));
}

function calcScore(p) {
  const pr = p.profile;
  const kda_k = p.kills   ?? +(pr?.avgKDA?.k || 0);
  const kda_d = p.deaths  ?? +(pr?.avgKDA?.d || 1);
  const kda_a = p.assists ?? +(pr?.avgKDA?.a || 0);
  const gpm = p.gold_per_min || p.gpm || pr?.avgGPM || 0;
  const nw  = p.net_worth  || 0;
  const lh  = p.last_hits  || 0;
  const dmg = p.hero_damage || 0;
  const wr  = pr?.winrate   || 50;

  const pos = detectPosition(p);
  const W   = POS_WEIGHTS[pos];
  const B   = BENCHMARKS;
  const kdaRatio = (kda_k + kda_a * 0.5) / Math.max(1, kda_d);

  const kdaScore = benchScore(kdaRatio, B.kda.all);
  const gpmScore = benchScore(gpm,      B.gpm[pos]);
  const nwScore  = benchScore(nw,       B.nw[pos]);
  const lhScore  = benchScore(lh,       B.lh[pos]);
  const dmgScore = benchScore(dmg,      B.dmg[pos]);
  const wrScore  = benchScore(wr,       B.wr.all);

  const total =
    kdaScore * W.kda +
    gpmScore * W.gpm +
    nwScore  * W.nw  +
    lhScore  * W.lh  +
    dmgScore * W.dmg +
    wrScore  * W.wr;

  // Контекстные подсказки
  const hints = [];
  if (pos === 1 && gpm < B.gpm[1][0]) hints.push('⚠ Очень мало фарма для керри');
  if (pos === 1 && gpm > B.gpm[1][2]) hints.push('💰 Хороший фарм');
  if (pos === 5 && wr !== null && wr >= B.wr.all[2]) hints.push('🛡 Высокий винрейт');
  if (kdaRatio >= B.kda.all[2]) hints.push('⚔ Убийственный KDA');
  if (kdaRatio < B.kda.all[0])  hints.push('💀 Много смертей');

  return {
    total: Math.round(total),
    pos, posLabel: POS_LABELS[pos],
    kda: kdaRatio.toFixed(2),
    kdaScore: Math.round(kdaScore),
    gpmScore: Math.round(gpmScore),
    nwScore:  Math.round(nwScore),
    lhScore:  Math.round(lhScore),
    dmgScore: Math.round(dmgScore),
    wrScore:  Math.round(wrScore),
    gpm, nw, lh, dmg, wr,
    k: kda_k, d: kda_d, a: kda_a,
    hints,
    // Бенчмарки для показа в UI
    bench: {
      gpm: B.gpm[pos],
      lh:  B.lh[pos],
      nw:  B.nw[pos],
      dmg: B.dmg[pos],
    },
  };
}


function scoreColor(v) {
  if (v >= 80) return '#4ade80';
  if (v >= 60) return '#a3e635';
  if (v >= 40) return '#facc15';
  if (v >= 20) return '#fb923c';
  return '#f87171';
}

function scoreLabel(v) {
  if (v >= 85) return 'Топ';
  if (v >= 65) return 'Хорошо';
  if (v >= 45) return 'Норм';
  if (v >= 25) return 'Слабо';
  return 'Плохо';
}

function MiniBar({ value, color }) {
  return (
    <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, value)}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
    </div>
  );
}

function StatRow({ label, value, score, bench }) {
  const color = scoreColor(score);
  const benchText = bench
    ? bench.map((v, i) => {
        const labels = ['плохо','норм','хор','топ'];
        return `${labels[i]}: ${typeof v === 'number' && v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`;
      }).join(' · ')
    : null;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 36, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
        <MiniBar value={score} color={color} />
        <span style={{ width: 48, fontSize: 11, fontWeight: 600, color, textAlign: 'right', flexShrink: 0 }}>{value}</span>
      </div>
      {benchText && (
        <div style={{ marginLeft: 44, fontSize: 9, color: '#3d4f6b', marginTop: 1 }}>
          {benchText}
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score }) {
  const color = scoreColor(score);
  const r = 16, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="42" height="42" style={{ flexShrink: 0 }}>
      <circle cx="21" cy="21" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
      <circle cx="21" cy="21" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 21 21)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      <text x="21" y="25" textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="Rajdhani,sans-serif">{score}</text>
    </svg>
  );
}

function PlayerScoreCard({ player, rank, team }) {
  const [open, setOpen] = useState(false);
  const sc = calcScore(player);
  const color = scoreColor(sc.total);
  const teamColor = team === 'radiant' ? 'var(--radiant)' : 'var(--dire)';
  const name = player.profile?.name || player.personaname || 'Игрок';

  const posColors = { 1:'#facc15', 2:'#a78bfa', 3:'#f87171', 4:'#34d399', 5:'#60a5fa' };
  const posColor = posColors[sc.pos] || 'var(--text-muted)';

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'grid', gridTemplateColumns: '18px 42px 1fr auto',
          gap: 8, alignItems: 'center',
          padding: '6px 10px',
          background: 'var(--bg-card)',
          border: `1px solid ${open ? color + '55' : 'var(--border)'}`,
          borderLeft: `2px solid ${teamColor}`,
          borderRadius: open ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'Rajdhani,sans-serif' }}>#{rank}</span>
        <ScoreRing score={sc.total} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 5 }}>
            {name}
            <span style={{ fontSize: 9, fontWeight: 700, color: posColor, background: posColor + '1a', padding: '1px 4px', borderRadius: 3, flexShrink: 0, letterSpacing: '0.03em' }}>
              {sc.posLabel}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{player.heroName || '—'}</span>
            <span style={{ margin: '0 5px', color: 'var(--text-muted)' }}>·</span>
            {sc.k}/{sc.d}/{sc.a}
            {sc.gpm > 0 && <><span style={{ margin: '0 5px', color: 'var(--text-muted)' }}>·</span><span style={{ color: 'var(--gold)' }}>{sc.gpm}g</span></>}
            {sc.nw > 0 && <><span style={{ margin: '0 5px', color: 'var(--text-muted)' }}>·</span><span style={{ color: 'var(--text-muted)' }}>{(sc.nw/1000).toFixed(1)}k</span></>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'Rajdhani,sans-serif', letterSpacing: '0.05em' }}>
            {scoreLabel(sc.total)}
          </span>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>WR {sc.wr}%</div>
        </div>
      </div>

      {open && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${color}55`,
          borderTop: 'none',
          borderRadius: '0 0 var(--radius-md) var(--radius-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: posColor, fontWeight: 700, letterSpacing: '0.05em' }}>
              {sc.posLabel.toUpperCase()} — скор относительно роли
            </span>
            <span style={{ fontSize: 10, color: scoreColor(sc.total), fontWeight: 700 }}>
              {sc.total}/100
            </span>
          </div>
          {sc.hints?.length > 0 && (
            <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {sc.hints.map((h, i) => (
                <span key={i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>{h}</span>
              ))}
            </div>
          )}
          <StatRow label="KDA"  value={sc.kda}                                     score={sc.kdaScore} bench={[0.8, 1.8, 3.2, 5.5]} />
          <StatRow label="GPM"  value={sc.gpm || '—'}                              score={sc.gpmScore} bench={sc.bench.gpm} />
          <StatRow label="NW"   value={sc.nw ? `${(sc.nw/1000).toFixed(1)}k` : '—'} score={sc.nwScore} bench={sc.bench.nw} />
          <StatRow label="LH"   value={sc.lh || '—'}                               score={sc.lhScore}  bench={sc.bench.lh} />
          <StatRow label="DMG"  value={sc.dmg ? `${(sc.dmg/1000).toFixed(0)}k` : '—'} score={sc.dmgScore} bench={sc.bench.dmg} />
          <StatRow label="WR%"  value={sc.wr ? `${sc.wr}%` : '—'}                 score={sc.wrScore}  bench={[40, 48, 55, 65]} />
        </div>
      )}
    </div>
  );
}

function AnalysisBlock({ players }) {
  const scores = players.map(p => ({ ...p, _sc: calcScore(p) }))
    .sort((a, b) => b._sc.total - a._sc.total);

  const radiant = scores.filter(p => p.team_number === 0);
  const dire    = scores.filter(p => p.team_number === 1);

  const radiantAvg = Math.round(radiant.reduce((s, p) => s + p._sc.total, 0) / Math.max(1, radiant.length));
  const direAvg    = Math.round(dire.reduce((s, p) => s + p._sc.total, 0) / Math.max(1, dire.length));
  const mvp        = scores[0];
  const weakest    = scores[scores.length - 1];

  const barW = 180;
  const rW = Math.round((radiantAvg / (radiantAvg + direAvg)) * barW);

  return (
    <div style={{ marginTop: 10 }}>
      {/* Team comparison bar */}
      <div style={{ padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}>
          <span style={{ color: 'var(--radiant)', fontWeight: 700 }}>Radiant {radiantAvg}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Средний скор</span>
          <span style={{ color: 'var(--dire)', fontWeight: 700 }}>{direAvg} Dire</span>
        </div>
        <div style={{ height: 6, background: 'rgba(248,113,113,0.3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${(radiantAvg / (radiantAvg + direAvg)) * 100}%`, height: '100%', background: 'var(--radiant)', borderRadius: 3, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            🏆 MVP: <span style={{ color: scoreColor(mvp._sc.total), fontWeight: 600 }}>{mvp.profile?.name || mvp.personaname}</span> ({mvp._sc.total})
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            ⚠️ Слабый: <span style={{ color: scoreColor(weakest._sc.total), fontWeight: 600 }}>{weakest.profile?.name || weakest.personaname}</span> ({weakest._sc.total})
          </span>
        </div>
      </div>

      {/* Radiant players */}
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--radiant)', letterSpacing: '0.1em', marginBottom: 5, fontFamily: 'Rajdhani,sans-serif' }}>▲ RADIANT</div>
      {radiant.sort((a,b) => b._sc.total - a._sc.total).map((p, i) => (
        <PlayerScoreCard key={p.account_id} player={p} rank={i+1} team="radiant" />
      ))}

      {/* Dire players */}
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dire)', letterSpacing: '0.1em', margin: '10px 0 5px', fontFamily: 'Rajdhani,sans-serif' }}>▼ DIRE</div>
      {dire.sort((a,b) => b._sc.total - a._sc.total).map((p, i) => (
        <PlayerScoreCard key={p.account_id} player={p} rank={i+1} team="dire" />
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const tracker = useTracker();
  const [matchInput, setMatchInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [logBadge, setLogBadge] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  React.useEffect(() => {
    if (!window.electronAPI?.onLogBadge) return;
    window.electronAPI.onLogBadge(() => setLogBadge(true));
  }, []);

  React.useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) return;
    window.electronAPI.onUpdateStatus((info) => {
      if (info.status === 'available' || info.status === 'downloaded') {
        setUpdateAvailable(true);
      }
    });
  }, []);

  const displayMatch = tracker.matchData || (demoLoaded ? DEMO : null);
  const radiant = displayMatch?.players?.filter(p => p.team_number === 0) || [];
  const dire = displayMatch?.players?.filter(p => p.team_number === 1) || [];

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setSearchResults(null);
    setSelectedProfile(null);
    const results = await tracker.searchPlayer(searchInput.trim());
    if (results) setSearchResults(results);
  };

  const handleSelectProfile = async (item) => {
    const id = item.account_id || item.accountId;
    if (!id) return;
    setSelectedProfile(null);
    try {
      const profile = await fetch(`http://localhost:3001/profile/${id}`).then(r => r.json());
      setSelectedProfile(profile);
    } catch {
      setSelectedProfile({ ...item, name: item.personaname || 'Игрок' });
    }
  };

  const isElectron = typeof window.electronAPI !== 'undefined';

  return (
    <div style={s.app}>
      {/* Title bar */}
      <div style={s.titleBar}>
        <div style={s.logo}>D2</div>
        <span style={s.titleText}>DOTA 2 TRACKER</span>
        <div style={{ ...s.dot, background: tracker.serverOnline ? 'var(--radiant)' : '#f87171' }} title={tracker.serverOnline ? 'GSI онлайн' : 'GSI офлайн'} />
        <span style={{ fontSize: 10, color: tracker.serverOnline ? 'var(--radiant)' : '#f87171' }}>
          {tracker.serverOnline ? 'LIVE' : 'OFF'}
        </span>
        {isElectron && (
          <div style={s.winBtns}>
            <button
              title="Настройки (Alt+S)"
              onClick={() => window.electronAPI.openSettings()}
              style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', WebkitAppRegion: 'no-drag', lineHeight: 1 }}
            >
              <span style={{ fontSize: 13, opacity: 0.6 }}>⚙️</span>
              {updateAvailable && <span style={{ position: 'absolute', top: 0, right: 0, width: 5, height: 5, borderRadius: '50%', background: '#6c8cff' }} />}
            </button>
            <button
              title="Логи (Alt+L)"
              onClick={() => { window.electronAPI.openLogs(); setLogBadge(false); }}
              style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', WebkitAppRegion: 'no-drag', lineHeight: 1 }}
            >
              <span style={{ fontSize: 13, opacity: logBadge ? 1 : 0.5 }}>📋</span>
              {logBadge && <span style={{ position: 'absolute', top: 0, right: 0, width: 5, height: 5, borderRadius: '50%', background: '#f87171' }} />}
            </button>
            <button style={{ ...s.winBtn, background: '#facc15' }} onClick={() => window.electronAPI.minimize()} title="Свернуть">−</button>
            <button style={{ ...s.winBtn, background: '#f87171' }} onClick={() => window.electronAPI.close()} title="Скрыть">×</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {[['pick', '🎯 ПИК'], ['match', '📊 МАТЧ'], ['search', '🔍 ПОИСК']].map(([id, label]) => (
          <button key={id} style={{ ...s.tab, ...(tracker.activeTab === id ? s.tabActive : {}) }}
            onClick={() => tracker.setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {/* Body */}
      <div style={s.body}>

        {/* ── ПИК ── */}
        {tracker.activeTab === 'pick' && (
          <>
            {/* GSI статус */}
            <div style={s.gsiPhase}>
              <div style={{ ...s.dot, width: 8, height: 8,
                background: tracker.serverOnline ? 'var(--radiant)' : 'var(--text-muted)',
                borderRadius: '50%', animation: tracker.serverOnline ? 'pulse 2s infinite' : 'none' }} />
              <span style={{ fontSize: 12, color: tracker.serverOnline ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {tracker.gsiState
                  ? GAME_STATES[tracker.gsiState.gameState] || tracker.gsiState.gameState
                  : tracker.serverOnline ? 'Запусти Dota 2' : 'GSI сервер не запущен'}
              </span>
              {tracker.gsiState?.matchId && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  #{tracker.gsiState.matchId}
                </span>
              )}
            </div>

            {/* Нет сервера */}
            {!tracker.serverOnline && (
              <div style={s.serverOff}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>⚡</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>GSI сервер не запущен</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  Приложение запускает его автоматически.<br/>Если не помогло — перезапусти трекер.
                </div>
                <button style={{ ...s.btn, marginTop: 12 }} onClick={() => { setDemoLoaded(true); tracker.setActiveTab('match'); }}>
                  Посмотреть демо →
                </button>
              </div>
            )}

            {/* Сервер онлайн, нет матча */}
            {tracker.serverOnline && !tracker.gsiState?.matchId && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 12px', lineHeight: 2 }}>
                🎮 Зайди в матч в Dota 2<br/>
                <span style={{ fontSize: 11 }}>Статистика загрузится автоматически</span>
              </div>
            )}

            {/* Пик / стратегия — ищем live данные */}
            {tracker.serverOnline && tracker.gsiState?.matchId && tracker.liveStatus === 'waiting' && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 12px', lineHeight: 2 }}>
                <div style={{ fontSize: 16, marginBottom: 8 }}>🔍</div>
                Ищем данные об игроках...<br/>
                <span style={{ fontSize: 11 }}>Пробуем live API каждые 30 секунд</span>
                <div style={{ marginTop: 10 }}>
                  <button style={s.btn} onClick={() => tracker.loadLive(tracker.gsiState.matchId)}>
                    Попробовать сейчас
                  </button>
                </div>
              </div>
            )}

            {/* Идёт загрузка матча */}
            {tracker.serverOnline && tracker.liveStatus === 'loading' && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 12px', lineHeight: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <div className="loading-dots" style={{ display: 'flex', gap: 4 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
                        animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
                Загружаем данные об игроках...
              </div>
            )}

            {/* Матч ещё не спарсен */}
            {tracker.serverOnline && tracker.liveStatus === 'not_parsed' && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 12px', lineHeight: 2 }}>
                <div style={{ fontSize: 16, marginBottom: 8 }}>⏱</div>
                OpenDota ещё обрабатывает матч<br/>
                <span style={{ fontSize: 11 }}>Повторяем попытку каждые 30 секунд...</span>
                {tracker.gsiState?.matchId && (
                  <div style={{ marginTop: 10 }}>
                    <button style={s.btn} onClick={() => tracker.loadMatch(tracker.gsiState.matchId)}>
                      Попробовать сейчас
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Частичные данные (только свой игрок) */}
            {tracker.serverOnline && tracker.liveStatus === 'partial' && tracker.matchData && (
              <div style={{ padding: '8px 0' }}>
                <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, marginBottom: 8, textAlign: 'center', padding: '6px', background: 'rgba(245,200,66,0.08)', borderRadius: 6 }}>
                  ⚠ Live данные недоступны — матч не в публичной трансляции<br/>
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>Показана только твоя статистика. Добавь STEAM_API_KEY в настройки для полных данных.</span>
                </div>
                <button style={{ ...s.btn, width: '100%', justifyContent: 'center', display: 'flex', marginTop: 6 }}
                  onClick={() => tracker.setActiveTab('match')}>
                  Смотреть статистику →
                </button>
              </div>
            )}

            {/* Матч загружен */}
            {tracker.serverOnline && tracker.liveStatus === 'ready' && tracker.matchData && (
              <div style={{ padding: '12px 0' }}>
                <div style={{ fontSize: 11, color: 'var(--radiant)', fontWeight: 600, marginBottom: 10, textAlign: 'center' }}>
                  ✓ Данные загружены — #{tracker.matchData.match_id}
                </div>
                <button style={{ ...s.btn, width: '100%', justifyContent: 'center', display: 'flex' }}
                  onClick={() => tracker.setActiveTab('match')}>
                  Открыть статистику →
                </button>
              </div>
            )}

            {/* Ошибка */}
            {tracker.liveStatus === 'error' && tracker.error && (
              <div style={{ ...s.status, background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', marginTop: 8 }}>
                {tracker.error}
              </div>
            )}
          </>
        )}

        {/* ── МАТЧ ── */}
        {tracker.activeTab === 'match' && (
          <>
            <div style={s.inputRow}>
              <input
                style={s.input}
                placeholder="ID матча (10 цифр)"
                value={matchInput}
                onChange={e => setMatchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && tracker.loadMatch(matchInput)}
              />
              <button style={s.btn} onClick={() => tracker.loadMatch(matchInput)} disabled={tracker.loading}>
                {tracker.loading ? '...' : 'Найти'}
              </button>
              <button style={{ ...s.btn, background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.3)', color: 'var(--radiant)' }}
                onClick={() => { setDemoLoaded(true); tracker.setMatchData(null); }}>
                Демо
              </button>
            </div>

            {tracker.error && (
              <div style={{ ...s.status, background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                {tracker.error}
              </div>
            )}

            {displayMatch && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: 11, color: 'var(--text-muted)', padding: '6px 0' }}>
                  <span>#{displayMatch.match_id}</span>
                  <span>·</span>
                  <span style={{ color: displayMatch.radiant_win ? 'var(--radiant)' : 'var(--dire)', fontWeight: 600 }}>
                    {displayMatch.radiant_win ? 'Radiant победил' : 'Dire победил'}
                  </span>
                  <span>·</span>
                  <span>{Math.floor((displayMatch.duration || 0) / 60)}:{String((displayMatch.duration || 0) % 60).padStart(2, '0')}</span>
                </div>

                <div style={{ ...s.teamLabel, color: 'var(--radiant)', marginTop: 0, display: 'none' }} />

                <AnalysisBlock players={displayMatch.players} />
              </>
            )}

            {!displayMatch && !tracker.loading && !tracker.error && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0', lineHeight: 2 }}>
                Введи ID матча<br/>или нажми «Демо»
              </div>
            )}
          </>
        )}

        {/* ── ПОИСК ── */}
        {tracker.activeTab === 'search' && (
          <>
            <div style={s.inputRow}>
              <input
                style={s.input}
                placeholder="Ник или Steam ID / account_id"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <button style={s.btn} onClick={handleSearch} disabled={tracker.loading}>
                {tracker.loading ? '...' : 'Искать'}
              </button>
            </div>

            {searchResults && !selectedProfile && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Результаты:</div>
                {searchResults.map((item, i) => (
                  <div key={i} style={s.searchResult} onClick={() => handleSelectProfile(item)}>
                    {item.avatar && <img src={item.avatar} alt="" style={{ width: 28, height: 28, borderRadius: 4 }} />}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {item.personaname || item.name || 'Игрок'}
                      </div>
                      {item.similarity !== undefined && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Совпадение: {Math.round(item.similarity * 100)}%
                        </div>
                      )}
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)' }}>→</span>
                  </div>
                ))}
              </>
            )}

            {selectedProfile && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 12 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  {selectedProfile.avatarFull || selectedProfile.avatar
                    ? <img src={selectedProfile.avatarFull || selectedProfile.avatar} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                    : <div style={{ width: 48, height: 48, borderRadius: 6, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--text-muted)' }}>
                        {selectedProfile.name?.[0]?.toUpperCase()}
                      </div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedProfile.name}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                      {selectedProfile.rank && (
                        <span style={{ fontSize: 10, color: getRankColor(selectedProfile.rank), fontWeight: 600 }}>{getRankName(selectedProfile.rank)}</span>
                      )}
                      {selectedProfile.leaderboardRank && (
                        <span style={{ fontSize: 10, color: '#e8c96a' }}>LB #{selectedProfile.leaderboardRank}</span>
                      )}
                      {selectedProfile.mainRoleName && (
                        <span style={{ fontSize: 10, color: ROLE_COLORS_SEARCH[selectedProfile.mainRole], fontWeight: 600 }}>
                          {selectedProfile.mainRoleName}
                        </span>
                      )}
                    </div>
                  </div>
                  <button style={{ ...s.btn, flexShrink: 0 }} onClick={() => setSelectedProfile(null)}>←</button>
                </div>

                {/* W/L/WR bar */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, marginBottom: 10 }}>
                  {[
                    ['WR', selectedProfile.winrate != null ? `${selectedProfile.winrate}%` : '—',
                      selectedProfile.winrate >= 55 ? 'var(--radiant)' : selectedProfile.winrate >= 50 ? 'var(--gold)' : 'var(--dire)'],
                    ['Матчи', selectedProfile.totalGames ?? '—', 'var(--text-primary)'],
                    ['GPM', selectedProfile.avgGPM || '—', 'var(--gold)'],
                    ['LH', selectedProfile.avgLH || '—', 'var(--text-secondary)'],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ textAlign: 'center', padding: '7px 4px', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'Rajdhani, sans-serif' }}>{val}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Средние */}
                <div style={{ marginBottom: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  {selectedProfile.avgKDA && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-muted)' }}>KDA</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedProfile.avgKDA.k}/{selectedProfile.avgKDA.d}/{selectedProfile.avgKDA.a}</span>
                    </div>
                  )}
                  {selectedProfile.avgXPM > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-muted)' }}>XPM</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedProfile.avgXPM}</span>
                    </div>
                  )}
                  {selectedProfile.avgHD > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Урон</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedProfile.avgHD >= 1000 ? (selectedProfile.avgHD/1000).toFixed(1)+'k' : selectedProfile.avgHD}</span>
                    </div>
                  )}
                  {selectedProfile.avgDur > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Длина</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{Math.floor(selectedProfile.avgDur/60)}:{String(selectedProfile.avgDur%60).padStart(2,'0')}</span>
                    </div>
                  )}
                </div>

                {/* Роли */}
                {selectedProfile.roleCount?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 5 }}>РОЛИ</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {selectedProfile.roleCount.slice(0,4).map(({ role, count }) => {
                        const rwr = selectedProfile.roleWR?.[role];
                        return (
                          <div key={role} style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: `1px solid ${ROLE_COLORS_SEARCH[role]}33` }}>
                            <span style={{ fontSize: 11, color: ROLE_COLORS_SEARCH[role], fontWeight: 600 }}>
                              {{ 1:'Carry',2:'Mid',3:'Off',4:'Sup' }[role]}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>{count}г</span>
                            {rwr && <span style={{ fontSize: 10, marginLeft: 4, color: rwr.wr>=52?'var(--radiant)':rwr.wr<48?'var(--dire)':'var(--gold)' }}>{rwr.wr}%</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Топ герои */}
                {selectedProfile.topHeroes?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 5 }}>ТОП ГЕРОИ</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {selectedProfile.topHeroes.slice(0, 5).map((h, i) => {
                        const wr = h.winrate;
                        const wrC = wr >= 55 ? 'var(--radiant)' : wr < 48 ? 'var(--dire)' : 'var(--gold)';
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-primary)', flex: 1, fontWeight: 500 }}>{h.name}</span>
                            <span style={{ fontSize: 10, color: wrC, fontWeight: 600 }}>{wr}%</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{h.games}г</span>
                            {h.kda !== '—' && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>KDA {h.kda}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedProfile.profileUrl && (
                  <a href={selectedProfile.profileUrl}
                    style={{ ...s.btn, display: 'block', textAlign: 'center', marginTop: 8, textDecoration: 'none', lineHeight: '28px' }}
                    onClick={e => { e.preventDefault(); window.open(selectedProfile.profileUrl, '_blank'); }}>
                    OpenDota ↗
                  </a>
                )}
              </div>
            )}

            {!searchResults && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0', lineHeight: 2 }}>
                Найди любого игрока<br/>по нику или Steam ID
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
