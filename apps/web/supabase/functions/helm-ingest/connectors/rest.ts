import { type Connector, type MetricPoint, today } from "./types.ts";

// REST — kullanıcının kendi endpoint'inden metrik çeker. Endpoint helm
// sözleşmesine uymalı: JSON gövdesi ya doğrudan bir dizi
//   [{ "date": "2026-05-19", "metric": "signups", "value": 42 }]
// ya da { "metrics": [ ... ] } biçiminde olmalı. date verilmezse bugün alınır.
// config: { url, auth_header? }

export const fetchRest: Connector = async (config) => {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.auth_header) {
    headers.Authorization = config.auth_header;
  }

  const res = await fetch(config.url, { headers });
  if (!res.ok) {
    throw new Error(`REST ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const arr: unknown = Array.isArray(json) ? json : json?.metrics;
  if (!Array.isArray(arr)) {
    throw new Error(
      "Beklenen biçim: [{date,metric,value}] ya da {metrics:[...]}",
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
