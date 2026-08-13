import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { FX_FALLBACK, fetchFxRates, metricValueUsd, toUsd } from "./fx-rates";

/**
 * Gelirin KANONIK tanimi.
 *
 * `app_revenue` BILEREK DISARIDA: olculdu, `subscription_revenue` ile birebir
 * ayni para (ayni toplam 92.49, ayni 8 sifir-disi gun). Iki isim altinda tek
 * kayit. Ikisini birden toplamak cift sayim olur; Overview `ad + app`, Kirilim
 * `ad + subs + iap` topluyordu — iki ekran iki farkli tanim. Tek tanim budur.
 */
export const REVENUE_SOURCES = [
  { metric: "ad_revenue", label: "Ad revenue" },
  { metric: "subscription_revenue", label: "Subscriptions" },
  { metric: "iap_revenue", label: "In-app purchase" },
] as const;

export type RevenueSource = (typeof REVENUE_SOURCES)[number]["metric"];

/**
 * Bir gelir kaleminin iki bacagi.
 *
 * ANLIK  — RevenueCat webhook'u. Satin alma aninda gelir, revize olabilir.
 * KESIN  — magaza raporu (App Store Connect / Play). T-1 gecikmeli ama mutabakatli;
 *          komisyon, iade ve kur farki bu rakama yansir.
 *
 * NEDEN IKISI BIRDEN: yalnizca kesin gosterirsek bugunun geliri 1-2 gun gorunmez.
 * Yalnizca anligi gosterirsek iade ve komisyon hic yansimaz. Ikisini SESSIZCE
 * degistirmek de yanlis olurdu — o zaman magaza farkli bir rakam soyledigi anda
 * fark kaybolurdu. Durum acikca tasinir.
 */
export type ReconState =
  /** Anlik var, magaza henuz raporlamadi. Bugun ve dun icin normal. */
  | "pending"
  /** Ikisi de var ve ortusuyor. */
  | "confirmed"
  /** Ikisi de var ama farkli — iade, komisyon veya ayristirma hatasi. */
  | "mismatch"
  /** Yalnizca magaza raporu var. Webhook'tan onceki gunler icin normal. */
  | "storeOnly";

export type RevenueLeg = {
  /** RevenueCat magaza kodu: APP_STORE, PLAY_STORE, STRIPE… */
  store: string;
  provisional: number;
  confirmed: number;
  state: ReconState;
};

/**
 * Tek bir odeme satiri.
 *
 * IKI GRANULARITE: webhook baglandiktan sonrasi ISLEM bazinda (hangi urun, hangi
 * magaza, hangi tur), oncesi GUN bazinda (magaza raporu yalnizca gunluk toplam
 * verir). Ayrimi saklamiyoruz — "gunluk toplam" satirinin tek bir satin alma
 * oldugunu ima etmek yanlis olurdu.
 */
export type PaymentRow = {
  date: string;
  /** Urun kimligi veya kalem adi. */
  label: string;
  /** Olay turu (yeni abonelik, yenileme…) veya "gunluk toplam". */
  kind: string;
  store: string | null;
  /** USD'ye normalize. */
  amount: number;
  granularity: "transaction" | "day";
};

export type RevenueBucket = {
  /** "2026-08" (ay) veya "2026-W32" (hafta). */
  key: string;
  /** Kapsanan ilk ve son gun (ISO). */
  start: string;
  end: string;
  total: number;
  /** metric → tutar. Sifir olanlar da burada; gizleme karari UI'in. */
  bySource: Record<string, number>;
  /** Gunluk toplamlar — bar grafigi icin. */
  days: Array<{ date: string; value: number }>;
  /** Magaza bazinda anlik/kesin mutabakat. Bos ise webhook verisi yok. */
  legs: RevenueLeg[];
  /** Donem SONUNDAKI MRR. Nokta-zaman metrigi — donemin toplami degil. */
  mrr: number | null;
  /** Donem sonundaki aktif abone. */
  activeSubs: number | null;
  /** Donemdeki odemeler, yeniden eskiye. */
  payments: PaymentRow[];
  /** bySource'ta tutari MAGAZA RAPORUNDAN DEGIL webhook'tan gelen kaynaklar.
   *  Para gercek ama magaza henuz dogrulamadi — UI bunu "anlık" diye
   *  isaretlemeli, yoksa kesin rakamla ayni agirlikta okunur. */
  provisionalSources: string[];
};

