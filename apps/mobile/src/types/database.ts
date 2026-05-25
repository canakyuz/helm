// Bu dosya `bun run gen:types` ile üretilecek — şimdilik placeholder.
// `.env`'de HELM_SUPABASE_PROJECT_ID dolduktan sonra çalıştır:
//   bun run gen:types
// Önce `supabase login` ve `npm i -g supabase` gerekebilir.

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
