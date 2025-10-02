const CACHE_NAME = "patroli-dynamic-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/login.html",
  "/dashboard/dashboard.html",
  "/pages/form.html",
  "/pages/pending.html",
  "/pages/riwayat.html",
  "/pages/settings.html",
  "/pages/panduan.html",
  "/pages/notifikasi.html",
  "/style/style.css",
  "/style/loading.css",
  "/style/table-page.css",
  "/dashboard/dashboard.css",
  "/admin.css",
  "/js/form.js",
  "/js/pending.js",
  "/js/utils.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Install → cache aset dasar
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate → hapus cache lama
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
      )
  );
  self.clients.claim();
});

// Fetch → dynamic cache
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Jangan cache API backend (Google Apps Script)
  if (request.url.includes("script.google.com")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((response) => {
      return (
        response ||
        fetch(request)
          .then((resp) => {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return resp;
          })
          .catch(() => caches.match("/index.html")) // fallback tetap index
      );
    })
  );
});
