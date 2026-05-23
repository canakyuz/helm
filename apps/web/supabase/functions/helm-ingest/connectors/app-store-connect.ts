import { type Connector, type MetricPoint } from "./types.ts";

// App Store Connect — Sales Reports (daily summary).
// JWT ES256 ile auth → günlük satış raporu (gzip TSV).
// config: { key_id, issuer_id, private_key, vendor_number, currency? }
//   private_key: .p8 dosyasının tüm içeriği (BEGIN/END satırları dahil).
//   currency: developer proceeds para birimi (Apple raporu varsayılanı, çoğu vendor için USD).

const DAYS_BACK = 7;

const b64url = (data: ArrayBuffer | Uint8Array | string): string => {
  let bytes: Uint8Array;
  if (typeof data === "string") {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else {
    bytes = new Uint8Array(data);
  }
  let str = "";
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const pemToDer = (pem: string): Uint8Array => {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  return der;
};

async function makeJwt(config: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: config.key_id, typ: "JWT" };
  const payload = {
    iss: config.issuer_id,
    iat: now,
    exp: now + 1199, // < 20 min (Apple limit)
    aud: "appstoreconnect-v1",
  };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const der = pemToDer(config.private_key);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(sig)}`;
}

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
}

function parseTsv(tsv: string): ReportRow[] {
  const lines = tsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  const idx = (name: string) => headers.indexOf(name);
  const iType = idx("Product Type Identifier");
  const iUnits = idx("Units");
  const iProc = idx("Developer Proceeds");
  if (iType < 0 || iUnits < 0 || iProc < 0) return [];

  const rows: ReportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    rows.push({
      productType: cols[iType] ?? "",
      units: Number(cols[iUnits] ?? 0),
      proceeds: Number(cols[iProc] ?? 0),
    });
  }
  return rows;
}

// Apple product type identifiers:
//   1, 1F, 1T, 1TP = yeni app install (paid/free/universal)
//   7, 7F          = update (download) — sayma
//   IA1, IA9, IAY  = in-app purchase / sub
//   1A, 1E         = paid app upgrade
//   F1             = free in-app purchase
const isDownloadType = (t: string) =>
  t === "1" || t === "1F" || t === "1T" || t === "1TP";

export const fetchAppStoreConnect: Connector = async (config) => {
  const jwt = await makeJwt(config as Record<string, string>);
  const vendor = String(config.vendor_number);

  const points: MetricPoint[] = [];
  const today = new Date();
  // Apple's DAILY reports T-1 (dünden başla geriye).
  for (let i = 1; i <= DAYS_BACK; i++) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const date = ymd(d);
    const tsv = await fetchDailyReport(jwt, vendor, date);
    if (!tsv) continue;
    const rows = parseTsv(tsv);
    let downloads = 0;
    let revenue = 0;
    for (const r of rows) {
      if (isDownloadType(r.productType)) downloads += r.units;
      revenue += r.proceeds * r.units; // proceeds per unit × units
    }
    points.push({ date, metric: "app_downloads", value: downloads });
    points.push({ date, metric: "app_revenue", value: revenue });
  }
  return points;
};
