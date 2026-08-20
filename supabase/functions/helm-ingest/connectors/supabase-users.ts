import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type Connector, type MetricPoint } from "./types.ts";

// Supabase - hedef projenin auth.users kayıtlarından son 90 günlük
// total_users + new_users serisini created_at'e bakarak yeniden kurar.
//
// track_activity="true" ise ek olarak hedef projenin public.analytics_daily
// rollup tablosundan dau/mau/sessions çekilir (Empire gibi event yazan ürünler).
// Tablo/RPC yoksa bu ek kısım sessizce atlanır - geriye dönük güvenli.
// config: { project_url, service_role_key, track_activity?, activity_refresh_days? }
export const fetchSupabaseUsers: Connector = async (config) => {
  const admin = createClient(config.project_url, config.service_role_key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Tüm kullanıcıların kayıt zamanlarını topla.
  const createdAt: number[] = [];
  const perPage = 1000;
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Supabase users: ${error.message}`);
    }
    for (const u of data.users) {
      createdAt.push(new Date(u.created_at).getTime());
    }
    if (data.users.length < perPage) break;
    page++;
  }

  // Son 90 günü created_at'ten yeniden kur (geçmiş seri).
  const DAY = 86_400_000;
  const points: MetricPoint[] = [];
  for (let i = 0; i < 90; i++) {
    const dayStr = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    const dayStart = new Date(`${dayStr}T00:00:00.000Z`).getTime();
    const dayEnd = new Date(`${dayStr}T23:59:59.999Z`).getTime();

    const total = createdAt.filter((c) => c <= dayEnd).length;
    const newUsers = createdAt.filter(
      (c) => c >= dayStart && c <= dayEnd,
    ).length;

    points.push({ date: dayStr, metric: "total_users", value: total });
    points.push({ date: dayStr, metric: "new_users", value: newUsers });
  }

  // Aktivite metrikleri (dau/mau/sessions) - yalnızca opt-in eden projeler için.
  // Hedef projedeki analytics_daily rollup tablosundan okunur; ham event taranmaz.
  if (config.track_activity === "true") {
    try {
      // Rollup'u tazele (geç gelen event'leri yakala). pg_cron varsa zaten günlük
      // çalışıyor; bu çağrı idempotent ve ucuz (son N gün). O(N*event) ile sınırlı.
      const refreshDays = Number(config.activity_refresh_days) || 7;
      await admin.rpc("refresh_analytics_daily", { p_days: refreshDays });

      const { data: daily, error } = await admin
        .from("analytics_daily")
        .select("date, dau, mau, sessions")
        .order("date", { ascending: false })
        .limit(90);
      if (error) throw new Error(error.message);

      for (const row of daily ?? []) {
        const date = String(row.date).slice(0, 10);
        points.push({ date, metric: "dau", value: Number(row.dau) || 0 });
        points.push({ date, metric: "mau", value: Number(row.mau) || 0 });
        points.push({ date, metric: "sessions", value: Number(row.sessions) || 0 });
      }
    } catch (e) {
      // analytics_daily / refresh_analytics_daily yoksa veya eski şemaysa: atla.
      // total_users/new_users emit'i etkilenmez.
      console.warn(
        `[supabase connector] activity metrics skipped: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    // Funnel-health metrikleri (anlık snapshot) - ayrı try, çünkü funnel
    // migration'ı olmayan projelerde kolonlar yoksa dau/mau emit'i etkilenmesin.
    try {
      await admin.rpc("snapshot_funnel_daily"); // idempotent, sadece bugünü yazar
      const { data: funnel, error } = await admin
        .from("analytics_daily")
        .select(
          "date, players_total, paying_users, pct_le1_business, pct_level1, pct_paused, pct_ever_prestiged",
        )
        .order("date", { ascending: false })
        .limit(90);
      if (error) throw new Error(error.message);

      const FUNNEL_METRICS = [
        "players_total",
        "paying_users",
        "pct_le1_business",
        "pct_level1",
        "pct_paused",
        "pct_ever_prestiged",
      ] as const;

      // Sadece dolu (non-null) alanları emit et - funnel kolonları yalnızca
      // snapshot alınan günlerde dolu olur, boş günleri yanlış 0 olarak basmayız.
      for (const row of funnel ?? []) {
        const date = String(row.date).slice(0, 10);
        for (const m of FUNNEL_METRICS) {
          const v = (row as Record<string, unknown>)[m];
          if (v !== null && v !== undefined) {
            points.push({ date, metric: m, value: Number(v) || 0 });
          }
        }
      }
    } catch (e) {
      console.warn(
        `[supabase connector] funnel metrics skipped: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  return points;
};
