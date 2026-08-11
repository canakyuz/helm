import {
  type Connector,
  type CountryMetricPoint,
  type MetricPoint,
} from "./types.ts";
import { makeAscJwt } from "../../_shared/asc-jwt.ts";

// App Store Connect — Sales Reports (daily summary).
// JWT ES256 ile auth → günlük satış raporu (gzip TSV).
// config: { key_id, issuer_id?, private_key, vendor_number, currency?, app_store_id? }
//   issuer_id: Team Key için Integrations sayfasındaki Issuer ID (UUID).
//              Individual API Key kullanıyorsan BOŞ bırak (Apple `sub: "user"` bekler).
//   private_key: .p8 dosyasının tüm içeriği (BEGIN/END satırları dahil).
//   currency: developer proceeds para birimi (vendor varsayılanı; çoğu hesapta USD).
//   app_store_id: Apple'ın SAYISAL uygulama kimliği (App Store URL'indeki id######),
//                 bundle id DEĞİL. Vendor raporu hesaptaki TÜM uygulamaları içerir;
//                 bu alan verilmezse hepsi toplanıp tek projeye yazılır — birden
//                 fazla uygulaması olan hesaplarda rakamlar birbirine karışır.

const DAYS_BACK = 7;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function fetchDailyReport(
  jwt: string,
  vendorNumber: string,
  date: string,
): Promise<string | null> {
  const params = new URLSearchParams({
    "filter[frequency]": "DAILY",
    "filter[reportType]": "SALES",
    "filter[reportSubType]": "SUMMARY",
    "filter[vendorNumber]": vendorNumber,
    "filter[reportDate]": date,
  });
  const res = await fetch(
    `https://api.appstoreconnect.apple.com/v1/salesReports?${params}`,
    { headers: { Authorization: `Bearer ${jwt}` } },
  );
  if (res.status === 404) return null; // o güne ait rapor yok (henüz oluşmamış)
  if (res.status === 401) {
    const body = await res.text();
    const [header, payload] = jwt.split(".");
    throw new Error(
      `AppStoreConnect 401 — JWT reddedildi.\n` +
        `JWT (jwt.io'da inceleyin, signature'ı atın): ${header}.${payload}.SIGNATURE\n` +
        `Sık görülen sebep: Issuer/Key ID yanlış, .p8 eski/yanlış key, ya da API key'in "Sales and Trends" yetkisi yok (rol: Admin / Finance / Sales gerekli).\n` +
        `Apple yanıtı: ${body}`,
    );
  }
  if (!res.ok) {
    throw new Error(`AppStoreConnect ${res.status}: ${await res.text()}`);
  }
  // gzip TSV → decompress
  const ds = new DecompressionStream("gzip");
  const stream = res.body!.pipeThrough(ds);
  return await new Response(stream).text();
}

interface ReportRow {
  productType: string;
  units: number;
  proceeds: number;
  countryCode: string; // ISO 3166-1 alpha-2; boş ise ""
  /** "Apple Identifier" — raporun HANGI uygulamaya ait oldugu. Kolon yoksa "". */
  appleId: string;
}

/**
 * parseTsv ciktisi. hasAppleId, raporda uygulama kimligi kolonunun BULUNUP
 * bulunmadigini soyler: vendor raporu hesaptaki TUM uygulamalari icerir ve bu
 * kolon olmadan proje bazinda ayirmak imkansizdir. Filtre istenmisken kolon
 * yoksa sessizce yanlis toplam yazmak yerine hata veririz.
 */
interface ParsedReport {
  rows: ReportRow[];
  hasAppleId: boolean;
}

function parseTsv(tsv: string): ParsedReport {
  const lines = tsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  const idx = (name: string) => headers.indexOf(name);
  const iType = idx("Product Type Identifier");
  const iUnits = idx("Units");
  const iProc = idx("Developer Proceeds");
  const iCountry = idx("Country Code");
  const iAppleId = idx("Apple Identifier");
  if (iType < 0 || iUnits < 0 || iProc < 0) return { rows: [], hasAppleId: iAppleId >= 0 };

  const rows: ReportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    rows.push({
      productType: cols[iType] ?? "",
      units: Number(cols[iUnits] ?? 0),
      proceeds: Number(cols[iProc] ?? 0),
      countryCode: iCountry >= 0 ? (cols[iCountry] ?? "").trim() : "",
      appleId: iAppleId >= 0 ? (cols[iAppleId] ?? "").trim() : "",
    });
  }
  return { rows, hasAppleId: iAppleId >= 0 };
}

