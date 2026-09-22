import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  FileText,
  Table,
  AlertCircle,
  Eye,
  EyeOff,
  Search,
  FileCode,
  FileSpreadsheet,
  Archive,
  Activity,
  Square,
  Play,
  RefreshCw,
  Globe2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Filter,
  Radio,
  ChevronLeft,
  ChevronRight,
  Server,
} from 'lucide-react';
import { ProxyItem, PingInfo, GeoInfo } from '../types';
import { FilterMode } from './StatsCard';
import {
  exportToTxt,
  exportToCsv,
  exportToJson,
  exportToV2Ray,
  formatV2RayUri,
  copyToClipboard,
} from '../utils/exportUtils';
import { loadStoredTextFormatMode, saveStoredTextFormatMode } from '../utils/storageUtils';
import { ZipSplitModal } from './ZipSplitModal';
import {
  startServerCheckJob,
  pollServerCheckJob,
  stopServerCheckJob,
  fetchAllServerJobResults,
  checkSingleProxy,
} from '../utils/proxyChecker';

interface OutputSectionProps {
  items: ProxyItem[];
  validItems: ProxyItem[];
  invalidItems: ProxyItem[];
  filterMode: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
  onUpdateItemCheck: (id: string, ping?: PingInfo, geo?: GeoInfo, isChecking?: boolean) => void;
  onBatchUpdateChecks: (
    updates: Array<{ id: string; host: string; port: number; ping?: PingInfo; geo?: GeoInfo }>
  ) => void;
  onKeepOnlyOnline?: () => void;
  onlineCount: number;
  testedCount: number;
}

