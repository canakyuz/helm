import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";

/** Refresh RPC durumlari asenkron toplar; bu kadar sonra ikinci okuma. */
const REFRESH_SETTLE_MS = 5_000;

export function useSocialLibrary() {
  const { scope, isAll } = useScope();
  return useQuery(socialLibraryQueryOptions(supabaseClient, isAll ? "all" : scope));
}

export function useSocialPosts() {
  const { scope, isAll } = useScope();
  return useQuery(socialPostsQueryOptions(supabaseClient, isAll ? "all" : scope));
}

function useInvalidateSocialPublishing() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: socialPublishingKeys.all });
}

export function usePublishSocialItem() {
  const invalidate = useInvalidateSocialPublishing();
  return useMutation({
    mutationFn: (args: { libraryId: string; platforms: SocialPlatform[]; scheduledFor: string | null }) =>
      publishSocialItem(supabaseClient, args),
    onSuccess: (_id, args) => {
      toast.success(args.scheduledFor == null ? "Paylaşım sıraya alındı" : "Planlandı");
      void invalidate();
    },
    onError: (e: Error) => toast.error("Paylaşılamadı", { description: e.message }),
  });
}

/**
 * Scope "all" iken kutuphane birden fazla projeye ait olabilir; `projectCounts`
 * (bkz. `readyProjectCounts`) proje basina RPC cagrisini sirayla yapar. Bir
 * proje basarisiz olursa o ana kadar planlanan adet + sunucu mesaji gosterilir.
 */
export function useScheduleAllSocial() {
  const invalidate = useInvalidateSocialPublishing();
  return useMutation({
    mutationFn: (args: { projectCounts: ReadonlyMap<string, number>; platforms: SocialPlatform[] }) =>
      scheduleAllReady(supabaseClient, args.projectCounts, args.platforms),
    onSuccess: (count) => {
      toast.success(`${count} video planlandı`);
      void invalidate();
    },
    onError: (e: Error) => {
      if (e instanceof ScheduleAllPartialError) {
        toast.error(`${e.scheduled} video planlandı, sonra durdu`, { description: e.message });
      } else {
        toast.error("Planlanamadı", { description: e.message });
      }
      void invalidate();
    },
  });
}

export function useCancelSocialPost() {
  const invalidate = useInvalidateSocialPublishing();
  return useMutation({
    mutationFn: (postId: string) => cancelSocialPost(supabaseClient, postId),
    onSuccess: () => {
      toast.success("Plan iptal edildi");
      void invalidate();
    },
    onError: (e: Error) => toast.error("İptal edilemedi", { description: e.message }),
  });
}

/** Durum yenilemeyi kuyruga atar; hemen ve ~5 sn sonra tekrar okur. */
export function useRefreshSocialPosts() {
  const invalidate = useInvalidateSocialPublishing();
  return useMutation({
    mutationFn: async () => {
      await refreshSocialPosts(supabaseClient);
      await invalidate();
    },
    onSuccess: () => {
      setTimeout(() => void invalidate(), REFRESH_SETTLE_MS);
    },
    onError: (e: Error) => toast.error("Yenilenemedi", { description: e.message }),
  });
}
