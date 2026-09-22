import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Globe,
  Shuffle,
  ArrowDownUp,
  Trash2,
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  PlusCircle,
  FileSpreadsheet,
  CopyCheck,
  Sparkles,
} from 'lucide-react';
import { PRESET_REMOTE_URLS } from '../utils/exportUtils';
import { ConversionOptions } from '../types';
import { deduplicateRawText } from '../utils/socksParser';

interface InputSectionProps {
  inputText: string;
  onInputChange: (text: string) => void;
  onAppendText: (text: string) => void;
  totalLines: number;
  options?: ConversionOptions;
}

export const InputSection: React.FC<InputSectionProps> = ({
  inputText,
  onInputChange,
  onAppendText,
  totalLines,
  options = {
    scheme: 'socks5://',
    urlEncodeCredentials: true,
    removeDuplicates: true,
    dedupMode: 'uri',
    skipInvalid: true,
    trimWhitespace: true,
    tagSuffix: '',
    delimiter: 'auto',
  },
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'file' | 'url'>('text');
  const [dedupToast, setDedupToast] = useState<string | null>(null);
  
  // URL Fetch state
  const [remoteUrl, setRemoteUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchSuccess, setFetchSuccess] = useState<string | null>(null);
  const [appendOnUrlFetch, setAppendOnUrlFetch] = useState(false);

  // File Upload state
  const [dragActive, setDragActive] = useState(false);
  const [lastUploadedFile, setLastUploadedFile] = useState<{ name: string; size: number; lines: number } | null>(null);
  const [appendOnFileUpload, setAppendOnFileUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick text manipulation actions
  const handleShuffle = () => {
    const lines = inputText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    for (let i = lines.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lines[i], lines[j]] = [lines[j], lines[i]];
    }
    onInputChange(lines.join('\n'));
  };

  const handleReverse = () => {
    const lines = inputText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    lines.reverse();
    onInputChange(lines.join('\n'));
  };

  const handleRemoveEmpty = () => {
    const lines = inputText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    onInputChange(lines.join('\n'));
  };

  const handleDeduplicateInPlace = () => {
    if (!inputText.trim()) return;
    const { deduplicatedText, removedCount } = deduplicateRawText(inputText, options);
    onInputChange(deduplicatedText);
    if (removedCount > 0) {
      setDedupToast(`Удалено дубликатов: ${removedCount}`);
    } else {
      setDedupToast('Дубликатов не найдено (все строки уникальны)');
    }
    setTimeout(() => {
      setDedupToast(null);
    }, 3000);
  };

  // Handle URL fetch
  const handleFetchUrl = async (urlToFetch?: string) => {
    const target = (urlToFetch || remoteUrl).trim();
    if (!target) {
      setFetchError('Пожалуйста, введите корректный адрес URL');
      return;
    }

    setIsFetchingUrl(true);
    setFetchError(null);
    setFetchSuccess(null);

    try {
      // 1. Try fetching through server proxy to bypass CORS
      let fetchedText = '';
      try {
        const proxyRes = await fetch(`/api/fetch-url?url=${encodeURIComponent(target)}`);
        if (proxyRes.ok) {
          const data = await proxyRes.json();
          fetchedText = data.content || '';
        } else {
          const errData = await proxyRes.json().catch(() => ({}));
          throw new Error(errData.error || `Ошибка сервера (${proxyRes.status})`);
        }
      } catch (serverErr: any) {
        // Fallback 1: direct fetch
        try {
          const directRes = await fetch(target);
          if (!directRes.ok) throw new Error(`HTTP ${directRes.status}`);
          fetchedText = await directRes.text();
        } catch {
          // Fallback 2: public CORS proxy (when running on static GitHub Pages)
          try {
            const corsRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`);
            if (!corsRes.ok) throw new Error(`HTTP ${corsRes.status}`);
            fetchedText = await corsRes.text();
          } catch {
            throw new Error(serverErr.message || 'Не удалось получить данные по указанной ссылке');
          }
        }
      }

      if (!fetchedText || fetchedText.trim().length === 0) {
        throw new Error('Полученный ответ пуст или не содержит текста');
      }

      const lineCount = fetchedText.split(/\r?\n/).filter((l) => l.trim().length > 0).length;

      if (appendOnUrlFetch && inputText.trim()) {
        onAppendText('\n' + fetchedText);
        setFetchSuccess(`Успешно добавлено ${lineCount} строк из ${new URL(target).hostname}`);
      } else {
        onInputChange(fetchedText);
        setFetchSuccess(`Успешно загружено ${lineCount} строк из ${new URL(target).hostname}`);
      }
    } catch (err: any) {
      setFetchError(err.message || 'Произошла ошибка при загрузке данных из интернета');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // Handle File drop/upload
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
      setLastUploadedFile({
        name: file.name,
        size: file.size,
        lines,
      });

      if (appendOnFileUpload && inputText.trim()) {
        onAppendText('\n' + text);
      } else {
        onInputChange(text);
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div id="input-section" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col h-full">
      {/* Top Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50/75 px-3 pt-2 gap-2">
        <button
          type="button"
          id="tab-text-btn"
          onClick={() => setActiveTab('text')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'text'
              ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Текст / Список</span>
          {totalLines > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px]">
              {totalLines}
            </span>
          )}
        </button>

        <button
          type="button"
          id="tab-file-btn"
          onClick={() => setActiveTab('file')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'file'
              ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Файл (.txt, .csv)</span>
        </button>

        <button
          type="button"
          id="tab-url-btn"
          onClick={() => setActiveTab('url')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'url'
              ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-blue-600" />
          <span>Из интернета (URL)</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-4 flex-1 flex flex-col min-h-0">
        {/* Tab 1: Textarea */}
        {activeTab === 'text' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 text-xs text-slate-500">
              <span>
                Формат одной строки: <code className="font-mono text-slate-800 font-medium">IP:port:user:pass</code>
              </span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  id="dedup-in-place-btn"
                  onClick={handleDeduplicateInPlace}
                  title="Удалить дубликаты из текста прямо на месте"
                  className="hover:text-emerald-700 text-slate-700 font-medium inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  <CopyCheck className="w-3 h-3 text-emerald-600" />
                  <span>Удалить дубли</span>
                </button>
                <button
                  type="button"
                  onClick={handleShuffle}
                  title="Перемешать строки случайным образом"
                  className="hover:text-slate-900 inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Shuffle className="w-3 h-3" />
                  <span className="hidden sm:inline">Перемешать</span>
                </button>
                <button
                  type="button"
                  onClick={handleReverse}
                  title="Обратный порядок строк"
                  className="hover:text-slate-900 inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <ArrowDownUp className="w-3 h-3" />
                  <span className="hidden sm:inline">Перевернуть</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveEmpty}
                  title="Удалить пустые строки"
                  className="hover:text-slate-900 inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 text-slate-400" />
                  <span className="hidden sm:inline">Сжать</span>
                </button>
              </div>
            </div>

            <div className="relative flex-1 min-h-[280px]">
              {dedupToast && (
                <div className="absolute top-2 right-2 z-10 bg-slate-900/90 backdrop-blur-xs text-white text-xs px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 border border-slate-700 animate-fade-in">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{dedupToast}</span>
                </div>
              )}
              <textarea
                id="raw-proxy-textarea"
                value={inputText}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Вставьте сюда список прокси, например:&#10;192.168.1.1:1080:login:password&#10;185.199.229.15:8080:admin:secret123&#10;94.23.45.67:1080:user:pass"
                className="w-full h-full p-3 font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 transition-all leading-relaxed"
                spellCheck={false}
              />
              {inputText.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
                  <div className="p-3 bg-slate-100 rounded-full mb-2">
                    <FileText className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Вставьте список прокси формата <span className="font-semibold text-slate-700">IP:port:user:pass</span>, перетащите файл во вкладку «Файл» или загрузите по ссылке из интернета.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>Символов: {inputText.length.toLocaleString('ru-RU')}</span>
              <span>Строк: {totalLines}</span>
            </div>
          </div>
        )}

        {/* Tab 2: File Upload */}
        {activeTab === 'file' && (
          <div className="flex-1 flex flex-col justify-center">
            <div
              id="file-dropzone"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[240px] ${
                dragActive
                  ? 'border-slate-900 bg-slate-50 scale-[0.99]'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                id="proxy-file-input"
                type="file"
                accept=".txt,.csv,.list,.log"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
                <Upload className="w-6 h-6 text-slate-700" />
              </div>
              <p className="text-sm font-medium text-slate-800 mb-1">
                Перетащите файл сюда или нажмите для выбора
              </p>
              <p className="text-xs text-slate-500 mb-3">
                Поддерживаются текстовые файлы: <code className="font-mono">.txt</code>, <code className="font-mono">.csv</code>, <code className="font-mono">.list</code>
              </p>
              <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 shadow-2xs">
                Выбрать файл на устройстве
              </span>
            </div>

            {/* Append switch & Last uploaded file badge */}
            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  id="append-file-toggle"
                  type="checkbox"
                  checked={appendOnFileUpload}
                  onChange={(e) => setAppendOnFileUpload(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
                <span>Добавлять к текущему списку (не заменять)</span>
              </label>

              {lastUploadedFile && (
                <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Загружен: {lastUploadedFile.name} ({lastUploadedFile.lines} строк)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Remote Internet URL */}
        {activeTab === 'url' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Прямая ссылка на список прокси (HTTP / HTTPS)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Globe className="w-4 h-4" />
                    </div>
                    <input
                      id="remote-url-input"
                      type="url"
                      placeholder="https://raw.githubusercontent.com/.../proxies.txt"
                      value={remoteUrl}
                      onChange={(e) => setRemoteUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    id="fetch-url-btn"
                    onClick={() => handleFetchUrl()}
                    disabled={isFetchingUrl || !remoteUrl.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    {isFetchingUrl ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Загрузка...</span>
                      </>
                    ) : (
                      <>
                        <DownloadCloud className="w-3.5 h-3.5" />
                        <span>Загрузить</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Append toggle */}
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                  <input
                    id="append-url-toggle"
                    type="checkbox"
                    checked={appendOnUrlFetch}
                    onChange={(e) => setAppendOnUrlFetch(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  <span>Добавлять к текущему списку (не заменять)</span>
                </label>
              </div>

              {/* Status messages */}
              {fetchError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-700">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Ошибка загрузки:</span> {fetchError}
                  </div>
                </div>
              )}

              {fetchSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-xs text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>{fetchSuccess}</div>
                </div>
              )}

              {/* Preset URLs */}
              <div className="pt-2">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-2">
                  Быстрые тестовые ссылки из сети:
                </span>
                <div className="space-y-1.5">
                  {PRESET_REMOTE_URLS.map((preset, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs hover:bg-slate-100 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-medium text-slate-800 truncate">{preset.name}</div>
                        <div className="text-[11px] text-slate-500 truncate font-mono">{preset.url}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRemoteUrl(preset.url);
                          handleFetchUrl(preset.url);
                        }}
                        disabled={isFetchingUrl}
                        className="shrink-0 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded text-xs font-medium transition-colors cursor-pointer"
                      >
                        Загрузить
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
              💡 Загрузка происходит через безопасный серверный прокси с обходом CORS-ограничений браузера.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
