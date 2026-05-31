// ISO 3166-1 alpha-2 → approximate country centroid + display name.
// Subset of common countries; unknown codes return null (caller skips the marker).

export type CountryGeo = { lat: number; lng: number; name: string };

const TABLE: Record<string, CountryGeo> = {
  US: { lat: 39.8, lng: -98.6, name: "United States" },
  TR: { lat: 39.0, lng: 35.2, name: "Türkiye" },
  DE: { lat: 51.2, lng: 10.4, name: "Germany" },
  GB: { lat: 54.0, lng: -2.0, name: "United Kingdom" },
  FR: { lat: 46.6, lng: 2.2, name: "France" },
  BR: { lat: -14.2, lng: -51.9, name: "Brazil" },
  JP: { lat: 36.2, lng: 138.3, name: "Japan" },
  IN: { lat: 22.6, lng: 79.0, name: "India" },
  CA: { lat: 56.1, lng: -106.3, name: "Canada" },
  AU: { lat: -25.3, lng: 133.8, name: "Australia" },
  NL: { lat: 52.1, lng: 5.3, name: "Netherlands" },
  ES: { lat: 40.2, lng: -3.7, name: "Spain" },
  IT: { lat: 41.9, lng: 12.6, name: "Italy" },
  RU: { lat: 61.5, lng: 105.3, name: "Russia" },
  MX: { lat: 23.6, lng: -102.5, name: "Mexico" },
  ID: { lat: -0.8, lng: 113.9, name: "Indonesia" },
  KR: { lat: 35.9, lng: 127.8, name: "South Korea" },
  SA: { lat: 23.9, lng: 45.1, name: "Saudi Arabia" },
  AE: { lat: 23.4, lng: 53.8, name: "UAE" },
  PL: { lat: 51.9, lng: 19.1, name: "Poland" },
  SE: { lat: 60.1, lng: 18.6, name: "Sweden" },
  AR: { lat: -38.4, lng: -63.6, name: "Argentina" },
  EG: { lat: 26.8, lng: 30.8, name: "Egypt" },
  ZA: { lat: -30.6, lng: 22.9, name: "South Africa" },
  NG: { lat: 9.1, lng: 8.7, name: "Nigeria" },
};

export function countryGeo(code: string): CountryGeo | null {
  return TABLE[code?.toUpperCase()?.trim()] ?? null;
}

// ISO 3166-1 alpha-2 → flag emoji (regional indicator symbols).
export function countryFlag(code: string): string {
  const cc = code?.toUpperCase().trim();
  if (!cc || cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return "🏳️";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
