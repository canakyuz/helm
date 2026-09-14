import { useMemo, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  SOCIAL_PLATFORMS,
  isActivePost,
  latestPostByLibrary,
  socialItemState,
  type SocialLibraryItem,
  type SocialPlatform,
  type SocialPost,
} from "@helm/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageStatus } from "@/components/ui/page-status";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useCancelSocialPost,
  usePublishSocialItem,
  useScheduleAllSocial,
  useSocialLibrary,
  useSocialPosts,
} from "@/hooks/use-social-publishing";
import {
  MIN_LEAD_MS,
  PLATFORM_LABEL,
  POST_STATUS_LABEL,
  fmtDateTime,
  fmtDuration,
  itemStateBadge,
  nextEvening,
  platformBadge,
  toLocalInput,
} from "./labels";

export function LibraryTab() {
  const library = useSocialLibrary();
  const posts = useSocialPosts();
  const scheduleAll = useScheduleAllSocial();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const items = library.data ?? [];
  // Time: O(p) + O(n). Satir basina durum Map'ten O(1).
  const latest = useMemo(() => latestPostByLibrary(posts.data ?? []), [posts.data]);
  const readyCount = useMemo(
    () => items.filter((i) => !isActivePost(latest.get(i.id)?.status ?? "cancelled")).length,
    [items, latest],
  );
  const selected = items.find((i) => i.id === selectedId);

  if (library.isLoading) return <PageStatus tone="loading" label="Kütüphane yükleniyor" />;
  if (library.error) return <PageStatus tone="error" label={library.error.message} />;
  if (items.length === 0) {
    return (
      <PageStatus
        tone="empty"
        label="Kütüphane boş. Videoları scripts/social/import-library.ts ile içe aktar."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {items.length} video · {readyCount} hazır
        </p>
        <Button
          size="sm"
          disabled={readyCount === 0 || scheduleAll.isPending}
          onClick={() => setConfirmAll(true)}
        >
          Hepsini planla
        </Button>
      </div>
      {posts.error && (
        <p role="alert" className="text-sm text-destructive">
          Paylaşım durumları okunamadı: {posts.error.message}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14" />
            <TableHead>Hook</TableHead>
            <TableHead>Kod</TableHead>
            <TableHead className="text-right">Süre</TableHead>
            <TableHead className="text-right">Durum</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const badge = itemStateBadge(socialItemState(latest.get(item.id)));
            return (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => setSelectedId(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(item.id);
                  }
                }}
              >
                <TableCell>
                  <Thumb item={item} className="h-16 w-9" />
                </TableCell>
                <TableCell className="max-w-md whitespace-normal">
                  <span className="line-clamp-2">{item.hook}</span>
                </TableCell>
                <TableCell className="font-mono text-xs">{item.code}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtDuration(item.duration_sec)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ItemSheet
        item={selected}
        post={selected ? latest.get(selected.id) : undefined}
        onClose={() => setSelectedId(null)}
      />

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hepsini planla</AlertDialogTitle>
            <AlertDialogDescription>
              {readyCount} video her gün 20:00'de birer birer planlanacak. İlki en erken yarın.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const first = items[0];
                if (!first) return;
                scheduleAll.mutate({ projectId: first.project_id, platforms: [...SOCIAL_PLATFORMS] });
              }}
            >
              Planla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function Thumb({ item, className }: { item: SocialLibraryItem | undefined; className: string }) {
  if (!item?.thumbnail_url) return <div className={`${className} rounded-md bg-muted`} />;
  return (
    <img
      src={item.thumbnail_url}
      alt=""
      loading="lazy"
      className={`${className} rounded-md bg-muted object-cover`}
    />
  );
}

function ItemSheet({
  item,
  post,
  onClose,
}: {
  item: SocialLibraryItem | undefined;
  post: SocialPost | undefined;
  onClose: () => void;
}) {
  return (
    <Sheet open={item != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6">{item.hook}</SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {item.code} · {fmtDuration(item.duration_sec)}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-6">
              <div className="flex gap-4">
                <a href={item.video_url} target="_blank" rel="noreferrer" aria-label="Videoyu aç">
                  <Thumb item={item} className="h-48 w-27" />
                </a>
                <div className="flex flex-col justify-end gap-2 text-sm">
                  <a
                    className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                    href={item.video_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="size-3.5" /> Videoyu aç
                  </a>
                </div>
              </div>

              {post && isActivePost(post.status) ? (
                <ActivePost post={post} />
              ) : (
                <PublishForm item={item} lastFailed={post?.status === "failed" ? post : undefined} />
              )}

              <Caption title="TikTok" text={item.tiktok_caption} />
              <Caption title="Instagram" text={item.instagram_caption} />
              {item.pinned_comment?.trim() && <Caption title="Sabit yorum" text={item.pinned_comment} />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Caption({ title, text }: { title: string; text: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${title} metni kopyalandı`);
    } catch {
      toast.error("Kopyalanamadı");
    }
  };
  return (
    <section className="space-y-2 border-t pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <Button variant="ghost" size="sm" onClick={() => void copy()} disabled={text.trim() === ""}>
          <Copy /> Kopyala
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{text || "Metin yok"}</p>
    </section>
  );
}

function ActivePost({ post }: { post: SocialPost }) {
  const cancel = useCancelSocialPost();
  const at = post.published_at ?? post.scheduled_for;
  return (
    <section className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Durum</h3>
        {post.status === "scheduled" && <CancelButton pending={cancel.isPending} onConfirm={() => cancel.mutate(post.id)} />}
      </div>
      <p className="text-sm tabular-nums">
        {POST_STATUS_LABEL[post.status]}
        {at && ` · ${fmtDateTime(at)}`}
      </p>
      <PlatformList post={post} />
      {post.error && <p className="text-sm text-destructive">{post.error}</p>}
    </section>
  );
}

export function PlatformList({ post }: { post: SocialPost }) {
  if (post.platforms.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {post.platforms.map((p) => {
        const badge = platformBadge(p.status);
        const label = `${PLATFORM_LABEL[p.platform]} · ${badge.label}`;
        return (
          <li key={`${p.platform}-${p.account_id}`} title={p.error ?? undefined}>
            {p.url ? (
              <a href={p.url} target="_blank" rel="noreferrer">
                <Badge variant={badge.variant}>
                  {label} <ExternalLink />
                </Badge>
              </a>
            ) : (
              <Badge variant={badge.variant}>{label}</Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function CancelButton({ pending, onConfirm }: { pending: boolean; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="destructive" size="sm" disabled={pending} onClick={() => setOpen(true)}>
        Planı iptal et
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Planı iptal et</AlertDialogTitle>
            <AlertDialogDescription>Bu paylaşım Zernio'dan silinecek.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>İptal et</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PublishForm({ item, lastFailed }: { item: SocialLibraryItem; lastFailed: SocialPost | undefined }) {
  const publish = usePublishSocialItem();
  const [flags, setFlags] = useState<Record<SocialPlatform, boolean>>({ tiktok: true, instagram: true });
  const [when, setWhen] = useState(() => toLocalInput(nextEvening(new Date())));
  const [confirmNow, setConfirmNow] = useState(false);

  const platforms = SOCIAL_PLATFORMS.filter((p) => flags[p]);
  const whenDate = new Date(when);
  const whenValid = !Number.isNaN(whenDate.getTime()) && whenDate.getTime() >= Date.now() + 60_000;

  const submit = (scheduledFor: string | null) =>
    publish.mutate({ libraryId: item.id, platforms, scheduledFor });

  return (
    <section className="space-y-4 border-t pt-4">
      <h3 className="text-sm font-medium">Paylaş</h3>
      {lastFailed && (
        <p className="text-sm text-destructive">Son deneme başarısız: {lastFailed.error ?? "bilinmeyen hata"}</p>
      )}
      <div className="flex flex-wrap gap-6">
        {SOCIAL_PLATFORMS.map((p) => (
          <div key={p} className="flex items-center gap-2">
            <Switch
              id={`platform-${p}`}
              checked={flags[p]}
              onCheckedChange={(on) => setFlags((prev) => ({ ...prev, [p]: on }))}
            />
            <Label htmlFor={`platform-${p}`}>{PLATFORM_LABEL[p]}</Label>
          </div>
        ))}
      </div>
      {platforms.length === 0 && <p className="text-xs text-muted-foreground">En az bir platform seç.</p>}

      <Button className="w-full" disabled={platforms.length === 0 || publish.isPending} onClick={() => setConfirmNow(true)}>
        Şimdi paylaş
      </Button>

      <div className="space-y-2">
        <Label htmlFor="schedule-at">Planla</Label>
        <div className="flex gap-2">
          <Input
            id="schedule-at"
            type="datetime-local"
            value={when}
            min={toLocalInput(new Date(Date.now() + MIN_LEAD_MS))}
            onChange={(e) => setWhen(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={platforms.length === 0 || !whenValid || publish.isPending}
            onClick={() => submit(whenDate.toISOString())}
          >
            Planla
          </Button>
        </div>
        {!whenValid && <p className="text-xs text-destructive">Gelecekte bir zaman seç.</p>}
      </div>

      <AlertDialog open={confirmNow} onOpenChange={setConfirmNow}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Şimdi paylaş</AlertDialogTitle>
            <AlertDialogDescription>
              {platforms.map((p) => PLATFORM_LABEL[p]).join(" + ")} için yaklaşık 2 dakika içinde yayınlanacak.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit(null)}>Paylaş</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
