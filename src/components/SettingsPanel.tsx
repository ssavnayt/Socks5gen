import React from 'react';
import { Sliders, Shield, Hash, Code, CheckSquare } from 'lucide-react';
import { ConversionOptions } from '../types';

interface SettingsPanelProps {
  options: ConversionOptions;
  onChange: (newOptions: ConversionOptions) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ options, onChange }) => {
  const updateOption = <K extends keyof ConversionOptions>(key: K, value: ConversionOptions[K]) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div id="settings-panel" className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-900">Параметры конвертации</h2>
        </div>
        <span className="text-xs text-slate-400">Настройки URI и парсера</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Scheme Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Протокол URI
          </label>
          <div className="flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
            <button
              type="button"
              id="scheme-socks5-btn"
              onClick={() => updateOption('scheme', 'socks5://')}
              className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
                options.scheme === 'socks5://'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              socks5://
            </button>
            <button
              type="button"
              id="scheme-socks5h-btn"
              onClick={() => updateOption('scheme', 'socks5h://')}
              title="socks5h:// делегирует DNS-резолвинг на сторону прокси (рекомендуется для обхода блокировок)"
              className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
                options.scheme === 'socks5h://'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              socks5h://
            </button>
          </div>
        </div>

        {/* Delimiter */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Разделитель входа
          </label>
          <select
            id="delimiter-select"
            value={options.delimiter}
            onChange={(e) => updateOption('delimiter', e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
          >
            <option value="auto">Авто ( : / ; / | / Tab )</option>
            <option value=":">Двоеточие (:)</option>
            <option value=";">Точка с запятой (;)</option>
            <option value="|">Вертикальная черта (|)</option>
            <option value="&#9;">Табуляция (\t)</option>
          </select>
        </div>

        {/* Deduplication Mode */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center justify-between">
            <span>Дедупликация</span>
            <span className="text-[10px] text-emerald-600 font-medium">Режим</span>
          </label>
          <select
            id="dedup-mode-select"
            value={options.dedupMode}
            onChange={(e) => updateOption('dedupMode', e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
          >
            <option value="uri">По полному URI (с логином)</option>
            <option value="host_port">По IP:Порт (уник. сервера)</option>
            <option value="host_only">По IP адресу (уник. IP)</option>
          </select>
        </div>

        {/* Tag / Suffix */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center justify-between">
            <span>Суффикс / Тег URI</span>
            <span className="text-[10px] text-slate-400">#тег</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 text-xs font-mono">
              #
            </span>
            <input
              id="tag-suffix-input"
              type="text"
              placeholder="например: fast-proxy"
              value={options.tagSuffix.replace(/^#/, '')}
              onChange={(e) => updateOption('tagSuffix', e.target.value)}
              className="w-full pl-6 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 font-mono"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-col justify-center space-y-1.5 pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="url-encode-toggle"
              type="checkbox"
              checked={options.urlEncodeCredentials}
              onChange={(e) => updateOption('urlEncodeCredentials', e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer"
            />
            <span className="text-xs text-slate-700 font-medium truncate">
              URL-кодировать auth
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="remove-duplicates-toggle"
              type="checkbox"
              checked={options.removeDuplicates}
              onChange={(e) => updateOption('removeDuplicates', e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer"
            />
            <span className="text-xs text-slate-700 font-medium truncate">
              Скрывать дубликаты
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
