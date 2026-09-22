import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Check, Info } from 'lucide-react';

export const InfoBanner: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div id="info-banner" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-800">
            Справка: форматы ввода и структура SOCKS5 URI
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-400 text-xs">
          <span>{isOpen ? 'Скрыть' : 'Подробнее'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 text-xs text-slate-600 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">
                Поддерживаемые форматы ввода:
              </span>
              <ul className="space-y-1 font-mono text-[11px] text-slate-700">
                <li><span className="text-emerald-700 font-bold">•</span> IP:port:user:pass <span className="text-slate-400 font-sans">(основной стандарт)</span></li>
                <li><span className="text-emerald-700 font-bold">•</span> IP:port <span className="text-slate-400 font-sans">(без авторизации)</span></li>
                <li><span className="text-emerald-700 font-bold">•</span> [IPv6]:port:user:pass <span className="text-slate-400 font-sans">(IPv6 адреса)</span></li>
                <li><span className="text-emerald-700 font-bold">•</span> host.domain.com:port:user:pass <span className="text-slate-400 font-sans">(доменные имена)</span></li>
                <li><span className="text-emerald-700 font-bold">•</span> user:pass@IP:port <span className="text-slate-400 font-sans">(альтернативный вид)</span></li>
              </ul>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">
                Формат на выходе (RFC 3986 URI):
              </span>
              <p className="mb-1 font-mono text-[11px] text-emerald-800 bg-emerald-50/70 p-1.5 rounded border border-emerald-200">
                socks5://username:password@192.168.1.1:1080
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Спецсимволы в логине и пароле (<code className="font-mono">@</code>, <code className="font-mono">:</code>, <code className="font-mono">#</code>, <code className="font-mono">%</code>) автоматически процент-кодируются по стандарту URL, предотвращая сбои в Telegram, curl, v2ray и других клиентах.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
