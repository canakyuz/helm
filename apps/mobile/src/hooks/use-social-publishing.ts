import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelSocialPost,
  publishSocialItem,
  refreshSocialPosts,
  scheduleAllReady,
  ScheduleAllPartialError,
  type SocialPlatform,
} from "@helm/api";
import {
  socialLibraryQueryOptions,
  socialPostsQueryOptions,
  socialPublishingKeys,
} from "@helm/queries";

import { tr } from "~/lib/i18n";
import { usePreferences } from "~/lib/preferences";
import { supabase } from "~/lib/supabase";
import { toast } from "~/lib/toast";

export type {
  SocialItemState,
  SocialLibraryItem,
  SocialPlatform,
  SocialPost,
  SocialPostPlatform,
  SocialPostStatus,
} from "@helm/api";

/** Refresh RPC durumlari asenkron toplar; bu kadar sonra ikinci okuma. */
const REFRESH_SETTLE_MS = 5_000;

export function useSocialLibrary() {
  const { selectedPropertyId } = usePreferences();
  return useQuery(socialLibraryQueryOptions(supabase, selectedPropertyId));
}

export function useSocialPosts() {
  const { selectedPropertyId } = usePreferences();
  return useQuery(socialPostsQueryOptions(supabase, selectedPropertyId));
}

/** Her yazma hem kutuphaneyi hem postlari tazeler (durum ikisinden turer). */
function useInvalidateSocialPublishing() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: socialPublishingKeys.all });
}

export function usePublishSocialItem() {
  const invalidate = useInvalidateSocialPublishing();
  return useMutation({
    mutationFn: (args: {
      libraryId: string;
      platforms: SocialPlatform[];
      scheduledFor: string | null;
    }) => publishSocialItem(supabase, args),
    onSuccess: (_id, args) => {
      toast.success(args.scheduledFor == null ? tr("Paylaşım sıraya alındı") : tr("Planlandı"));
      void invalidate();
    },
    onError: (e: Error) => toast.error(tr("Paylaşılamadı"), e.message),
  });
}

/**
 * Scope "all" iken kutuphane birden fazla projeye ait olabilir; `projectCounts`
 * (bkz. `readyProjectCounts`) proje basina RPC cagrisini sirayla yapar. Bir
 * proje basarisiz olursa o ana kadar planlanan adet + sunucu mesaji gosterilir
 * (kismi basari sessizce yutulmaz).
 */
export function useScheduleAllSocial() {
  const invalidate = useInvalidateSocialPublishing();
  return useMutation({
    mutationFn: (args: { projectCounts: ReadonlyMap<string, number>; platforms: SocialPlatform[] }) =>
      scheduleAllReady(supabase, args.projectCounts, args.platforms),
    onSuccess: (count) => {
      toast.success(tr("{n} video planlandı", { n: count }));
      void invalidate();
    },
    onError: (e: Error) => {
      if (e instanceof ScheduleAllPartialError) {
        toast.error(tr("{n} video planlandı, sonra durdu", { n: e.scheduled }), e.message);
      } else {
        toast.error(tr("Planlanamadı"), e.message);
      }
      void invalidate();
    },
  });
}

export function useCancelSocialPost() {
  const invalidate = useInvalidateSocialPublishing();
  return useMutation({
    mutationFn: (postId: string) => cancelSocialPost(supabase, postId),
    onSuccess: () => {
      toast.success(tr("Plan iptal edildi"));
      void invalidate();
    },
    onError: (e: Error) => toast.error(tr("İptal edilemedi"), e.message),
  });
}

/**
 * Asagi cekip yenile. RPC Zernio'dan durumlari KUYRUGA atar, sonuc hemen gelmez:
 * once elimizdekini tazeleriz (spinner burada biter), ~5 sn sonra bir kez daha
 * okuruz. Spinner'i 5 sn tutmak "donmus" hissi veriyordu - bekleme gorunmez kalir.
 */
export function useRefreshSocialPosts() {
  const invalidate = useInvalidateSocialPublishing();
  return useMutation({
    mutationFn: async () => {
      await refreshSocialPosts(supabase);
      await invalidate();
    },
    onSuccess: () => {
      setTimeout(() => void invalidate(), REFRESH_SETTLE_MS);
    },
    onError: (e: Error) => toast.error(tr("Yenilenemedi"), e.message),
  });
}
