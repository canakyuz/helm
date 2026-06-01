import { type Connector, type MetricPoint } from "./types.ts";

// Sentry — iki metrik:
//   1) "errors": son 90 gün günlük "received event" sayısı (stats endpoint).
//   2) "crash_free_sessions": son 90 gün günlük crash-free session oranı (0–100),
//      Sessions/Release-Health endpoint'inden. Indie founder için en kritik sağlık
//      sinyali. Projede release-health (session) verisi yoksa veya token scope yetmezse
//      sessizce atlanır — "errors" akışını bozmaz (graceful degradation).
// config: { org_slug, project_slug, auth_token, host? }

const SESSION_FIELD = "crash_free_rate(session)";

/**
 * Crash-free session oranını günlük seri olarak çeker.
 * Org-level sessions endpoint numerik project_id ister (slug kabul etmez), bu yüzden
 * önce slug → numerik id çözülür. Herhangi bir hata → boş dizi (errors korunur).
 *
 * Time: O(d) (d = gün sayısı ~90). Space: O(d). HTTP: 2 çağrı.
 */
async function fetchCrashFree(
  host: string,
  config: Record<string, string>,
): Promise<MetricPoint[]> {
  const auth = { Authorization: `Bearer ${config.auth_token}` };

  // 1) slug → numerik project id
  const projRes = await fetch(
    `${host}/api/0/projects/${config.org_slug}/${config.project_slug}/`,
    { headers: auth },
  );
  if (!projRes.ok) {
    throw new Error(`Sentry project ${projRes.status}: ${await projRes.text()}`);
  }
  const projectId = String((await projRes.json())?.id ?? "");
  if (!projectId) throw new Error("Sentry project id çözülemedi");

  // 2) günlük crash-free session oranı
  const qs = new URLSearchParams({
    field: SESSION_FIELD,
    interval: "1d",
    statsPeriod: "90d",
    project: projectId,
  });
  const sessRes = await fetch(
    `${host}/api/0/organizations/${config.org_slug}/sessions/?${qs}`,
    { headers: auth },
  );
  if (!sessRes.ok) {
    throw new Error(`Sentry sessions ${sessRes.status}: ${await sessRes.text()}`);
  }

  const data = (await sessRes.json()) as {
    intervals?: string[];
    groups?: Array<{ series?: Record<string, Array<number | null>> }>;
  };
  const intervals = data.intervals ?? [];
  const series = data.groups?.[0]?.series?.[SESSION_FIELD] ?? [];

  const points: MetricPoint[] = [];
  for (let i = 0; i < intervals.length; i++) {
    const rate = series[i];
    // null = o gün session yok → "%0 crash-free" demek değil, yazma.
    if (rate == null) continue;
    points.push({
      date: intervals[i].slice(0, 10),
      metric: "crash_free_sessions",
      value: Math.round(rate * 10_000) / 100, // 0..1 → 0..100, 2 ondalık
    });
  }
  return points;
}

export const fetchSentry: Connector = async (config) => {
  const host = (config.host || "https://sentry.io").replace(/\/+$/, "");
  const until = Math.floor(Date.now() / 1000);
  const since = until - 90 * 86_400;

  // errors — ana metrik (her zaman çekilir)
  const url = `${host}/api/0/projects/${config.org_slug}/${config.project_slug}/stats/?stat=received&resolution=1d&since=${since}&until=${until}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.auth_token}` },
  });
  if (!res.ok) {
    throw new Error(`Sentry ${res.status}: ${await res.text()}`);
  }
  const data: Array<[number, number]> = await res.json();
  const points: MetricPoint[] = data.map(([ts, count]): MetricPoint => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    metric: "errors",
    value: Number(count ?? 0),
  }));

  // crash_free_sessions — opsiyonel, hata errors'ı bloklamaz
  try {
    points.push(...(await fetchCrashFree(host, config)));
  } catch {
    // release-health yoksa / scope yetmezse sessizce atla
  }

  return points;
};
