import { useMemo } from "react";
import {
  isCountMetric,
  maskBrand,
  maskProject,
  scaleCount,
} from "@helm/domain";
import type {
  AcquisitionData,
  CockpitKpis,
  MetricDetail,
  AuditEntry,
  CountryMetrics,
  FunnelData,
  GameFunnels,
  GeoData,
  HubUser,
  OsData,
  ProjectBreakdown,
  Property,
  PropertyDau,
  PropertyListItem,
  PropertyMetricTotal,
  Segment,
} from "@helm/api";

import { usePreferences } from "~/lib/preferences";

/**
 * Ekran görüntüsü merceği - React Query'nin `select`'ine takılır.
 *
 * NEDEN `select`, NEDEN CACHE DEĞİL: `select` okuma anında çalışır, cache'e
 * yazmaz. Anahtarı çevirince aynı karede maskeli/maskesiz hale geçilir -
 * refetch yok, ağ turu yok. Cache'e maskelenmiş veri yazsaydık geri dönmek
 * için invalidate + yeniden çekme gerekirdi.
 *
 * NEDEN ÜRETİCİ HOOK'TA, NEDEN RENDER'DA DEĞİL: proje adı ~10 ayrı yerde
 * basılıyor (iki proje seçici, kırılım listesi, özet listesi, monogram,
 * arama filtresi…). Render tarafında tek tek maskelemek demek, BİRİNİ
 * kaçırmak demek - ve kaçırılan tek yer, paylaşılan görsele gerçek ismin
 * sızması demek. Hook'ta kesince monogram, sıralama ve arama da bedava
 * doğru oluyor.
 */
export type DemoLens = {
  /** Ad maskesi açık mı. */
  names: boolean;
  /** Sayaç çarpanı. 1 = dokunma. */
  count: number;
};

/** Identity-stable mercek - `select` referansının gereksiz değişmemesi için. */
export function useDemoLens(): DemoLens {
  const { maskNames, revenueMultiplier } = usePreferences();
  return useMemo(
    () => ({ names: maskNames, count: revenueMultiplier }),
    [maskNames, revenueMultiplier],
  );
}

/** Hiçbir maske açık değilse referansı AYNEN döndür - React Query gereksiz
 *  yeniden render etmesin. */
const idle = (l: DemoLens) => !l.names && l.count === 1;

// ─── Ad taşıyan şekiller ─────────────────────────────────────────────────────

export function lensProperties(rows: Property[], l: DemoLens): Property[] {
  if (!l.names) return rows;
  return rows.map((p) => ({
    ...p,
    name: maskProject(p.name, true)!,
    // slug ada bağlı türetilmiş bir alan; maskelenmezse adı geri verir.
    slug: maskProject(p.name, true)!.toLowerCase(),
    brandName: maskBrand(p.brandName, true),
    heartbeatName: maskProject(p.heartbeatName, true),
  }));
}

export function lensPropertyList(rows: PropertyListItem[], l: DemoLens): PropertyListItem[] {
  if (!l.names) return rows;
  return rows.map((p) => ({
    ...p,
    name: maskProject(p.name, true)!,
    brandName: maskBrand(p.brandName, true),
  }));
}

export function lensProjectsBreakdown(
  rows: ProjectBreakdown[],
  l: DemoLens,
): ProjectBreakdown[] {
  if (idle(l)) return rows;
  return rows.map((p) => ({
    ...p,
    name: maskProject(p.name, l.names)!,
    brandName: maskBrand(p.brandName, l.names),
    // dau SAYAÇ → ölçeklenir. mrr/adRevenue PARA → format katmanı zaten
    // çarpıyor (use-format-currency), burada da çarpsak ÇİFT olurdu.
    // openAlerts de ölçeklenmez: "340 açık uyarı" gerçekçi bir ekran değil.
    dau: scaleCount(p.dau, l.count),
  }));
}

export function lensPropertyDau(rows: PropertyDau[], l: DemoLens): PropertyDau[] {
  if (idle(l)) return rows;
  return rows.map((p) => ({
    ...p,
    name: maskProject(p.name, l.names)!,
    brandName: maskBrand(p.brandName, l.names),
    dau: scaleCount(p.dau, l.count),
    total: scaleCount(p.total, l.count),
  }));
}

export function lensPropertyMetricTotals(
  rows: PropertyMetricTotal[],
  l: DemoLens,
  metric: string,
): PropertyMetricTotal[] {
  if (idle(l)) return rows;
  const scale = isCountMetric(metric) ? l.count : 1;
  return rows.map((p) => ({
    ...p,
    name: maskProject(p.name, l.names)!,
    brandName: maskBrand(p.brandName, l.names),
    thisMonth: scaleCount(p.thisMonth, scale),
    today: scaleCount(p.today, scale),
  }));
}

export function lensSegments(rows: Segment[], l: DemoLens): Segment[] {
  if (!l.names) return rows;
  return rows.map((s) => ({ ...s, propertyName: maskProject(s.propertyName, true) }));
}

export function lensAudit(rows: AuditEntry[], l: DemoLens): AuditEntry[] {
  if (!l.names) return rows;
  return rows.map((a) => ({ ...a, propertyName: maskProject(a.propertyName, true) }));
}

