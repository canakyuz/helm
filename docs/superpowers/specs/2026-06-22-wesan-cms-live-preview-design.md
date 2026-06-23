# wesan CMS — Canlı Önizleme (Live Preview) Tasarımı

- **Tarih:** 2026-06-22
- **Durum:** Tasarım — onay bekliyor
- **Hedef site:** `wesan` (wesan.co) — **CANLI**
- **Sahip:** Can (Bekircan Akyuz)

## 1. Bağlam (doğrulanmış mevcut durum)

helm'de tam, wire edilmiş, çok-siteli homegrown CMS zaten var (`helm/apps/web`, Vite + Refine + Supabase). Eksik olan **tek şey canlı önizleme** — `entries/edit.tsx`'te iframe/preview yok; editör Hero'yu düzenlerken çıkan sayfayı göremiyor. Bu, non-tech editörler için "CMS değil veritabanı formu" hissi yaratıyor ("alakası yok" sebebi).

Mevcut parçalar (yeniden kullanılacak, dokunulmayacak):
- **Şema kaynağı:** `scripts/cms-ingest.ts` (`bun run ingest:wesan`) → `wesan/content/en.json` → `inferSchema`/`mergeSchema` (drift governance) → `cms_collections.schema` + `cms_entries.data`.
- **Editör:** `components/cms/sectioned-form.tsx` (derin ağaç, breadcrumb: Pages › Home › Hero), `lib/cms-schema.ts` (şema→Zod), draft/publish/revisions/locale/assets.
- **Publish:** `supabase/functions/helm-cms-publish` → entry publish + `properties.cms_publish_targets` webhook + ISR tag invalidate.
- **Delivery (wesan):** `wesan/lib/content.ts` `getContent` (React cache) → `fetchHelmContent` (`status=eq.published` + ISR) → null ise static `en.json`, değilse `deepMerge(static, remote)`.

## 2. Amaç / Amaç-dışı

**Amaç:** Non-tech bir editör helm'de wesan içeriğini düzenlerken, **gerçek wesan sayfasını draft içerikle yan panelde görsün**; deploy olmadan düzenleyip publish edebilsin.

**Amaç-dışı (bu spec):** Yeni CMS, yeni editör, AutoForm, block-builder, Zod-koddan-üretim (hepsi zaten var ya da gereksiz). Tıkla-düzenle overlay ve tuş-başına anlık önizleme → P2.

## 3. Üretim güvenliği kısıtları (CANLI — pazarlıksız)

