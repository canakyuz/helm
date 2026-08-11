import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

/**
 * Oyun telemetrisi hunileri.
 *
 * Kaynak `game_events` (26k+ satir) ve `metrics` DEGIL. Ekranlarin bugune kadar
 * bakmadigi yer burasi: metrics gunluk toplamlari tutar, davranis burada.
 *
 * Toplama sunucuda (RPC `game_funnels`, migration 0035) — ham satirlari mobile
 * cekmek hem ag hem bellek israfi olurdu.
 */

export type SessionRow = {
  platform: string;
  started: number;
  ended: number;
  /** Baslayip bitmeyen oturum. Cokme veya surec olumu gostergesi. */
  unclosed: number;
  /** 0–1. `started` sifirsa null. */
  unclosedRate: number | null;
};

export type AdRow = {
  format: string;
  shown: number;
  failed: number;
  /** 0–1. Toplam sifirsa null. */
  failureRate: number | null;
};

export type CountRow = { key: string; count: number };

export type PlatformRow = { platform: string; events: number };

/**
 * Proje basina oyun akisi.
 *
 * NEDEN AYRI: her oyunun kendi olay sozlugu var. Block Forge'un "oyun bitti"si
 * ile Echo'nun "seviye tamamlandi"si ayni kutuya girerse anlamsiz bir toplam
 * cikar. "Tum projeler" seciliyken UI proje basina ayri kart gosterir.
 */
export type ProjectFunnel = {
  projectId: string;
  projectName: string;
  steps: CountRow[];
};

export type PerfRow = {
  key: string;
  samples: number;
  /** Ortanca fps. */
  p50: number;
  /** Alt %5 — kotu deneyimin esigi. Ortalama burayi gizler. */
  p05: number;
  /** Gorulen en kotu tek olcum. */
  worst: number;
};

export type GameFunnels = {
  days: number;
  sessions: SessionRow[];
  ads: AdRow[];
  game: CountRow[];
  gameByProject: ProjectFunnel[];
  purchases: CountRow[];
  platforms: PlatformRow[];
  perf: PerfRow[];
  errors: CountRow[];
};

type RawFunnels = {
  days: number;
  sessions: Array<{ platform: string; started: number; ended: number }>;
  ads: Array<{ format: string; shown: number; failed: number }>;
  game: CountRow[];
  gameByProject: ProjectFunnel[];
  purchases: CountRow[];
  platforms: PlatformRow[];
  perf: PerfRow[];
  errors: CountRow[];
};

const EMPTY: GameFunnels = {
  days: 0,
  sessions: [],
  ads: [],
  game: [],
  gameByProject: [],
  purchases: [],
  platforms: [],
  perf: [],
  errors: [],
};

/**
 * Oyun akisindaki adim sirasi.
 *
 * NEDEN SABIT LISTE: RPC ham sayimlari dondurur, sirayi bilmez — "basla" olayi
 * "bitir"den once gelmeli, sayisi kucuk olsa bile. Sayiya gore siralamak huniyi
 * ters cevirirdi.
 */
export const GAME_STEP_ORDER = [
  "game_start_classic",
  "game_start_daily",
  "game_start_time",
  "game_over_score",
  "continue_used",
  "shop_opened",
  "quests_opened",
  "mastery_level_up",
  "daily_solved",
] as const;

/** Ekranda gorunen adim adlari. Bilinmeyen anahtar ham haliyle gecer. */
export const GAME_STEP_LABEL: Record<string, string> = {
  game_start_classic: "Klasik başlatıldı",
  game_start_daily: "Günlük başlatıldı",
  game_start_time: "Zamanlı başlatıldı",
  game_over_score: "Oyun bitti",
  continue_used: "Devam edildi",
  shop_opened: "Mağaza açıldı",
  quests_opened: "Görevler açıldı",
  mastery_level_up: "Ustalık seviyesi",
  daily_solved: "Günlük çözüldü",
};

