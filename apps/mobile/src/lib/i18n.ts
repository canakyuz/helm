import { preferences, usePreferences, type Language } from "~/lib/preferences";

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

  // Accent aile adlari - kaynak @helm/design/accents.ts, orada tek dil.
  "Camgöbeği": "Cyan",
  "İndigo": "Indigo",
  "Pembe": "Pink",
  "Yeşil": "Green",

  // Form
  "opsiyonel": "optional",
  "Kaydediliyor…": "Saving…",
  "Eksik zorunlu alan: {list}": "Missing required field: {list}",
  "••••••••  kayıtlı - değiştirmek için yeni değer gir":
    "••••••••  saved - enter a new value to replace it",

  // Giris
  "E-posta ve en az 6 karakter şifre gir.":
    "Enter your email and a password of at least 6 characters.",
  "E-posta veya şifre hatalı.": "Incorrect email or password.",
  "E-POSTA": "EMAIL",
  "GİRİŞ YAP": "SIGN IN",
  "Cockpit'in cep yoldaşı. Portföyün, kuruşuna kadar.":
    "Your cockpit's pocket companion. Your portfolio, down to the cent.",

  // Ekran basliklari ve yukleme/bos durumlari
  "ANALİZ": "ANALYTICS",
  "SAĞLIK": "HEALTH",
  "GELİR": "REVENUE",
  "PORTFÖY": "PORTFOLIO",
  "Yükleniyor…": "Loading…",
  "YÜKLENİYOR…": "LOADING…",
  "Analiz yüklenemedi": "Couldn't load analytics",
  "Cockpit yüklenemedi": "Couldn't load the cockpit",
  "Gelir yüklenemedi": "Couldn't load revenue",
  "ÜLKE VERİSİ YOK": "NO COUNTRY DATA",
  "AÇIK CRASH YOK": "NO OPEN CRASHES",
  "SÜRÜM KAYDI YOK": "NO VERSION HISTORY",
  "HENÜZ İŞLEM YOK": "NO TRANSACTIONS YET",
  "BU DÖNEMDE ÖDEME YOK": "NO PAYOUTS THIS PERIOD",
  "FPS ÖLÇÜMÜ YOK": "NO FPS SAMPLES",
  "PLATFORM VERİSİ YOK": "NO PLATFORM DATA",
  "KUR YÜKLENIYOR": "LOADING RATES",

  // Analiz
  "Kullanıcılar": "Users",
  "Oyun akışı": "Game flow",
  "Mağaza açıldı": "Store opened",
  "Satın alma": "Purchase",
  "Satın alındı": "Purchased",
  "ne yapıyorlar": "what they're doing",
  "mağaza açılışı ölçülmüyor": "store opens aren't tracked",
  "Akış · {name}": "Flow · {name}",
  "dönüşüm {rate}": "conversion {rate}",
  "· yapışkanlık {value}": "· stickiness {value}",

  // Saglik
  "Kararlılık": "Stability",
  "Reklam arızası": "Ad failures",
  "Sağlıklı": "Healthy",
  "Zayıflamış": "Degraded",
  "GÖSTERİM / TOPLAM": "IMPRESSIONS / TOTAL",
  "hatasız": "no errors",
  "tümü kapandı": "all closed",
  "{n} oturum kapanmadı · {rate}": "{n} sessions never closed · {rate}",
  "bitiş sayısı başlangıçtan fazla - ölçüm hatalı":
    "more ends than starts - the measurement is wrong",

  // Ozet
  "BUGÜN · GELİR": "TODAY · REVENUE",
  "Tüm projeler": "All projects",
  "Tüm Projeler": "All Projects",
  "Proje seç": "Pick a project",
  "Çöz": "Resolve",
  "ölçüm yok": "not measured",
  "· {n} modül": "· {n} modules",

  // Gelir
  "Kazanç": "Earnings",
  "Uygulama içi": "In-app",
  "anlık": "live",
  "{n} gösterim": "{n} impressions",
  "DOĞRULANDI": "RECONCILED",
  "MAĞAZA": "STORE",
  "UYUŞMUYOR": "MISMATCH",
  "DÜN": "YESTERDAY",
  "GEÇEN AY": "LAST MONTH",

  // Uyarilar
  "altında": "below",
  "üstünde": "above",
  "artış": "rise",
  "düşüş": "drop",
  "Açık alert": "Open alerts",
  "Toplam kullanıcı": "Total users",
  "Yeni kullanıcı": "New users",

  // Telemetri
  "En düşük fps": "Lowest fps",
  "p95 düşük fps": "p95 low fps",
  "en kötü": "worst",
  "{n} ÖLÇÜM": "{n} SAMPLES",

  // Baslik seridi
  "SÜRÜYOR": "RUNNING",
  "Senkronizasyon sürüyor": "Sync in progress",
  "Son güncelleme saat {clock}": "Last updated at {clock}",

  // Yorum yaniti
  "Yanıt Yaz": "Write a reply",
  "Yanıtı Düzenle": "Edit reply",
  "Yanıtınız…": "Your reply…",
  "Gönder": "Send",
  "Gönderiliyor…": "Sending…",
  "Yanıt gönderildi": "Reply sent",
  "Yanıt gönderilemedi": "Couldn't send the reply",

  // Kaynak yonetimi bildirimleri
  "Kaynak bağlandı": "Source connected",
  "Kaynak bağlanamadı": "Couldn't connect the source",
  "Kaynak kaldırıldı": "Source removed",
  "Kaldırılamadı": "Couldn't remove it",
  "Durum değiştirilemedi": "Couldn't change the status",
  "Hedef güncellendi": "Goal updated",
  "· kapalı": "· off",

  // labels.ts - property tipi ve durumu
  "Uygulama": "App",
  "Oyun": "Game",
  "Masaüstü": "Desktop",
  "sağlıklı": "healthy",
  "veri bayat": "stale data",
  "kapalı": "down",
  "bilinmiyor": "unknown",

  // labels.ts - ay adlari. Tarih bicimleyici bunlari anahtar olarak gecirir.
  "Ocak": "January",
  "Şubat": "February",
  "Mart": "March",
  "Nisan": "April",
  "Mayıs": "May",
  "Haziran": "June",
  "Temmuz": "July",
  "Ağustos": "August",
  "Eylül": "September",
  "Ekim": "October",
  "Kasım": "November",
  "Aralık": "December",
  "Oca": "Jan",
  "Şub": "Feb",
  "Nis": "Apr",
  "Haz": "Jun",
  "Tem": "Jul",
  "Ağu": "Aug",
  "Eyl": "Sep",
  "Eki": "Oct",
  "Kas": "Nov",
  "Ara": "Dec",

  // Dil secici - kendi adlari
  "Türkçe": "Turkish",
  "İngilizce": "English",

  // Bos durumlar ve baslik seridi kalanlari
  "KAYNAKLAR": "SOURCES",
  "OYUN OLAYI YOK": "NO GAME EVENTS",
  "SATIN ALMA OLAYI YOK": "NO PURCHASE EVENTS",
  "OTURUM OLAYI YOK": "NO SESSION EVENTS",
  "REKLAM OLAYI YOK": "NO AD EVENTS",
  "ENTEGRASYON YOK": "NO INTEGRATIONS",
  "Entegrasyonlar": "Integrations",

  "SON": "LAST",

  // Sekme cubugu
  "Özet": "Overview",
  "Gelir": "Revenue",
  "Kullanıcı": "Users",
  "Sağlık": "Health",
  "Ayar": "Settings",

  // Kart basliklari - tirnaksiz JSX metni oldugu icin ilk taramada kacmisti
  "Sürümler": "Versions",
  "Ödemeler": "Payouts",
  "Platformlar": "Platforms",
  "Dikkat gerekiyor": "Needs attention",
  "Crash'ler": "Crashes",
  "ANLIK / KESİN": "LIVE / SETTLED",
  "ŞİFRE": "PASSWORD",
  "Veri yok": "No data",
  "Kritik": "Critical",
  "Bilinmiyor": "Unknown",
  "kesin": "settled",
  "{month} hedefi": "{month} goal",
  "CRASH-FREE OTURUM": "CRASH-FREE SESSIONS",
  "{issues} aktif sorun · {fatal} fatal · {events} olay":
    "{issues} active issues · {fatal} fatal · {events} events",
  "Ölçüm şüpheli": "Measurement suspect",
  "Aşağıdakiler kullanıcı davranışı değil, eksik veya hatalı olay gönderimi.":
    "These are not user behaviour - they are missing or malformed event reporting.",
  "Oturum kapanma": "Session closure",
  "{platform}: {started} oturum başladı, hiçbiri kapanmadı":
    "{platform}: {started} sessions started, none closed",
  "{platform}: bitiş ({ended}) başlangıçtan ({started}) fazla":
    "{platform}: more ends ({ended}) than starts ({started})",
  "Oyun bitişi ({overs}) başlangıçtan ({starts}) fazla - başlangıç olayı eksik":
    "More game-overs ({overs}) than starts ({starts}) - the start event is missing",
  "TOPLAM GELİR": "TOTAL REVENUE",
  "Ay": "Month",
  "Hafta": "Week",
  "{label} · {n} gün": "{label} · {n} days",
  "ABONE": "SUBS",
  "Reklam": "Ads",
  "Abonelik": "Subscription",
  "doluluk {rate}": "fill {rate}",
  "DOLULUK {rate}": "FILL {rate}",
  "Reklam ekonomisi": "Ad economics",
  "Banner": "Banner",
  "Geçiş": "Interstitial",
  "Ödüllü": "Rewarded",
  "Ödüllü · devam": "Rewarded · continue",
  "Ödüllü · günlük ×2": "Rewarded · daily ×2",
  "Açılış": "App open",
  "GÜNLÜK AKTİF KULLANICI": "DAILY ACTIVE USERS",
  "CANLI": "LIVE",
  "Klasik başlatıldı": "Classic started",
  "Günlük başlatıldı": "Daily started",
  "Zamanlı başlatıldı": "Timed started",
  "Oyun bitti": "Game over",
  "Devam edildi": "Continue used",
  "Görevler açıldı": "Quests opened",
  "Ustalık seviyesi": "Mastery level up",
  "Günlük çözüldü": "Daily solved",
  "Yeni abonelik": "New subscription",
  "Yenileme": "Renewal",
  "Tek seferlik": "One-off",
  "İptal geri alındı": "Uncancelled",
  "Plan değişikliği": "Plan change",
  "İptal": "Cancellation",
  "Süresi doldu": "Expired",
  "Ödeme sorunu": "Billing issue",

  // Goreli zaman - birim basina anahtar (bkz. src/lib/format.ts)
  "şimdi": "just now",
  "az sonra": "in a moment",
  "{n} sn önce": "{n}s ago",
  "{n} dk önce": "{n}m ago",
  "{n} sa önce": "{n}h ago",
  "{n} g önce": "{n}d ago",
  "{n} h önce": "{n}w ago",
  "{n} ay önce": "{n}mo ago",
  "{n} y önce": "{n}y ago",
  "{n} sn sonra": "in {n}s",
  "{n} dk sonra": "in {n}m",
  "{n} sa sonra": "in {n}h",
  "{n} g sonra": "in {n}d",
  "{n} h sonra": "in {n}w",
  "{n} ay sonra": "in {n}mo",
  "{n} y sonra": "in {n}y",
  "ping yok": "no ping",

  // Entegrasyon form alanlari - kaynak @helm/domain/integrations.ts
  "App Store ID (App Store URL'inde id sonrası rakam - yorumlar için)":
    "App Store ID (the number after `id` in the App Store URL - used for reviews)",
  "App Store ülke kodları (virgülle ayır - yorumlar için)":
    "App Store country codes (comma-separated - used for reviews)",
  "CRM tabloları (virgülle ayır, opsiyonel `tablo:kolon`)":
    "CRM tables (comma-separated, optional `table:column`)",
  "Fiyat ondalığı (hep .99 ise - MRR kuruşunu RC yuvarlamasına rağmen ekler)":
    "Price decimal (if prices always end in .99 - restores the cents RevenueCat rounds off)",
  "Gönderen adı":
    "Sender name",
  "Gönderen e-posta (Resend'de doğrulanmış domain)":
    "Sender email (must be a domain verified in Resend)",
  "Host (self-hosted için)":
    "Host (for self-hosted)",
  "Huni adımları (virgülle ayır, event adları)":
    "Funnel steps (comma-separated event names)",
  "Issuer ID (Team Key için - Individual API Key'de BOŞ bırak)":
    "Issuer ID (for a Team Key - leave EMPTY for an Individual API Key)",
  "Package Name (opsiyonel - boşsa properties.google_play_id'den okunur)":
    "Package name (optional - falls back to properties.google_play_id)",
  "Para birimi (ISO kodu - RC raporlama, genelde USD)":
    "Currency (ISO code - RevenueCat reporting, usually USD)",
  "Para birimi (ISO kodu - TRY/USD/EUR)":
    "Currency (ISO code - TRY/USD/EUR)",
  "Private Key (.p8 içeriği - BEGIN/END dahil)":
    "Private key (.p8 contents - including BEGIN/END)",
  "Proceeds para birimi (ISO kodu)":
    "Proceeds currency (ISO code)",
  "Proje slug":
    "Project slug",
  "Service Account JSON (Google Cloud → IAM → Service Accounts → Keys → CREATE → JSON; içeriğin TAMAMINI yapıştır)":
    "Service account JSON (Google Cloud → IAM → Service Accounts → Keys → CREATE → JSON; paste the WHOLE file)",
  "Site ID (alan adı)":
    "Site ID (domain)",
  "Yorum çeviri dilleri (virgülle, opsiyonel - reviews için, versions etkilenmez)":
    "Review translation languages (comma-separated, optional - affects reviews, not versions)",
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

/**
 * React disi kod icin ceviri - hook cagrilamayan yerler: mutation `onSuccess`
 * toast'lari, olay isleyicileri, saf yardimci fonksiyonlar.
 *
 * NEDEN AYRI: `useT` bir hook, kural geregi bilesen govdesi disinda cagrilamaz.
 * Bu surum dili cagri aninda MMKV'den okur; abonelik yok, cunki bir toast zaten
 * tek seferlik cizilir - dil degisiminde yeniden cevrilecek bir sey kalmaz.
 */
/**
 * Aktif dilin BCP-47 etiketi - buyuk/kucuk harf ve tarih donusumleri icin.
 *
 * NEDEN CEVIRI TABLOSUNDAN DEGIL: tablo Turkce moddaki her anahtari oldugu gibi
 * geri veriyor, yani "__locale__" gibi bir anahtar TR'de dizginin kendisi olarak
 * donerdi ve `toLocaleUpperCase("__locale__")` patlardi.
 */
export function currentLocale(): string {
  return preferences.get().language === "tr" ? "tr-TR" : "en-US";
}

export function tr(key: string, vars?: TranslateVars): string {
  return translate(preferences.get().language, key, vars);
}
