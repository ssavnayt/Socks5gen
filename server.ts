import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import net from 'net';
import dns from 'dns';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-memory cache for IP Geolocation to eliminate external rate limits
interface GeoCacheItem {
  country?: string;
  countryCode?: string;
  flag?: string;
  city?: string;
  isp?: string;
  ip?: string;
  cachedAt: number;
}

const geoCache = new Map<string, GeoCacheItem>();

function countryCodeToFlag(code?: string): string {
  if (!code || code.length !== 2) return '🌐';
  const upper = code.toUpperCase();
  const codePoints = [...upper].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Check TCP connection latency (Ping)
function pingHostPort(
  rawHost: string,
  port: number,
  timeoutMs = 3500
): Promise<{ online: boolean; latencyMs?: number; error?: string }> {
  return new Promise((resolve) => {
    // Strip IPv6 brackets if present: [2001:db8::1] -> 2001:db8::1
    const host = rawHost.replace(/^\[|\]$/g, '').trim();

    if (!host || isNaN(port) || port < 1 || port > 65535) {
      return resolve({ online: false, error: 'Неверный хост или порт' });
    }

    const start = Date.now();
    const socket = new net.Socket();
    let isSettled = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (!isSettled) {
        isSettled = true;
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ online: true, latencyMs: latency });
      }
    });

    socket.on('timeout', () => {
      if (!isSettled) {
        isSettled = true;
        socket.destroy();
        resolve({ online: false, error: 'Таймаут (нет отклика)' });
      }
    });

    socket.on('error', (err: any) => {
      if (!isSettled) {
        isSettled = true;
        socket.destroy();
        const code = err.code || '';
        let msg = 'Недоступен';
        if (code === 'ECONNREFUSED') msg = 'Порт закрыт (Connection refused)';
        else if (code === 'EHOSTUNREACH') msg = 'Хост недостижим';
        else if (code === 'ENOTFOUND') msg = 'DNS имя не найдено';
        resolve({ online: false, error: msg });
      }
    });

    try {
      socket.connect(port, host);
    } catch (err: any) {
      if (!isSettled) {
        isSettled = true;
        socket.destroy();
        resolve({ online: false, error: err.message || 'Ошибка подключения' });
      }
    }
  });
}

// Resolve IP and fetch Geolocation using multi-provider fallback without limits
async function fetchGeoLocation(rawHost: string): Promise<GeoCacheItem> {
  const host = rawHost.replace(/^\[|\]$/g, '').trim();

  // Resolve hostname to IP if it's a domain name
  let targetIp = host;
  const isIpV4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  const isIpV6 = host.includes(':');

  if (!isIpV4 && !isIpV6) {
    try {
      const lookup = await dns.promises.lookup(host, { family: 4 });
      targetIp = lookup.address;
    } catch {
      // Fall back to querying host as-is
    }
  }

  // Check in-memory cache
  const cached = geoCache.get(targetIp) || geoCache.get(host);
  if (cached) {
    return cached;
  }

  // Provider 1: ip-api.com (Fast, free, reliable)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(targetIp)}?fields=status,country,countryCode,city,isp,query`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SOCKS5-Converter/2.0' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success') {
        const item: GeoCacheItem = {
          country: data.country || '',
          countryCode: data.countryCode || '',
          flag: countryCodeToFlag(data.countryCode),
          city: data.city || '',
          isp: data.isp || '',
          ip: data.query || targetIp,
          cachedAt: Date.now(),
        };
        geoCache.set(targetIp, item);
        geoCache.set(host, item);
        return item;
      }
    }
  } catch {
    // Try fallback
  }

  // Provider 2: ipwho.is (Secondary fallback, no key required)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(targetIp)}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SOCKS5-Converter/2.0' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false) {
        const item: GeoCacheItem = {
          country: data.country || '',
          countryCode: data.country_code || '',
          flag: data.flag?.emoji || countryCodeToFlag(data.country_code),
          city: data.city || '',
          isp: data.connection?.isp || data.connection?.org || '',
          ip: data.ip || targetIp,
          cachedAt: Date.now(),
        };
        geoCache.set(targetIp, item);
        geoCache.set(host, item);
        return item;
      }
    }
  } catch {
    // Try next fallback
  }

  // Provider 3: freeipapi.com (Tertiary fallback)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://freeipapi.com/api/json/${encodeURIComponent(targetIp)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const item: GeoCacheItem = {
        country: data.countryName || '',
        countryCode: data.countryCode || '',
        flag: countryCodeToFlag(data.countryCode),
        city: data.cityName || '',
        isp: '',
        ip: data.ipAddress || targetIp,
        cachedAt: Date.now(),
      };
      geoCache.set(targetIp, item);
      geoCache.set(host, item);
      return item;
    }
  } catch {
    // Fallback failure
  }

  const fallbackResult: GeoCacheItem = {
    ip: targetIp,
    country: 'Неизвестно',
    countryCode: '',
    flag: '🌐',
    city: '',
    cachedAt: Date.now(),
  };
  geoCache.set(targetIp, fallbackResult);
  return fallbackResult;
}

