import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type Connector, type MetricPoint } from "./types.ts";

// Supabase — hedef projenin auth.users kayıtlarından son 90 günlük
// total_users + new_users serisini created_at'e bakarak yeniden kurar.
// config: { project_url, service_role_key }
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
  return points;
};