export const OutputSection: React.FC<OutputSectionProps> = ({
  items,
  validItems,
  invalidItems,
  filterMode,
  onFilterChange,
  onUpdateItemCheck,
  onBatchUpdateChecks,
  onKeepOnlyOnline,
  onlineCount,
  testedCount,
}) => {
  const [viewMode, setViewMode] = useState<'text' | 'table' | 'errors'>('text');
  const [textFormatMode, setTextFormatMode] = useState<'uri' | 'v2ray'>(() => loadStoredTextFormatMode());
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'untested'>('all');

  useEffect(() => {
    saveStoredTextFormatMode(textFormatMode);
  }, [textFormatMode]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [v2rayCopiedId, setV2rayCopiedId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [customFilename, setCustomFilename] = useState('socks5_proxies');
  const [isZipModalOpen, setIsZipModalOpen] = useState(false);
  const [exportOnlyOnline, setExportOnlyOnline] = useState(false);

  // Batch checking state
  const [isBatchChecking, setIsBatchChecking] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: 0,
  });

  // Table pagination state to prevent UI freeze on large datasets
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(100);

  // Background testing polling refs
  const pollCursorRef = useRef(0);
  const isPollingRef = useRef(false);
  const isBatchCheckingRef = useRef(false);
  isBatchCheckingRef.current = isBatchChecking;

  // Poll server background job status and drain all results
  const pollJobStatus = async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      // Pull up to 400 results per request
      const data = await pollServerCheckJob(pollCursorRef.current, 400);

      if (data.newResults && data.newResults.length > 0) {
        onBatchUpdateChecks(data.newResults);
        pollCursorRef.current = data.cursor;
      }

      setBatchProgress({ completed: data.completed, total: data.total });

      if (data.status === 'running') {
        setIsBatchChecking(true);
        const delay = data.hasMore ? 30 : 600;
        setTimeout(pollJobStatus, delay);
      } else if (data.status === 'completed' || data.status === 'stopped') {
        // If there are still results remaining on server, continue polling until cursor catches up
        if (data.hasMore || (data.completed > 0 && pollCursorRef.current < data.completed)) {
          setIsBatchChecking(true);
          setTimeout(pollJobStatus, 25);
        } else {
          setIsBatchChecking(false);
        }
      } else {
        setIsBatchChecking(false);
      }
    } catch {
      if (isBatchCheckingRef.current) {
        setTimeout(pollJobStatus, 2000);
      }
    } finally {
      isPollingRef.current = false;
    }
  };

  // Restore server job: load ALL results from server at once (even after full reload or tab wake-up)
  const restoreServerJob = async () => {
    try {
      const allData = await fetchAllServerJobResults();
      if (allData.jobId && allData.results && allData.results.length > 0) {
        onBatchUpdateChecks(allData.results);
        pollCursorRef.current = allData.results.length;
        setBatchProgress({ completed: allData.completed, total: allData.total });

        if (allData.status === 'running') {
          setIsBatchChecking(true);
          setTimeout(pollJobStatus, 250);
        } else {
          setIsBatchChecking(false);
        }
      } else if (allData.status === 'running') {
        setIsBatchChecking(true);
        setTimeout(pollJobStatus, 250);
      }
    } catch {
      // Fallback to incremental polling
      pollJobStatus();
    }
  };

  // On initial mount: restore all completed or in-progress proxies
  useEffect(() => {
    restoreServerJob();
  }, []);

  // When tab wakes up from background throttling or window regains focus
  useEffect(() => {
    const handleWakeup = () => {
      if (document.visibilityState === 'visible') {
        restoreServerJob();
      }
    };
    document.addEventListener('visibilitychange', handleWakeup);
    window.addEventListener('focus', handleWakeup);
    return () => {
      document.removeEventListener('visibilitychange', handleWakeup);
      window.removeEventListener('focus', handleWakeup);
    };
  }, []);

  // Sync view mode when stats card filter changes
  useEffect(() => {
    if (filterMode === 'errors') {
      setViewMode('errors');
    } else if (filterMode === 'online') {
      setStatusFilter('online');
      if (viewMode === 'errors') setViewMode('table');
    } else if (filterMode === 'valid') {
      setStatusFilter('all');
      if (viewMode === 'errors') setViewMode('text');
    }
  }, [filterMode]);

  // Start background test on server
  const handleStartBatchCheck = async (onlyUntested = false) => {
    const targets = onlyUntested
      ? validItems.filter((it) => it.ping === undefined)
      : validItems;

    if (targets.length === 0) return;

    // Reset cursor and immediate UI state (no lag, no looping)
    pollCursorRef.current = 0;
    setIsBatchChecking(true);
    setBatchProgress({ completed: 0, total: targets.length });

    try {
      const payload = targets.map((t) => ({ id: t.id, host: t.host, port: t.port }));
      await startServerCheckJob(payload, 3500);
      // Kick off polling
      setTimeout(pollJobStatus, 200);
    } catch (err: any) {
      setIsBatchChecking(false);
      // Fallback message
      alert(err.message || 'Не удалось запустить тестирование на сервере');
    }
  };

  const handleStopBatchCheck = async () => {
    setIsBatchChecking(false);
    try {
      await stopServerCheckJob();
    } catch {
      // Ignore
    }
  };

  // Check single proxy
  const handleCheckSingle = async (item: ProxyItem) => {
    onUpdateItemCheck(item.id, undefined, undefined, true);
    const result = await checkSingleProxy(item, 4000);
    onUpdateItemCheck(item.id, result.ping, result.geo, false);
  };

  // Duplicate items
  const duplicateItems = items.filter((it) => it.isDuplicate);

  // Filter items for display
  const currentDataset = viewMode === 'errors' ? invalidItems : validItems;

  const filteredDataset = useMemo(() => {
    return currentDataset.filter((item) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          item.raw.toLowerCase().includes(q) ||
          item.host.toLowerCase().includes(q) ||
          item.username.toLowerCase().includes(q) ||
          item.port.toString().includes(q) ||
          item.uri.toLowerCase().includes(q) ||
          item.geo?.country?.toLowerCase().includes(q) ||
          item.geo?.city?.toLowerCase().includes(q) ||
          item.geo?.isp?.toLowerCase().includes(q);

        if (!matchesSearch) return false;
      }

      // Ping status filter
      if (viewMode !== 'errors') {
        if (statusFilter === 'online') {
          return item.ping?.online === true;
        }
        if (statusFilter === 'offline') {
          return item.ping && item.ping.online === false;
        }
        if (statusFilter === 'untested') {
          return item.ping === undefined;
        }
      }

      return true;
    });
  }, [currentDataset, searchQuery, viewMode, statusFilter]);

  // Reset pagination when filter or dataset changes
  useEffect(() => {
    setTablePage(1);
  }, [searchQuery, statusFilter, viewMode]);

  const totalTablePages = Math.max(1, Math.ceil(filteredDataset.length / tablePageSize));
  const safeTablePage = Math.min(tablePage, totalTablePages);

  const paginatedDataset = useMemo(() => {
    const start = (safeTablePage - 1) * tablePageSize;
    return filteredDataset.slice(start, start + tablePageSize);
  }, [filteredDataset, safeTablePage, tablePageSize]);

  // Items to export based on online toggle or current filter
  const itemsToExport = useMemo(() => {
    return exportOnlyOnline && onlineCount > 0
      ? validItems.filter((p) => p.ping?.online === true)
      : filteredDataset;
  }, [exportOnlyOnline, onlineCount, validItems, filteredDataset]);

  // Memoize URI texts to avoid expensive string concats on large lists
  const rawUriText = useMemo(() => {
    if (viewMode !== 'text' || textFormatMode !== 'uri') return '';
    return filteredDataset.map((it) => it.uri).join('\n');
  }, [filteredDataset, viewMode, textFormatMode]);

  const v2rayText = useMemo(() => {
    if (viewMode !== 'text' || textFormatMode !== 'v2ray') return '';
    return filteredDataset.map(formatV2RayUri).join('\n');
  }, [filteredDataset, viewMode, textFormatMode]);

  const activeTextContent = textFormatMode === 'v2ray' ? v2rayText : rawUriText;

  const handleCopyAll = async () => {
    const textToCopy = textFormatMode === 'v2ray'
      ? itemsToExport.map(formatV2RayUri).join('\n')
      : itemsToExport.map((p) => p.uri).join('\n');
    if (!textToCopy) return;

    const ok = await copyToClipboard(textToCopy);
    if (ok) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const handleCopySingle = async (item: ProxyItem) => {
    const ok = await copyToClipboard(item.uri);
    if (ok) {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  const handleCopyV2RaySingle = async (item: ProxyItem) => {
    const ok = await copyToClipboard(formatV2RayUri(item));
    if (ok) {
      setV2rayCopiedId(item.id);
      setTimeout(() => setV2rayCopiedId(null), 1500);
    }
  };

  const handleExportTxt = () => {
    const suffix = exportOnlyOnline ? '_online' : '';
    const fn = (customFilename.trim() || 'socks5_proxies') + suffix + '.txt';
    exportToTxt(itemsToExport, fn);
  };

  const handleExportV2Ray = () => {
    const suffix = exportOnlyOnline ? '_online' : '';
    const fn = (customFilename.trim() || 'socks_v2ray') + suffix + '.txt';
    exportToV2Ray(itemsToExport, fn);
  };

  const handleExportCsv = () => {
    const suffix = exportOnlyOnline ? '_online' : '';
    const fn = (customFilename.trim() || 'socks5_proxies') + suffix + '.csv';
    exportToCsv(itemsToExport, fn);
  };

  const handleExportJson = () => {
    const suffix = exportOnlyOnline ? '_online' : '';
    const fn = (customFilename.trim() || 'socks5_proxies') + suffix + '.json';
    exportToJson(itemsToExport, fn);
  };

  const offlineCount = Math.max(0, testedCount - onlineCount);

  return (
    <div id="output-section" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col h-full">
      {/* Header bar: View mode & search */}
      <div className="border-b border-slate-200 bg-slate-50/75 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            id="view-text-btn"
            onClick={() => setViewMode('text')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              viewMode === 'text'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Список URI</span>
            <span className="text-[10px] text-slate-400 font-mono">({validItems.length})</span>
          </button>

          <button
            type="button"
            id="view-table-btn"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Таблица с локацией & пингом</span>
          </button>

          {invalidItems.length > 0 && (
            <button
              type="button"
              id="view-errors-btn"
              onClick={() => setViewMode('errors')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                viewMode === 'errors'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs'
                  : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Ошибки</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px]">
                {invalidItems.length}
              </span>
            </button>
          )}
        </div>

        {/* Search bar inside output */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="output-search-input"
            type="text"
            placeholder="Поиск по IP, стране, городу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 w-36 sm:w-52"
          />
        </div>
      </div>

      {/* Ping & Geo Toolbar */}
      <div className="bg-slate-50/50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Action buttons to test ping & geo */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isBatchChecking ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="check-all-proxies-btn"
                onClick={() => handleStartBatchCheck(false)}
                disabled={validItems.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-2xs"
                title="Проверить TCP доступность (пинг в мс) и определить геолокацию сервера без лимитов"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Проверить пинг и гео</span>
              </button>

              {testedCount > 0 && testedCount < validItems.length && (
                <button
                  type="button"
                  onClick={() => handleStartBatchCheck(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  title="Проверить только те, которые еще не были проверены"
                >
                  <span>Только новые</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="stop-check-btn"
                onClick={handleStopBatchCheck}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Остановить</span>
              </button>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <RefreshCw className="w-3 h-3 text-teal-600 animate-spin" />
                <span className="font-mono">
                  {batchProgress.completed} / {batchProgress.total}
                </span>
                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-600 transition-all duration-200"
                    style={{
                      width: `${
                        batchProgress.total > 0
                          ? Math.round((batchProgress.completed / batchProgress.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-teal-700 font-medium bg-teal-50 px-2 py-0.5 rounded border border-teal-200" title="Тест выполняется сервером в фоновом режиме">
                  <Server className="w-3 h-3 text-teal-600" />
                  <span>В фоне на сервере</span>
                </span>
              </div>
            </div>
          )}

          {/* Quick status chips */}
          {testedCount > 0 && (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                Онлайн: {onlineCount}
              </span>
              <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                Оффлайн: {offlineCount}
              </span>
              {onlineCount > 0 && onKeepOnlyOnline && (
                <button
                  type="button"
                  id="keep-only-online-btn"
                  onClick={onKeepOnlyOnline}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 transition-colors cursor-pointer shadow-2xs"
                  title="Заменить список прокси в левом поле ввода только на живые (онлайн) прокси"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Оставить только онлайн ({onlineCount})</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Quick filter by online/offline */}
        {viewMode !== 'errors' && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 text-[11px] hidden sm:inline mr-1">Фильтр:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-200 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Все
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('online')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1 ${
                statusFilter === 'online'
                  ? 'bg-emerald-100 text-emerald-800 font-semibold'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Онлайн ({onlineCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('offline')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1 ${
                statusFilter === 'offline'
                  ? 'bg-rose-100 text-rose-800 font-semibold'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Оффлайн ({offlineCount})
            </button>
          </div>
        )}
      </div>

      {/* Main output display */}
      <div className="p-4 flex-1 flex flex-col min-h-0">
        {validItems.length === 0 && invalidItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <div className="p-3 bg-slate-100 rounded-full mb-3 text-slate-400">
              <FileCode className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-1">
              Результат появится автоматически
            </p>
            <p className="text-xs text-slate-400 max-w-sm">
              Введите прокси в левом поле или нажмите кнопку «Пример данных» вверху для мгновенной проверки.
            </p>
          </div>
        ) : (
          <>
            {/* View 1: Text format */}
            {viewMode === 'text' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Format toggle: SOCKS5 URI vs V2Ray */}
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      id="format-mode-uri-btn"
                      onClick={() => setTextFormatMode('uri')}
                      className={`px-2.5 py-1 text-xs rounded-md font-mono transition-colors cursor-pointer ${
                        textFormatMode === 'uri'
                          ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      socks5:// URI
                    </button>
                    <button
                      type="button"
                      id="format-mode-v2ray-btn"
                      onClick={() => setTextFormatMode('v2ray')}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                        textFormatMode === 'v2ray'
                          ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                          : 'text-indigo-700 hover:bg-indigo-50 font-medium'
                      }`}
                      title="Формат V2Ray: socks://ссылка#🇫🇮Finland - 676ms"
                    >
                      <Radio className="w-3 h-3" />
                      <span>V2Ray (#🇫🇮Страна - Пинг)</span>
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    {textFormatMode === 'v2ray'
                      ? 'socks://ссылка#🇫🇮Страна - Пинг (для v2rayN, v2rayNG, Nekoray)'
                      : 'Стандартный SOCKS5 URI'}
                  </span>
                </div>

                <div className="relative flex-1 min-h-[280px]">
                  <textarea
                    id="converted-uri-textarea"
                    readOnly
                    value={activeTextContent}
                    placeholder={
                      textFormatMode === 'v2ray'
                        ? 'Здесь появятся ссылки socks://...#🇫🇮Finland - 676ms'
                        : 'Здесь появятся ссылки socks5://...'
                    }
                    className="w-full h-full p-3 font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 transition-all leading-relaxed select-all"
                  />
                  {copiedAll && (
                    <div className="absolute top-3 right-3 bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 animate-fade-in">
                      <Check className="w-3.5 h-3.5" />
                      <span>Скопировано в буфер!</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* View 2: Table format with Geolocation & Latency */}
            {viewMode === 'table' && (
              <div className="flex-1 flex flex-col min-h-[280px]">
                <div className="flex-1 overflow-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-2 px-2.5 w-8">#</th>
                      <th className="py-2 px-3">Локация сервера</th>
                      <th className="py-2 px-3">Пинг / Статус</th>
                      <th className="py-2 px-3">IP / Хост</th>
                      <th className="py-2 px-2.5 w-14">Порт</th>
                      <th className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <span>Пароль</span>
                          <button
                            type="button"
                            onClick={() => setShowPasswords(!showPasswords)}
                            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                            title={showPasswords ? 'Скрыть пароли' : 'Показать пароли'}
                          >
                            {showPasswords ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </th>
                      <th className="py-2 px-3">SOCKS5 URI</th>
                      <th className="py-2 px-2.5 text-right w-16">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px] bg-white">
                    {paginatedDataset.map((item, idx) => {
                      const isChecking = item.isChecking;
                      const hasPing = item.ping !== undefined;
                      const isOnline = item.ping?.online === true;
                      const latency = item.ping?.latencyMs;
                      const itemNumber = (safeTablePage - 1) * tablePageSize + idx + 1;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-2.5 text-slate-400 font-sans">{itemNumber}</td>

                          {/* Geolocation column */}
                          <td className="py-2 px-3 font-sans">
                            {item.geo && item.geo.country ? (
                              <div
                                className="flex items-center gap-1.5 truncate max-w-[170px]"
                                title={`${item.geo.country}${item.geo.city ? ', ' + item.geo.city : ''}${
                                  item.geo.isp ? ' (' + item.geo.isp + ')' : ''
                                }`}
                              >
                                <span className="text-base leading-none select-none">
                                  {item.geo.flag || '🌐'}
                                </span>
                                <div className="truncate">
                                  <div className="font-semibold text-slate-800 text-[11px] truncate">
                                    {item.geo.countryCode || item.geo.country}
                                    {item.geo.city && <span className="font-normal text-slate-500">, {item.geo.city}</span>}
                                  </div>
                                  {item.geo.isp && (
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {item.geo.isp}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300 font-mono">—</span>
                            )}
                          </td>

                          {/* Ping / Latency column */}
                          <td className="py-2 px-3 font-sans whitespace-nowrap">
                            {isChecking ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-medium">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin text-teal-600" />
                                <span>Проверка...</span>
                              </span>
                            ) : hasPing ? (
                              isOnline ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                                    (latency || 0) < 150
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : (latency || 0) < 350
                                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                  title={`Отклик: ${latency} мс`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span>{latency} мс</span>
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-medium bg-rose-50 text-rose-700 border border-rose-200"
                                  title={item.ping?.error || 'Таймаут или порт закрыт'}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                  <span>Оффлайн</span>
                                </span>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCheckSingle(item)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-teal-700 hover:bg-teal-50 border border-slate-200 rounded transition-colors cursor-pointer"
                                title="Проверить пинг и локацию для этого прокси"
                              >
                                <Activity className="w-2.5 h-2.5 text-teal-600" />
                                <span>Пинг</span>
                              </button>
                            )}
                          </td>

                          {/* Host & Port */}
                          <td className="py-2 px-3 font-semibold text-slate-800">{item.host}</td>
                          <td className="py-2 px-2.5 text-slate-600">{item.port}</td>

                          {/* Password */}
                          <td className="py-2 px-3 text-slate-600">
                            {item.password ? (
                              showPasswords ? (
                                item.password
                              ) : (
                                '••••••••'
                              )
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* URI */}
                          <td className="py-2 px-3 text-emerald-700 truncate max-w-xs" title={item.uri}>
                            {item.uri}
                          </td>

                          {/* Row Actions */}
                          <td className="py-2 px-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleCheckSingle(item)}
                                disabled={isChecking}
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-teal-700 transition-colors cursor-pointer"
                                title="Перепроверить пинг и гео"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopySingle(item)}
                                className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                                title="Копировать стандартный URI (socks5://...)"
                              >
                                {copiedId === item.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyV2RaySingle(item)}
                                className="p-1 rounded hover:bg-indigo-100 text-slate-400 hover:text-indigo-700 transition-colors cursor-pointer"
                                title="Копировать в формате V2Ray (socks://...#🇫🇮Страна - Пинг)"
                              >
                                {v2rayCopiedId === item.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Radio className="w-3.5 h-3.5 text-indigo-500" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Controls */}
              {filteredDataset.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-600 select-none">
                  <div className="flex items-center gap-2">
                    <span>
                      Показано <strong className="font-semibold text-slate-800">{(safeTablePage - 1) * tablePageSize + 1}–{Math.min(safeTablePage * tablePageSize, filteredDataset.length)}</strong> из <strong className="font-semibold text-slate-800">{filteredDataset.length.toLocaleString('ru-RU')}</strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Строк:</span>
                      <select
                        value={tablePageSize}
                        onChange={(e) => {
                          setTablePageSize(Number(e.target.value));
                          setTablePage(1);
                        }}
                        className="px-1.5 py-0.5 border border-slate-200 rounded text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                      >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={250}>250</option>
                        <option value={500}>500</option>
                        <option value={1000}>1000</option>
                      </select>
                    </div>
                  </div>

                  {totalTablePages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeTablePage <= 1}
                        onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Назад</span>
                      </button>
                      <span className="px-2 text-xs text-slate-500">
                        Стр. <strong className="text-slate-800">{safeTablePage}</strong> из <strong className="text-slate-800">{totalTablePages}</strong>
                      </span>
                      <button
                        type="button"
                        disabled={safeTablePage >= totalTablePages}
                        onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                        className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <span>Вперёд</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

            {/* View 3: Error Inspector */}
            {viewMode === 'errors' && (
              <div className="flex-1 overflow-auto border border-rose-200 bg-rose-50/20 rounded-lg min-h-[280px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-rose-100/70 text-rose-900 font-semibold sticky top-0 border-b border-rose-200 z-10">
                    <tr>
                      <th className="py-2 px-3 w-16">Строка</th>
                      <th className="py-2 px-3">Исходный текст</th>
                      <th className="py-2 px-3">Причина ошибки</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 font-mono text-[11px] bg-white">
                    {invalidItems.slice(0, 150).map((item) => (
                      <tr key={item.id} className="hover:bg-rose-50/40 transition-colors">
                        <td className="py-2 px-3 text-rose-600 font-semibold font-sans">
                          № {item.lineNumber}
                        </td>
                        <td className="py-2 px-3 text-slate-700 break-all">{item.raw}</td>
                        <td className="py-2 px-3 text-rose-700 font-sans">{item.error}</td>
                      </tr>
                    ))}
                    {invalidItems.length > 150 && (
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-center text-slate-500 font-sans bg-rose-50/50">
                          Показано первые 150 из {invalidItems.length.toLocaleString('ru-RU')} некорректных строк
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Export and Action Toolbar */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              {/* Filename input and online-only checkbox */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Имя файла:</span>
                  <input
                    id="custom-filename-input"
                    type="text"
                    value={customFilename}
                    onChange={(e) => setCustomFilename(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md font-mono text-slate-800 w-36 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>

                {onlineCount > 0 && (
                  <label className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={exportOnlyOnline}
                      onChange={(e) => setExportOnlyOnline(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-400 cursor-pointer"
                    />
                    <span className="font-medium">Экспорт только онлайн ({onlineCount})</span>
                  </label>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  id="copy-all-btn"
                  onClick={handleCopyAll}
                  disabled={validItems.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAll ? 'Скопировано!' : `Копировать всё (${itemsToExport.length})`}</span>
                </button>

                <button
                  type="button"
                  id="export-v2ray-btn"
                  onClick={handleExportV2Ray}
                  disabled={validItems.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="Экспорт в V2Ray: socks://ссылка#🇫🇮Finland - 676ms"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Экспорт в V2Ray</span>
                </button>

                <button
                  type="button"
                  id="export-txt-btn"
                  onClick={handleExportTxt}
                  disabled={validItems.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="Скачать текстовый файл (одна ссылка на строку)"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>.TXT</span>
                </button>

                <button
                  type="button"
                  id="export-csv-btn"
                  onClick={handleExportCsv}
                  disabled={validItems.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="Скачать таблицу CSV с локацией и пингом"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>.CSV</span>
                </button>

                <button
                  type="button"
                  id="export-json-btn"
                  onClick={handleExportJson}
                  disabled={validItems.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="Скачать в формате JSON с геолокацией и пингом"
                >
                  <FileCode className="w-3.5 h-3.5 text-amber-600" />
                  <span>.JSON</span>
                </button>

                <button
                  type="button"
                  id="export-zip-btn"
                  onClick={() => setIsZipModalOpen(true)}
                  disabled={validItems.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="Скачать ZIP архив с разделением по частям (настраиваемое количество)"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>ZIP по частям</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ZIP split export modal dialog */}
      <ZipSplitModal
        isOpen={isZipModalOpen}
        onClose={() => setIsZipModalOpen(false)}
        validItems={itemsToExport}
      />
    </div>
  );
};
