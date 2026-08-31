# ADR-002: Anlamsal Arama (pgvector + RAG) ve MCP Sunucusu

**Durum:** Kabul edildi
**Tarih:** 2026-08-31
**Bağlam:** Yorum arama `ilike` ile kelime eşleşmesi yapıyordu; portföy verisine
program dışından erişimin bir yolu yoktu.

## Karar

Üç parça, tek sistem:

1. **pgvector** — `content_embeddings` tablosu, HNSW indeksi, `vector(1536)`.
2. **RAG** — `helm-embed` (gömme üretimi) + `helm-ask` (soru → arama → Claude).
3. **MCP** — `@helm/mcp`, stdio taşımalı, altı okuma aracı.

Üçü birbirine bağlı: MCP'nin `helm_ask_reviews` aracı `helm-ask`'i çağırır,
`helm-ask` de pgvector aramasını kullanır.

## Alternatifler

| Alternatif | Red nedeni |
|------------|------------|
| Harici vektör DB (Pinecone, Qdrant) | İkinci bir servis, ikinci bir fatura, ikinci bir sır. Veri zaten Postgres'te; pgvector aynı işi aynı yerde yapıyor |
| `pg_trgm` ile bulanık arama | Yazım hatasını çözer, anlamı çözmez. "Yavaş açılıyor" hâlâ "performans" aramasında çıkmaz |
| Gömme üretimini istemcide yapmak | API anahtarı tarayıcıya iner. Helm'in tüm sır modeli buna karşı |
| MCP'yi HTTP/SSE taşımasıyla sunmak | Kimlik doğrulama ve barındırma yükü getirir. Araç kullanıcının kendi makinesinde, kendi verisiyle çalışıyor - stdio yeterli |
| Yorum başına tek tek gömme | Her yorum bir HTTP isteği demek. Toplu gönderim 100 kat az istek |

## Sonuçlar

**Artı:**
- Anlamsal arama çok dilli çalışıyor - depodaki yorumlar arasında Lehçe de var,
  kelime eşleşmesi bunları hiçbir Türkçe/İngilizce sorguda bulamazdı
- MCP, veriyi asistana açarken RLS'i koruyor (oturum açarak bağlanır)
- Gömme idempotent: `md5(content)` değişmediyse tekrar üretilmez

**Eksi / açık riskler:**
- **Veri hacmi bugün yetersiz.** Depoda 15 yorum var; RAG bu ölçekte anlamlı
  tema çıkarmaz. Altyapı doğru, değeri veri birikince gelir. Bu, kararın
  bilinçli kabul edilmiş zayıf noktası
- **İki dış sağlayıcı bağımlılığı eklendi:** gömme için OpenAI, cevap için
  Anthropic. Anthropic gömme API'si sunmadığı için tek sağlayıcıya inilemedi
- **Boyut kilitli:** `vector(1536)` seçildi. Voyage veya Cohere'e geçilirse
  kolonun yeniden yazılması gerekir; bu yüzden her satır hangi modelle
  üretildiğini `model` kolonunda taşıyor
- **Maliyet:** gömme ucuz (~$0.02/1M token), cevap üretimi değil. `helm-ask`
  kimlik doğrulaması arkasında ve varsayılan `effort` "medium"

## Güvenlik notu

`helm-ask`'in bağlamına giren metinler kullanıcı üretimi yorumlardır. Sistem
promptu bunları açıkça **veri** olarak işaretler ve içlerindeki yönergelere
uyulmamasını söyler. Prompt enjeksiyonu bu ucun en belirgin saldırı yüzeyidir.

## İlgili

- `supabase/migrations/0048_content_embeddings.sql`
- `supabase/functions/helm-embed/` · `supabase/functions/helm-ask/`
- `packages/mcp/`
- [ADR-001](./001-monorepo-shared-packages.md)
