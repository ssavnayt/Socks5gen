import { ConversionOptions, ProxyItem, ParseSummary } from '../types';

/**
 * Generates deduplication key based on chosen mode
 */
export function getDedupKey(
  item: ProxyItem,
  mode: 'uri' | 'host_port' | 'host_only' = 'uri'
): string {
  if (mode === 'host_port') {
    return `${item.host.toLowerCase()}:${item.port}`;
  }
  if (mode === 'host_only') {
    return item.host.toLowerCase();
  }
  return item.uri;
}

/**
 * Parses raw text input into structured ProxyItem objects and converts to SOCKS5 URI
 */
export function parseProxyList(
  rawText: string,
  options: ConversionOptions
): { items: ProxyItem[]; summary: ParseSummary } {
  const lines = rawText.split(/\r?\n/);
  const items: ProxyItem[] = [];
  const seenKeys = new Set<string>();
  let duplicatesCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = options.trimWhitespace ? rawLine.trim() : rawLine;

    // Skip empty lines unless user specifically wants raw lines
    if (!trimmed) {
      continue;
    }

    const item = parseSingleLine(trimmed, i + 1, options);

    if (item.isValid) {
      const key = getDedupKey(item, options.dedupMode);
      if (seenKeys.has(key)) {
        item.isDuplicate = true;
        duplicatesCount++;
      } else {
        seenKeys.add(key);
      }
    }

    items.push(item);
  }

  const validItems = items.filter((it) => it.isValid && (!options.removeDuplicates || !it.isDuplicate));
  const invalidItems = items.filter((it) => !it.isValid);

  return {
    items,
    summary: {
      total: items.length,
      valid: validItems.length,
      invalid: invalidItems.length,
      duplicates: duplicatesCount,
      processedAt: Date.now(),
    },
  };
}

/**
 * Strips duplicates in-place from the raw input text
 */
export function deduplicateRawText(
  rawText: string,
  options: ConversionOptions
): { deduplicatedText: string; removedCount: number } {
  const lines = rawText.split(/\r?\n/);
  const seen = new Set<string>();
  const outputLines: string[] = [];
  let removedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const item = parseSingleLine(trimmed, i + 1, options);
    if (item.isValid) {
      const key = getDedupKey(item, options.dedupMode);
      if (seen.has(key)) {
        removedCount++;
        continue;
      }
      seen.add(key);
      outputLines.push(trimmed);
    } else {
      // Keep invalid lines or comments so user doesn't lose notes
      if (seen.has(trimmed)) {
        removedCount++;
      } else {
        seen.add(trimmed);
        outputLines.push(trimmed);
      }
    }
  }

  return {
    deduplicatedText: outputLines.join('\n'),
    removedCount,
  };
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Parses an individual line into host, port, user, pass
 * Primary expected format: IP:port:user:pass
 * Also handles: user:pass@IP:port, IP:port, or existing socks5:// URI
 */
