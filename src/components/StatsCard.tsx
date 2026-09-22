import React from 'react';
import { CheckCircle2, XCircle, CopyCheck, Layers, Activity } from 'lucide-react';
import { ParseSummary } from '../types';

export type FilterMode = 'all' | 'valid' | 'online' | 'errors' | 'duplicates';

interface StatsCardProps {
  summary: ParseSummary;
  filterMode: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
  onlineCount?: number;
  testedCount?: number;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  summary,
  filterMode,
  onFilterChange,
  onlineCount = 0,
  testedCount = 0,
}) => {
  return (
    <div id="stats-card" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* Total lines */}
      <button
        type="button"
        onClick={() => onFilterChange('all')}
        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
          filterMode === 'all'
            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs ${filterMode === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
            Всего записей
          </span>
          <Layers className={`w-3.5 h-3.5 ${filterMode === 'all' ? 'text-slate-300' : 'text-slate-400'}`} />
        </div>
        <div className="text-xl font-bold font-mono">
          {summary.total.toLocaleString('ru-RU')}
        </div>
      </button>

      {/* Valid SOCKS5 URIs */}
      <button
        type="button"
        onClick={() => onFilterChange('valid')}
        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
          filterMode === 'valid'
            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
            : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs ${filterMode === 'valid' ? 'text-emerald-100' : 'text-slate-500'}`}>
            Сконвертировано URI
          </span>
          <CheckCircle2 className={`w-3.5 h-3.5 ${filterMode === 'valid' ? 'text-emerald-200' : 'text-emerald-500'}`} />
        </div>
        <div className="text-xl font-bold font-mono text-emerald-600 data-[active=true]:text-white" data-active={filterMode === 'valid'}>
          {summary.valid.toLocaleString('ru-RU')}
        </div>
      </button>

      {/* Online / Ping Verified */}
      <button
        type="button"
        onClick={() => onFilterChange('online')}
        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
          filterMode === 'online'
            ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
            : 'bg-white border-slate-200 text-slate-700 hover:border-teal-300'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs ${filterMode === 'online' ? 'text-teal-100' : 'text-slate-500'}`}>
            Онлайн (пинг)
          </span>
          <Activity className={`w-3.5 h-3.5 ${filterMode === 'online' ? 'text-teal-200' : 'text-teal-500'}`} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono text-teal-600 data-[active=true]:text-white" data-active={filterMode === 'online'}>
            {onlineCount.toLocaleString('ru-RU')}
          </span>
          {testedCount > 0 && (
            <span className={`text-[10px] font-mono ${filterMode === 'online' ? 'text-teal-200' : 'text-slate-400'}`}>
              из {testedCount}
            </span>
          )}
        </div>
      </button>

      {/* Errors */}
      <button
        type="button"
        onClick={() => onFilterChange('errors')}
        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
          filterMode === 'errors'
            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
            : 'bg-white border-slate-200 text-slate-700 hover:border-rose-300'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs ${filterMode === 'errors' ? 'text-rose-100' : 'text-slate-500'}`}>
            Ошибки формата
          </span>
          <XCircle className={`w-3.5 h-3.5 ${filterMode === 'errors' ? 'text-rose-200' : 'text-rose-500'}`} />
        </div>
        <div className="text-xl font-bold font-mono text-rose-500 data-[active=true]:text-white" data-active={filterMode === 'errors'}>
          {summary.invalid.toLocaleString('ru-RU')}
        </div>
      </button>

      {/* Duplicates */}
      <button
        type="button"
        onClick={() => onFilterChange('duplicates')}
        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
          filterMode === 'duplicates'
            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
            : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs ${filterMode === 'duplicates' ? 'text-amber-100' : 'text-slate-500'}`}>
            Дубликаты
          </span>
          <CopyCheck className={`w-3.5 h-3.5 ${filterMode === 'duplicates' ? 'text-amber-200' : 'text-amber-500'}`} />
        </div>
        <div className="text-xl font-bold font-mono text-amber-600 data-[active=true]:text-white" data-active={filterMode === 'duplicates'}>
          {summary.duplicates.toLocaleString('ru-RU')}
        </div>
      </button>
    </div>
  );
};
