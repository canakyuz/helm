import {
  istanbulEveningSlot,
  type SocialItemState,
  type SocialPlatform,
  type SocialPost,
  type SocialPostStatus,
} from "@helm/api";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
};

const dateTime = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "15 Eyl 20:00" - planli paylasimlarin tek bicimi (mobil ile ayni). */
export const fmtDateTime = (iso: string | null): string =>
  iso == null ? "-" : dateTime.format(new Date(iso));

export const fmtDuration = (sec: number | null): string =>
  sec == null ? "-" : `${Math.round(sec)} sn`;

export function itemStateBadge(state: SocialItemState): { label: string; variant: BadgeVariant } {
  switch (state.kind) {
    case "ready":
      return { label: "Hazır", variant: "outline" };
    case "scheduled":
      return { label: state.at == null ? "Planlı" : fmtDateTime(state.at), variant: "secondary" };
    case "publishing":
      return { label: "Gönderiliyor", variant: "secondary" };
    case "published":
      return { label: "Yayında", variant: "default" };
    case "draft":
      return { label: "TikTok taslağı", variant: "secondary" };
    case "failed":
      return { label: "Hata", variant: "destructive" };
  }
}

export const POST_STATUS_LABEL: Record<SocialPostStatus, string> = {
  sending: "Gönderiliyor",
  scheduled: "Planlı",
  publishing: "Yayınlanıyor",
  published: "Yayında",
  partial: "Kısmen yayında",
  failed: "Hata",
  cancelled: "İptal edildi",
};

/** Kuyruk satirinin durum metni; taslak post Zernio'da published olsa da taslaktir. */
export function postStatusLabel(post: SocialPost): string {
  const delivered = post.status === "published" || post.status === "partial";
  return post.tiktok_draft && delivered ? "TikTok taslağı" : POST_STATUS_LABEL[post.status];
}

/** Zernio platform durumu serbest metin; uc kovaya indirgenir (+ Helm'in "draft"i). */
export function platformBadge(status: string): { label: string; variant: BadgeVariant } {
  const s = status.toLowerCase();
  if (s === "draft") return { label: "Taslak", variant: "secondary" };
  if (s === "published" || s === "success") return { label: "Yayında", variant: "default" };
  if (s === "failed" || s === "error") return { label: "Hata", variant: "destructive" };
  return { label: "Bekliyor", variant: "outline" };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → `<input type="datetime-local">` degeri (yerel saat). */
export const toLocalInput = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Planlamaya izin verilen en erken an: simdiden 5 dk sonra. */
export const MIN_LEAD_MS = 5 * 60_000;

/** Bir sonraki Istanbul 20:00'i (bugun yetisiyorsa bugun, degilse yarin). */
export function nextEvening(now: Date): Date {
  const today = istanbulEveningSlot(now, 0);
  if (today.getTime() >= now.getTime() + MIN_LEAD_MS) return today;
  return istanbulEveningSlot(now, 1);
}