export type RevenueHistory = {
  /** Yeniden eskiye. Yalnizca VERISI OLAN donemler. */
  months: RevenueBucket[];
  weeks: RevenueBucket[];
  /** En az bir donemde sifirdan farkli olan kaynaklar. */
  activeSources: string[];
};

type Row = { date: string; metric: string; value: number; currency: string | null };
type EventRow = {
  store: string | null;
  amount: string | number | null;
  currency: string | null;
  occurred_at: string;
  product_id: string | null;
  event_type: string | null;
};

/** Kurus farklari mutabakati bozmasin — bu esigin altindaki fark "ayni" sayilir. */
const RECON_TOLERANCE = 0.01;

function reconcile(provisional: number, confirmed: number): ReconState {
  if (provisional > 0 && confirmed === 0) return "pending";
  if (provisional === 0 && confirmed > 0) return "storeOnly";
  return Math.abs(provisional - confirmed) <= RECON_TOLERANCE ? "confirmed" : "mismatch";
}

/** ISO haftasinin pazartesisi. Tarih string'i uzerinden, saat dilimi karismaz. */
function mondayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  // getUTCDay: 0=pazar. Pazartesi bazli offset.
  const offset = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - offset);
  return dt.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** "2026-08-11" → "2026-W32". Yil sinirinda pazartesi hangi yila dusuyorsa o. */
