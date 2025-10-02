// 🔑 Ambil base URL otomatis biar aman di root / subfolder
const BASE_URL = self.registration.scope;

const CACHE_NAME = "patroli-dynamic-v4"; // ⬅️ Ganti versi di sini kalau ada update

// Semua halaman inti + asset penting
const STATIC_FILES = [
  "index.html",
  "login.html",
  "dashboard/dashboard.html",
  "pages/form.html",
  "pages/pending.html",
  "pages/riwayat.html",
  "pages/settings.html",
  "pages/panduan.html",
  "pages/notifikasi.html",

  "style/style.css",
  "style/loading.css",
  "style/table-page.css",
  "dashboard/dashboard.css",
  "admin.css",

  "js/form.js",
  "js/pending.js",
  "js/utils.js",

  "manifest.json",
  "icon-192.png",
  "icon-512.png",
];

// Tambahkan base url ke semua path
const STATIC_ASSETS = STATIC_FILES.map((f) => new URL(f, BASE_URL).toString());

// ✅ Install: cache semua file inti
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ✅ Activate: hapus cache lama & notif update
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );

  // 🔥 Kirim pesan ke semua tab kalau versi baru aktif
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => client.postMessage({ type: "UPDATE_READY" }));
  });

  self.clients.claim();
});

// ✅ Fetch: dynamic cache + fallback
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Abaikan API backend (Google Apps Script)
  if (request.url.includes("script.google.com")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((response) => {
      return (
        response ||
        fetch(request)
          .then((resp) => {
            // Simpan ke cache
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return resp;
          })
          .catch(() => caches.match(new URL("index.html", BASE_URL).toString()))
      );
    })
  );
});
