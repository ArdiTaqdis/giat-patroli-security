// Nama cache baru → ubah versi jika update file agar refresh otomatis
const CACHE_NAME = "patroli-v2";

// Daftar file yang WAJIB dicache agar PWA tetap jalan offline
const urlsToCache = [
  "/index.html",
  "/dashboard.html",
  "/form.html",
  "/pending.html",
  "/riwayat.html",
  "/style/style.css",
  "/js/form.js",
  "/js/pending.js",
  "/icon-192.png",
  "/icon-512.png",
];

// INSTALL: Cache semua file statis
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting(); // langsung aktif
});

// ACTIVATE: Hapus cache lama jika versi berubah
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keyList) =>
        Promise.all(
          keyList.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// FETCH: Strategi cache-first, fallback ke network
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Abaikan permintaan ke Google Apps Script (API backend) → selalu ambil dari network
  if (request.url.includes("script.google.com")) {
    return; // biarkan browser fetch normal
  }

  event.respondWith(
    caches.match(request).then(
      (response) =>
        response ||
        fetch(request).catch(() =>
          // fallback opsional: jika offline dan file tidak ada di cache
          caches.match("/index.html")
        )
    )
  );
});
