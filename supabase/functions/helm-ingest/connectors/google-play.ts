import {
  type Connector,
  type ConnectorConfig,
  type CountryMetricPoint,
  type MetricPoint,
} from "./types.ts";

// Google Play - Earnings (finansal) raporu.
//
// NEDEN CLOUD STORAGE, NEDEN PLAY API DEGIL: androidpublisher (Play Developer
// API) ve playdeveloperreporting API'lerinin HICBIRINDE kazanc uc noktasi yok -
// birincisi surum/yorum/abonelik yonetimi, ikincisi crash/ANR/vitals verir.
// Play Console'un "Download reports > Financial" ekrani raporlari Google'in
// yonettigi bir Cloud Storage kovasina yazar (gs://pubsite_prod_rev_<dev_id>/)
// ve ORADAN okunur. Bu yuzden tek gercek kaynak: earnings/ klasorundeki AYLIK
// ZIP/CSV dosyalari.
//
// config:
//   service_account_json  Play Console'a bagli service account anahtari (JSON).
//   earnings_bucket       Play Console > Download reports > Financial ekranindaki
//                         Cloud Storage URI. "gs://pubsite_prod_rev_0123..." ya da
//                         cıplak kova adi kabul edilir. TAHMIN EDILMEZ: kova adi
//                         hesaba ozel bir sayidir, uydurmak 404 uretir.
//   package_name?         Yalnizca bu paketin satirlari sayilir. BOS BIRAKILIRSA
//                         gelistirici hesabindaki TUM uygulamalar toplanip tek
//                         projeye yazilir (ASC vendor raporundaki tuzagin aynisi).
//   currency?             Merchant (odeme) para birimi. index.ts bu alani
//                         metrics.currency olarak yazar; raporun para birimiyle
//                         uyusmazsa asagida hata firlatilir - yanlis etiketli
//                         gelir yazmaktansa senkronu durdurmak dogrusu.
//
// GECIKME NOTU: earnings raporu AYLIK ve ay kapandiktan sonra (~ayin 5'i)
// olusur. Yani "bugun"un Android geliri buradan gelmez; App Store'un T-1 gunluk
// raporuyla ayni tazelikte DEGIL. Kesinlesmis (payout) rakam istendigi icin
// bilincli tercih: tahmini sales raporu brut ve alici para biriminde, ASC'nin
// "Developer Proceeds" kolonuyla karsilastirilamaz.

/** Kac aylik earnings dosyasi taranir. Ay sonu gecikmesi + duzeltmeleri kapsar. */
const MONTHS_BACK = 3;

/** Storage okumasi androidpublisher DEGIL, bu scope'u ister. */
const STORAGE_SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

// NEDEN _shared/play-oauth.ts YENIDEN KULLANILMIYOR: oradaki helper scope'u
// "androidpublisher" olarak SABIT yaziyor ve token cache anahtari yalnizca
// client_email - farkli scope'lu iki token birbirinin uzerine yazardi. Storage
// icin farkli scope sart oldugundan, ayni JWT kurgusu burada scope-farkindalikli
// cache ile tekrarlaniyor. Helper'i parametrik yapmak _shared'i ve onu paylasan
// helm-reviews/helm-versions/helm-review-reply/helm-test dosyalarini riske
// atardi; bu degisiklik setinin disinda.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

const b64url = (s: string) =>
  btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlBytes = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** PEM (pkcs8) → CryptoKey. RS256 imzalama icin. */
async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  const cleaned = privateKeyPem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  return await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Service account → istenen scope icin OAuth access token (JWT-bearer akisi). */
async function mintAccessToken(
  serviceAccountJson: string,
  scope: string,
): Promise<string> {
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(serviceAccountJson) as ServiceAccount;
  } catch {
    throw new Error(
      "GooglePlay: service_account_json gecerli JSON degil - Google Cloud'dan indirilen anahtar dosyasinin TAMAMI yapistirilmali.",
    );
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error(
      "GooglePlay: service_account_json icinde client_email/private_key yok.",
    );
  }

  const cacheKey = `${sa.client_email}|${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const signingInput =
    b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    b64url(
      JSON.stringify({
        iss: sa.client_email,
        scope,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    );

  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64urlBytes(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`GooglePlay OAuth ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