// Apple product type identifiers:
//   1, 1F, 1T, 1TP = yeni app install (paid/free/universal)
//   7, 7F          = update (download) — sayma
//   IA1, IA9, IAY  = in-app purchase / sub
//   1A, 1E         = paid app upgrade
//   F1             = free in-app purchase
const isDownloadType = (t: string) =>
  t === "1" || t === "1F" || t === "1T" || t === "1TP";

// Gelir sınıflandırması (Apple Product Type Identifier referansı, doğrulandı):
//   sub  = auto-renewable: IAY, IAY-M
//   iap  = IAP + non-renewing sub: IA1, IA1-M, FI1, IA9, IA9-M
//   skip = re-download/update/restore: 3*, 7*, F7, IA3 (proceeds ~0, sayma)
//   app  = kalan (paid app sales) — toplam app_revenue'ya girer ama mix'te ayrı tutulmaz
type RevClass = "sub" | "iap" | "skip" | "app";
function classifyRevenue(productType: string): RevClass {
  const t = productType.toUpperCase();
  if (t === "IAY" || t === "IAY-M") return "sub";
  if (t === "IA1" || t === "IA1-M" || t === "FI1" || t === "IA9" || t === "IA9-M") return "iap";
  if (t === "IA3" || t === "F7" || t.startsWith("3") || t.startsWith("7")) return "skip";
  return "app";
}

export const fetchAppStoreConnect: Connector = async (config) => {
  const jwt = await makeAscJwt(config as unknown as { key_id: string; issuer_id?: string; private_key: string });
  const vendor = String(config.vendor_number);
  // Apple'in sayisal uygulama kimligi (App Store URL'indeki id######). Yorum
  // tarafindaki app_store_id ile ayni alan; yeni bir isim uydurulmadi.
  const appFilter =
    typeof config.app_store_id === "string" && config.app_store_id.trim().length > 0
      ? config.app_store_id.trim()
      : null;

  const points: MetricPoint[] = [];
  const byCountry: CountryMetricPoint[] = [];
  const today = new Date();
  // Apple's DAILY reports T-1 (dünden başla geriye).
  for (let i = 1; i <= DAYS_BACK; i++) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const date = ymd(d);
    const tsv = await fetchDailyReport(jwt, vendor, date);
    if (!tsv) continue;
    const parsed = parseTsv(tsv);
    // Vendor raporu hesaptaki TUM uygulamalari icerir. app_store_id verilmisse
    // yalnizca o uygulamanin satirlari sayilir; verilmemisse davranis eskisi
    // gibi kalir (hepsi toplanir) — mevcut entegrasyonlar kirilmaz.
    if (appFilter && !parsed.hasAppleId) {
      throw new Error(
        `ASC satis raporunda "Apple Identifier" kolonu yok; app_store_id="${appFilter}" ile ayristirma yapilamaz. Filtresiz devam etmek hesaptaki tum uygulamalari bu projeye yazardi.`,
      );
    }
    const rows = appFilter
      ? parsed.rows.filter((r) => r.appleId === appFilter)
      : parsed.rows;
    let downloads = 0;
    let revenue = 0;
    let subRev = 0;
    let iapRev = 0;
    // Ülke bazlı toplam — Country Code yoksa "??" altında topla.
    const dlByCountry = new Map<string, number>();
    const revByCountry = new Map<string, number>();
    for (const r of rows) {
      const cc = (r.countryCode || "??").toUpperCase();
      if (isDownloadType(r.productType)) {
        downloads += r.units;
        dlByCountry.set(cc, (dlByCountry.get(cc) ?? 0) + r.units);
      }
      const rev = r.proceeds * r.units; // proceeds per unit × units
      revenue += rev;
      revByCountry.set(cc, (revByCountry.get(cc) ?? 0) + rev);
      // Gelir mix'i için sub/iap ayır (app_revenue toplam kalır).
      const cls = classifyRevenue(r.productType);
      if (cls === "sub") subRev += rev;
      else if (cls === "iap") iapRev += rev;
    }
    points.push({ date, metric: "app_downloads", value: downloads });
    points.push({ date, metric: "app_revenue", value: revenue });
    points.push({ date, metric: "subscription_revenue", value: subRev });
    points.push({ date, metric: "iap_revenue", value: iapRev });

    for (const [cc, v] of dlByCountry) {
      if (cc === "??" || v === 0) continue;
      byCountry.push({
        date,
        metric: "app_downloads",
        country_code: cc,
        value: v,
      });
    }
    for (const [cc, v] of revByCountry) {
      if (cc === "??" || v === 0) continue;
      byCountry.push({
        date,
        metric: "app_revenue",
        country_code: cc,
        value: v,
      });
    }
  }
  return { points, byCountry };
};