1. **Published render byte-for-byte değişmez.** Draft yolu yalnızca Next Draft Mode açıkken (token'lı `/api/preview` üzerinden) devreye girer; normal ziyaretçi asla tetiklemez.
2. **Publish manuel kalır.** Bu iş sırasında hiçbir şey otomatik publish edilmez; canlı içerik ancak editör bilerek "Publish" derse değişir.
3. **`ingest:wesan` prod Supabase'e yazar** ama sadece `cms_collections.schema` + `status='draft'` entry. Site `published` okur → canlı render etkilenmez.
4. **Secret env'de**, repoda değil. Preview route secret doğrulamadan Draft Mode açmaz.

## 4. Mimari + veri akışı

```
helm editör (/cms/entries/edit/:id)
  ┌───────────────────────────┬───────────────────────────────────────┐
  │ SOL: SectionedForm        │ SAĞ: <iframe>                          │
  │  (mevcut, değişmez)        │  src = {previewBase}/api/preview        │
  │  Taslak Kaydet ──────────► │        ?secret=…&path=/<sayfa>          │
  └───────────────────────────┴───────────────┬───────────────────────┘
        save → cms_entries.data (draft)        │ kayıt sonrası iframe.reload()
                                               ▼
                              wesan /api/preview  →  draftMode().enable() → redirect path
                                               ▼
                              wesan getContent()  (draftMode AÇIK)
                                  → fetchHelmContent(status='draft', no-store)
                                  → deepMerge(static, draft)  → sayfa render
        (token YOKSA: draftMode kapalı → eski published yol, hiç değişmez)
```

## 5. Bileşenler (units)

### 5.1 wesan sitesi (CANLI — additive değişiklikler)

- **`wesan/lib/helm.ts`** — `fetchHelmContent(lang, opts?: { draft?: boolean })`. Default published (mevcut davranış, dokunma). `draft:true` iken: `status=eq.draft`, `cache: 'no-store'`, ISR tag yok. Tek dosya, geriye dönük uyumlu imza.
- **`wesan/lib/content.ts`** — `getContent` içinde `draftMode()` (`next/headers`) kontrolü: `isEnabled` ise `fetchHelmContent(lang, { draft:true })`, değilse mevcut yol. Draft, published→static fallback zinciriyle. (React `cache` per-request olduğundan published cache'i kirletmez.)
- **`wesan/app/api/preview/route.ts`** (YENİ) — `GET ?secret&path`: `secret === env.WESAN_PREVIEW_SECRET` ise `draftMode().enable()` + `redirect(path)`. Aksi halde 401.
- **`wesan/app/api/preview/disable/route.ts`** (YENİ) — `draftMode().disable()` + redirect (önizlemeden çıkış).
- Env: `WESAN_PREVIEW_SECRET`.

### 5.2 helm editör

- **`properties` config** — önizleme için `preview_url` (taban URL, ör. https://wesan.co veya staging) + paylaşılan `preview_secret`. (Mevcut `cms_publish_targets` taban URL'i de kaynak olabilir; karar §7.)
- **`components/cms/preview-panel.tsx`** (YENİ) — `iframe` + **sayfa seçici** (bundle `pages.*` anahtarları → site route eşlemesi, §6) + "Yenile" + Taslak Kaydet sonrası otomatik `reload`. Sadece `kind==='singleton'` site-bundle / website property'lerinde görünür.
- **`pages/cms/entries/edit.tsx`** — grid'i `[form | preview]` iki-pane yap (mevcut form ve revisions korunur); preview-panel'i sağ tarafa ekle. Editörün içi (SectionedForm) değişmez.

## 6. Sayfa → route eşlemesi

Bundle `pages` anahtarları wesan route'larına denk (çoğu birebir): `home→/`, `mission→/mission`, `now→/now`, `careers→/careers`, `contact→/contact`, `about→/about`, `divisions→/divisions`, `software→/software`, `studio→/studio`, `industries→/industries`, `newsroomIndex→/newsroom`, `legal→/legal`, `trust→/trust`, `reports→/reports`, `calendar→/calendar`, `studio01`/`studio02` → ilgili detay route'ları. Eşleme helm'de küçük bir sabit map; bilinmeyen anahtar → `/`.

## 7. Açık üretim kararları (uygulamadan önce onay)

1. **Önizleme hedefi:** Draft-mode kodu **prod wesan.co'ya** mı deploy edilip ona mı önizlenecek (ziyaretçi için inert, en gerçekçi), yoksa wesan'ın **staging/preview deploy'una** mı? *Öneri: kod prod'a (zararsız), önizleme wesan.co.*
2. **`ingest:wesan` koşuldu mu?** Prod'da wesan property + site-bundle entry var mı? Yoksa Adım 0 = `bun run ingest:wesan` (draft yazar, canlıyı etkilemez). *Doğrulanacak.*

## 8. Kapsam / fazlar

- **P1 (bu spec, wesan uçtan uca):** §5.1 + §5.2 + §6. Çıktı: non-tech biri helm'de wesan Hero metnini düzenleyip **yan panelde görüp** publish edebilir. Çalışınca dur, göster.
- **P2:** postMessage ile tuş-başına anlık önizleme (kaydetmeden); tıkla-düzenle overlay (preview'da section'a tıkla → forma git); `editor/advanced` alan rolü (showcase alanlarını non-tech'ten gizle); friday + diğer siteler.

## 9. Test (kritik yol — aşırı test yok)

1. **Regression (en kritik):** token YOK iken wesan published render'ı bayt düzeyinde aynı (Draft Mode kapalı yol).
2. **Güvenlik:** yanlış/eksik secret → `/api/preview` 401, Draft Mode açılmaz.
3. **Draft görünürlüğü:** geçerli token → düzenlenen draft içerik önizlemede; publish edilmemiş içerik canlıda görünmez.
4. **Publish akışı:** publish → webhook + ISR invalidate → canlı güncellenir.

## 10. Rollout / güvenlik

- Önce wesan'a additive deploy (published değişmez) → secret env ekle → helm preview-panel → `ingest:wesan` (gerekirse) → tek sayfada (home) doğrula → diğer sayfalar.
- Geri dönüş: preview route + draftMode branch'i feature olarak izole; sorun olursa secret'ı kaldır → önizleme kapanır, canlı etkilenmez.
