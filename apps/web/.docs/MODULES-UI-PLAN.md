# Helm - Modül Mimarisi UI Implementasyon Planı

> Eşlik eden dokümanlar: `.docs/MODULES.md` (model sözleşmesi), `.docs/0019-migration-draft.sql` (DB taslağı; gerçek dosya `supabase/migrations/0019_brands_and_properties.sql`. 0018 numarası `cms_publish_targets` için ayrıldı.)
>
> Sıralama: **DB migration → ortak kütüphane → context/hook → wizard → settings → sidebar → dashboard filter → eski URL redirect.**
> Hiçbir adım atlanmaz; her adım kendi commit'ine girer (atomik regresyon).

---

## Faz 0 - Hazırlık (kod yok, sadece checklist)

- [ ] `.docs/MODULES.md` kullanıcı tarafından onaylandı
- [ ] `.docs/0019-migration-draft.sql` review edildi, post-migration TODO'lar onaylandı
- [ ] Dev DB snapshot (geri alma için): `pg_dump` veya Supabase dashboard backup
- [ ] Çalışan dev sunucu kapatılıyor (5173) - migration sırasında React Query cache karışmasın

---

## Faz 1 - DB migration (1 commit)

**Dosya:** `supabase/migrations/0019_brands_and_properties.sql` (taslaktan kopyala)

**Adımlar:**
1. `.docs/0019-migration-draft.sql` → `supabase/migrations/0019_brands_and_properties.sql` (taslak başlığı ve rollback yorumu silinmeden, sadece "TASLAK" notu kaldırılır)
2. `supabase db push` (dev önce, sonra prod)
3. Doğrulama: `select * from properties limit 1`, `select * from brands limit 1`, `select * from projects limit 1` (view çalışıyor mu)
4. Post-migration TODO 1 + 2 SQL'leri elle çalıştır (type set + enabled_modules backfill)

**Commit:** `feat(helm): WES-000 0019 - brands tablosu + projects→properties rename + enabled_modules`

---

## Faz 2 - Ortak kütüphane (1 commit)

### 2.1. `src/lib/modules.ts` (yeni)

```ts
export const MODULE_KEYS = [
  "content","users","analytics","subscriptions","ads",
  "reviews","funnel","push","mail","social"
] as const;
export type ModuleKey = typeof MODULE_KEYS[number];

export const PROPERTY_TYPES = [
  "website","web_app","mobile_app","desktop_app","game"
] as const;
export type PropertyType = typeof PROPERTY_TYPES[number];

// Property type → default modül seti (MODULES.md §4 ile birebir aynı)
export const PRESET_MODULES: Record<PropertyType, ModuleKey[]> = {
  website:     ["content","analytics"],
  web_app:     ["users","analytics","subscriptions","funnel"],
  mobile_app:  ["users","analytics","subscriptions","ads","reviews","funnel","push"],
  desktop_app: ["users","analytics"],
  game:        ["users","analytics","ads","reviews","funnel","push"],
};

// Wizard'da gösterilecek opsiyoneller (preset değil ama eklenebilir)
export const OPTIONAL_MODULES: Record<PropertyType, ModuleKey[]> = {
  website:     ["funnel","mail","social"],
  web_app:     ["content","ads","push","mail"],
  mobile_app:  ["mail"],
  desktop_app: ["subscriptions","mail"],
  game:        ["subscriptions","mail"],
};

// Modül için Türkçe label + Lucide icon adı
export const MODULE_META: Record<ModuleKey, { label: string; icon: string; comingSoon?: boolean }> = {
  content:       { label: "İçerik (CMS)",  icon: "FileText" },
  users:         { label: "Müşteriler",    icon: "Users" },
  analytics:     { label: "Analitik",      icon: "LineChart" },
  subscriptions: { label: "Abonelik",      icon: "CreditCard" },
  ads:           { label: "Reklam",        icon: "Megaphone" },
  reviews:       { label: "Yorumlar",      icon: "Star" },
  funnel:        { label: "Huni",          icon: "Workflow" },
  push:          { label: "Push",          icon: "Send" },
  mail:          { label: "Mail",          icon: "Mail" },
  social:        { label: "Sosyal",        icon: "Share2", comingSoon: true },
};

// metrics.source → module mapping (MODULES.md §3.1)
export const SOURCE_TO_MODULE: Record<string, ModuleKey> = {
  revenuecat:        "subscriptions",
  stripe:            "subscriptions",
  admob:             "ads",
  posthog:           "analytics",
  plausible:         "analytics",
  supabase:          "users",
  app_store_connect: "reviews",
  resend:            "mail",
  sentry:            "analytics",
  rest:              "analytics",
};
```

