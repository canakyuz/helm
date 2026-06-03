import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-alert — alert_rules'u metrics'e karşı değerlendirir, tetiklenenleri
// alert_events'e yazar ve cockpit'e Expo push gönderir (asıl kanal; helm_push_devices
// token'larına). Telegram bot env'i ayarlıysa paralel ping de atar (opsiyonel).
// helm-ingest her senkron sonrası bunu çağırır; panelden de çağrılabilir.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface AlertRule {
  id: string;
  name: string;
  project_id: string | null;
  metric: string;
  condition: "drop_pct" | "rise_pct" | "below" | "above";
  threshold: number;
}

async function sendTelegram(text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chatId) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

// Cockpit'e Expo push — helm_push_devices'taki kayıtlı token'lara bildirim atar.
// Asıl kanal bu; telefon titrer. Token yoksa (henüz build/izin yok) sessizce false.
async function sendExpoPush(
  hub: ReturnType<typeof createClient>,
  title: string,
  body: string,
): Promise<boolean> {
  const { data: devices } = await hub
    .from("helm_push_devices")
    .select("token");
  const tokens = Array.from(
    new Set(
      (devices ?? [])
        .map((d: { token: string }) => d.token)
        .filter(
          (t: unknown): t is string =>
            typeof t === "string" && t.startsWith("ExponentPushToken["),
        ),
    ),
  );
  if (tokens.length === 0) return false;

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    sound: "default",
    data: { kind: "alert" },
  }));
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Body: { rule_id? } — verilirse sadece o kural değerlendirilir (test için)
  let onlyRuleId: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.rule_id === "string") onlyRuleId = body.rule_id;
  } catch {
    // body yok — tüm kurallar
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let rulesQuery = hub
    .from("alert_rules")
    .select("id, name, project_id, metric, condition, threshold");
  if (onlyRuleId) {
    rulesQuery = rulesQuery.eq("id", onlyRuleId);
  } else {
    rulesQuery = rulesQuery.eq("enabled", true);
  }
  const { data: rules, error } = await rulesQuery;
  if (error) return json({ error: error.message }, 500);

  const dedupeSince = new Date(Date.now() - 20 * 3_600_000).toISOString();
  let triggered = 0;

  for (const rule of (rules ?? []) as AlertRule[]) {
    // Aynı kural 20 saatte bir kez tetiklensin — alarm yorgunluğu önleme.
    const { count } = await hub
      .from("alert_events")
      .select("id", { count: "exact", head: true })
      .eq("rule_id", rule.id)
      .gte("triggered_at", dedupeSince);
    if ((count ?? 0) > 0) continue;

    // İlgili metriğin günlük serisini al (proje filtresi varsa uygula).
    let query = hub
      .from("metrics")
      .select("date, value")
      .eq("metric", rule.metric)
      .order("date", { ascending: true });
    if (rule.project_id) query = query.eq("project_id", rule.project_id);
    const { data: rows } = await query;

    const byDate = new Map<string, number>();
    for (const r of rows ?? []) {
      byDate.set(r.date, (byDate.get(r.date) ?? 0) + Number(r.value));
    }
    const series = [...byDate.entries()].sort((a, b) =>
      a[0] < b[0] ? -1 : 1,
    );
    if (series.length === 0) continue;

    const last = series[series.length - 1][1];
    const prev = series[Math.max(0, series.length - 1 - 7)][1];

    let fire = false;
    let message = "";
    if (rule.condition === "drop_pct" && prev > 0) {
      const pct = ((prev - last) / prev) * 100;
      if (pct >= rule.threshold) {
        fire = true;
        message = `${rule.metric} %${pct.toFixed(0)} düştü (${prev} → ${last})`;
      }
    } else if (rule.condition === "rise_pct" && prev > 0) {
      const pct = ((last - prev) / prev) * 100;
      if (pct >= rule.threshold) {
        fire = true;
        message = `${rule.metric} %${pct.toFixed(0)} arttı (${prev} → ${last})`;
      }
    } else if (rule.condition === "below" && last < rule.threshold) {
      fire = true;
      message = `${rule.metric} eşiğin altında: ${last} < ${rule.threshold}`;
    } else if (rule.condition === "above" && last > rule.threshold) {
      fire = true;
      message = `${rule.metric} eşiğin üstünde: ${last} > ${rule.threshold}`;
    }

    if (!fire) continue;

    // Asıl kanal: cockpit'e Expo push. Telegram env ayarlıysa o da paralel gider.
    const pushed = await sendExpoPush(hub, rule.name, message);
    const tg = await sendTelegram(`🔔 ${rule.name}\n${message}`);
    const delivered = pushed || tg;
    await hub.from("alert_events").insert({
      rule_id: rule.id,
      metric: rule.metric,
      current_value: last,
      reference_value: prev,
      message,
      delivered,
    });
    triggered++;
  }

  return json({ evaluated: rules?.length ?? 0, triggered });
});