function weekKey(monday: string): string {
  const [y, m, d] = monday.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  const jan1 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.floor((dt.getTime() - jan1.getTime()) / 604_800_000) + 1;
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Gelir gecmisi — kaynak kirilimi ve gun/hafta/ay gruplari.
 *
 * TEK SORGU, bellekte gruplama. Gelir satirlari ~300 civari (olculdu); ay basina
 * ayri sorgu atmak N+1 olurdu ve donem gezinmesi her dokunusta ag turu isterdi.
 * Time: O(n log n) — n satir, siralama gruplama sonrasi anahtar sayisi kadar.
 * Space: O(n).
 *
 * `since` verilmezse son 12 ay. Veri Nisan 2026'da basliyor, bu tamamini kapsar.
 */
export async function fetchRevenueHistory(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  since?: string,
): Promise<RevenueHistory> {
  const now = new Date();
  const from =
    since ??
    new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);

  let q = client
    .from("metrics")
    .select("date, metric, value, currency")
    .in("metric", [...REVENUE_SOURCES.map((s) => s.metric), "mrr", "active_subs"])
    .gte("date", from)
    .order("date", { ascending: true });

  if (propertyId !== "all") q = q.eq("project_id", propertyId);

  // Webhook olaylari ayni pencerede: anlik bacak. Ayri sorgu ama paralel —
  // magaza metrikleriyle ayni gidis-donuste biter.
  let eq = client
    .from("revenue_events")
    .select("store, amount, currency, occurred_at, product_id, event_type")
    .gte("occurred_at", `${from}T00:00:00Z`)
    .not("amount", "is", null);
  if (propertyId !== "all") eq = eq.eq("project_id", propertyId);

  const [{ data, error }, { data: events }, rates] = await Promise.all([
    q,
    eq,
    fetchFxRates(),
  ]);
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  const fx = rates ?? FX_FALLBACK;

  // Gun + kaynak kirilimini tek gecliste kur.
  const byDay = new Map<string, Map<string, number>>();
  // Nokta-zaman metrikleri (mrr, active_subs) TOPLANMAZ — donem sonundaki deger
  // alinir. Toplamak "Temmuz'da 43.99 x 31 gun MRR" gibi anlamsiz bir sayi verirdi.
  const pointInTime = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (r.metric === "mrr" || r.metric === "active_subs") {
      let d = pointInTime.get(r.date);
      if (d == null) {
        d = new Map();
        pointInTime.set(r.date, d);
      }
      const usd = metricValueUsd(r.metric, Number(r.value), r.currency, fx);
      d.set(r.metric, (d.get(r.metric) ?? 0) + usd);
      continue;
    }
    const usd = metricValueUsd(r.metric, Number(r.value), r.currency, fx);
    let day = byDay.get(r.date);
    if (day == null) {
      day = new Map();
      byDay.set(r.date, day);
    }
    day.set(r.metric, (day.get(r.metric) ?? 0) + usd);
  }

  // Gun -> magaza -> anlik tutar. occurred_at UTC damgali; gun anahtarini
  // metrics ile ayni bicimde (YYYY-MM-DD) cikariyoruz ki kovalar ortussun.
  const provByDay = new Map<string, Map<string, number>>();
  // Gun -> KAYNAK -> anlik tutar. provByDay magazaya, bu kaynaga kirar.
  // Ikisi ayri: mutabakat magaza bazinda yapilir, kirilim kaynak bazinda.
  const provSourceByDay = new Map<string, Map<string, number>>();
  const txByDay = new Map<string, PaymentRow[]>();
  for (const e of (events ?? []) as EventRow[]) {
    const day = e.occurred_at.slice(0, 10);
    const store = e.store ?? "BILINMIYOR";
    // USD'ye normalize SART: webhook tutari SATIN ALMA para biriminde saklanir,
    // magaza metrikleri ise USD'ye normalize edilmis. Cevirmeden karsilastirmak
    // EUR/GBP satin almalarda mutabakati yanlis "uyusmuyor" gosterirdi.
    const amt = toUsd(Number(e.amount) || 0, e.currency, fx);
    let m = provByDay.get(day);
    if (m == null) {
      m = new Map();
      provByDay.set(day, m);
    }
    m.set(store, (m.get(store) ?? 0) + amt);

    // Tek seferlik satin alma "uygulama ici", geri kalan her gelir ureten olay
    // (ilk satin alma, yenileme, iptal iptali, paket degisimi) abonelik.
    const metric =
      e.event_type === "NON_RENEWING_PURCHASE" ? "iap_revenue" : "subscription_revenue";
    let sm = provSourceByDay.get(day);
    if (sm == null) {
      sm = new Map();
      provSourceByDay.set(day, sm);
    }
    sm.set(metric, (sm.get(metric) ?? 0) + amt);

    const list = txByDay.get(day) ?? [];
    list.push({
      date: day,
      label: e.product_id ?? "—",
      kind: e.event_type ?? "—",
      store: e.store,
      amount: amt,
      granularity: "transaction",
    });
    txByDay.set(day, list);
  }

  const EMPTY: ReadonlyMap<string, number> = new Map();

  const bucket = (keyOf: (iso: string) => string): RevenueBucket[] => {
    const acc = new Map<string, RevenueBucket>();
    // Mutabakat icin YALNIZCA magaza raporundan gelen toplam — asagida bySource
    // anlik tarafi da icerebilecegi icin oradan okunamaz, yoksa dogrulanmamis
    // para "DOGRULANDI" gorunurdu.
    const confirmedStore = new Map<string, number>();
    // kova -> metrik -> anlik toplam, ve kova -> gun -> metrik -> anlik tutar.
    // Anlik taraf ILK GECISTE TOPLAMA KATILMAZ; karar kova bazinda ikinci
    // gecişte veriliyor (nedeni asagida).
    const provByBucket = new Map<string, Map<string, number>>();
    const provByBucketDay = new Map<string, Map<string, Map<string, number>>>();

    // Gunler IKI KAYNAGIN BIRLESIMI. Onceki hal yalnizca metrics gunlerini
    // geziyordu: magaza raporu hic satir yazmamis bir gunde gelen odeme
    // (webhook ANINDA bilir, Apple T-1) hicbir kovaya girmiyordu.
    const dayKeys = [...new Set([...byDay.keys(), ...provSourceByDay.keys()])].sort();

    for (const date of dayKeys) {
      const key = keyOf(date);
      let b = acc.get(key);
      if (b == null) {
        b = {
          key, start: date, end: date, total: 0, bySource: {}, days: [],
          legs: [], mrr: null, activeSubs: null, payments: [], provisionalSources: [],
        };
        acc.set(key, b);
      }

      const confirmed = byDay.get(date) ?? EMPTY;

      let dayTotal = 0;
      for (const [metric, value] of confirmed) {
        b.bySource[metric] = (b.bySource[metric] ?? 0) + value;
        dayTotal += value;
      }

      const provisional = provSourceByDay.get(date);
      if (provisional != null) {
        let pm = provByBucket.get(key);
        if (pm == null) {
          pm = new Map();
          provByBucket.set(key, pm);
        }
        let pd = provByBucketDay.get(key);
        if (pd == null) {
          pd = new Map();
          provByBucketDay.set(key, pd);
        }
        pd.set(date, new Map(provisional));
        for (const [metric, amount] of provisional) {
          pm.set(metric, (pm.get(metric) ?? 0) + amount);
        }
      }

      const dayConfirmedStore =
        (confirmed.get("subscription_revenue") ?? 0) + (confirmed.get("iap_revenue") ?? 0);
      if (dayConfirmedStore !== 0) {
        confirmedStore.set(key, (confirmedStore.get(key) ?? 0) + dayConfirmedStore);
      }

      b.total += dayTotal;
      b.days.push({ date, value: dayTotal });
      if (date < b.start) b.start = date;
      if (date > b.end) b.end = date;
    }
    // Anlik/kesin mutabakati kova bazinda. Kesin taraf: magaza raporundan gelen
    // abonelik + uygulama-ici toplami (reklam geliri magaza degil, disarida kalir).
    for (const b of acc.values()) {
      b.days.sort((x, y) => (x.date < y.date ? -1 : 1));

      // ANLIK GELIRIN KOVAYA KATILMASI — karar KOVA BAZINDA, gun bazinda DEGIL.
      //
      // Neden gun bazinda olmaz (olculdu): Apple geliri TAHSILAT gunune yazar,
      // RevenueCat ise SATIN ALMA anina. Ayni para iki farkli gune duser. Gun
      // bazinda "magaza sustuysa anligi al" denince Temmuz ₺5,082 → ₺10,933
      // cikti; abonelik 3,417'den 9,268'e sisti. Ayni para iki kez sayilmisti.
      //
      // Kova bazinda kural: magaza bu donemde o kaynak icin RAKAM VERDIYSE
      // anlik taraf TAMAMEN yok sayilir. Vermediyse (bugunku Agustos: Apple
      // henuz hic abonelik raporlamadi) anlik tutar gosterilir.
      //
      // Bedeli: magaza donemin bir kismini raporlamis ama son gunleri
      // raporlamamissa o gunlerin parasi TOPLAMDA gorunmez. Bilerek: eksik
      // gostermek, fazla gostermekten iyidir — ustelik eksik kalan tutar
      // mutabakat kartinda "anlık / bekliyor" olarak zaten duruyor.
      const prov = provByBucket.get(b.key);
      if (prov != null) {
        const used = new Set<string>();
        for (const [metric, amount] of prov) {
          if ((b.bySource[metric] ?? 0) > 0) continue;
          used.add(metric);
          b.bySource[metric] = amount;
          b.total += amount;
          b.provisionalSources.push(metric);
        }
        if (used.size > 0) {
          const perDay = provByBucketDay.get(b.key);
          for (const d of b.days) {
            const m = perDay?.get(d.date);
            if (m == null) continue;
            for (const metric of used) d.value += m.get(metric) ?? 0;
          }
        }
      }

      const provByStore = new Map<string, number>();
      for (const d of b.days) {
        for (const [store, amt] of provByDay.get(d.date) ?? []) {
          provByStore.set(store, (provByStore.get(store) ?? 0) + amt);
        }
      }
      // Nokta-zaman: donemin SON gunundeki deger.
      const lastWithPit = [...pointInTime.keys()]
        .filter((d) => d >= b.start && d <= b.end)
        .sort()
        .pop();
      if (lastWithPit != null) {
        const pit = pointInTime.get(lastWithPit)!;
        b.mrr = pit.get("mrr") ?? null;
        b.activeSubs = pit.get("active_subs") ?? null;
      }

      // Odemeler: islem varsa islem, yoksa o gunun magaza toplami. Ayni gun icin
      // ikisini birden listelemek CIFT SAYIM olurdu.
      const payments: PaymentRow[] = [];
      for (const d of b.days) {
        const tx = txByDay.get(d.date);
        if (tx != null && tx.length > 0) {
          payments.push(...tx);
          continue;
        }
        const sub = byDay.get(d.date)?.get("subscription_revenue") ?? 0;
        const iap = byDay.get(d.date)?.get("iap_revenue") ?? 0;
        if (sub > 0) payments.push({ date: d.date, label: "Abonelik", kind: "günlük toplam", store: null, amount: sub, granularity: "day" });
        if (iap > 0) payments.push({ date: d.date, label: "Uygulama içi", kind: "günlük toplam", store: null, amount: iap, granularity: "day" });
      }
      b.payments = payments.sort((x, y) => (x.date < y.date ? 1 : -1));

      // bySource ARTIK anlik tarafi da icerebilir; mutabakatin "kesin" bacagi
      // yalnizca magaza raporundan okunmali, yoksa dogrulanmamis para kendi
      // kendini dogrular ve durum hep "DOGRULANDI" cikar.
      const storeConfirmed = confirmedStore.get(b.key) ?? 0;

      if (provByStore.size === 0 && storeConfirmed === 0) {
        b.legs = [];
      } else if (provByStore.size === 0) {
        b.legs = [{ store: "APP_STORE", provisional: 0, confirmed: storeConfirmed,
                    state: reconcile(0, storeConfirmed) }];
      } else {
        // Magaza raporu tek rakam veriyor (Apple); anlik taraf magazaya ayrilmis.
        b.legs = [...provByStore.entries()].map(([store, provisional]) => {
          const confirmed = store === "APP_STORE" ? storeConfirmed : 0;
          return { store, provisional, confirmed, state: reconcile(provisional, confirmed) };
        });
      }
    }
    // Yeniden eskiye — kullanici en cok guncel donemi acar.
    return [...acc.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
  };

  const months = bucket((iso) => iso.slice(0, 7));
  const weeks = bucket((iso) => weekKey(mondayOf(iso)));

  // Hicbir donemde sifirdan farkli olmayan kaynak "bagli ama uretmiyor"
  // demektir; UI onu gizler, ilk gercek degerde kendiliginden geri gelir.
  const active = new Set<string>();
  for (const day of byDay.values()) {
    for (const [metric, value] of day) if (value !== 0) active.add(metric);
  }
  // Anlik tarafi da sayar: magaza raporu henuz sifirken gelen abonelik geliri
  // aksi halde "uretmiyor" sayilip kirilimdan tamamen gizleniyordu.
  for (const day of provSourceByDay.values()) {
    for (const [metric, value] of day) if (value !== 0) active.add(metric);
  }

  return {
    months,
    weeks,
    activeSources: REVENUE_SOURCES.map((s) => s.metric).filter((m) => active.has(m)),
  };
}

/** Haftanin baslangic/bitis gunleri — UI etiketi icin. */
export function weekRange(bucket: RevenueBucket): { from: string; to: string } {
  const from = mondayOf(bucket.start);
  return { from, to: addDays(from, 6) };
}