/** "gs://bucket/olabilir/yol" veya "bucket" → "bucket". */
function normalizeBucket(raw: string): string {
  const trimmed = raw.trim().replace(/^gs:\/\//i, "");
  const bucket = trimmed.split("/")[0].trim();
  if (bucket.length === 0) {
    throw new Error(
      "GooglePlay: earnings_bucket bos - Play Console > Download reports > Financial ekranindaki Cloud Storage URI gerekli.",
    );
  }
  return bucket;
}

/** Son N ayin "YYYYMM" etiketleri (bu ay dahil, UTC). */
function recentMonths(count: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  return out;
}

/**
 * earnings/ altindaki nesne adlarini listeler (sayfali).
 *
 * NEDEN DOSYA ADI TAHMIN EDILMIYOR: earnings dosya adi hesaba/donemlere gore
 * degisiyor (PlayApps_YYYYMM_*, earnings_YYYYMM_* gibi). Listeleyip AY ETIKETINE
 * gore suzmek, kalibi sabitlemekten dayanikli.
 * Time: O(nesne sayisi), Space: O(nesne sayisi)
 */
async function listEarningsObjects(
  bucket: string,
  token: string,
): Promise<string[]> {
  const names: string[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`,
    );
    url.searchParams.set("prefix", "earnings/");
    url.searchParams.set("maxResults", "1000");
    url.searchParams.set("fields", "items(name),nextPageToken");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 403) {
      throw new Error(
        `GooglePlay Storage 403 - kovaya erisim yok. Service account'a Play Console > Users and permissions'ta "View financial data" yetkisi verilmeli ve anahtar ${STORAGE_SCOPE} scope'unu kullanabilmeli. Google: ${await res.text()}`,
      );
    }
    if (res.status === 404) {
      throw new Error(
        `GooglePlay Storage 404 - "${bucket}" kovasi bulunamadi. Play Console > Download reports > Financial ekranindaki Cloud Storage URI birebir kopyalanmali.`,
      );
    }
    if (!res.ok) {
      throw new Error(`GooglePlay Storage ${res.status}: ${await res.text()}`);
    }
    const page = (await res.json()) as {
      items?: Array<{ name?: string }>;
      nextPageToken?: string;
    };
    for (const item of page.items ?? []) {
      if (item.name) names.push(item.name);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  return names;
}

async function downloadObject(
  bucket: string,
  name: string,
  token: string,
): Promise<Uint8Array> {
  const url =
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}` +
    `/o/${encodeURIComponent(name)}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(
      `GooglePlay Storage indirme ${res.status} (${name}): ${await res.text()}`,
    );
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Ham deflate akisini cozer.
 *
 * NEDEN AYRI ARABELLEK: `data` arsivin tamamina bakan bir subarray ve tasiyicisi
 * ArrayBufferLike (paylasimli olabilir). DecompressionStream paylasilmayan bir
 * arabellek ister; tek seferlik kopya sikistirilmis parca boyutunda, cozulmus
 * CSV'nin yaninda ihmal edilebilir.
 */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const chunk = new Uint8Array(new ArrayBuffer(data.byteLength));
  chunk.set(data);
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(chunk);
      controller.close();
    },
  });
  const stream = source.pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * ZIP arsivindeki .csv girdilerini metin olarak cikarir.
 *
 * NEDEN ELDE ZIP OKUYUCU: Edge Function'da harici bagimlilik istemiyoruz ve
 * DecompressionStream yalnizca ham deflate akisi cozer - ZIP kapsayicisini
 * (central directory + local header) kendimiz gezmemiz gerekiyor.
 * Time: O(arsiv boyutu), Space: O(cikarilan csv boyutu)
 */
