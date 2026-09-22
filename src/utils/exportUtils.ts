import { ProxyItem, ZipSplitOptions } from '../types';
import JSZip from 'jszip';

export function exportToTxt(items: ProxyItem[], filename = 'socks5_proxies.txt') {
  const content = items.map((p) => p.uri).join('\n');
  downloadBlob(content, filename, 'text/plain;charset=utf-8');
}

/**
 * Formats a ProxyItem into v2ray SOCKS format:
 * socks://user:pass@host:port#🇫🇮Finland - 676ms
 */
export function formatV2RayUri(item: ProxyItem): string {
  const hostPart = item.host.includes(':') && !item.host.startsWith('[')
    ? `[${item.host}]`
    : item.host;

  let authPart = '';
  if (item.username || item.password) {
    const u = encodeURIComponent(item.username || '');
    const p = encodeURIComponent(item.password || '');
    authPart = `${u}:${p}@`;
  }

  const baseLink = `socks://${authPart}${hostPart}:${item.port}`;

  // Build remark / tag after #
  const flag = item.geo?.flag || '';
  const country = item.geo?.country || item.geo?.countryCode || 'Proxy';

  let tag = flag ? `${flag}${country}` : country;

  if (item.ping?.latencyMs !== undefined) {
    tag += ` - ${item.ping.latencyMs}ms`;
  } else if (item.ping?.online === false) {
    tag += ` - Offline`;
  }

  return `${baseLink}#${tag}`;
}

export function exportToV2Ray(items: ProxyItem[], filename = 'socks_v2ray.txt') {
  const content = items.map(formatV2RayUri).join('\n');
  downloadBlob(content, filename, 'text/plain;charset=utf-8');
}

export function exportToCsv(items: ProxyItem[], filename = 'socks5_proxies.csv') {
  const headers = ['IP/Host', 'Port', 'Username', 'Password', 'URI', 'Country', 'City', 'Status', 'Ping (ms)'];
  const rows = items.map((p) => [
    escapeCsv(p.host),
    p.port,
    escapeCsv(p.username),
    escapeCsv(p.password),
    escapeCsv(p.uri),
    escapeCsv(p.geo?.country || ''),
    escapeCsv(p.geo?.city || ''),
    escapeCsv(p.ping ? (p.ping.online ? 'Online' : 'Offline') : 'Not checked'),
    p.ping?.latencyMs !== undefined ? p.ping.latencyMs : '',
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8');
}

export function exportToJson(items: ProxyItem[], filename = 'socks5_proxies.json') {
  const cleanData = items.map((p) => ({
    host: p.host,
    port: p.port,
    username: p.username || undefined,
    password: p.password || undefined,
    uri: p.uri,
    location: p.geo ? {
      country: p.geo.country,
      countryCode: p.geo.countryCode,
      city: p.geo.city,
      isp: p.geo.isp,
    } : undefined,
    ping: p.ping ? {
      online: p.ping.online,
      latencyMs: p.ping.latencyMs,
      error: p.ping.error,
    } : undefined,
  }));
  const jsonContent = JSON.stringify(cleanData, null, 2);
  downloadBlob(jsonContent, filename, 'application/json;charset=utf-8');
}

export async function exportSplitZip(items: ProxyItem[], options: ZipSplitOptions): Promise<void> {
  if (!items || items.length === 0) return;

  const zip = new JSZip();
  const total = items.length;

  const chunks: ProxyItem[][] = [];
  if (options.mode === 'lines_per_file') {
    const linesPerFile = Math.max(1, Math.floor(options.value));
    for (let i = 0; i < total; i += linesPerFile) {
      chunks.push(items.slice(i, i + linesPerFile));
    }
  } else {
    const totalFiles = Math.min(total, Math.max(1, Math.floor(options.value)));
    const chunkSize = Math.ceil(total / totalFiles);
    for (let i = 0; i < total; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
  }

  const numChunks = chunks.length;
  const padLength = Math.max(2, String(numChunks).length);
  const baseName = options.baseFilename.trim() || 'socks5_proxies';

  chunks.forEach((chunk, index) => {
    const partNum = String(index + 1).padStart(padLength, '0');
    let ext = options.fileFormat;
    if (options.fileFormat === 'v2ray') {
      ext = 'txt';
    }
    const fileName = `${baseName}_${options.fileFormat === 'v2ray' ? 'v2ray_' : ''}part_${partNum}.${ext}`;

    let content = '';
    if (options.fileFormat === 'txt') {
      content = chunk.map((p) => p.uri).join('\n');
    } else if (options.fileFormat === 'v2ray') {
      content = chunk.map(formatV2RayUri).join('\n');
    } else if (options.fileFormat === 'csv') {
      const headers = ['IP/Host', 'Port', 'Username', 'Password', 'URI'];
      const rows = chunk.map((p) => [
        escapeCsv(p.host),
        p.port,
        escapeCsv(p.username),
        escapeCsv(p.password),
        escapeCsv(p.uri),
      ]);
      content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (options.fileFormat === 'json') {
      const cleanData = chunk.map((p) => ({
        host: p.host,
        port: p.port,
        username: p.username || undefined,
        password: p.password || undefined,
        uri: p.uri,
      }));
      content = JSON.stringify(cleanData, null, 2);
    }

    zip.file(fileName, content);
  });

  if (options.includeReadme) {
    const readme = `SOCKS5 URI Proxy List - Split Export
==========================================
Дата экспорта: ${new Date().toLocaleString('ru-RU')}
Всего прокси: ${total}
Количество частей в архиве: ${numChunks}
Формат файлов: .${options.fileFormat}
Режим разбиения: ${
      options.mode === 'lines_per_file'
        ? `По ${options.value} прокси в каждом файле`
        : `Разбивка на ${options.value} частей`
    }

Содержимое архива:
${chunks
  .map((chunk, i) => {
    const partNum = String(i + 1).padStart(padLength, '0');
    return ` - ${baseName}_part_${partNum}.${options.fileFormat} (${chunk.length} прокси)`;
  })
  .join('\n')}
`;
    zip.file('README.txt', readme);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const zipFilename = `${baseName}_split_${numChunks}_parts.zip`;
  downloadBlobDirect(zipBlob, zipFilename);
}

function downloadBlobDirect(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsv(val: string): string {
  if (!val) return '""';
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return `"${val}"`;
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  // Fallback for older contexts / iframe constraints
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  let successful = false;
  try {
    successful = document.execCommand('copy');
  } catch {
    successful = false;
  }
  document.body.removeChild(textArea);
  return successful;
}

export const SAMPLE_PROXIES = `185.199.229.15:1080:usr_alpha:pass_alpha123
194.26.229.41:8000:admin:Secret@2026!
45.142.122.9:3128:proxy_user:Pass#Hash?9
91.240.89.102:1080:fastnet:net_pass$44
185.220.101.5:9050:tor_node:tor_pass!
178.62.204.88:1080:user:pass
185.199.229.15:1080:usr_alpha:pass_alpha123
194.26.229.41:8000:admin:Secret@2026!
203.0.113.195:1080
[2001:db8::1]:1080:ipv6_user:ipv6_p@ss
proxy-eu.fastvpn.org:5000:premium_client:Wk92!#xL
invalid_proxy_line_example_without_port`;

export const PRESET_REMOTE_URLS = [
  {
    name: 'GitHub Raw (Sample SOCKS5 List)',
    url: 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt',
    desc: 'Публичный тестовый список прокси (IP:Port)',
  },
  {
    name: 'Hookzof SOCKS5 Public List',
    url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
    desc: 'Публичный репозиторий прокси',
  },
];