// Batch check proxies (Ping & Geolocation)
app.post('/api/check-proxies', async (req, res) => {
  const { proxies, checkPing = true, checkGeo = true, timeoutMs = 3500 } = req.body;

  if (!Array.isArray(proxies) || proxies.length === 0) {
    return res.status(400).json({ error: 'Параметр "proxies" должен быть непустым массивом' });
  }

  // Cap batch size to 100 per request
  const batch = proxies.slice(0, 100);

  try {
    const results = await Promise.all(
      batch.map(async (item: { id: string; host: string; port: number }) => {
        const result: any = {
          id: item.id,
          host: item.host,
          port: item.port,
        };

        const tasks: Promise<any>[] = [];

        if (checkPing) {
          tasks.push(
            pingHostPort(item.host, item.port, timeoutMs).then((pingRes) => {
              result.ping = pingRes;
            })
          );
        }

        if (checkGeo) {
          tasks.push(
            fetchGeoLocation(item.host).then((geoRes) => {
              result.geo = geoRes;
            })
          );
        }

        await Promise.all(tasks);
        return result;
      })
    );

    return res.json({ results, count: results.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Ошибка проверки прокси' });
  }
});

// --- Server-Side Persistent Background Testing Engine ---
interface ProxyTarget {
  id: string;
  host: string;
  port: number;
}

interface JobResultItem {
  id: string;
  host: string;
  port: number;
  ping: { online: boolean; latencyMs?: number; error?: string };
  geo?: GeoCacheItem;
  completedAt: number;
}

interface ServerCheckJob {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'stopped';
  startedAt: number;
  updatedAt: number;
  total: number;
  completed: number;
  onlineCount: number;
  offlineCount: number;
  proxies: ProxyTarget[];
  resultsMap: Map<string, JobResultItem>;
  resultsList: JobResultItem[];
  abortController: AbortController | null;
}

let activeJob: ServerCheckJob = {
  id: '',
  status: 'idle',
  startedAt: 0,
  updatedAt: 0,
  total: 0,
  completed: 0,
  onlineCount: 0,
  offlineCount: 0,
  proxies: [],
  resultsMap: new Map(),
  resultsList: [],
  abortController: null,
};

function startBackgroundCheck(job: ServerCheckJob, timeoutMs = 3500) {
  const concurrency = 25; // 25 parallel socket checks in Node.js
  let nextIndex = 0;
  const total = job.proxies.length;
  const signal = job.abortController?.signal;

  const worker = async () => {
    while (nextIndex < total && !signal?.aborted) {
      const idx = nextIndex++;
      const item = job.proxies[idx];
      if (!item) break;

      try {
        const [pingRes, geoRes] = await Promise.all([
          pingHostPort(item.host, item.port, timeoutMs),
          fetchGeoLocation(item.host),
        ]);

        if (signal?.aborted) break;

        const resItem: JobResultItem = {
          id: item.id,
          host: item.host,
          port: item.port,
          ping: pingRes,
          geo: geoRes,
          completedAt: Date.now(),
        };

        job.resultsMap.set(item.id, resItem);
        job.resultsList.push(resItem);
        job.completed++;
        if (pingRes.online) {
          job.onlineCount++;
        } else {
          job.offlineCount++;
        }
        job.updatedAt = Date.now();
      } catch (err: any) {
        if (signal?.aborted) break;
        const fallbackRes: JobResultItem = {
          id: item.id,
          host: item.host,
          port: item.port,
          ping: { online: false, error: err.message || 'Ошибка проверки' },
          completedAt: Date.now(),
        };
        job.resultsMap.set(item.id, fallbackRes);
        job.resultsList.push(fallbackRes);
        job.completed++;
        job.offlineCount++;
        job.updatedAt = Date.now();
      }
    }
  };

  const poolSize = Math.min(concurrency, Math.max(1, total));
  const pool = Array.from({ length: poolSize }, () => worker());

  Promise.all(pool).then(() => {
    if (!signal?.aborted && job.id === activeJob.id) {
      job.status = 'completed';
      job.updatedAt = Date.now();
    }
  });
}

// Start background test job (continues even if client closes or refreshes browser)
app.post('/api/check-job/start', (req, res) => {
  const { proxies, timeoutMs = 3500 } = req.body;
  if (!Array.isArray(proxies) || proxies.length === 0) {
    return res.status(400).json({ error: 'Список прокси пуст' });
  }

  // Stop running job if any
  if (activeJob.status === 'running' && activeJob.abortController) {
    activeJob.abortController.abort();
  }

  const abortController = new AbortController();
  activeJob = {
    id: 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    status: 'running',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    total: proxies.length,
    completed: 0,
    onlineCount: 0,
    offlineCount: 0,
    proxies,
    resultsMap: new Map(),
    resultsList: [],
    abortController,
  };

  // Start asynchronous background worker
  startBackgroundCheck(activeJob, timeoutMs);

  return res.json({
    success: true,
    jobId: activeJob.id,
    total: activeJob.total,
    status: activeJob.status,
  });
});

// Poll background test job status & new results since cursor
app.get('/api/check-job/status', (req, res) => {
  const cursor = parseInt(req.query.cursor as string, 10) || 0;
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string, 10) || 200));

  const resultsSlice = activeJob.resultsList.slice(cursor, cursor + limit);
  const nextCursor = cursor + resultsSlice.length;
  const hasMore = nextCursor < activeJob.resultsList.length;

  return res.json({
    jobId: activeJob.id,
    status: activeJob.status,
    total: activeJob.total,
    completed: activeJob.completed,
    onlineCount: activeJob.onlineCount,
    offlineCount: activeJob.offlineCount,
    startedAt: activeJob.startedAt,
    updatedAt: activeJob.updatedAt,
    cursor: nextCursor,
    newResults: resultsSlice,
    hasMore,
  });
});

