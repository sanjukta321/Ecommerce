import React, { createContext, useContext, useEffect, useState } from 'react';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const CACHE_KEY = 'sb_site_config_v3';

interface SiteConfig {
  app_name: string;
  logo_url: string;
  favicon: string;
}

// Shown instantly on every load — updated by API in background
const FALLBACK: SiteConfig = {
  app_name: 'SB Store',
  logo_url: '/files/sb-store-logo.svg',
  favicon: '',
};

declare global {
  interface Window { __SITE_CONFIG__?: SiteConfig; }
}

function safeLocalGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeLocalSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function safeLocalRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function getInitialConfig(): SiteConfig {
  // Priority 1 — server-injected (instant, no network)
  const injected = window.__SITE_CONFIG__;
  if (injected?.app_name) return injected;

  // Priority 2 — localStorage cache from previous visit
  safeLocalRemove('sb_site_config');   // clear old v1 key
  safeLocalRemove('sb_site_config_v2'); // clear old v2 key
  const raw = safeLocalGet(CACHE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SiteConfig;
      if (parsed.app_name && parsed.app_name !== 'My Store') return parsed;
    } catch { /* ignore */ }
  }

  // Priority 3 — hardcoded fallback (always visible, API updates it)
  return FALLBACK;
}

const SiteConfigContext = createContext<SiteConfig>(FALLBACK);

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(getInitialConfig);

  useEffect(() => {
    if (config.app_name) document.title = config.app_name;

    const load = async (attempt = 1) => {
      try {
        const res = await fetch(
          `${BASE}/api/method/store_customizations.api.get_site_config`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const msg = data?.message;
        if (!msg?.app_name) return;

        const next: SiteConfig = {
          app_name: msg.app_name.trim(),
          logo_url: (msg.logo_url || '').trim(),
          favicon: (msg.favicon || '').trim(),
        };

        // setConfig FIRST — always runs even if localStorage fails
        setConfig(next);
        document.title = next.app_name;

        // localStorage separately — failure here doesn't affect rendering
        safeLocalSet(CACHE_KEY, JSON.stringify(next));

        if (next.favicon) {
          const link =
            document.querySelector<HTMLLinkElement>("link[rel~='icon']") ??
            Object.assign(document.createElement('link'), { rel: 'icon' });
          link.href = next.favicon.startsWith('http')
            ? next.favicon
            : `${BASE}${next.favicon}`;
          document.head.appendChild(link);
        }
      } catch {
        if (attempt < 3) setTimeout(() => load(attempt + 1), attempt * 2000);
      }
    };

    load();
  }, []);

  return (
    <SiteConfigContext.Provider value={config}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}
