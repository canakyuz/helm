import type { Theme } from "@helm/design";
import type { SocialItemState, SocialPlatform, SocialPost, SocialPostStatus } from "@helm/api";

import type { TranslateVars } from "~/lib/i18n";
import { shortDateTime } from "~/lib/labels";

export type Translate = (key: string, vars?: TranslateVars) => string;

export type Tone = { label: string; color: string };

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
};

/**
 * Kutuphane satirinin sag kolonu. Renk TEK BASINA anlam tasimiyor: her durumun
 * metni var (renk korlugu), renk yalnizca ikinci kodlama.
 */
export function itemStateTone(state: SocialItemState, t: Translate, theme: Theme): Tone {
  switch (state.kind) {
    case "ready":
      return { label: t("Hazır"), color: theme.fg3 };
    case "scheduled":
      return { label: state.at == null ? t("Planlı") : shortDateTime(state.at), color: theme.fg };
    case "publishing":
      return { label: t("Gönderiliyor"), color: theme.warn };
    case "published":
      return { label: t("Yayında"), color: theme.pos };
    // warn, pos degil: gelen kutusunda bekleyen video henuz public degil.
    case "draft":
      return { label: t("TikTok taslağı"), color: theme.warn };
    case "failed":
      return { label: t("Hata"), color: theme.neg };
  }
}

/** Kuyruk/durum satirinin tonu; taslak post Zernio'da published olsa da taslaktir. */
export function postTone(post: SocialPost, t: Translate, theme: Theme): Tone {
  const delivered = post.status === "published" || post.status === "partial";
  if (post.tiktok_draft && delivered) return { label: t("TikTok taslağı"), color: theme.warn };
  return postStatusTone(post.status, t, theme);
}

export function postStatusTone(status: SocialPostStatus, t: Translate, theme: Theme): Tone {
  switch (status) {
    case "sending":
      return { label: t("Gönderiliyor"), color: theme.warn };
    case "scheduled":
      return { label: t("Planlı"), color: theme.fg };
    case "publishing":
      return { label: t("Yayınlanıyor"), color: theme.warn };
    case "published":
      return { label: t("Yayında"), color: theme.pos };
    case "partial":
      return { label: t("Kısmen yayında"), color: theme.warn };
    case "failed":
      return { label: t("Hata"), color: theme.neg };
    case "cancelled":
      return { label: t("İptal edildi"), color: theme.fg3 };
  }
}

/** Zernio platform durumu serbest metin; uc kovaya indirgenir (+ Helm'in "draft"i). */
export function platformTone(status: string, t: Translate, theme: Theme): Tone {
  const s = status.toLowerCase();
  if (s === "draft") return { label: t("Taslak"), color: theme.warn };
  if (s === "published" || s === "success") return { label: t("Yayında"), color: theme.pos };
  if (s === "failed" || s === "error") return { label: t("Hata"), color: theme.neg };
  return { label: t("Bekliyor"), color: theme.fg2 };
}

/** "11 sn". Sure yoksa null - satir meta'si o parcayi atlar. */
export function durationLabel(sec: number | null, t: Translate): string | null {
  return sec == null ? null : t("{n} sn", { n: Math.round(sec) });
}
