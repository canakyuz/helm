import { usePreferences, type Language } from "~/lib/preferences";

/**
 * Arayuz cevirisi.
 *
 * ANAHTAR = TURKCE KAYNAK DIZGI. Uydurulmus anahtar (`settings.title`) yerine
 * dizginin kendisi kullaniliyor. Gerekcesi:
 *   - TR ciktisi birebir degismeden gecer → gorsel regresyon riski sifir.
 *   - 160+ anahtar uydurmak ve akilda tutmak gerekmez.
 *   - Eksik ceviri INGILIZCEDE TURKCEYE duser: ekran bozulmaz, sadece
 *     cevrilmemis gorunur. Sessiz bos string riski yok.
 * Bedeli: TR metni degistirince EN karsiligi duser. Tek gelistiricili bir
 * uygulamada kabul edilebilir ve fark edilebilir bir maliyet.
 *
 * Yer tutucu: `t("{n} bağlı", { n: 4 })`.
 *
 * KAPSAM DISI: `PROVIDER_FIELDS` etiketleri (@helm/domain, 45 alan) hala yalniz
 * Turkce. Onlar web ile ortak ve ceviri katmani orada yok; ayri bir is.
 */

const EN: Record<string, string> = {
  // Hub
  "SİSTEM": "SYSTEM",
  "Ayarlar": "Settings",
  "Kişisel çalışma alanı": "Personal workspace",
  "{n} PROJE · {m} KAYNAK": "{n} PROJECTS · {m} SOURCES",
  "Görünüm": "Appearance",
  "tema ve vurgu rengi": "theme and accent colour",
  "Veri ve biçim": "Data and format",
  "para birimi, hedef, çarpan": "currency, goal, multiplier",
  "Kaynaklar": "Sources",
  "bağlı entegrasyonlar": "connected integrations",
  "Hakkında": "About",
  "sürüm ve senkron durumu": "version and sync status",
  "Çıkış yap": "Sign out",
  "Tekrar girmek için e-posta bağlantısı gerekecek.":
    "You will need an email link to sign in again.",
  "Vazgeç": "Cancel",
  "{n} bağlı": "{n} connected",
  "{n} bağlı · {m} hata": "{n} connected · {m} failing",

  // Gorunum
  "AYARLAR": "SETTINGS",
  "Tema": "Theme",
  "sistem / koyu / açık": "system / dark / light",
  "Vurgu rengi": "Accent colour",
  "dolgu ve aktif durumlar": "fills and active states",
  "Dil": "Language",
  "arayüz dili": "interface language",
  "Sistem": "System",
  "Koyu": "Dark",
  "Açık": "Light",

  // Veri
  "Para birimi": "Currency",
  "tüm tutarlar bu birime çevrilir": "all amounts are converted to this currency",
  "Aylık gelir hedefi": "Monthly revenue goal",
  "Belirle": "Set",
  "Gelir çarpanı": "Revenue multiplier",
  "yalnızca yerel gösterim": "local display only",
  "Gelir önceliği": "Revenue priority",
  "gelir sorgusu önce yüklensin": "load the revenue query first",
  "Aylık gelir hedefi ({cur})": "Monthly revenue goal ({cur})",
  "Tutarı {cur} cinsinden gir. İlerleme ayın gerçek gelir toplamından hesaplanır. Para birimini değiştirmek için önce yukarıdan seç.":
    "Enter the amount in {cur}. Progress is computed from the month's actual revenue. To change the currency, pick it above first.",
  "1 ile 100 arası bir değer. Yalnızca yerel gösterimi etkiler, veriyi değiştirmez.":
    "A value between 1 and 100. Affects local display only, it does not change the data.",
  "{p} bağlantısı ve ayarları silinecek. Toplanmış metrikler kalır.":
    "The {p} connection and its settings will be deleted. Collected metrics remain.",

  // Kaynaklar
  "YÜKLENİYOR": "LOADING",
  "KAYNAKLAR OKUNAMADI": "COULD NOT LOAD SOURCES",
  "HENÜZ KAYNAK YOK": "NO SOURCES YET",
  "Yeni kaynak bağla": "Connect a new source",
  "HATA": "FAILING",
  "BEKLİYOR": "PENDING",
  " · kapalı": " · off",
  "KAYNAK": "SOURCE",
  "Kaynak": "Source",
  "Etkin": "Enabled",
  "senkrona dahil": "included in sync",
  "senkron dışı": "excluded from sync",
  "Son senkron hatası": "Last sync error",
  "Kaydet": "Save",
  "Kaynağı kaldır": "Remove source",
  "KAYNAK OKUNAMADI": "COULD NOT LOAD SOURCE",
  "Yeni kaynak": "New source",
  "PROJE": "PROJECT",
  "ÖNCE PROJE GEREKLİ": "A PROJECT IS REQUIRED FIRST",
  "SAĞLAYICI": "PROVIDER",
  "Bağla": "Connect",
  "Devam etmek için proje seç.": "Select a project to continue.",
  "Devam etmek için sağlayıcı seç.": "Select a provider to continue.",
  "Kaldır": "Remove",

  // Hakkinda
  "Sürüm": "Version",
  "Son senkron": "Last sync",
  "Son 24 saat": "Last 24 hours",
  "{n} tur": "{n} runs",
  "Projeler": "Projects",
  "Uyarı kuralları": "Alert rules",

  // Accent aile adlari — kaynak @helm/design/accents.ts, orada tek dil.
  "Camgöbeği": "Cyan",
  "İndigo": "Indigo",
  "Pembe": "Pink",
  "Yeşil": "Green",

  // Form
  "opsiyonel": "optional",
  "Kaydediliyor…": "Saving…",
  "Eksik zorunlu alan: {list}": "Missing required field: {list}",
  "••••••••  kayıtlı — değiştirmek için yeni değer gir":
    "••••••••  saved — enter a new value to replace it",
};

export type TranslateVars = Record<string, string | number>;

export function translate(lang: Language, key: string, vars?: TranslateVars): string {
  // TR kaynak dil: tablo aranmaz, dizgi oldugu gibi doner.
  const base = lang === "en" ? (EN[key] ?? key) : key;
  if (vars == null) return base;
  return base.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** Ekranlarda kullanilan hook. Dil degisince tum ekran yeniden cizilir. */
export function useT() {
  const { language } = usePreferences();
  return (key: string, vars?: TranslateVars) => translate(language, key, vars);
}
