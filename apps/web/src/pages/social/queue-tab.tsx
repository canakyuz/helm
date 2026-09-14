import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { groupSocialQueue, type SocialPost } from "@helm/api";
import { Button } from "@/components/ui/button";
import { PageStatus } from "@/components/ui/page-status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useCancelSocialPost,
  useRefreshSocialPosts,
  useSocialLibrary,
  useSocialPosts,
} from "@/hooks/use-social-publishing";
import { CancelButton, PlatformList, Thumb } from "./library-tab";
import { POST_STATUS_LABEL, fmtDateTime } from "./labels";

type Section = { key: string; title: string; posts: SocialPost[]; timeOf: (p: SocialPost) => string | null };

export function QueueTab() {
  const library = useSocialLibrary();
  const posts = useSocialPosts();
  const cancel = useCancelSocialPost();
  const refresh = useRefreshSocialPosts();

  // Time: O(n) Map + O(p log p) gruplama.
  const itemsById = useMemo(
    () => new Map((library.data ?? []).map((i) => [i.id, i] as const)),
    [library.data],
  );
  const sections = useMemo<Section[]>(() => {
    const q = groupSocialQueue(posts.data ?? []);
    const all: Section[] = [
      { key: "scheduled", title: "Planlı", posts: q.scheduled, timeOf: (p) => p.scheduled_for },
      { key: "published", title: "Yayınlanan", posts: q.published, timeOf: (p) => p.published_at ?? p.updated_at },
      { key: "failed", title: "Hatalı", posts: q.failed, timeOf: (p) => p.updated_at },
    ];
    return all.filter((s) => s.posts.length > 0);
  }, [posts.data]);

  const toolbar = (
    <div className="flex justify-end">
      <Button variant="outline" size="sm" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
        <RefreshCw className={refresh.isPending ? "animate-spin" : undefined} /> Durumları yenile
      </Button>
    </div>
  );

  if (posts.isLoading) return <PageStatus tone="loading" label="Kuyruk yükleniyor" />;
  if (posts.error) return <PageStatus tone="error" label={posts.error.message} />;
  if (sections.length === 0) {
    return (
      <div className="space-y-3">
        {toolbar}
        <PageStatus tone="empty" label="Kuyruk boş. Kütüphaneden bir video paylaş ya da planla." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toolbar}
      {sections.map((section) => (
        <section key={section.key} className="space-y-2">
          <h2 className="text-sm font-medium">
            {section.title} <span className="text-muted-foreground tabular-nums">{section.posts.length}</span>
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>Hook</TableHead>
                <TableHead>Zaman</TableHead>
                <TableHead>Platformlar</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.posts.map((post) => {
                const item = post.library_id ? itemsById.get(post.library_id) : undefined;
                return (
                  <TableRow key={post.id}>
                    <TableCell>
                      <Thumb item={item} className="h-12 w-7" />
                    </TableCell>
                    <TableCell className="max-w-sm whitespace-normal">
                      <span className="line-clamp-1">{item?.hook ?? "Kütüphanede olmayan içerik"}</span>
                      {post.error && <span className="line-clamp-2 text-xs text-destructive">{post.error}</span>}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {fmtDateTime(section.timeOf(post))}
                      {post.status !== "scheduled" && (
                        <span className="block text-xs text-muted-foreground">{POST_STATUS_LABEL[post.status]}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <PlatformList post={post} />
                    </TableCell>
                    <TableCell className="text-right">
                      {post.status === "scheduled" && (
                        <CancelButton pending={cancel.isPending} onConfirm={() => cancel.mutate(post.id)} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      ))}
    </div>
  );
}
