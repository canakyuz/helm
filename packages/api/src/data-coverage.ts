import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

import { providerLabel } from "@helm/domain";

/**
 * Veri kapsami - hangi kaynak susmus, hangi proje hic baglanmamis.
 *
 * NEDEN TURETME, OLAY DEGIL: bayatlik ANLIK BIR DURUM. alert_events'e yazilsa
 * kaynak duzeldikten sonra da uyari orada durur ve elle kapatilmasi gerekirdi.
 * Okuma aninda turetilince kendini iyilestirir.
 *
 * NEDEN GEREKLI: bir kokpitte "gelir ₺0" ile "olcum gelmiyor" ayni ekranda ayni
 * sekilde gorunemez. AdMob senkronu sussa panel ₺0 gosterir ve para
 * kazanilmiyor sanilir.
 */

export type CoverageSeverity = "info" | "warn" | "critical";

export type CoverageIssue = {
  /** Kararli kimlik - kapatma (dismiss) durumu bunun uzerinden tutulur. */
  id: string;
  severity: CoverageSeverity;
  title: string;
  detail: string;
  projectId: string;
};

/**
 * Kaynagin BEKLENEN gecikmesi (gun). Esik kaynaga gore degisir: AdMob gunu
 * gunune raporlar, Apple satis raporunu T-1 yayinlar ve hafta sonu gecikir.
 * Tek bir global esik ya Apple'i surekli "susmus" gosterir ya da AdMob'un
 * gercekten sustugunu gunlerce gizler.
 */
const EXPECTED_LAG: Record<string, number> = {
  admob: 0,
  revenuecat: 0,
  sentry: 0,
  posthog: 0,
  supabase: 0,
  game: 0,
  app_store_connect: 1,
  play_console: 1,
};
const DEFAULT_LAG = 1;

/** Beklenen gecikmenin uzerine tanianan pay. 1 gun: tek bir gecikmis senkron
 *  uyari uretmemeli, alarm yorgunlugu gercek uyarilari kor eder. */
const GRACE_DAYS = 1;
/** Bu kadar gun asimda durum "kritik" - bir gunluk aksama degil, kopmus akis. */
const CRITICAL_AFTER = 3;

type SourceRow = {
  projectId: string;
  projectName: string;
  source: string;
  lastDate: string | null;
  ageDays: number | null;
};

type MetricRow = {
  projectId: string;
  projectName: string;
  source: string;
  metric: string;
  lastDate: string | null;
  ageDays: number | null;
};

type ProjectRow = {
  projectId: string;
  projectName: string;
  type: string;
  integrations: number;
  metricRows: number;
  eventRows: number;
  lastDate: string | null;
};

type CoveragePayload = {
  today: string;
  sources: SourceRow[];
  metrics: MetricRow[];
  projects: ProjectRow[];
};

/** Ekranlarda kutu kaplayan metriklerin okunur adi. Listede olmayanlar
 *  bildirilmez: her metrik bir uyariyi hak etmiyor, yalnizca kokpitte yer
 *  tutanlar. Aksi halde 30 metrigin her sessizligi uyari uretirdi. */
const WATCHED_METRICS: Record<string, string> = {
  crash_free_sessions: "Çökmesiz oturum",
  errors: "Hata takibi",
  dau: "Günlük aktif kullanıcı",
  mau: "Aylık aktif kullanıcı",
  mrr: "MRR",
  active_subs: "Aktif abone",
  ad_revenue: "Reklam geliri",
  avg_session_sec: "Ortalama oturum süresi",
};

const label = (source: string): string => providerLabel(source);

const dayWord = (n: number): string => `${n} gün`;

export async function fetchDataCoverage(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<CoverageIssue[]> {
  const { data, error } = await client.rpc("data_coverage");
  if (error) throw error;

  const payload = (data ?? { today: "", sources: [], metrics: [], projects: [] }) as CoveragePayload;
  const issues: CoverageIssue[] = [];

  const inScope = (projectId: string) =>
    propertyId === "all" || projectId === propertyId;

  // 1) Susmus kaynak - gecmisi VAR ama akis durmus. En degerli sinyal bu:
  //    hic baglanmamis bir kaynak bilinen bir eksiklik, susan kaynak sessiz
  //    bir yalan uretir.
  for (const s of payload.sources) {
    if (!inScope(s.projectId) || s.ageDays == null) continue;
    const budget = (EXPECTED_LAG[s.source] ?? DEFAULT_LAG) + GRACE_DAYS;
    const over = s.ageDays - budget;
    if (over <= 0) continue;
    issues.push({
      id: `stale:${s.projectId}:${s.source}`,
      severity: over >= CRITICAL_AFTER ? "critical" : "warn",
      title: `${label(s.source)} veri göndermiyor`,
      detail: `${s.projectName} · son kayıt ${s.lastDate} (${dayWord(s.ageDays)} önce)`,
      projectId: s.projectId,
    });
  }

  // 2) Olmus METRIK - kaynak hala yaziyor ama bu olcum durmus. Kaynak bazinda
  //    bakmak bunu kaciriyordu: sentry her gun `errors` yazarken
  //    `crash_free_sessions` 32 gundur gelmiyor ve ekranda yalnizca bos bir
  //    kutu kaliyor. Kutuyu bos birakip sebebini soylememek en kotusu.
  for (const m of payload.metrics ?? []) {
    if (!inScope(m.projectId) || m.ageDays == null) continue;
    const name = WATCHED_METRICS[m.metric];
    if (name == null) continue;
    const budget = (EXPECTED_LAG[m.source] ?? DEFAULT_LAG) + GRACE_DAYS;
    const over = m.ageDays - budget;
    if (over <= 0) continue;
    issues.push({
      id: `metric:${m.projectId}:${m.metric}`,
      severity: over >= CRITICAL_AFTER ? "critical" : "warn",
      title: `${name} ölçümü durdu`,
      detail: `${m.projectName} · ${label(m.source)} · son kayıt ${m.lastDate} (${dayWord(m.ageDays)} önce)`,
      projectId: m.projectId,
    });
  }

  for (const p of payload.projects) {
    if (!inScope(p.projectId)) continue;

    // 3) Telemetri akiyor ama hicbir gelir/magaza kaynagi bagli degil.
    //    Block Forge tam olarak boyle: 27bin olay gonderiyor, geliri "-".
    if (p.integrations === 0 && (p.eventRows > 0 || p.metricRows > 0)) {
      issues.push({
        id: `unconnected:${p.projectId}`,
        severity: "warn",
        title: `${p.projectName} kaynaklara bağlı değil`,
        detail:
          "Telemetri geliyor ama mağaza/gelir entegrasyonu yok - kazancı ölçülemiyor",
        projectId: p.projectId,
      });
      continue;
    }

    // 4) Hicbir verisi olmayan proje. "info": bilinen bir eksik, ariza degil -
    //    henuz kurulmamis bir proje uyari kirmizisini hak etmez.
    if (p.integrations === 0 && p.metricRows === 0 && p.eventRows === 0) {
      issues.push({
        id: `empty:${p.projectId}`,
        severity: "info",
        title: `${p.projectName} için veri yok`,
        detail: "Entegrasyon tanımlanmamış",
        projectId: p.projectId,
      });
    }
  }

  const RANK: Record<CoverageSeverity, number> = { critical: 0, warn: 1, info: 2 };
  return issues.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
