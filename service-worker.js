<<<<<<< HEAD
// ===============================
// 🚀 GIAT PATROLI SERVICE WORKER
// ===============================

// 🧩 Ganti versi ini setiap kali update file, supaya cache auto refresh
const CACHE_NAME = "patroli-v4.1";

// 🧩 File yang wajib dicache untuk offline mode
const urlsToCache = [
  "./index.html",
  "./login.html",
  "./dashboard/dashboard.html",
  "./pages/form.html",
  "./pages/pending.html",
  "./pages/jadwalpatroli.html",
  "./style/style.css",
  "./js/form.js",
  "./js/pending.js",
  "./icon-192.png",
  "./icon-512.png",
];

// ===============
// 📦 INSTALL
// ===============
=======
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
>>>>>>> d116ae6fad36c7873ab10e5bc6e8df9677b169a8
self.addEventListener("install", (event) => {
  console.log("📦 SW: Install event — caching static files...");
  event.waitUntil(
<<<<<<< HEAD
    caches.open(CACHE_NAME).then(async (cache) => {
      for (let url of urlsToCache) {
        try {
          await cache.add(url);
          console.log("✅ Cached:", url);
        } catch (err) {
          console.warn("⚠️ Gagal cache:", url, err);
        }
      }
    })
  );
  self.skipWaiting(); // 🔁 Langsung aktif
});

// ===============
// 🧹 ACTIVATE
// ===============
=======
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ✅ Activate: hapus cache lama & notif update
>>>>>>> d116ae6fad36c7873ab10e5bc6e8df9677b169a8
self.addEventListener("activate", (event) => {
  console.log("♻️ SW: Activate — membersihkan cache lama...");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
<<<<<<< HEAD
            console.log("🗑️ Hapus cache lama:", key);
=======
>>>>>>> d116ae6fad36c7873ab10e5bc6e8df9677b169a8
            return caches.delete(key);
          }
        })
      )
    )
<<<<<<< HEAD
=======
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
>>>>>>> d116ae6fad36c7873ab10e5bc6e8df9677b169a8
  );

  // ⚡ Auto-claim agar SW baru langsung aktif
  self.clients.claim();
});

// ===============
// 🌐 FETCH HANDLER
// ===============
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

  // 🧠 Cache-first untuk file statis, fallback ke network
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      return (
        cachedRes ||
        fetch(req)
          .then((networkRes) => {
            // Cache file baru (stale-while-revalidate)
            return caches.open(CACHE_NAME).then((cache) => {
              if (req.method === "GET" && req.url.startsWith("http")) {
                cache.put(req, networkRes.clone());
              }
              return networkRes;
            });
          })
          .catch(() => caches.match("/index.html"))
      );
    })
  );
});

// ===============
// 🔁 AUTO REFRESH
// ===============
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    console.log("⚡ SW: Skip waiting — activating update now...");
    self.skipWaiting();
  }
});

// ===============
// 💡 NOTIFIKASI UPDATE
// ===============
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
