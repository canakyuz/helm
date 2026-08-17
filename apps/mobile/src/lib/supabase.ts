import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const SUPABASE_URL = process.env.EXPO_PUBLIC_HELM_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_HELM_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "EXPO_PUBLIC_HELM_SUPABASE_URL / EXPO_PUBLIC_HELM_SUPABASE_ANON_KEY are not set. Copy .env.example to .env and fill them in.",
  );
}

const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
