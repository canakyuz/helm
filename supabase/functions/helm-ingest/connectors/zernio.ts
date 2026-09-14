import { type Connector, daysAgo, today } from "./types.ts";
import { listAccounts, listAnalyticsPosts, resolveProfileId } from "../../_shared/zernio.ts";
import { aggregateDaily, toAccountRows } from "./zernio-aggregate.ts";

// Zernio - sosyal hesaplar + post analitigi.
// config: { api_key, profile_id? }
// Cikti: metrics (social_*), social_accounts, social_account_daily (extra).
// Son 90 gun her gece yeniden toplanir; kumulatif degerler upsert ile buyur.

const DAYS_BACK = 90;

export const fetchZernio: Connector = async (config) => {
  const apiKey = config.api_key;
  if (!apiKey) throw new Error("Zernio api_key eksik");

  const profileId = await resolveProfileId(apiKey, config.profile_id);
  const accounts = await listAccounts(apiKey, profileId);
  const to = today();
  const posts = await listAnalyticsPosts(apiKey, profileId, daysAgo(DAYS_BACK), to);

  const syncedAt = new Date().toISOString();
  const { points, daily } = aggregateDaily(accounts, posts, to);

  return {
    points,
    extra: [
      // Sira onemli: daily -> accounts FK'si.
      { table: "social_accounts", rows: toAccountRows(accounts, syncedAt), onConflict: "id", withProjectId: true },
      { table: "social_account_daily", rows: daily, onConflict: "account_id,date", withProjectId: false },
    ],
  };
};
