import React from 'react';
import { ArrowRight, ShieldCheck, Sparkles, RefreshCw, FileText } from 'lucide-react';

interface NavbarProps {
  onLoadSample: () => void;
  onClearAll: () => void;
  hasInput: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onLoadSample, onClearAll, hasInput }) => {
  return (
    <header id="app-header" className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                SOCKS5 URI Converter
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                v2.0
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Пакетное преобразование <code className="font-mono text-slate-700 font-medium">IP:port:user:pass</code> <ArrowRight className="inline w-3 h-3 text-slate-400 mx-0.5" /> <code className="font-mono text-slate-700 font-medium">socks5://user:pass@IP:port</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="load-sample-btn"
            onClick={onLoadSample}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Вставить тестовый список прокси"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden xs:inline">Пример данных</span>
          </button>

          {hasInput && (
            <button
              id="clear-all-btn"
              onClick={onClearAll}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer border border-rose-200"
              title="Очистить все поля"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Очистить</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