async function unzipCsvEntries(bytes: Uint8Array): Promise<string[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = bytes.byteLength;

  // End of Central Directory: sondan geriye tara (yorum alani en fazla 64KB).
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  const minScan = Math.max(0, len - 65_557);
  for (let i = len - 22; i >= minScan; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("GooglePlay: ZIP bozuk - EOCD kaydi yok.");

  const entryCount = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);

  const decoder = new TextDecoder("utf-8");
  const out: string[] = [];

  for (let n = 0; n < entryCount; n++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("GooglePlay: ZIP bozuk - central directory kaydi hatali.");
    }
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen));
    cursor += 46 + nameLen + extraLen + commentLen;

    if (!name.toLowerCase().endsWith(".csv")) continue;
    // ZIP64 (4GB ustu / 65k+ girdi) beklenmiyor; sessizce yanlis okumaktansa dur.
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error(`GooglePlay: ZIP64 arsiv desteklenmiyor (${name}).`);
    }

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`GooglePlay: ZIP bozuk - local header hatali (${name}).`);
    }
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);

    if (method === 0) out.push(decoder.decode(raw));
    else if (method === 8) out.push(decoder.decode(await inflateRaw(raw)));
    else {
      throw new Error(
        `GooglePlay: ZIP sikistirma yontemi ${method} desteklenmiyor (${name}).`,
      );
    }
  }
  return out;
}

/**
 * RFC 4180 CSV ayristirici - earnings raporunda urun basliklari virgul ve tirnak
 * icerebiliyor, split(",") yeterli degil.
 * Time: O(karakter sayisi), Space: O(hucre sayisi)
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else inQuotes = false;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch !== "\r") field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Basliklari normalize edip aday isimlerden ilk eslesenin indeksini doner. */
function headerIndex(headers: string[], candidates: string[]): number {
  // BOM (﻿) ilk basligin onune yapisir - temizlenmezse "Description"
  // kolonu hic eslesmez.
  const norm = (s: string) =>
    s.replace(/^﻿/, "").trim().toLowerCase().replace(/\s+/g, " ");
  const normalized = headers.map(norm);
  for (const c of candidates) {
    const i = normalized.indexOf(norm(c));
    if (i >= 0) return i;
  }
  return -1;
}

const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Earnings raporunun "Transaction Date" hucresini YYYY-MM-DD'ye cevirir.
 * Rapor uretim yerine gore "2025-08-01", "Aug 1, 2025" veya "8/1/2025" gorulur;
 * slash formati ABD duzeni (ay/gun) - Google raporlari boyle yaziyor.
 * Cozulemeyen tarihte HATA verilir: satiri sessizce atmak eksik gelir demektir.
 */
