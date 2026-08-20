import { type Connector, type MetricPoint, today } from "./types.ts";

// REST - kullanıcının kendi endpoint'inden metrik çeker. Endpoint helm
// sözleşmesine uymalı: JSON gövdesi ya doğrudan bir dizi
//   [{ "date": "2026-05-19", "metric": "signups", "value": 42 }]
// ya da { "metrics": [ ... ] } biçiminde olmalı. date verilmezse bugün alınır.
// config: { url, auth_header? }
//
// SSRF guard:
//   - sadece https:// (http:// yasak - clear-text + private hedef riski)
//   - localhost / 127.x / 0.0.0.0 / 169.254.x (AWS metadata) / RFC1918 yasak
//   - IPv6 ::1 / fe80::/10 yasak
//   - Hostname IP literal değilse DNS rebinding riski mevcut; ek defans için
//     timeout + redirect-manual (otomatik follow yok).

const PRIVATE_IPV4_PATTERNS: Array<(o: number[]) => boolean> = [
  (o) => o[0] === 0,                                     // 0.0.0.0/8
  (o) => o[0] === 10,                                    // 10/8
  (o) => o[0] === 127,                                   // 127/8 (loopback)
  (o) => o[0] === 169 && o[1] === 254,                   // 169.254/16 (metadata)
  (o) => o[0] === 172 && o[1] >= 16 && o[1] <= 31,       // 172.16/12
  (o) => o[0] === 192 && o[1] === 168,                   // 192.168/16
  (o) => o[0] === 224 && o[1] >= 0,                      // 224/4 (multicast)
];

const isPrivateIPv4 = (host: string): boolean => {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => Number(p));
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  return PRIVATE_IPV4_PATTERNS.some((fn) => fn(octets));
};

const isPrivateIPv6 = (host: string): boolean => {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::1") return true;            // loopback
  if (h.startsWith("fe80:")) return true;  // link-local
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // ULA fc00::/7
  return false;
};

const BLOCKED_HOSTS = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata",
]);

const assertSafeUrl = (raw: string): URL => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("Sadece https:// URL kabul edilir (SSRF guard)");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    throw new Error(`Hedef host yasak: ${host}`);
  }
  if (isPrivateIPv4(host)) {
    throw new Error(`Private IPv4 is not allowed: ${host}`);
  }
  if (host.includes(":") && isPrivateIPv6(host)) {
    throw new Error(`Private IPv6 is not allowed: ${host}`);
  }
  return url;
};

export const fetchRest: Connector = async (config) => {
  const safeUrl = assertSafeUrl(String(config.url ?? ""));

  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.auth_header) {
    headers.Authorization = config.auth_header;
  }

  // 10 sn timeout - sınırsız bekleme yok
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(safeUrl, {
      headers,
      signal: controller.signal,
      // Redirect target SSRF kaçırmasın diye manuel
      redirect: "manual",
    });
  } finally {
    clearTimeout(timer);
  }
  // 3xx → manuel redirect; takip yapmayız
  if (res.status >= 300 && res.status < 400) {
    throw new Error(
      `REST must not redirect (${res.status} → ${res.headers.get("location") ?? "?"}). Endpoint son URL'i vermeli.`,
    );
  }
  if (!res.ok) {
    throw new Error(`REST ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const arr: unknown = Array.isArray(json) ? json : json?.metrics;
  if (!Array.isArray(arr)) {
    throw new Error(
      "Expected shape: [{date,metric,value}] or {metrics:[...]}",
    );
  }

  const fallbackDate = today();
  const points: MetricPoint[] = [];
  for (const item of arr as Array<Record<string, unknown>>) {
    if (!item || typeof item.metric !== "string") continue;
    const date = String(item.date ?? "").slice(0, 10) || fallbackDate;
    points.push({
      date,
      metric: item.metric,
      value: Number(item.value ?? 0),
    });
  }
  return points;
};
