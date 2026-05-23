import { type Connector, type MetricPoint } from "./types.ts";

// Sentry — projenin son 90 gün günlük "received event" sayısını çeker.
// Hata izleme metriği olarak "errors" yazılır.
// config: { org_slug, project_slug, auth_token, host? }

export const fetchSentry: Connector = async (config) => {
  const host = (config.host || "https://sentry.io").replace(/\/+$/, "");
  const until = Math.floor(Date.now() / 1000);
  const since = until - 90 * 86_400;

  const url = `${host}/api/0/projects/${config.org_slug}/${config.project_slug}/stats/?stat=received&resolution=1d&since=${since}&until=${until}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.auth_token}` },
  });
  if (!res.ok) {
    throw new Error(`Sentry ${res.status}: ${await res.text()}`);
  }

  const data: Array<[number, number]> = await res.json();
  return data.map(([ts, count]): MetricPoint => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    metric: "errors",
    value: Number(count ?? 0),
  }));
};