function parseReportDate(raw: string): string {
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const named = /^([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if (named) {
    const month = MONTH_ABBR[named[1].toLowerCase()];
    if (month) {
      return `${named[3]}-${String(month).padStart(2, "0")}-${named[2].padStart(2, "0")}`;
    }
  }

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  }

  throw new Error(
    `GooglePlay: earnings raporundaki tarih cozulemedi ("${s}"). Beklenen: YYYY-MM-DD, "Aug 1, 2025" veya 8/1/2025.`,
  );
}

/**
 * Product Type → gelir sinifi. ASC connector'undaki classifyRevenue ile ayni
 * mantik: "other" toplama girer ama mix'te ayri gosterilmez.
 */
type RevClass = "sub" | "iap" | "other";
function classifyProductType(productType: string): RevClass {
  const t = productType.trim().toLowerCase();
  if (t.includes("subscription")) return "sub";
  if (t.includes("inapp") || t.includes("in-app") || t.includes("in app")) {
    return "iap";
  }
  return "other";
}

interface DayTotals {
  total: number;
  sub: number;
  iap: number;
}

const zeroDay = (): DayTotals => ({ total: 0, sub: 0, iap: 0 });

interface AggregateState {
  daily: Map<string, DayTotals>;
  /** anahtar: "YYYY-MM-DD|CC" */
  byCountry: Map<string, number>;
  currencies: Set<string>;
  matchedRows: number;
}

/**
 * Tek bir earnings CSV'sini toplamlara ekler.
 *
 * NEDEN TUM SATIRLAR TOPLANIYOR: rapor bir islemi birden fazla satira boler -
 * "Charge" pozitif, "Google fee" ve "Tax" negatif. Hepsinin toplami net
 * developer proceeds'tir, yani ASC'nin "Developer Proceeds" kolonunun karsiligi.
 * Yalnizca Charge satirlarini almak geliri %30 fazla gosterirdi.
 *
 * Time: O(satir), Space: O(gun x ulke)
 */
function accumulateCsv(
  csv: string,
  packageFilter: string | null,
  state: AggregateState,
): void {
  const rows = parseCsv(csv);
  if (rows.length < 2) return;

  const headers = rows[0];
  const iDate = headerIndex(headers, ["Transaction Date", "Date"]);
  const iAmount = headerIndex(headers, [
    "Amount (Merchant Currency)",
    "Amount (Merchant currency)",
  ]);
  const iCurrency = headerIndex(headers, ["Merchant Currency"]);
  const iProductType = headerIndex(headers, ["Product Type"]);
  const iCountry = headerIndex(headers, ["Buyer Country", "Country of Buyer"]);
  const iProductId = headerIndex(headers, ["Product id", "Product ID"]);

  if (iDate < 0 || iAmount < 0 || iCurrency < 0) {
    throw new Error(
      `GooglePlay: earnings CSV beklenen kolonlari tasimiyor (Transaction Date / Amount (Merchant Currency) / Merchant Currency). Bulunanlar: ${headers.join(", ")}`,
    );
  }
  if (packageFilter && iProductId < 0) {
    throw new Error(
      `GooglePlay: earnings CSV'de "Product id" kolonu yok; package_name="${packageFilter}" ile ayristirma yapilamaz. Filtresiz devam etmek hesaptaki tum uygulamalari bu projeye yazardi.`,
    );
  }

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const dateCell = (cols[iDate] ?? "").trim();
    if (dateCell.length === 0) continue; // rapor sonundaki bos/ozet satiri

    // package_name verilmisse yalnizca o paketin satirlari. Product id bos olan
    // satirlar (hesap seviyesi duzeltmeler) bir uygulamaya atfedilemez; filtre
    // aktifken bunlari almak baska uygulamalarin duzeltmesini bu projeye
    // yazmak olurdu.
    if (packageFilter && (cols[iProductId] ?? "").trim() !== packageFilter) {
      continue;
    }

    const amountCell = (cols[iAmount] ?? "").trim();
    const amount = Number(amountCell);
    if (!Number.isFinite(amount)) {
      throw new Error(
        `GooglePlay: earnings raporunda sayisal olmayan tutar ("${amountCell}", satir ${r + 1}).`,
      );
    }

    const currency = (cols[iCurrency] ?? "").trim().toUpperCase();
    if (currency.length > 0) state.currencies.add(currency);

    const date = parseReportDate(dateCell);
    const day = state.daily.get(date) ?? zeroDay();
    day.total += amount;
    const cls = iProductType >= 0
      ? classifyProductType(cols[iProductType] ?? "")
      : "other";
    if (cls === "sub") day.sub += amount;
    else if (cls === "iap") day.iap += amount;
    state.daily.set(date, day);

    const cc = iCountry >= 0 ? (cols[iCountry] ?? "").trim().toUpperCase() : "";
    if (cc.length === 2) {
      const key = `${date}|${cc}`;
      state.byCountry.set(key, (state.byCountry.get(key) ?? 0) + amount);
    }

    state.matchedRows++;
  }
}

/**
 * Rapor para birimi ile entegrasyonun currency alanini karsilastirir.
 * index.ts metrics.currency'yi config.currency'den (yoksa USD) yazar; uyusmazsa
 * TRY tutari USD etiketiyle kaydedilir ve panel yanlis rakam gosterir.
 */
function assertCurrencyMatches(
  reportCurrencies: Set<string>,
  configured: string | undefined,
): void {
  if (reportCurrencies.size === 0) return;
  if (reportCurrencies.size > 1) {
    throw new Error(
      `GooglePlay: earnings raporunda birden fazla merchant para birimi var (${[...reportCurrencies].join(", ")}); tek bir metrics.currency ile temsil edilemez.`,
    );
  }
  const reported = [...reportCurrencies][0];
  const expected = (configured ?? "USD").trim().toUpperCase();
  if (reported !== expected) {
    throw new Error(
      `GooglePlay: rapor "${reported}" cinsinden ama entegrasyonun currency alani "${expected}". Entegrasyon ayarindaki para birimini "${reported}" yap - aksi halde tutarlar yanlis para birimiyle kaydedilir.`,
    );
  }
}