### 2.2. `src/types/index.ts` (extend)

```ts
export interface Brand { id: string; name: string; slug: string; created_at: string; }
export interface Property {
  id: string;
  brand_id: string;
  name: string;
  slug: string;
  type: PropertyType;
  enabled_modules: ModuleKey[];
  app_store_id: string | null;
  app_store_country: string | null;
  created_at: string;
}
```

**Commit:** `feat(helm): WES-000 modules - modül kataloğu + property type + brand/property type`

---

## Faz 3 - Context / Hook (1 commit)

### 3.1. `src/context/scope.tsx` (refactor - silmiyoruz, genişletiyoruz)

Mevcut: `scope: "all" | string` (project_id).

Yeni:

```ts
export type ScopeValue =
  | { kind: "all" }                                      // tüm brand'ler agregat
  | { kind: "brand";    brand_id: string }               // brand agregat
  | { kind: "property"; brand_id: string; property_id: string };

interface ScopeContextValue {
  scope: ScopeValue;
  setScope: (s: ScopeValue) => void;
  // Geri-uyumluluk için legacy getter:
  legacyProjectId: string | null; // property_id veya null (Refine query'lerinde mevcut kullanım)
  isAll: boolean;
}
```

**Migration:** localStorage'da eski `helm-scope` ("all" | uuid) görüldüğünde `kind: "all"` veya `kind: "property"` olarak parse → `helm-scope-v2`'ye yaz. Eski key kalsın (downgrade için, 1 ay sonra sil).

### 3.2. `src/hooks/use-enabled-modules.ts` (yeni)

```ts
export function useEnabledModules(): ModuleKey[] {
  const { scope } = useScope();
  const { data: properties } = useList<Property>({ resource: "properties" });

  if (scope.kind === "all")     return unionAll(properties);
  if (scope.kind === "brand")   return unionByBrand(properties, scope.brand_id);
  return properties.find(p => p.id === scope.property_id)?.enabled_modules ?? [];
}

export function useIsModuleEnabled(key: ModuleKey): boolean {
  return useEnabledModules().includes(key);
}
```

**Commit:** `feat(helm): WES-000 scope - brand/property scope context + useEnabledModules hook`

---

## Faz 4 - Property create wizard (1 commit)

**Dosya:** `src/pages/projects/create.tsx` → `src/pages/properties/create.tsx` (move)

Mevcut form: name + slug (2 alan).
Yeni form: 4 adım (1 modal, multi-step):

```
Step 1 - Brand:
  RadioGroup (mevcut brand listesi) + "Yeni brand oluştur" → inline input

Step 2 - Property:
  Input name
  Input slug (slugify auto)
  RadioGroup type (5 seçenek, icon + açıklama)

Step 3 - Modüller:
  type seçildiği anda PRESET_MODULES[type] otomatik checked
  Tüm modüllerin Checkbox listesi (MODULE_META'dan label/icon)
  comingSoon olanlar disabled + badge "Yakında"
  OPTIONAL_MODULES vurgulu (subtle), gerisi normal
  PRESET değil ve type için anlamsız olanlar gizli

Step 4 - (sadece mobile_app/game ise):
  app_store_id input
  app_store_country select
```

