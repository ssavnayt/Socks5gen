import React, { useState, useMemo } from 'react';
import {
  Archive,
  X,
  FileText,
  FileSpreadsheet,
  FileCode,
  Check,
  Loader2,
  Layers,
  FolderArchive,
  FileCheck,
  Radio
} from 'lucide-react';
import { ProxyItem, ZipSplitOptions } from '../types';
import { exportSplitZip } from '../utils/exportUtils';

interface ZipSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  validItems: ProxyItem[];
}

export const ZipSplitModal: React.FC<ZipSplitModalProps> = ({
  isOpen,
  onClose,
  validItems,
}) => {
  const total = validItems.length;

  const [mode, setMode] = useState<'lines_per_file' | 'total_files'>('lines_per_file');
  const [linesPerFile, setLinesPerFile] = useState<number>(Math.min(50, Math.max(1, Math.floor(total / 2) || 10)));
  const [totalFiles, setTotalFiles] = useState<number>(Math.min(5, Math.max(1, total)));
  const [fileFormat, setFileFormat] = useState<'txt' | 'csv' | 'json' | 'v2ray'>('txt');
  const [baseFilename, setBaseFilename] = useState('socks5_proxies');
  const [includeReadme, setIncludeReadme] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Calculate parts preview
  const previewInfo = useMemo(() => {
    if (total === 0) return { numChunks: 0, previewFiles: [] };

    let chunksCount = 0;
    let avgSize = 0;

    if (mode === 'lines_per_file') {
      const perFile = Math.max(1, linesPerFile);
      chunksCount = Math.ceil(total / perFile);
      avgSize = perFile;
    } else {
      chunksCount = Math.min(total, Math.max(1, totalFiles));
      avgSize = Math.ceil(total / chunksCount);
    }

    const padLength = Math.max(2, String(chunksCount).length);
    const prefix = baseFilename.trim() || 'socks5_proxies';

    const previewFiles: { name: string; count: number }[] = [];
    for (let i = 0; i < Math.min(chunksCount, 4); i++) {
      const num = String(i + 1).padStart(padLength, '0');
      let count = avgSize;
      if (i === chunksCount - 1) {
        // Last chunk remainder
        count = total - (chunksCount - 1) * avgSize;
        if (count <= 0) count = avgSize;
      }
      const ext = fileFormat === 'v2ray' ? 'txt' : fileFormat;
      const v2Prefix = fileFormat === 'v2ray' ? 'v2ray_' : '';
      previewFiles.push({
        name: `${prefix}_${v2Prefix}part_${num}.${ext}`,
        count: Math.min(count, total),
      });
    }

    return {
      numChunks: chunksCount,
      previewFiles,
      hasMore: chunksCount > 4,
    };
  }, [total, mode, linesPerFile, totalFiles, fileFormat, baseFilename]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (total === 0) return;
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const options: ZipSplitOptions = {
        mode,
        value: mode === 'lines_per_file' ? Math.max(1, linesPerFile) : Math.max(1, totalFiles),
        fileFormat,
        baseFilename: baseFilename.trim() || 'socks5_proxies',
        includeReadme,
      };

      await exportSplitZip(validItems, options);
      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Ошибка создания ZIP архива:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Экспорт в ZIP архив по частям
              </h3>
              <p className="text-[11px] text-slate-500">
                Всего доступно для экспорта: <span className="font-semibold text-slate-800">{total} прокси</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          {/* Splitting Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-2">
              Режим разделения списка:
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Option 1: By lines per file */}
              <button
                type="button"
                onClick={() => setMode('lines_per_file')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  mode === 'lines_per_file'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 text-slate-900'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="font-semibold text-xs mb-1">По количеству строк</div>
                <div className="text-[11px] text-slate-500">
                  Фиксированное число прокси в каждом файле
                </div>
              </button>

              {/* Option 2: Total number of files */}
              <button
                type="button"
                onClick={() => setMode('total_files')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  mode === 'total_files'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 text-slate-900'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="font-semibold text-xs mb-1">На N равных частей</div>
                <div className="text-[11px] text-slate-500">
                  Разбить весь список на заданное число файлов
                </div>
              </button>
            </div>
          </div>

          {/* Mode-specific value configuration */}
          {mode === 'lines_per_file' ? (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-800">Прокси в одном файле:</span>
                <div className="flex items-center gap-1">
                  <input
                    id="lines-per-file-input"
                    type="number"
                    min="1"
                    max={total || 1}
                    value={linesPerFile}
                    onChange={(e) => setLinesPerFile(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-20 px-2.5 py-1 text-right font-mono bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                  <span className="text-slate-500 text-[11px]">шт.</span>
                </div>
              </div>

              {/* Preset quick buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 mr-1">Быстрый выбор:</span>
                {[5, 10, 25, 50, 100, 250, 500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLinesPerFile(preset)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      linesPerFile === preset
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-800">Количество файлов (частей):</span>
                <div className="flex items-center gap-1">
                  <input
                    id="total-files-input"
                    type="number"
                    min="1"
                    max={total || 1}
                    value={totalFiles}
                    onChange={(e) => setTotalFiles(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-20 px-2.5 py-1 text-right font-mono bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                  <span className="text-slate-500 text-[11px]">файлов</span>
                </div>
              </div>

              {/* Preset quick buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 mr-1">Быстрый выбор:</span>
                {[2, 3, 4, 5, 10, 20].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTotalFiles(preset)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      totalFiles === preset
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Format selection inside archive */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Формат файлов внутри архива:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFileFormat('txt')}
                className={`py-2 px-2.5 rounded-lg border text-center font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  fileFormat === 'txt'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>.TXT</span>
              </button>

              <button
                type="button"
                id="zip-v2ray-format-btn"
                onClick={() => setFileFormat('v2ray')}
                className={`py-2 px-2 rounded-lg border text-center font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  fileFormat === 'v2ray'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                }`}
                title="Формат V2Ray socks://ссылка#🇫🇮Finland - 676ms"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>.V2RAY</span>
              </button>

              <button
                type="button"
                onClick={() => setFileFormat('csv')}
                className={`py-2 px-2.5 rounded-lg border text-center font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  fileFormat === 'csv'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>.CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setFileFormat('json')}
                className={`py-2 px-2.5 rounded-lg border text-center font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  fileFormat === 'json'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>.JSON</span>
              </button>
            </div>
          </div>

          {/* Base Filename and Readme */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Префикс файлов:
              </label>
              <input
                id="zip-prefix-input"
                type="text"
                value={baseFilename}
                onChange={(e) => setBaseFilename(e.target.value)}
                placeholder="socks5_proxies"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div className="pt-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="include-readme-toggle"
                  type="checkbox"
                  checked={includeReadme}
                  onChange={(e) => setIncludeReadme(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
                <span className="text-xs text-slate-700">Вложить README.txt</span>
              </label>
            </div>
          </div>

          {/* Live Archive Preview */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-medium text-slate-800">
                <FolderArchive className="w-3.5 h-3.5 text-amber-600" />
                <span>Структура архива (будет {previewInfo.numChunks} {previewInfo.numChunks === 1 ? 'файл' : previewInfo.numChunks < 5 ? 'файла' : 'файлов'}):</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-mono font-medium">
                .{fileFormat}
              </span>
            </div>

            <div className="space-y-1 font-mono text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
              {previewInfo.previewFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-slate-800 font-medium">📄 {file.name}</span>
                  <span className="text-slate-400 text-[10px] font-sans">~{file.count} прокси</span>
                </div>
              ))}
              {previewInfo.hasMore && (
                <div className="text-slate-400 text-[10px] italic pl-5">
                  ... и ещё {previewInfo.numChunks - previewInfo.previewFiles.length} файлов
                </div>
              )}
              {includeReadme && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-slate-500">
                  <span>📄 README.txt</span>
                  <span className="text-slate-400 text-[10px] font-sans">Справка</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Отмена
          </button>

          <button
            type="button"
            id="start-zip-download-btn"
            onClick={handleDownload}
            disabled={isExporting || total === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Сжатие архива...</span>
              </>
            ) : exportSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Архив скачан!</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                <span>Скачать ZIP ({previewInfo.numChunks} ч.)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
