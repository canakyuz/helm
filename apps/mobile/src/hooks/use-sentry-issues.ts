import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import { usePreferences, type SelectedPropertyId } from "~/lib/preferences";

export type SentryLevel = "fatal" | "error" | "warning" | "info" | "debug";
export type SentryStatus = "unresolved" | "resolved" | "ignored";

export type SentryIssue = {
  id: string;
  propertyId: string;
  propertyName: string | null;
  shortId: string;
  title: string;
  culprit: string | null;
  level: SentryLevel;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
  status: SentryStatus;
  type: string | null;
  value: string | null;
};

type EdgeIssue = {
  id: string;
  short_id: string;
  title: string;
  culprit: string | null;
  level: string;
  count: number;
  user_count: number;
  first_seen: string;
  last_seen: string;
  permalink: string;
  status: string;
  type: string | null;
  value: string | null;
};

type EdgeResp = {
  projects?: Array<{
    project_id: string;
    ok: boolean;
    issues?: EdgeIssue[];
    error?: string;
  }>;
  error?: string;
};

function normLevel(s: string): SentryLevel {
  if (s === "fatal" || s === "warning" || s === "info" || s === "debug")
    return s;
  return "error";
}

function normStatus(s: string): SentryStatus {
  if (s === "resolved" || s === "ignored") return s;
  return "unresolved";
}

async function fetchPropertyMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, name");
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ id: string; name: string }>) {
    map.set(row.id, row.name);
  }
  return map;
}

async function fetchIssues(
  propertyId: SelectedPropertyId,
): Promise<SentryIssue[]> {
  const [edge, propMap] = await Promise.all([
    supabase.functions.invoke<EdgeResp>("helm-sentry-issues", {
      body: propertyId === "all" ? {} : { project_id: propertyId },
    }),
    fetchPropertyMap(),
  ]);

  if (edge.error) return [];
  const projects = edge.data?.projects ?? [];

  const out: SentryIssue[] = [];
  for (const proj of projects) {
    if (!proj.ok || !proj.issues) continue;
    const propertyName = propMap.get(proj.project_id) ?? null;
    for (const i of proj.issues) {
      out.push({
        id: i.id,
        propertyId: proj.project_id,
        propertyName,
        shortId: i.short_id,
        title: i.title,
        culprit: i.culprit,
        level: normLevel(i.level),
        count: i.count,
        userCount: i.user_count,
        firstSeen: i.first_seen,
        lastSeen: i.last_seen,
        permalink: i.permalink,
        status: normStatus(i.status),
        type: i.type,
        value: i.value,
      });
    }
  }
  return out;
}

export function useSentryIssues() {
  const { selectedPropertyId } = usePreferences();
  return useQuery({
    queryKey: ["sentry-issues", selectedPropertyId],
    queryFn: () => fetchIssues(selectedPropertyId),
    staleTime: 2 * 60_000,
  });
}