Submit:
```ts
const { data: brand } = await supabase.from("brands")
  .insert({ name, slug })
  .select().single();  // veya mevcut brand_id kullan

await supabase.from("properties").insert({
  brand_id: brand.id, name, slug, type,
  enabled_modules: selectedModules,
  app_store_id, app_store_country,
});
```

**App.tsx route güncellemesi:**
- `/projects/create` → 301 redirect → `/properties/create`
- Yeni route: `/properties/create`, `/properties/edit/:id`, `/brands/edit/:id`
- Refine resource adı `projects` → `properties` (DB view geri-uyumlu olduğu için aşamalı geçiş mümkün)

**Commit:** `feat(helm): WES-000 properties - create wizard (brand + type + modules)`

---

## Faz 5 - Property settings (1 commit)

**Dosya:** `src/pages/properties/edit.tsx` (eski `src/pages/projects/edit.tsx`'tan move)

Üst bölüm (mevcut):
- name, slug, app_store_id, app_store_country

Yeni orta bölüm - **Modüller**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Modüller</CardTitle>
    <CardDescription>Bu property için aktif olan modüller. Kapalı modüllerin sayfaları sidebar'da gizlenir.</CardDescription>
  </CardHeader>
  <CardContent className="space-y-2">
    {MODULE_KEYS.map(key => (
      <div className="flex items-center justify-between" key={key}>
        <div className="flex items-center gap-2">
          <Icon name={MODULE_META[key].icon} className="size-4 opacity-60" />
          <span>{MODULE_META[key].label}</span>
          {MODULE_META[key].comingSoon && <Badge variant="muted">Yakında</Badge>}
        </div>
        <Switch
          checked={enabledModules.includes(key)}
          onCheckedChange={(v) => toggleModule(key, v)}
          disabled={MODULE_META[key].comingSoon}
        />
      </div>
    ))}
  </CardContent>
</Card>
```

Submit → `update properties set enabled_modules = $1 where id = $2`.

**Commit:** `feat(helm): WES-000 properties - settings sayfasında modül toggle`

---

## Faz 6 - Brand sayfası (1 commit, opsiyonel ama önerilen)

**Dosya:** `src/pages/brands/edit.tsx` (yeni)

- name, slug edit
- Alt: o brand'in property listesi (DataTable: name, type, modül sayısı, son sync)
- "Yeni property" butonu → `/properties/create?brand_id=X` (Step 1 atlanır)
- "Brand sil" → property'leri taşımayı şart koş (UI engelleme - bağlı property varsa silinemez, `on delete restrict` zaten engelliyor)

**App.tsx:** `brands` resource ekle.

**Commit:** `feat(helm): WES-000 brands - edit sayfası + property listesi`

---

## Faz 7 - Sidebar refactor (1 commit)

**Dosya:** `src/components/layout/index.tsx` (NAV_GROUPS'u dinamik yap)

Mevcut: hard-coded array (20 item, 6 grup).

Yeni:

```ts
type NavItem = { label: string; url: string; icon: string; requires?: ModuleKey | ModuleKey[] };
type NavGroup = { label: string; items: NavItem[]; alwaysVisible?: boolean };

const NAV_GROUPS: NavGroup[] = [
  { label: "Genel", alwaysVisible: true, items: [
      { label: "Cockpit", url: "/", icon: "LayoutDashboard" },
  ]},
  { label: "İçerik", items: [
      { label: "Şemalar",   url: "/cms/collections", icon: "Layers",    requires: "content" },
      { label: "İçerikler", url: "/cms/entries",     icon: "FileText",  requires: "content" },
      { label: "Medya",     url: "/cms/assets",      icon: "ImageIcon", requires: "content" },
  ]},
  { label: "CRM", items: [
      { label: "Kullanıcılar",     url: "/users",    icon: "Users",  requires: "users" },
      { label: "Segmentler",       url: "/segments", icon: "Filter", requires: "users" },
      { label: "Yorumlar",         url: "/reviews",  icon: "Star",   requires: "reviews" },
      { label: "Müdahale Geçmişi", url: "/audit",    icon: "History" }, // her zaman
  ]},
  { label: "Analitik", items: [
      { label: "Gelir & Reklam", url: "/revenue", icon: "TrendingUp", requires: ["subscriptions","ads"] },
      { label: "Büyüme",         url: "/growth",  icon: "LineChart",  requires: "analytics" },
      { label: "Huni",           url: "/funnel",  icon: "Workflow",   requires: "funnel" },
      { label: "Uyarılar",       url: "/alerts",  icon: "Bell" },     // her zaman
  ]},
  { label: "İletişim", items: [
      { label: "Mail",              url: "/mail",      icon: "Mail",      requires: "mail" },
      { label: "Push",              url: "/push",      icon: "Send",      requires: "push" },
      { label: "Sosyal",            url: "/social",    icon: "Share2",    requires: "social" },
      { label: "Kampanya Geçmişi",  url: "/campaigns", icon: "Megaphone", requires: ["mail","push"] },
  ]},
  { label: "DevOps", alwaysVisible: true, items: [
      { label: "Entegrasyonlar",  url: "/integrations", icon: "Plug" },
      { label: "Senkron & Sağlık", url: "/system",      icon: "Activity" },
      { label: "Loglar",           url: "/logs",        icon: "ScrollText" },
      { label: "Sürümler",         url: "/versions",    icon: "Tag" },
  ]},
  { label: "Sistem", alwaysVisible: true, items: [
      { label: "Ayarlar", url: "/settings", icon: "Settings" },
  ]},
];

// Render:
const enabled = useEnabledModules();
const visibleGroups = NAV_GROUPS.map(g => ({
  ...g,
  items: g.items.filter(i =>
    !i.requires ||
    (Array.isArray(i.requires) ? i.requires.some(r => enabled.includes(r)) : enabled.includes(i.requires))
  )
})).filter(g => g.alwaysVisible || g.items.length > 0);
```

**Saved context Quick Win #3 burada karşılanıyor:** 6 grup → 7 grup (İçerik ayrı çıktı), ama modül-aware filter sayesinde **görünür grup sayısı** çoğu property için 4-5'e düşüyor.

**Commit:** `feat(helm): WES-000 sidebar - modül-aware nav (requires + filter)`

---

## Faz 8 - Scope switcher refactor (1 commit)

**Dosya:** `src/components/layout/project-switcher.tsx` (rename + refactor)

Yeni iskelet:

```
[Brand: Dante     ▾]   ← brand listesi (ilk satır "Tüm brand'ler")
[Property: Mobile ▾]   ← seçili brand'in property'leri (ilk satır "Brand toplamı"; brand=All ise disabled)
```

Davranış:
- Brand değişince Property otomatik "Brand toplamı"na döner
- Brand=All ise Property select disabled + "Hepsi" göster
- localStorage'a `helm-scope-v2` JSON olarak yaz

**Commit:** `feat(helm): WES-000 scope switcher - brand + property 2-level select`

---

## Faz 9 - Dashboard cockpit modül filtresi (1 commit)

**Dosya:** `src/pages/dashboard/index.tsx`

KpiCell render'ında:
```tsx
const enabled = useEnabledModules();

{enabled.includes("subscriptions") ? (
  <KpiCell label="MRR" value={mrr} ... />
) : (
  <KpiPlaceholder label="MRR" reason="subscriptions modülü kapalı" />
)}
```

`KpiPlaceholder` yeni component - KpiCell ile aynı boyutta, ghost iskelet + "Modülü aç →" link.

**Aurora drift, pulse markers, map glass dokunulmaz.** Sadece KPI cell içeriği koşullu.

**Commit:** `feat(helm): WES-000 dashboard - modül-aware KPI cell + placeholder`

---

## Faz 10 - Eski URL'ler için redirect + temizlik (1 commit)

- `/projects` → `/properties` 301
- `/projects/create` → `/properties/create`
- `/projects/edit/:id` → `/properties/edit/:id`
- Refine resource `projects` kaldır (artık `properties`)
- DB view `public.projects` DROP (3 hafta sonra ayrı commit'te, kullanım izlendikten sonra)

**Commit:** `chore(helm): WES-000 projects route'ları properties'e taşı (redirect + resource cleanup)`

---

## Sıra dışı: paralel/blocked iş

- **CMS untracked dosyaları:** Saved context'te `src/components/cms/`, `src/pages/cms/`, `src/types/cms.ts` untracked. Bu PR'la **karışmasın** - ayrı commit'te önce CMS'i landed yap, sonra modül mimarisi PR'ı (CMS modülü = `content`, sidebar'da zaten yer ayrılıyor).
- **Phase 3 (saved context Quick Win 1 + 2):** Status strip pill gruplama + ZONE C chart label tipografi - modül PR'ından bağımsız, paralel yapılabilir.

---

## Commit zinciri (özet)

```
1. feat(helm): WES-000 0019 - brands tablosu + projects→properties rename + enabled_modules
2. feat(helm): WES-000 modules - modül kataloğu + property type
3. feat(helm): WES-000 scope - brand/property scope context + useEnabledModules hook
4. feat(helm): WES-000 properties - create wizard (brand + type + modules)
5. feat(helm): WES-000 properties - settings sayfasında modül toggle
6. feat(helm): WES-000 brands - edit sayfası + property listesi
7. feat(helm): WES-000 sidebar - modül-aware nav (requires + filter)
8. feat(helm): WES-000 scope switcher - brand + property 2-level select
9. feat(helm): WES-000 dashboard - modül-aware KPI cell + placeholder
10. chore(helm): WES-000 projects route'ları properties'e taşı (redirect + resource cleanup)
```

**Tahmin:** 10 commit, ~600-900 satır net diff. Her commit izole çalışabilir hale gelecek.

---

## Risk listesi

| Risk | Etki | Azaltma |
|---|---|---|
| `projects` view DROP edilince geri-uyumluluk biter | 17 Refine resource'unda hata | Faz 10'a kadar view kalsın, kullanım Sentry/logs üzerinden izle |
| `enabled_modules` text[] yerine enum array gerekti | Type-safety yarım | App-level TypeScript Zod schema, DB constraint sonra eklenebilir |
| Brand=All durumunda KPI agregasyonu yanlış sum (currency mismatch) | Yanlış MRR | `metrics.source` × currency override + `useScope().kind === "all"` durumunda currency normalize |
| Saved context'teki CMS untracked dosyaları wizard'ı tetiklemeden landed olmazsa | Sidebar "İçerik" grubu boş görünür | `content` modülü preset'te website için `✅`, mevcut data backfill SQL'inde Dante.com/Van için açık gelir |
| Mevcut Empire Inc projesi type=`mobile_app` default'la bağlanır ama Empire SaaS olabilir | KPI'lar yanlış modülde | Post-migration TODO 1: manuel `update properties set type = ...` doğru type'ları set et |

---

## Bitiş kriteri (DoD)

- [ ] 10 commit landed, CI yeşil
- [ ] Empire Inc dashboard eskiyle birebir aynı görünüyor (modül-aware refactor sonrası regresyon yok)
- [ ] Yeni Brand + Property oluşturma E2E çalışıyor (Dante markası + 3 property test edilebilir)
- [ ] Sidebar property'ye göre dinamik filtreliyor (website seçilince Push/Reviews gizli)
- [ ] Brand=All scope agregat KPI'lar gösteriyor
- [ ] `/projects/*` URL'leri `/properties/*`'a 301
