// src/components/PlayerCard.jsx
import React, { useState } from 'react';
import { getRankName, getRankColor } from '../hooks/useTracker';

const ROLE_NAMES  = { 1: 'Carry', 2: 'Mid', 3: 'Offlane', 4: 'Support' };
const ROLE_COLORS = { 1: '#facc15', 2: '#a78bfa', 3: '#f87171', 4: '#60a5fa' };

function fmtTime(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function fmtK(n) {
  if (!n) return '—';
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}
function wrColor(wr) {
  if (wr === null || wr === undefined) return '#7a8299';
  if (wr >= 60) return '#4ade80';
  if (wr >= 53) return '#a3e635';
  if (wr >= 47) return '#facc15';
  if (wr >= 40) return '#fb923c';
  return '#f87171';
}

function Badge({ children, color = '#7a8299', bg }) {
  return (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 600,
      color, background: bg || color + '1a', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function MiniStatRow({ label, value, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>
        {value}
        {sub && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{sub}</span>}
      </span>
    </div>
  );
}

function HeroChip({ hero }) {
  const color = wrColor(hero.winrate);
  return (
    <div style={{
      padding: '4px 8px', borderRadius: 5,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>{hero.name}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <span style={{ fontSize: 10, color }}>WR {hero.winrate}%</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hero.games}г</span>
        {hero.kda !== '—' && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>KDA {hero.kda}</span>}
      </div>
    </div>
  );
}

export default function PlayerCard({ player, team }) {
  const [open, setOpen] = useState(false);
  const pr = player?.profile;
  const teamColor = team === 'radiant' ? 'var(--radiant)' : 'var(--dire)';
  const name = pr?.name || player?.personaname || 'Игрок';
  const rank = pr?.rank || player?.rank_tier;

  const mainRole = pr?.mainRole;
  const roleColor = mainRole ? ROLE_COLORS[mainRole] : 'var(--text-muted)';
  const roleName  = mainRole ? ROLE_NAMES[mainRole]  : null;

  return (
    <div style={{ marginBottom: 4 }}>
      {/* ─── Collapsed row ─────────────────────────────────────── */}
      <div
        onClick={() => pr && setOpen(o => !o)}
        style={{
          display: 'grid',
          gridTemplateColumns: '30px 1fr auto',
          gap: 8, alignItems: 'center',
          padding: '7px 10px',
          background: 'var(--bg-card)',
          border: `1px solid ${open ? teamColor + '55' : 'var(--border)'}`,
          borderLeft: `2px solid ${teamColor}`,
          borderRadius: open ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
          cursor: pr ? 'pointer' : 'default',
        }}
      >
        {/* Avatar */}
        <div style={{ width: 30, height: 30, borderRadius: 5, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {pr?.avatar
            ? <img src={pr.avatar} alt="" style={{ width: 30, height: 30, objectFit: 'cover' }} />
            : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{name[0]?.toUpperCase()}</span>
          }
        </div>

        {/* Name + info */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name}
            </span>
            {rank && (
              <span style={{ fontSize: 9, color: getRankColor(rank), flexShrink: 0 }}>
                {getRankName(rank)}
              </span>
            )}
            {roleName && (
              <span style={{ fontSize: 9, fontWeight: 700, color: roleColor, background: roleColor + '18', padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>
                {roleName}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, display: 'flex', gap: 6, flexWrap: 'nowrap', overflow: 'hidden' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{player?.heroName || '—'}</span>
            {pr?.avgKDA && (
              <span>{pr.avgKDA.k}/{pr.avgKDA.d}/{pr.avgKDA.a}</span>
            )}
            {pr?.avgGPM > 0 && (
              <span style={{ color: 'var(--gold)' }}>{pr.avgGPM}g</span>
            )}
          </div>
        </div>

        {/* WR badge */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          {pr?.winrate !== null && pr?.winrate !== undefined ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: wrColor(pr.winrate), fontFamily: 'Rajdhani,sans-serif' }}>
                {pr.winrate}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pr.totalGames}г</div>
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {pr ? '—' : '⟳'}
            </span>
          )}
        </div>
      </div>

      {/* ─── Expanded detail ───────────────────────────────────── */}
      {open && pr && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${teamColor}33`,
          borderTop: 'none',
          borderRadius: '0 0 var(--radius-md) var(--radius-md)',
        }}>
          {/* Топ герои */}
          {pr.topHeroes?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 5, letterSpacing: '0.05em' }}>ТОП ГЕРОИ</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {pr.topHeroes.slice(0, 4).map((h, i) => <HeroChip key={i} hero={h} />)}
              </div>
            </div>
          )}

          {/* Средние показатели */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 5, letterSpacing: '0.05em' }}>СРЕДНИЕ ЗА ПОСЛЕДНИЕ 20 ИГР</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <MiniStatRow label="KDA" value={pr.avgKDA ? `${pr.avgKDA.k}/${pr.avgKDA.d}/${pr.avgKDA.a}` : '—'} />
              <MiniStatRow label="GPM" value={pr.avgGPM || '—'} />
              <MiniStatRow label="XPM" value={pr.avgXPM || '—'} />
              <MiniStatRow label="Last Hits" value={pr.avgLH || '—'} />
              <MiniStatRow label="Урон" value={fmtK(pr.avgHD)} />
              <MiniStatRow label="Длина матча" value={fmtTime(pr.avgDur)} />
            </div>
          </div>

          {/* Роли */}
          {pr.roleCount?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 5, letterSpacing: '0.05em' }}>РОЛИ</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {pr.roleCount.slice(0, 4).map(({ role, count }) => {
                  const rwr = pr.roleWR?.[role];
                  return (
                    <div key={role} style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: `1px solid ${ROLE_COLORS[role]}33` }}>
                      <span style={{ fontSize: 11, color: ROLE_COLORS[role], fontWeight: 600 }}>{ROLE_NAMES[role]}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 5 }}>{count}г</span>
                      {rwr && <span style={{ fontSize: 10, color: wrColor(rwr.wr), marginLeft: 5 }}>{rwr.wr}%</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* W/L и ссылка */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11 }}>
                <span style={{ color: 'var(--radiant)', fontWeight: 600 }}>{pr.wins}W</span>
                <span style={{ color: 'var(--text-muted)', margin: '0 3px' }}>/</span>
                <span style={{ color: 'var(--dire)', fontWeight: 600 }}>{pr.losses}L</span>
              </span>
              {pr.leaderboardRank && (
                <span style={{ fontSize: 10, color: '#e8c96a' }}>Leaderboard #{pr.leaderboardRank}</span>
              )}
            </div>
            {pr.profileUrl && (
              <a
                href={pr.profileUrl}
                style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}
                onClick={e => { e.preventDefault(); e.stopPropagation(); window.open(pr.profileUrl, '_blank'); }}
              >
                OpenDota ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
