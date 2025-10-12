// ===============================
// 🚀 GIAT PATROLI SERVICE WORKER (FINAL CLEAN MERGE)
// ===============================

// 🔑 Ambil base URL otomatis agar aman di root / subfolder
const BASE_URL = self.registration.scope;

// 🧩 Ganti versi cache setiap kali update file agar auto refresh
const CACHE_NAME = "patroli-v7.13";

// ✅ Daftar file penting untuk offline mode
const STATIC_FILES = [
  "index.html",
  "login.html",
  "dashboard/dashboard.html",
  "pages/form.html",
  "pages/pending.html",
  "pages/jadwalpatroli.html",
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

// Tambahkan BASE_URL agar tetap valid di hosting subfolder
const STATIC_ASSETS = STATIC_FILES.map((f) => new URL(f, BASE_URL).toString());

// ===============================
// 📦 INSTALL — cache semua file statis
// ===============================
self.addEventListener("install", (event) => {
  console.log("📦 SW: Install event — caching static files...");
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of STATIC_ASSETS) {
        try {
          await cache.add(url);
          console.log("✅ Cached:", url);
        } catch (err) {
          console.warn("⚠️ Gagal cache:", url, err);
        }
      }
    })
  );
  self.skipWaiting(); // langsung aktif
});

// ===============================
// ♻️ ACTIVATE — hapus cache lama & klaim client
// ===============================
self.addEventListener("activate", (event) => {
  console.log("♻️ SW: Activate — membersihkan cache lama...");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🗑️ Hapus cache lama:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );

  // 🔥 Kirim notifikasi update ke semua tab aktif
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => client.postMessage({ type: "UPDATE_READY" }));
  });

  self.clients.claim(); // langsung klaim kontrol tab
});

// ===============================
// 🌐 FETCH — dynamic cache + fallback offline
// ===============================
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = req.url;

  // ⚙️ Bypass cache untuk API & halaman sensitif (login, dashboard)
  if (
    url.includes("script.google.com") ||
    url.includes("login.html") ||
    url.includes("dashboard.html")
  ) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // 🧠 Cache-first dengan fallback network
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      return (
        cachedRes ||
        fetch(req)
          .then((networkRes) => {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              if (req.method === "GET" && req.url.startsWith("http")) {
                cache.put(req, clone);
              }
            });
            return networkRes;
          })
          .catch(() => caches.match(new URL("index.html", BASE_URL).toString()))
      );
    })
  );
});

// ===============================
// 🔁 AUTO REFRESH
// ===============================
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    console.log("⚡ SW: Skip waiting — activating update now...");
    self.skipWaiting();
  }
});

// ===============================
// 💡 NOTIFIKASI UPDATE
// ===============================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        client.postMessage({ type: "NEW_VERSION_AVAILABLE" });
      }
    })()
  );
});