export const AD_FORMAT_LABEL: Record<string, string> = {
  banner: "Banner",
  interstitial: "Geçiş",
  rewarded: "Ödüllü",
  rewarded_continue: "Ödüllü · devam",
  rewarded_double_daily: "Ödüllü · günlük ×2",
};

export async function fetchGameFunnels(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  days = 30,
): Promise<GameFunnels> {
  const { data, error } = await client.rpc("game_funnels", {
    p_project_id: propertyId === "all" ? null : propertyId,
    p_days: days,
  });
  if (error) throw error;
  if (data == null) return EMPTY;

  const raw = data as RawFunnels;

  return {
    days: raw.days,
    // Turetilmis oranlar BURADA hesaplanir; UI yalnizca gosterir.
    sessions: (raw.sessions ?? []).map((s) => ({
      ...s,
      unclosed: Math.max(0, s.started - s.ended),
      unclosedRate: s.started > 0 ? Math.max(0, s.started - s.ended) / s.started : null,
    })),
    ads: (raw.ads ?? []).map((a) => {
      const total = a.shown + a.failed;
      return { ...a, failureRate: total > 0 ? a.failed / total : null };
    }),
    game: raw.game ?? [],
    gameByProject: raw.gameByProject ?? [],
    purchases: raw.purchases ?? [],
    platforms: raw.platforms ?? [],
    perf: raw.perf ?? [],
    errors: raw.errors ?? [],
  };
}

/**
 * Oyun adimlarini siraya dizer.
 *
 * BILINEN anahtarlar once, KANONIK sirada — "basla" olayi "bitir"den once
 * gelmeli, sayisi kucuk olsa bile. Sayiya gore siralamak huniyi ters cevirirdi.
 *
 * BILINMEYEN anahtarlar ATILMAZ, sona eklenir (sayiya gore). Bu cok-urunlu
 * yapinin sarti: GAME_STEP_ORDER Block Forge'un sozlugu; Dante veya Echo baska
 * anahtarlar gonderecek. Filtrelemek onlari SESSIZCE gorunmez yapardi — yeni bir
 * oyun ekleyen kisi verisinin neden gelmedigini anlayamazdi.
 *
 * Time: O(n log n) — bilinmeyenlerin siralamasi. Space: O(n).
 */
export function orderedGameSteps(rows: readonly CountRow[]): CountRow[] {
  const byKey = new Map(rows.map((r) => [r.key, r.count]));
  const known = new Set<string>(GAME_STEP_ORDER);

  const canonical = GAME_STEP_ORDER.filter((k) => byKey.has(k)).map((k) => ({
    key: k,
    count: byKey.get(k)!,
  }));

  const rest = rows
    .filter((r) => !known.has(r.key))
    .slice()
    .sort((a, b) => b.count - a.count);

  return [...canonical, ...rest];
}

/**
 * Enstrümantasyon supheleri — kullanici davranisi gibi okunmamasi gereken sinyaller.
 *
 * NEDEN AYRI: "oturumlarin %100'u kapanmiyor" bir urun bulgusu degil, olcum
 * hatasidir. Ayni kutuda gostermek yanlis karar aldirir.
 */
export function instrumentationWarnings(f: GameFunnels): string[] {
  const out: string[] = [];
  for (const s of f.sessions) {
    if (s.started > 0 && s.ended === 0) {
      out.push(`${s.platform}: ${s.started} oturum başladı, hiçbiri kapanmadı`);
    } else if (s.ended > s.started) {
      out.push(`${s.platform}: bitiş (${s.ended}) başlangıçtan (${s.started}) fazla`);
    }
  }
  const starts = f.game
    .filter((g) => g.key.startsWith("game_start"))
    .reduce((a, g) => a + g.count, 0);
  const overs = f.game.find((g) => g.key === "game_over_score")?.count ?? 0;
  if (starts > 0 && overs > starts * 1.5) {
    out.push(`Oyun bitişi (${overs}) başlangıçtan (${starts}) fazla — başlangıç olayı eksik`);
  }
  return out;
}
