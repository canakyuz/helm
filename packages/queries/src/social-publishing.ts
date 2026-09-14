import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchSocialLibrary, fetchSocialPosts } from "@helm/api";

export const socialPublishingKeys = {
  all: ["social-publishing"] as const,
  library: (id: SelectedPropertyId) => ["social-publishing", "library", id] as const,
  posts: (id: SelectedPropertyId) => ["social-publishing", "posts", id] as const,
};

export function socialLibraryQueryOptions(client: SupabaseClient, propertyId: SelectedPropertyId) {
  return queryOptions({
    queryKey: socialPublishingKeys.library(propertyId),
    queryFn: () => fetchSocialLibrary(client, propertyId),
    staleTime: 30_000,
  });
}

export function socialPostsQueryOptions(client: SupabaseClient, propertyId: SelectedPropertyId) {
  return queryOptions({
    queryKey: socialPublishingKeys.posts(propertyId),
    queryFn: () => fetchSocialPosts(client, propertyId),
    staleTime: 30_000,
  });
}