// Stop background test job
app.post('/api/check-job/stop', (req, res) => {
  if (activeJob.status === 'running') {
    if (activeJob.abortController) {
      activeJob.abortController.abort();
    }
    activeJob.status = 'stopped';
    activeJob.updatedAt = Date.now();
  }
  return res.json({
    success: true,
    jobId: activeJob.id,
    status: activeJob.status,
    completed: activeJob.completed,
    total: activeJob.total,
  });
});

// Retrieve all completed results from current job (for fast restoration after page refresh)
app.get('/api/check-job/all-results', (req, res) => {
  return res.json({
    jobId: activeJob.id,
    status: activeJob.status,
    total: activeJob.total,
    completed: activeJob.completed,
    results: activeJob.resultsList,
  });
});

// Single ping endpoint
app.get('/api/ping', async (req, res) => {
  const host = req.query.host as string;
  const port = parseInt(req.query.port as string, 10);
  const timeoutMs = parseInt(req.query.timeout as string, 10) || 3500;

  if (!host || isNaN(port)) {
    return res.status(400).json({ error: 'Параметры "host" и "port" обязательны' });
  }

  const result = await pingHostPort(host, port, timeoutMs);
  return res.json(result);
});

// Single IP location endpoint
app.get('/api/ip-info', async (req, res) => {
  const ipOrHost = (req.query.ip as string) || (req.query.host as string);
  if (!ipOrHost) {
    return res.status(400).json({ error: 'Параметр "ip" или "host" обязателен' });
  }

  const geo = await fetchGeoLocation(ipOrHost);
  return res.json(geo);
});

// API route to fetch proxy list from any internet URL (bypassing CORS)
app.get('/api/fetch-url', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).json({ error: 'Параметр "url" обязателен' });
  }

  try {
    const trimmed = targetUrl.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return res.status(400).json({ error: 'Некорректный формат URL. Пример: https://example.com/proxies.txt' });
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'Поддерживаются только протоколы http:// и https://' });
    }

    const host = parsed.hostname.toLowerCase();
    // Safety check against SSRF to private/loopback addresses
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.16.') ||
      host.startsWith('172.17.') ||
      host.startsWith('172.18.') ||
      host.startsWith('172.19.') ||
      host.startsWith('172.20.') ||
      host.startsWith('172.21.') ||
      host.startsWith('172.22.') ||
      host.startsWith('172.23.') ||
      host.startsWith('172.24.') ||
      host.startsWith('172.25.') ||
      host.startsWith('172.26.') ||
      host.startsWith('172.27.') ||
      host.startsWith('172.28.') ||
      host.startsWith('172.29.') ||
      host.startsWith('172.30.') ||
      host.startsWith('172.31.') ||
      host.startsWith('169.254.') ||
      host.endsWith('.local')
    ) {
      return res.status(403).json({ error: 'Загрузка с локальных и приватных адресов сети запрещена в целях безопасности.' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(trimmed, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/plain, text/html, application/json, */*'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Сервер вернул статус ${response.status}: ${response.statusText}`
      });
    }

    const text = await response.text();
    // Limit to max 10MB to avoid memory exhaustion
    if (text.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'Размер списка превышает лимит (10 МБ)' });
    }

    return res.json({
      content: text,
      status: response.status,
      bytes: text.length,
      contentType: response.headers.get('content-type') || 'text/plain'
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Таймаут соединения: удаленный сервер не ответил в течение 12 секунд' });
    }
    return res.status(500).json({ error: err.message || 'Ошибка загрузки данных из интернета' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
