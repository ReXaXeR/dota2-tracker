// src/hooks/useTracker.js
import { useState, useEffect, useCallback, useRef } from 'react';

const API = 'http://localhost:3001';

const RANKS = {
  10: 'Herald 1', 11: 'Herald 2', 12: 'Herald 3', 13: 'Herald 4', 14: 'Herald 5',
  15: 'Guardian 1', 16: 'Guardian 2', 17: 'Guardian 3', 18: 'Guardian 4', 19: 'Guardian 5',
  25: 'Crusader 1', 26: 'Crusader 2', 27: 'Crusader 3', 28: 'Crusader 4', 29: 'Crusader 5',
  35: 'Archon 1', 36: 'Archon 2', 37: 'Archon 3', 38: 'Archon 4', 39: 'Archon 5',
  45: 'Legend 1', 46: 'Legend 2', 47: 'Legend 3', 48: 'Legend 4', 49: 'Legend 5',
  55: 'Ancient 1', 56: 'Ancient 2', 57: 'Ancient 3', 58: 'Ancient 4', 59: 'Ancient 5',
  65: 'Divine 1', 66: 'Divine 2', 67: 'Divine 3', 68: 'Divine 4', 69: 'Divine 5',
  80: 'Immortal',
};

export function getRankName(tier) {
  if (!tier) return '—';
  return RANKS[tier] || (tier >= 80 ? 'Immortal' : `Rank ${tier}`);
}

export function getRankColor(tier) {
  if (!tier) return '#7a8299';
  if (tier >= 80) return '#e8c96a';
  if (tier >= 65) return '#a78bfa';
  if (tier >= 55) return '#60a5fa';
  if (tier >= 45) return '#34d399';
  if (tier >= 35) return '#c084fc';
  if (tier >= 25) return '#fb923c';
  if (tier >= 15) return '#4ade80';
  return '#9ca3af';
}

const GAME_STATES_ACTIVE = [
  'DOTA_GAMERULES_STATE_HERO_SELECTION',
  'DOTA_GAMERULES_STATE_STRATEGY_TIME',
  'DOTA_GAMERULES_STATE_PRE_GAME',
  'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS',
  'DOTA_GAMERULES_STATE_POST_GAME',
];

