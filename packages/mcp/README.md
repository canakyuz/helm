# @helm/mcp

Helm portföyünü bir asistana araç olarak açan MCP sunucusu. stdio taşıması,
salt okuma.

## Araçlar

| Araç | Ne yapar |
|------|----------|
| `helm_list_apps` | Portföydeki uygulamalar ve id'leri |
| `helm_metrics` | Günlük metrik toplamları (mrr, dau, ad_revenue…) |
| `helm_review_stats` | Puan ortalaması, yıldız dağılımı, iOS/Android kırılımı |
| `helm_reviews` | Yorum listesi (platform, puan, kelime araması) |
| `helm_ask_reviews` | Yorumlara anlamsal soru — kaynaklı cevap |
| `helm_data_health` | Son senkron koşuları + susmuş kaynak uyarıları |

## Kurulum

Claude Code / Claude Desktop yapılandırmasına ekle:

```json
{
  "mcpServers": {
    "helm": {
      "command": "bun",
      "args": ["run", "/mutlak/yol/helm/packages/mcp/src/index.ts"],
      "env": {
        "HELM_SUPABASE_URL": "https://<ref>.supabase.co",
        "HELM_SUPABASE_KEY": "sb_publishable_...",
        "HELM_SUPABASE_EMAIL": "sen@ornek.com",
        "HELM_SUPABASE_PASSWORD": "..."
      }
    }
  }
}
```

## Kimlik

İki yol var:

1. **Publishable anahtar + e-posta/şifre (önerilen).** Sunucu oturum açar,
   sorgular RLS altında çalışır — araçlar panelde gördüğünden fazlasını görmez.
2. **Secret anahtar (`sb_secret_…`) tek başına.** RLS'i aşar. Sadece kendi
   makinende, kendi projende kullan.

Anon/publishable anahtarı **tek başına** yetmez: RLS politikalarının çoğu
`authenticated` rolüne yazılmış, oturumsuz çağrı hata değil **boş sonuç**
döndürür. Sunucu bu durumda stderr'e uyarı basar.

## Not

stdout protokol kanalıdır — bu pakette `console.log` kullanma, günlük için
`console.error`.
