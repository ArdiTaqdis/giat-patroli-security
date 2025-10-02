// Nama cache baru → ubah versi jika update file agar refresh otomatis
const CACHE_NAME = "patroli-v4";

// Daftar file statis yang wajib dicache
const urlsToCache = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/form.html",
  "/pending.html",
  "/riwayat.html",
  "/style/style.css",
  "/style/loading.css",
  "/style/table-page.css",
  "/js/form.js",
  "/js/pending.js",
  "/js/utils.js",
  "/icon-192.png",
  "/icon-512.png",
  "/offline.html", // ✅ fallback page
];

// INSTALL → cache semua file statis
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// ACTIVATE → hapus cache lama jika versi berubah
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// FETCH
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Abaikan request ke Google Apps Script (API backend)
  if (request.url.includes("script.google.com")) {
    return;
  }

  // Jika request adalah HTML → pakai strategi network-first
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (resp) => resp || caches.match("/offline.html") // ✅ fallback offline
          )
        )
    );
    return;
  }

  // Untuk asset (CSS, JS, Icon) → pakai strategi cache-first
  event.respondWith(
    caches.match(request).then(
      (response) =>
        response ||
        fetch(request).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return resp;
        })
    )
  );
});