function readConfig(config: ConnectorConfig) {
  const serviceAccountJson = (config.service_account_json ?? "").trim();
  if (serviceAccountJson.length === 0) {
    throw new Error(
      "GooglePlay: service_account_json eksik - entegrasyon ayarlarindan Google service account JSON'i girilmeli.",
    );
  }
  const bucketRaw = (config.earnings_bucket ?? "").trim();
  if (bucketRaw.length === 0) {
    throw new Error(
      "GooglePlay: earnings_bucket eksik - gelir raporu Play Console > Download reports > Financial ekranindaki Cloud Storage kovasindan okunur (ornek: gs://pubsite_prod_rev_0123456789012345678). Play Developer API kazanc verisi vermez.",
    );
  }
  const packageName = (config.package_name ?? "").trim();
  return {
    serviceAccountJson,
    bucket: normalizeBucket(bucketRaw),
    packageFilter: packageName.length > 0 ? packageName : null,
    currency: config.currency,
  };
}

export const fetchGooglePlay: Connector = async (config) => {
  const { serviceAccountJson, bucket, packageFilter, currency } =
    readConfig(config);

  const token = await mintAccessToken(serviceAccountJson, STORAGE_SCOPE);
  const objects = await listEarningsObjects(bucket, token);

  // Tek listeleme, tek gecis: hedef aylarin herhangi birinin etiketini tasiyan
  // earnings dosyalari. Time: O(nesne x ay) - ay sayisi 3, pratikte lineer.
  const months = recentMonths(MONTHS_BACK);
  const targets = objects.filter((name) => {
    const lower = name.toLowerCase();
    if (!lower.endsWith(".zip") && !lower.endsWith(".csv")) return false;
    return months.some((m) => name.includes(m));
  });

  if (targets.length === 0) {
    throw new Error(
      `GooglePlay: "${bucket}" kovasinin earnings/ klasorunde son ${MONTHS_BACK} aya (${months.join(", ")}) ait rapor bulunamadi. Earnings raporu ay kapandiktan sonra (~ayin 5'i) olusur; hesap yeniyse henuz rapor yok olabilir.`,
    );
  }

  const state: AggregateState = {
    daily: new Map(),
    byCountry: new Map(),
    currencies: new Set(),
    matchedRows: 0,
  };

  // Dosyalar SIRAYLA indirilir: ayni Storage kovasina es zamanli vurmak kota
  // riski, kazanc da yok - en fazla 3-4 dosya var.
  for (const name of targets) {
    const bytes = await downloadObject(bucket, name, token);
    const csvs = name.toLowerCase().endsWith(".zip")
      ? await unzipCsvEntries(bytes)
      : [new TextDecoder("utf-8").decode(bytes)];
    for (const csv of csvs) accumulateCsv(csv, packageFilter, state);
  }

  // package_name verilmisken hicbir satir eslesmediyse sessiz bos donmek yerine
  // hata: aksi halde index.ts "ok" yazar ve gelir sessizce sifir gorunur (tipik
  // sebep: yanlis paket adi). Filtre yokken bos rapor mesru olabilir.
  if (packageFilter && state.matchedRows === 0) {
    throw new Error(
      `GooglePlay: package_name="${packageFilter}" earnings raporundaki hicbir satirla eslesmedi - Play paket adi (ornek: com.example.app) bekleniyor.`,
    );
  }

  assertCurrencyMatches(state.currencies, currency);

  const points: MetricPoint[] = [];
  for (const [date, day] of state.daily) {
    points.push({ date, metric: "app_revenue", value: day.total });
    points.push({ date, metric: "subscription_revenue", value: day.sub });
    points.push({ date, metric: "iap_revenue", value: day.iap });
  }

  const byCountry: CountryMetricPoint[] = [];
  for (const [key, value] of state.byCountry) {
    if (value === 0) continue;
    const sep = key.indexOf("|");
    byCountry.push({
      date: key.slice(0, sep),
      metric: "app_revenue",
      country_code: key.slice(sep + 1),
      value,
    });
  }

  return { points, byCountry };
};
