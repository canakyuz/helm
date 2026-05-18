#!/usr/bin/env node
// AdMob refresh_token üretici — TEK SEFERLİK çalıştırılır.
// AdMob API service account desteklemediği için bir kez kullanıcı onayıyla
// refresh_token alınır; helm-ingest connector'ı bununla access_token tazeler.
//
// Önkoşul: Google Cloud Console'da "Desktop app" tipi OAuth client oluştur.
// Kullanım:  node scripts/admob-oauth.mjs <CLIENT_ID> <CLIENT_SECRET>

import http from "node:http";
import { URL } from "node:url";

const CLIENT_ID = process.env.ADMOB_CLIENT_ID || process.argv[2];
const CLIENT_SECRET = process.env.ADMOB_CLIENT_SECRET || process.argv[3];
const PORT = 4321;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/admob.readonly";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Kullanım: node scripts/admob-oauth.mjs <CLIENT_ID> <CLIENT_SECRET>",
  );
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline", // refresh_token için şart
    prompt: "consent", // her seferinde refresh_token döndür
  });

console.log("\n1) Şu URL'yi tarayıcıda aç ve Google hesabınla izin ver:\n");
console.log(authUrl + "\n");

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, REDIRECT_URI).searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("code parametresi yok");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Tamam! Terminale geri dönebilirsin.");
  server.close();

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const data = await tokenRes.json();

  if (data.refresh_token) {
    console.log("\n✅ refresh_token:\n");
    console.log(data.refresh_token + "\n");
    console.log(
      "Panelde AdMob entegrasyonu eklerken 'Refresh Token' alanına yapıştır.\n",
    );
  } else {
    console.error(
      "\n❌ refresh_token alınamadı. Yanıt:\n",
      JSON.stringify(data, null, 2),
    );
  }
  process.exit(0);
});

server.listen(PORT, () =>
  console.log(`2) Yetkilendirme bekleniyor (localhost:${PORT})...\n`),
);
