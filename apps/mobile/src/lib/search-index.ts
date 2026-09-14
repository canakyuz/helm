import type { Alert, Property, SocialAccount } from "@helm/api";

import { TYPE_LABEL } from "~/lib/labels";

export type SearchHitKind = "project" | "alert" | "account";

export type SearchHit = {
  kind: SearchHitKind;
  /** Tur icinde tekil; liste key'i `${kind}-${id}`. */
  id: string;
  title: string;
  sub: string;
};

export type SearchEntry = { hit: SearchHit; haystack: string };

/**
 * tr-TR katlama: "İstanbul" ile "istanbul" eslessin. Varsayilan toLowerCase
 * "İ"yi "i̇" (noktali, iki kod noktasi) yapar ve includes kacirir.
 */
export function normalizeQuery(text: string): string {
  return text.trim().toLocaleLowerCase("tr-TR");
}

function toEntry(hit: SearchHit, fields: ReadonlyArray<string | null>): SearchEntry {
  const text = fields.filter((field): field is string => field != null).join(" ");
  return { hit, haystack: normalizeQuery(text) };
}

/**
 * Aranabilir satirlar veri degistiginde BIR kez kurulur, her tus vurusunda degil.
 * Time: O(p + a + s); Space: O(p + a + s).
 */
export function buildSearchIndex(input: {
  properties: readonly Property[];
  alerts: readonly Alert[];
  accounts: readonly SocialAccount[];
}): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const p of input.properties) {
    const hit = { kind: "project" as const, id: p.id, title: p.name, sub: TYPE_LABEL[p.type] ?? p.type };
    entries.push(toEntry(hit, [p.name, p.slug, p.brandName]));
  }
  for (const a of input.alerts) {
    const hit = { kind: "alert" as const, id: String(a.id), title: a.ruleName, sub: a.message };
    entries.push(toEntry(hit, [a.ruleName, a.message, a.metric]));
  }
  for (const s of input.accounts) {
    const title = s.display_name ?? s.username ?? s.platform;
    const sub = s.username ? `${s.platform} @${s.username}` : s.platform;
    entries.push(toEntry({ kind: "account", id: s.id, title, sub }, [s.display_name, s.username, s.platform]));
  }
  return entries;
}

/**
 * Alt dizgi eslesmesi; girdi sirasini korur (projeler, uyarilar, hesaplar).
 * Time: O(n·m) en kotu, `limit`e ulasinca erken cikar; Space: O(limit).
 * NEDEN FUZZY/TRIE DEGIL: n onlarca satir. includes hizli ve sonucu tahmin edilebilir.
 */
export function searchIndex(entries: readonly SearchEntry[], query: string, limit = 30): SearchHit[] {
  const q = normalizeQuery(query);
  if (q.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const entry of entries) {
    if (!entry.haystack.includes(q)) continue;
    hits.push(entry.hit);
    if (hits.length === limit) break;
  }
  return hits;
}