export function parseSingleLine(
  line: string,
  lineNumber: number,
  options: ConversionOptions
): ProxyItem {
  const cleanLine = line.trim();
  const lineHash = hashString(cleanLine || `empty-${lineNumber}`);

  const result: ProxyItem = {
    id: `proxy-${lineNumber}-${lineHash}`,
    lineNumber,
    raw: line,
    host: '',
    port: 0,
    username: '',
    password: '',
    uri: '',
    isValid: false,
  };

  try {

    // Strip comments if any (# or // at start of line)
    if (cleanLine.startsWith('#') || cleanLine.startsWith('//')) {
      result.error = 'Строка является комментарием';
      return result;
    }

    // Check if line already has a protocol prefix like socks5://, socks4://, http://
    if (/^[a-zA-Z0-9+.-]+:\/\//.test(cleanLine)) {
      try {
        const parsedUrl = new URL(cleanLine);
        const host = parsedUrl.hostname.replace(/^\[|\]$/g, '');
        const port = parseInt(parsedUrl.port, 10);
        const username = decodeURIComponent(parsedUrl.username || '');
        const password = decodeURIComponent(parsedUrl.password || '');

        if (!host || isNaN(port) || port < 1 || port > 65535) {
          result.error = 'Некорректный хост или порт в URI';
          return result;
        }

        result.host = host;
        result.port = port;
        result.username = username;
        result.password = password;
        result.isValid = true;
        result.uri = buildSocksUri(host, port, username, password, options);
        return result;
      } catch {
        // Continue to regular parsing if URL parse fails
      }
    }

    // Check for user:pass@host:port format
    if (cleanLine.includes('@')) {
      const atIndex = cleanLine.lastIndexOf('@');
      const authPart = cleanLine.substring(0, atIndex);
      const hostPart = cleanLine.substring(atIndex + 1);

      const authSplit = authPart.split(':');
      const hostSplit = hostPart.split(':');

      if (hostSplit.length >= 2) {
        const host = hostSplit[0].trim();
        const port = parseInt(hostSplit[1].trim(), 10);
        const username = authSplit[0]?.trim() || '';
        const password = authSplit.slice(1).join(':').trim() || '';

        if (validateHostAndPort(host, port, result)) {
          result.host = host;
          result.port = port;
          result.username = username;
          result.password = password;
          result.isValid = true;
          result.uri = buildSocksUri(host, port, username, password, options);
          return result;
        }
      }
    }

    // Determine delimiter
    let delimiter = ':';
    if (options.delimiter === 'auto') {
      if (cleanLine.includes('\t')) delimiter = '\t';
      else if (cleanLine.includes('|')) delimiter = '|';
      else if (cleanLine.includes(';')) delimiter = ';';
      else delimiter = ':';
    } else {
      delimiter = options.delimiter;
    }

    // Handle bracketed IPv6 like [2001:db8::1]:1080:user:pass
    let host = '';
    let restParts: string[] = [];

    if (cleanLine.startsWith('[')) {
      const closingBracket = cleanLine.indexOf(']');
      if (closingBracket !== -1) {
        host = cleanLine.substring(1, closingBracket);
        const remainder = cleanLine.substring(closingBracket + 1);
        const subParts = remainder.split(delimiter).filter((p) => p.length > 0);
        restParts = subParts;
      }
    }

    if (!host) {
      const parts = cleanLine.split(delimiter);
      if (parts.length < 2) {
        result.error = `Недостаточно сегментов (найдено ${parts.length}, ожидается минимум 2: IP:Port)`;
        return result;
      }

      // Format: IP:port:user:pass
      // parts[0] = IP/host
      // parts[1] = port
      // parts[2] = user (optional)
      // parts[3] = pass (optional, or parts[3..] joined if password contains delimiter)
      host = parts[0].trim();
      const portStr = parts[1].trim();
      const port = parseInt(portStr, 10);

      if (!validateHostAndPort(host, port, result)) {
        return result;
      }

      const username = parts[2] ? parts[2].trim() : '';
      // In case password itself contained the delimiter (e.g., colons in pass)
      const password = parts.length > 3 ? parts.slice(3).join(delimiter).trim() : '';

      result.host = host;
      result.port = port;
      result.username = username;
      result.password = password;
      result.isValid = true;
      result.uri = buildSocksUri(host, port, username, password, options);
      return result;
    } else {
      // Handled IPv6 bracket format
      if (restParts.length < 1) {
        result.error = 'Отсутствует порт для IPv6 адреса';
        return result;
      }

      const port = parseInt(restParts[0].trim(), 10);
      if (!validateHostAndPort(host, port, result)) {
        return result;
      }

      const username = restParts[1] ? restParts[1].trim() : '';
      const password = restParts.length > 2 ? restParts.slice(2).join(delimiter).trim() : '';

      result.host = host;
      result.port = port;
      result.username = username;
      result.password = password;
      result.isValid = true;
      result.uri = buildSocksUri(host, port, username, password, options);
      return result;
    }
  } catch (err: any) {
    result.error = err.message || 'Ошибка обработки строки';
    return result;
  }
}

function validateHostAndPort(host: string, port: number, item: ProxyItem): boolean {
  if (!host) {
    item.error = 'Отсутствует IP или имя хоста';
    return false;
  }

  // Basic host characters validation (allow IPs and domain names)
  if (/\s/.test(host)) {
    item.error = 'Хост содержит недопустимые пробельные символы';
    return false;
  }

  if (isNaN(port) || port < 1 || port > 65535) {
    item.error = `Недопустимый номер порта (${port || 'не число'}). Допустимо: 1 - 65535`;
    return false;
  }

  return true;
}

export function buildSocksUri(
  host: string,
  port: number,
  username: string,
  password: string,
  options: ConversionOptions
): string {
  // Format host: if IPv6 and not already wrapped in brackets, wrap it
  let formattedHost = host;
  if (host.includes(':') && !host.startsWith('[')) {
    formattedHost = `[${host}]`;
  }

  let authString = '';
  if (username || password) {
    const user = options.urlEncodeCredentials ? encodeURIComponent(username) : username;
    const pass = options.urlEncodeCredentials ? encodeURIComponent(password) : password;

    if (user && pass) {
      authString = `${user}:${pass}@`;
    } else if (user) {
      authString = `${user}@`;
    } else if (pass) {
      authString = `:${pass}@`;
    }
  }

  let uri = `${options.scheme}${authString}${formattedHost}:${port}`;

  if (options.tagSuffix && options.tagSuffix.trim()) {
    const suffix = options.tagSuffix.trim();
    uri += suffix.startsWith('#') ? suffix : `#${suffix}`;
  }

  return uri;
}
