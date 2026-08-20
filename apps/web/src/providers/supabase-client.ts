import { createClient } from "@refinedev/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// helm hub Supabase projesi - değerler .env.local'dan okunur.
const SUPABASE_URL = import.meta.env.VITE_HELM_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_HELM_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "VITE_HELM_SUPABASE_URL / VITE_HELM_SUPABASE_ANON_KEY are not set. Fill in .env.local.",
  );
}

export const supabaseClient: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    db: { schema: "public" },
    auth: { persistSession: true },
  },
);