export function useTracker() {
  const [serverOnline, setServerOnline]   = useState(false);
  const [gsiState, setGsiState]           = useState(null);
  const [matchData, setMatchData]         = useState(null);
  const [liveStatus, setLiveStatus]       = useState(null); // 'loading' | 'waiting' | 'ready' | 'error' | 'not_parsed'
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [activeTab, setActiveTab]         = useState('pick');
  const [searchQuery, setSearchQuery]     = useState('');

  const pollRef      = useRef(null);
  const autoLoadRef  = useRef(null); // matchId который уже загружаем/загрузили
  const retryRef     = useRef(null);
  const retryCount   = useRef(0);

  // ─── Проверка сервера ─────────────────────────────────────────────────────
  const checkServer = useCallback(async () => {
    try {
      const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(1500) });
      setServerOnline(r.ok);
      return r.ok;
    } catch {
      setServerOnline(false);
      return false;
    }
  }, []);

  // ─── Загрузка live данных (во время пика / игры) ─────────────────────────
  const loadLive = useCallback(async (matchId) => {
    setLoading(true);
    setLiveStatus('loading');
    setError(null);
    try {
      const r = await fetch(`${API}/live/${matchId}`, { signal: AbortSignal.timeout(15000) });
      const data = await r.json();
      if (!data.players?.length) throw new Error('Нет данных об игроках');
      setMatchData(data);
      setLiveStatus(data.partial ? 'partial' : 'ready');
      setActiveTab('match');
      retryCount.current = 0;
    } catch (e) {
      console.warn('Live load failed:', e.message);
      setLiveStatus('waiting');
      // Повторяем каждые 30 сек
      if (retryCount.current < 10) {
        retryCount.current += 1;
        retryRef.current = setTimeout(() => loadLive(matchId), 30000);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Загрузка матча по ID (после окончания) ───────────────────────────────
  const loadMatch = useCallback(async (matchId, auto = false) => {
    if (!matchId) return;
    setLoading(true);
    if (auto) setLiveStatus('loading');
    setError(null);
    try {
      const r = await fetch(`${API}/match/${matchId}`, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || 'Матч не найден');
      }
      const data = await r.json();
      if (!data.players?.length) throw new Error('Нет данных об игроках');
      setMatchData(data);
      if (auto) {
        setLiveStatus('ready');
        setActiveTab('match');
      } else {
        setActiveTab('match');
      }
      retryCount.current = 0;
    } catch (e) {
      const msg = e.message || '';
      if (auto) {
        if (msg.includes('не найден') || msg.includes('not found') || msg.includes('спарсен')) {
          setLiveStatus('not_parsed');
          retryCount.current += 1;
          if (retryCount.current < 20) {
            retryRef.current = setTimeout(() => loadMatch(matchId, true), 30000);
          }
        } else {
          setLiveStatus('error');
          setError(msg);
        }
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Polling GSI ─────────────────────────────────────────────────────────
  const pollGSI = useCallback(async () => {
    try {
      const r = await fetch(`${API}/state`, { signal: AbortSignal.timeout(2000) });
      if (!r.ok) return;
      const data = await r.json();
      setGsiState(prev => {
        const newMatchId = data.matchId;
        const isNewMatch = newMatchId && newMatchId !== autoLoadRef.current;

        if (isNewMatch && GAME_STATES_ACTIVE.includes(data.gameState)) {
          autoLoadRef.current = newMatchId;
          retryCount.current  = 0;
          clearTimeout(retryRef.current);

          const isPick = ['DOTA_GAMERULES_STATE_HERO_SELECTION',
                          'DOTA_GAMERULES_STATE_STRATEGY_TIME',
                          'DOTA_GAMERULES_STATE_PRE_GAME'].includes(data.gameState);

          const isInGame = data.gameState === 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS';
          const isPost   = data.gameState === 'DOTA_GAMERULES_STATE_POST_GAME';

          if (isPick || isInGame) {
            // Во время пика и игры — пробуем live данные
            setLiveStatus('loading');
            loadLive(newMatchId);
          } else if (isPost) {
            // После матча — полный разбор через OpenDota
            setLiveStatus('loading');
            retryRef.current = setTimeout(() => loadMatch(newMatchId, true), 60000);
          }
        }

        // Переход в POST_GAME — запускаем загрузку разбора
        if (
          data.gameState === 'DOTA_GAMERULES_STATE_POST_GAME' &&
          prev?.gameState === 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS' &&
          data.matchId
        ) {
          clearTimeout(retryRef.current);
          retryCount.current = 0;
          setLiveStatus('loading');
          // Ждём 2 минуты перед запросом (OpenDota парсит не мгновенно)
          retryRef.current = setTimeout(() => loadMatch(data.matchId, true), 120000);
        }

        return data;
      });
    } catch { /* silently */ }
  }, [loadLive, loadMatch]);

  // ─── Поиск ────────────────────────────────────────────────────────────────
  const searchPlayer = useCallback(async (query) => {
    setLoading(true);
    setError(null);
    try {
      const isId = /^\d+$/.test(query.trim());
      if (isId) {
        const r = await fetch(`${API}/profile/${query.trim()}`);
        if (!r.ok) throw new Error('Профиль не найден');
        return [await r.json()];
      } else {
        const r = await fetch(`${API}/search?q=${encodeURIComponent(query.trim())}`);
        if (!r.ok) throw new Error('Ошибка поиска');
        const results = await r.json();
        if (!results.length) throw new Error('Игроки не найдены');
        return results;
      }
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Инициализация ────────────────────────────────────────────────────────
  useEffect(() => {
    checkServer();
    const serverTimer = setInterval(checkServer, 5000);
    pollRef.current   = setInterval(pollGSI, 2000);
    return () => {
      clearInterval(serverTimer);
      clearInterval(pollRef.current);
      clearTimeout(retryRef.current);
    };
  }, [checkServer, pollGSI]);

  return {
    serverOnline, gsiState, matchData, liveStatus,
    loading, error, activeTab, setActiveTab,
    searchQuery, setSearchQuery,
    loadMatch, loadLive, searchPlayer, setMatchData, setError,
  };
}
