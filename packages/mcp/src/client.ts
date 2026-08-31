import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Hub baglantisi.
 *
 * MCP sunucusu kullanicinin KENDI Supabase projesine baglanir - Helm'in
 * "kendi instance'ini getir" modeliyle ayni. Sunucu hicbir anahtari diske
 * yazmaz, loglamaz veya stdout'a dokmez.
 *
 * Iki kimlik yolu var:
 *
 *   1) Publishable anahtar + e-posta/sifre  (ONERILEN)
 *      Sunucu oturum acar; butun sorgular RLS ALTINDA calisir. Yani MCP
 *      araclari, panelde gordugunuzden fazlasini goremez.
 *
 *   2) Secret anahtar (sb_secret_...)  tek basina
 *      RLS'i bypass eder. Yalnizca kendi makinenizde, kendi projenizde
 *      kullanin - bu anahtar her satiri okur.
 *
 * Anon anahtari TEK BASINA yetmez: RLS politikalarinin cogu `authenticated`
 * rolune yazilmis, dolayisiyla oturumsuz cagri bos sonuc doner (hata degil,
 * bos - sessiz ve kafa karistirici). Bu yuzden asagida acikca uyariliyor.
 */
export async function createHubClient(): Promise<SupabaseClient> {
  const url = process.env.HELM_SUPABASE_URL;
  const key = process.env.HELM_SUPABASE_KEY;

  if (!url || !key) {
    throw new Error(
      "HELM_SUPABASE_URL ve HELM_SUPABASE_KEY ortam degiskenleri gerekli.",
    );
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = process.env.HELM_SUPABASE_EMAIL;
  const password = process.env.HELM_SUPABASE_PASSWORD;

  if (email && password) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(`Helm oturumu acilamadi: ${error.message}`);
    }
    return client;
  }

  // Secret anahtar zaten RLS'i asar; publishable/anon ise sessizce bos doner.
  if (!key.startsWith("sb_secret_") && !key.startsWith("service_role")) {
    console.error(
      "[helm-mcp] UYARI: oturum acilmadi ve anahtar secret degil. " +
        "RLS yuzunden araclar bos sonuc dondurebilir. " +
        "HELM_SUPABASE_EMAIL + HELM_SUPABASE_PASSWORD ekleyin veya secret anahtar kullanin.",
    );
  }

  return client;
}

/** MCP araclari icin ortak hata bicimi - istisna firlatmak yerine metin doner. */
export function toolError(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: `Hata: ${message}` }],
  };
}

/** Yapisal veriyi hem okunabilir hem ayristirilabilir bicimde dondurur. */
export function toolJson(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}
