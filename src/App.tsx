/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SettingsPanel } from './components/SettingsPanel';
import { StatsCard, FilterMode } from './components/StatsCard';
import { InputSection } from './components/InputSection';
import { OutputSection } from './components/OutputSection';
import { InfoBanner } from './components/InfoBanner';
import { ConversionOptions, PingInfo, GeoInfo } from './types';
import { parseProxyList } from './utils/socksParser';
import { SAMPLE_PROXIES } from './utils/exportUtils';
import {
  loadStoredInputText,
  saveStoredInputText,
  loadStoredCheckedData,
  saveStoredCheckedData,
  saveStoredCheckedDataDebounced,
  loadStoredOptions,
  saveStoredOptions,
  clearStoredData,
} from './utils/storageUtils';

export default function App() {
  const [inputText, setInputText] = useState<string>(() => loadStoredInputText());
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [checkedData, setCheckedData] = useState<
    Record<string, { ping?: PingInfo; geo?: GeoInfo; isChecking?: boolean }>
  >(() => loadStoredCheckedData());

  const [options, setOptions] = useState<ConversionOptions>(() => loadStoredOptions());

  // Save to localStorage with debounce to prevent UI lag on large proxy lists
  useEffect(() => {
    saveStoredInputText(inputText);
  }, [inputText]);

  useEffect(() => {
    saveStoredCheckedDataDebounced(checkedData, 1000);
  }, [checkedData]);

  useEffect(() => {
    saveStoredOptions(options);
  }, [options]);

  // Real-time memoized parse of the input list
  const { items, summary } = useMemo(() => {
    return parseProxyList(inputText, options);
  }, [inputText, options]);

  // Merge parsed items with live ping/geolocation results (persisted across reloads)
  const mergedItems = useMemo(() => {
    return items.map((item) => {
      const cleanHost = (item.host || '').toLowerCase().trim();
      const hostPortKey = `${cleanHost}:${item.port}`;
      const authKey = `${item.username || ''}:${item.password || ''}@${cleanHost}:${item.port}`;
      const rawHostPortKey = `${item.host}:${item.port}`;

      const extra =
        checkedData[item.id] ||
        checkedData[authKey] ||
        checkedData[hostPortKey] ||
        checkedData[rawHostPortKey];

      if (extra) {
        return {
          ...item,
          ping: extra.ping !== undefined ? extra.ping : item.ping,
          geo: extra.geo !== undefined ? extra.geo : item.geo,
          isChecking: extra.isChecking ?? false,
        };
      }
      return item;
    });
  }, [items, checkedData]);

  const validItems = useMemo(() => {
    return mergedItems.filter((it) => it.isValid && (!options.removeDuplicates || !it.isDuplicate));
  }, [mergedItems, options.removeDuplicates]);

  const invalidItems = useMemo(() => {
    return mergedItems.filter((it) => !it.isValid);
  }, [mergedItems]);

  const onlineCount = useMemo(() => {
    return validItems.filter((it) => it.ping?.online === true).length;
  }, [validItems]);

  const testedCount = useMemo(() => {
    return validItems.filter((it) => it.ping !== undefined).length;
  }, [validItems]);

  const handleUpdateCheck = (id: string, ping?: PingInfo, geo?: GeoInfo, isChecking?: boolean) => {
    setCheckedData((prev) => {
      const item = items.find((it) => it.id === id);
      const cleanHost = item?.host ? item.host.toLowerCase().trim() : '';
      const hostPortKey = cleanHost && item?.port ? `${cleanHost}:${item.port}` : null;
      const authKey = item && item.host && item.port && (item.username || item.password)
        ? `${item.username}:${item.password}@${cleanHost}:${item.port}`
        : null;

      const existing = prev[id] || (hostPortKey ? prev[hostPortKey] : undefined);
      const updatedEntry = {
        ...existing,
        ping: ping !== undefined ? ping : existing?.ping,
        geo: geo !== undefined ? geo : existing?.geo,
        isChecking,
      };

      const next = {
        ...prev,
        [id]: updatedEntry,
      };

      if (hostPortKey) {
        next[hostPortKey] = updatedEntry;
      }
      if (authKey) {
        next[authKey] = updatedEntry;
      }

      return next;
    });
  };

  const handleBatchUpdateChecks = (
    updates: Array<{ id: string; host: string; port: number; ping?: PingInfo; geo?: GeoInfo }>
  ) => {
    if (updates.length === 0) return;

    setCheckedData((prev) => {
      const itemsMap = new Map(items.map((it) => [it.id, it]));
      const hostPortMap = new Map(items.map((it) => [`${(it.host || '').toLowerCase().trim()}:${it.port}`, it]));
      const next = { ...prev };

      for (const u of updates) {
        const cleanHost = (u.host || '').toLowerCase().trim();
        const hostPortKey = `${cleanHost}:${u.port}`;
        const item = itemsMap.get(u.id) || hostPortMap.get(hostPortKey);
        const authKey = item && (item.username || item.password)
          ? `${item.username}:${item.password}@${cleanHost}:${u.port}`
          : null;

        const existing = next[u.id] || next[hostPortKey] || (item ? next[item.id] : undefined);
        const updated = {
          ...existing,
          ping: u.ping !== undefined ? u.ping : existing?.ping,
          geo: u.geo !== undefined ? u.geo : existing?.geo,
          isChecking: false,
        };

        if (u.id) next[u.id] = updated;
        if (item?.id) next[item.id] = updated;
        next[hostPortKey] = updated;
        if (authKey) {
          next[authKey] = updated;
        }
      }
      return next;
    });
  };

  const handleKeepOnlyOnline = () => {
    const onlineItems = validItems.filter((it) => it.ping?.online === true);
    if (onlineItems.length === 0) return;
    const newText = onlineItems.map((it) => it.raw).join('\n');
    setInputText(newText);
    setFilterMode('valid');
  };

  const handleLoadSample = () => {
    setInputText(SAMPLE_PROXIES);
    setFilterMode('all');
  };

  const handleClearAll = () => {
    setInputText('');
    setCheckedData({});
    setFilterMode('all');
    clearStoredData();
  };

  const handleAppendText = (appendedText: string) => {
    setInputText((prev) => (prev ? prev + appendedText : appendedText.trim()));
  };

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        onLoadSample={handleLoadSample}
        onClearAll={handleClearAll}
        hasInput={inputText.trim().length > 0}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
        {/* Settings Bar */}
        <SettingsPanel options={options} onChange={setOptions} />

        {/* Statistics Bar */}
        <StatsCard
          summary={summary}
          filterMode={filterMode}
          onFilterChange={setFilterMode}
          onlineCount={onlineCount}
          testedCount={testedCount}
        />

        {/* Two-Column Work Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 items-stretch min-h-[460px]">
          {/* Left Column: Input (Text, File, Remote URL) */}
          <InputSection
            inputText={inputText}
            onInputChange={setInputText}
            onAppendText={handleAppendText}
            totalLines={summary.total}
            options={options}
          />

          {/* Right Column: Output (URI list, Table, Errors, File Export) */}
          <OutputSection
            items={mergedItems}
            validItems={validItems}
            invalidItems={invalidItems}
            filterMode={filterMode}
            onFilterChange={setFilterMode}
            onUpdateItemCheck={handleUpdateCheck}
            onBatchUpdateChecks={handleBatchUpdateChecks}
            onKeepOnlyOnline={handleKeepOnlyOnline}
            onlineCount={onlineCount}
            testedCount={testedCount}
          />
        </div>

        {/* Informational guide and specification breakdown */}
        <InfoBanner />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            SOCKS5 URI Converter &copy; {new Date().getFullYear()} — Пакетная конвертация списков прокси
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            RFC 3986 • RFC 1928 Compliant
          </span>
        </div>
      </footer>
    </div>
  );
}
