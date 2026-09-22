import { ConversionOptions, PingInfo, GeoInfo } from '../types';
import { SAMPLE_PROXIES } from './exportUtils';

export const STORAGE_KEYS = {
  INPUT_TEXT: 'socks5_input_text_v1',
  CHECKED_DATA: 'socks5_checked_data_v1',
  OPTIONS: 'socks5_options_v1',
  TEXT_FORMAT_MODE: 'socks5_text_format_mode_v1',
  VIEW_MODE: 'socks5_view_mode_v1',
  EXPORT_ONLY_ONLINE: 'socks5_export_only_online_v1',
} as const;

export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  scheme: 'socks5://',
  urlEncodeCredentials: true,
  removeDuplicates: true,
  dedupMode: 'uri',
  skipInvalid: true,
  trimWhitespace: true,
  tagSuffix: '',
  delimiter: 'auto',
};

/**
 * Loads stored input text from localStorage or falls back to sample list.
 */
export function loadStoredInputText(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.INPUT_TEXT);
    if (saved !== null) {
      return saved;
    }
  } catch {
    // Ignore (e.g. private browsing or disabled cookies)
  }
  return SAMPLE_PROXIES;
}

/**
 * Saves raw input text into localStorage.
 */
export function saveStoredInputText(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INPUT_TEXT, text);
  } catch {
    // Ignore quota or permission errors
  }
}

/**
 * Loads stored ping / geo test results from localStorage.
 */
export function loadStoredCheckedData(): Record<
  string,
  { ping?: PingInfo; geo?: GeoInfo; isChecking?: boolean }
> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHECKED_DATA);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        const clean: Record<string, { ping?: PingInfo; geo?: GeoInfo; isChecking?: boolean }> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === 'object') {
            const entry = v as { ping?: PingInfo; geo?: GeoInfo };
            clean[k] = {
              ping: entry.ping,
              geo: entry.geo,
              isChecking: false, // Do not restore stuck checking state
            };
          }
        }
        return clean;
      }
    }
  } catch {
    // Ignore parse or storage errors
  }
  return {};
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingDataToSave: Record<string, { ping?: PingInfo; geo?: GeoInfo; isChecking?: boolean }> | null = null;

/**
 * Saves checked proxy ping and geo results into localStorage with debouncing
 * to prevent UI lag on high proxy volumes.
 */
export function saveStoredCheckedDataDebounced(
  data: Record<string, { ping?: PingInfo; geo?: GeoInfo; isChecking?: boolean }>,
  delayMs = 800
): void {
  pendingDataToSave = data;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    if (pendingDataToSave) {
      saveStoredCheckedData(pendingDataToSave);
      pendingDataToSave = null;
    }
  }, delayMs);
}

// Flush on page unload so no checked results are lost
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (pendingDataToSave) {
      saveStoredCheckedData(pendingDataToSave);
      pendingDataToSave = null;
    }
  });
}

/**
 * Saves checked proxy ping and geo results into localStorage.
 */
export function saveStoredCheckedData(
  data: Record<string, { ping?: PingInfo; geo?: GeoInfo; isChecking?: boolean }>
): void {
  try {
    const clean: Record<string, { ping?: PingInfo; geo?: GeoInfo }> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v && (v.ping || v.geo)) {
        clean[k] = {
          ping: v.ping,
          geo: v.geo,
        };
      }
    }
    localStorage.setItem(STORAGE_KEYS.CHECKED_DATA, JSON.stringify(clean));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Loads stored conversion options.
 */
export function loadStoredOptions(): ConversionOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OPTIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return { ...DEFAULT_CONVERSION_OPTIONS, ...parsed };
      }
    }
  } catch {
    // Ignore
  }
  return DEFAULT_CONVERSION_OPTIONS;
}

/**
 * Saves conversion options into localStorage.
 */
export function saveStoredOptions(options: ConversionOptions): void {
  try {
    localStorage.setItem(STORAGE_KEYS.OPTIONS, JSON.stringify(options));
  } catch {
    // Ignore
  }
}

/**
 * Loads stored output format mode ('uri' | 'v2ray').
 */
export function loadStoredTextFormatMode(): 'uri' | 'v2ray' {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.TEXT_FORMAT_MODE);
    if (saved === 'v2ray' || saved === 'uri') {
      return saved;
    }
  } catch {
    // Ignore
  }
  return 'uri';
}

/**
 * Saves stored output format mode.
 */
export function saveStoredTextFormatMode(mode: 'uri' | 'v2ray'): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TEXT_FORMAT_MODE, mode);
  } catch {
    // Ignore
  }
}

/**
 * Clears input and test check data from localStorage (e.g. on full reset).
 */
export function clearStoredData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.INPUT_TEXT);
    localStorage.removeItem(STORAGE_KEYS.CHECKED_DATA);
  } catch {
    // Ignore
  }
}
