import { ProxyItem, PingInfo, GeoInfo } from '../types';

export interface CheckProgressCallback {
  (completed: number, total: number, itemUpdate: { id: string; ping?: PingInfo; geo?: GeoInfo }): void;
}

/**
 * Checks a single proxy (TCP ping & Geolocation)
 */
export async function checkSingleProxy(
  item: ProxyItem,
  timeoutMs = 3500
): Promise<{ id: string; ping?: PingInfo; geo?: GeoInfo }> {
  try {
    const res = await fetch('/api/check-proxies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proxies: [{ id: item.id, host: item.host, port: item.port }],
        checkPing: true,
        checkGeo: true,
        timeoutMs,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ошибка сервера (${res.status})`);
    }

    const data = await res.json();
    const first = data.results?.[0];
    if (first) {
      return {
        id: item.id,
        ping: first.ping,
        geo: first.geo,
      };
    }
  } catch (err: any) {
    return {
      id: item.id,
      ping: { online: false, error: err.message || 'Ошибка сети' },
    };
  }

  return { id: item.id };
}

export interface JobStatusResponse {
  jobId: string;
  status: 'idle' | 'running' | 'completed' | 'stopped';
  total: number;
  completed: number;
  onlineCount: number;
  offlineCount: number;
  startedAt: number;
  updatedAt: number;
  cursor: number;
  newResults: Array<{
    id: string;
    host: string;
    port: number;
    ping: PingInfo;
    geo?: GeoInfo;
  }>;
  hasMore: boolean;
}

/**
 * Starts a server-side background proxy testing job.
 * This runs in Node.js and continues even if the browser tab is closed or refreshed.
 */
export async function startServerCheckJob(
  proxies: Array<{ id: string; host: string; port: number }>,
  timeoutMs = 3500
): Promise<{ success: boolean; jobId: string; total: number; status: string }> {
  const res = await fetch('/api/check-job/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proxies, timeoutMs }),
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Функция проверки пинга через сетевые сокеты требует серверного Node.js бэкенда (на статическом GitHub Pages недоступна). Конвертация, дедупликация и экспорт работают на 100% локально!'
      );
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Ошибка запуска задачи (${res.status})`);
  }
  return res.json();
}

/**
 * Polls the current server job status and retrieves newly completed results.
 */
export async function pollServerCheckJob(
  cursor = 0,
  limit = 250
): Promise<JobStatusResponse> {
  const res = await fetch(`/api/check-job/status?cursor=${cursor}&limit=${limit}`);
  if (!res.ok) {
    if (res.status === 404) {
      return {
        jobId: '',
        status: 'idle',
        total: 0,
        completed: 0,
        onlineCount: 0,
        offlineCount: 0,
        startedAt: 0,
        updatedAt: 0,
        cursor: 0,
        newResults: [],
        hasMore: false,
      };
    }
    throw new Error(`Ошибка опроса статуса (${res.status})`);
  }
  return res.json();
}

/**
 * Stops the currently running server-side background job.
 */
export async function stopServerCheckJob(): Promise<void> {
  await fetch('/api/check-job/stop', { method: 'POST' }).catch(() => {});
}

export interface JobAllResultsResponse {
  jobId: string;
  status: 'idle' | 'running' | 'completed' | 'stopped';
  total: number;
  completed: number;
  results: Array<{
    id: string;
    host: string;
    port: number;
    ping: PingInfo;
    geo?: GeoInfo;
  }>;
}

/**
 * Retrieves all results from the active or last completed job.
 */
export async function fetchAllServerJobResults(): Promise<JobAllResultsResponse> {
  const res = await fetch('/api/check-job/all-results');
  if (!res.ok) {
    if (res.status === 404) {
      return {
        jobId: '',
        status: 'idle',
        total: 0,
        completed: 0,
        results: [],
      };
    }
    throw new Error(`Ошибка получения результатов (${res.status})`);
  }
  return res.json();
}
