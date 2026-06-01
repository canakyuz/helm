import { type Connector, type MetricPoint, today } from "./types.ts";

// Stripe — aktif abonelikleri çeker, MRR hesaplar (web/SaaS aboneliği).
// config: { secret_key }

const monthlyAmount = (
  amount: number,
  interval: string | undefined,
  intervalCount: number,
): number => {
  const n = intervalCount || 1;
  if (interval === "year") return amount / (12 * n);
  if (interval === "week") return (amount * 52) / 12 / n;
  if (interval === "day") return (amount * 365) / 12 / n;
  return amount / n; // month
};

export const fetchStripe: Connector = async (config) => {
  let mrrCents = 0;
  let count = 0;
  let startingAfter: string | undefined;

  do {
    const params = new URLSearchParams({ status: "active", limit: "100" });
    if (startingAfter) params.set("starting_after", startingAfter);

    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions?${params}`,
      { headers: { Authorization: `Bearer ${config.secret_key}` } },
    );
    if (!res.ok) {
      throw new Error(`Stripe ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    const subs: Array<Record<string, any>> = json.data ?? [];

    for (const sub of subs) {
      count++;
      for (const item of sub.items?.data ?? []) {
        const price = item.price;
        const amount = (price?.unit_amount ?? 0) * (item.quantity ?? 1);
        mrrCents += monthlyAmount(
          amount,
          price?.recurring?.interval,
          price?.recurring?.interval_count ?? 1,
        );
      }
    }

    startingAfter = json.has_more
      ? subs[subs.length - 1]?.id
      : undefined;
  } while (startingAfter);

  const date = today();
  return [
    { date, metric: "mrr", value: mrrCents / 100 },
    { date, metric: "active_subs", value: count },
  ] satisfies MetricPoint[];
};
