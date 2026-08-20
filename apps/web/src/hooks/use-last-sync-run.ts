import { useMemo } from "react";
import { useList } from "@refinedev/core";

import type { SyncRun } from "@/types";

/**
 * How long after the last run starts we call the data stale.
 *
 * The ingest cron fires hourly, so 90 minutes means one missed run raises the
 * flag. The previous value was three hours, duplicated as a magic number in two
 * files - two consecutive misses could pass as healthy.
 */
const STALE_AFTER_MS = 90 * 60_000;

/**
 * A run that started but never finished is not fresh, it is stuck.
 *
 * An ingest takes ~90 seconds; anything still open after 15 minutes died
 * mid-flight. Reading `started_at` alone made a dead run look brand new.
 */
const RUNNING_GRACE_MS = 15 * 60_000;

export type SyncHealth = "ok" | "running" | "stuck" | "stale" | "never" | "failing";

export type LastSyncRun = {
  run: SyncRun | undefined;
  health: SyncHealth;
  /** True for anything the operator should look at. */
  needsAttention: boolean;
  isLoading: boolean;
};

/**
 * The most recent ingest run and what it means.
 *
 * Both call sites previously ran `useList` with `pagination: { mode: "off" }`
 * and then read `data[0]` - downloading every row of a table that grows by a
 * row an hour, forever, to render one line. This asks for one row.
 */
export function useLastSyncRun(): LastSyncRun {
  const { result, query } = useList<SyncRun>({
    resource: "sync_runs",
    sorters: [{ field: "started_at", order: "desc" }],
    pagination: { currentPage: 1, pageSize: 1 },
  });

  const run = result.data[0];

  const health = useMemo<SyncHealth>(() => {
    if (!run?.started_at) return "never";
    const startedAgo = Date.now() - new Date(run.started_at).getTime();

    if (run.finished_at == null) {
      return startedAgo > RUNNING_GRACE_MS ? "stuck" : "running";
    }
    if (startedAgo > STALE_AFTER_MS) return "stale";
    if (run.error_count > 0) return "failing";
    return "ok";
  }, [run]);

  return {
    run,
    health,
    needsAttention: health !== "ok" && health !== "running",
    isLoading: query.isLoading,
  };
}

/** What the operator should read when a run is not healthy. */
export const SYNC_HEALTH_MESSAGE: Record<SyncHealth, string> = {
  ok: "",
  running: "",
  stuck: "A run started but never finished - the ingest died mid-flight.",
  stale: "No sync in over 90 minutes; the hourly cron may not be firing.",
  never: "No sync has ever run. Check the Vault secrets and cron.job.",
  failing: "The last run finished with errors - open the run detail.",
};

/** Short badge text for the settings page. */
export const SYNC_HEALTH_LABEL: Record<SyncHealth, string> = {
  ok: "hourly cron is running",
  running: "a run is in flight",
  stuck: "a run is stuck",
  stale: "no sync in over 90 minutes",
  never: "no sync has ever run",
  failing: "last run had errors",
};
