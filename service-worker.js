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
self.addEventListener("install", (event) => {
  console.log("📦 SW: Install event — caching static files...");
  event.waitUntil(
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
