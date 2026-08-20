// FX dönüşümü - Frankfurter API (ücretsiz, auth'suz, ECB rate'leri).
// Günlük rate'leri localStorage'a cache'ler.

import { useEffect, useState } from "react";

const CACHE_KEY = "helm-fx-cache";

interface Cache {
  date: string;
  rates: Record<string, Record<string, number>>;
}

const today = () => new Date().toISOString().slice(0, 10);

const readCache = (): Cache => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { date: today(), rates: {} };
    const c = JSON.parse(raw) as Cache;
    if (c.date !== today()) return { date: today(), rates: {} };
    return c;
  } catch {
    return { date: today(), rates: {} };
  }
};

const writeCache = (c: Cache) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* sessizce geç */
  }
};

export async function getFxRate(from: string, to: string): Promise<number> {
  if (!from || !to || from === to) return 1;
  const cache = readCache();
  const cached = cache.rates[from]?.[to];
  if (cached != null) return cached;
  try {
    // open.er-api.com - ücretsiz, anahtarsız, CORS açık, her gün güncel.
    // /v6/latest/{base} → { result, rates: { [code]: rate } }. base=from.
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (!res.ok) return 1;
    const json = await res.json();
    if (json.result !== "success") return 1;
    const rate = Number(json.rates?.[to] ?? 1);
    cache.rates[from] = { ...(cache.rates[from] ?? {}), [to]: rate };
    writeCache(cache);
    return rate;
  } catch {
    return 1;
  }
}

/** Birden çok kaynak para biriminden tek hedefe rate haritası. */
export function useFxRates(
  froms: string[],
  to: string,
): Record<string, number> {
  const [rates, setRates] = useState<Record<string, number>>({});
  const key = [...new Set(froms)].sort().join("|") + ">" + to;

  useEffect(() => {
    let cancelled = false;
    const uniques = [...new Set(froms.filter(Boolean))];
    if (uniques.length === 0) {
      setRates({});
      return;
    }
    Promise.all(
      uniques.map((f) => getFxRate(f, to).then((r) => [f, r] as const)),
    ).then((pairs) => {
      if (!cancelled) setRates(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return rates;
}