export function lensUsers(rows: HubUser[], l: DemoLens): HubUser[] {
  if (!l.names) return rows;
  return rows.map((u) => ({ ...u, propertyName: maskProject(u.propertyName, true) }));
}

// ─── Sayaç taşıyan şekiller ──────────────────────────────────────────────────

export function lensCockpitKpis(data: CockpitKpis, l: DemoLens): CockpitKpis {
  if (l.count === 1) return data;
  return {
    ...data,
    // SADECE sayaçlar. mrr/adRevenue para (format katmanı çarpıyor),
    // delta'lar ORAN (ölçek altında değişmez), openAlerts/syncIngested
    // operasyonel sayaç - ölçeklenirse ekran yalan söyler.
    dau: scaleCount(data.dau, l.count),
    totalUsers: scaleCount(data.totalUsers, l.count),
    activeSubs: scaleCount(data.activeSubs, l.count),
    newUsers: scaleCount(data.newUsers, l.count),
  };
}

export function lensMetricDetail(
  data: MetricDetail,
  l: DemoLens,
  metric: string,
): MetricDetail {
  // Metrik kapısı ZORUNLU: bu hook `dau` ile de `crash_free_sessions` ile de
  // çağrılıyor. Yüzdeyi 10 ile çarpmak %995 üretirdi.
  if (l.count === 1 || !isCountMetric(metric)) return data;
  return {
    ...data,
    today: scaleCount(data.today, l.count),
    yesterday: scaleCount(data.yesterday, l.count),
    thisMonth: scaleCount(data.thisMonth, l.count),
    lastMonth: scaleCount(data.lastMonth, l.count),
    // Seri de ölçeklenmeli: KPI rakamı büyüyüp altındaki grafik olduğu gibi
    // kalırsa ikisi birbirini tutmaz ve görsel yanlış okunur.
    series: data.series.map((p) => ({ ...p, value: scaleCount(p.value, l.count) })),
  };
}

export function lensCountryMetrics(data: CountryMetrics, l: DemoLens): CountryMetrics {
  if (l.count === 1 || !isCountMetric(data.metric)) return data;
  return {
    ...data,
    rows: data.rows.map((r) => ({ ...r, value: scaleCount(r.value, l.count) })),
    total: scaleCount(data.total, l.count),
  };
}

export function lensGameFunnels(data: GameFunnels, l: DemoLens): GameFunnels {
  if (idle(l)) return data;
  const n = l.count;
  return {
    ...data,
    // unclosedRate / failureRate ORAN - ölçeklenmez, pay ve payda birlikte
    // büyüdüğü için zaten değişmez.
    sessions: data.sessions.map((s) => ({
      ...s,
      started: scaleCount(s.started, n),
      ended: scaleCount(s.ended, n),
      unclosed: scaleCount(s.unclosed, n),
    })),
    ads: data.ads.map((a) => ({
      ...a,
      shown: scaleCount(a.shown, n),
      failed: scaleCount(a.failed, n),
    })),
    game: data.game.map((c) => ({ ...c, count: scaleCount(c.count, n) })),
    gameByProject: data.gameByProject.map((p) => ({
      ...p,
      projectName: maskProject(p.projectName, l.names)!,
      steps: p.steps.map((c) => ({ ...c, count: scaleCount(c.count, n) })),
    })),
    purchases: data.purchases.map((c) => ({ ...c, count: scaleCount(c.count, n) })),
    platforms: data.platforms.map((p) => ({ ...p, events: scaleCount(p.events, n) })),
    // perf p50/p05/worst FPS - fiziksel tavanı var, ölçeklenmez. samples sayaç.
    perf: data.perf.map((p) => ({ ...p, samples: scaleCount(p.samples, n) })),
    errors: data.errors.map((c) => ({ ...c, count: scaleCount(c.count, n) })),
  };
}

export function lensAcquisition(data: AcquisitionData, l: DemoLens): AcquisitionData {
  if (l.count === 1) return data;
  return {
    ...data,
    rows: data.rows.map((r) => ({ ...r, users: scaleCount(r.users, l.count) })),
    total: scaleCount(data.total, l.count),
  };
}

export function lensOsBreakdown(data: OsData, l: DemoLens): OsData {
  if (l.count === 1) return data;
  // pct ORAN - dokunulmaz.
  return {
    ...data,
    rows: data.rows.map((r) => ({ ...r, users: scaleCount(r.users, l.count) })),
    total: scaleCount(data.total, l.count),
  };
}

export function lensGeoBreakdown(data: GeoData, l: DemoLens): GeoData {
  if (l.count === 1) return data;
  return {
    ...data,
    rows: data.rows.map((r) => ({ ...r, users: scaleCount(r.users, l.count) })),
    total: scaleCount(data.total, l.count),
  };
}

export function lensFunnel(data: FunnelData, l: DemoLens): FunnelData {
  if (l.count === 1) return data;
  // overall_pct / step_pct / drop / delta_pct / overall_conversion hepsi ORAN.
  return {
    ...data,
    steps: data.steps.map((s) => ({
      ...s,
      count: scaleCount(s.count, l.count),
      prev_count: scaleCount(s.prev_count, l.count),
    })),
    total_entered: scaleCount(data.total_entered, l.count),
    total_converted: scaleCount(data.total_converted, l.count),
  };
}
