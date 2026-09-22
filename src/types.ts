export interface GeoInfo {
  country?: string;
  countryCode?: string;
  flag?: string;
  city?: string;
  isp?: string;
  ip?: string;
}

export interface PingInfo {
  online?: boolean;
  latencyMs?: number;
  error?: string;
  checkedAt?: number;
}

export interface ProxyItem {
  id: string;
  lineNumber: number;
  raw: string;
  host: string;
  port: number;
  username: string;
  password: string;
  uri: string;
  isValid: boolean;
  error?: string;
  isDuplicate?: boolean;
  geo?: GeoInfo;
  ping?: PingInfo;
  isChecking?: boolean;
}

export interface ConversionOptions {
  scheme: 'socks5://' | 'socks5h://';
  urlEncodeCredentials: boolean;
  removeDuplicates: boolean;
  dedupMode: 'uri' | 'host_port' | 'host_only';
  skipInvalid: boolean;
  trimWhitespace: boolean;
  tagSuffix: string;
  delimiter: 'auto' | ':' | ';' | '|' | '\t';
}

export interface ParseSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  processedAt: number;
}

export interface ZipSplitOptions {
  mode: 'lines_per_file' | 'total_files';
  value: number;
  fileFormat: 'txt' | 'csv' | 'json' | 'v2ray';
  baseFilename: string;
  includeReadme: boolean;
}
