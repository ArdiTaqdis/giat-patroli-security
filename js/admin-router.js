// js/admin-router.js (FINAL FIXED CLEAN SYNC VERSION)
// import dashboard, { unloadDashboard } from "./admin-dashboard.js";
import dashboard, { unloadDashboard } from "./admin-dashboard-command.js";
import {
  loadPerusahaanShift,
  unloadPerusahaanShift,
} from "./admin-perusahaan-shift.js";
// import { loadPetugas, unloadPetugas } from "./admin-petugas.js";

console.log("🚀 Router SPA siap...");

/* ===============================
   1️⃣ Daftar hash → fungsi loader
   =============================== */
const routes = {
  "#dashboard": async () => {
    await dashboard.loadDashboard();
  },
  "#perusahaan": async () => {
    await loadPerusahaanShift();
  },
  "#petugas": async () => {
    try {
      const mod = await import("./admin-petugas.js");
      mod.unloadPetugas?.(); // bersihkan listener lama kalau ada
      await mod.loadPetugas?.();
    } catch (err) {
      console.warn("⚠️ Modul petugas belum tersedia:", err);
    }
  },
  "#notifikasi": async () => {
    console.log("🔔 Notifikasi belum diimplementasikan.");
  },
  "#settings": async () => {
    console.log("⚙️ Settings belum diimplementasikan.");
  },
};

/* ===============================
   2️⃣ Router utama
   =============================== */
export function initRouter() {
  const sections = document.querySelectorAll(".content");

  // Fungsi utama untuk handle perubahan route
  const handleRoute = async (forceReload = false) => {
    const hash = location.hash || "#dashboard";
    const targetFn = routes[hash];

    // 🔹 Sembunyikan semua section
    sections.forEach((sec) => (sec.style.display = "none"));

    // 🔹 Tentukan section aktif berdasarkan hash
    const targetSectionId =
      hash === "#dashboard"
        ? "dashboardSection"
        : hash === "#perusahaan"
        ? "perusahaanSection"
        : hash === "#petugas"
        ? "petugasSection"
        : hash === "#notifikasi"
        ? "notifikasiSection"
        : hash === "#settings"
        ? "settingsSection"
        : null;

    // 🔹 Tampilkan section target
    if (targetSectionId) {
      const el = document.getElementById(targetSectionId);
      if (el) el.style.display = "block";
    }

    // 🔹 Update menu aktif
    setActiveMenu(hash);

    // 🔹 Bersihkan listener modul lain (prevent double listener)
    unloadAllModulesExcept(hash);

    // 🔹 Jalankan fungsi modul kalau hash baru / refresh
    if (targetFn) {
      if (forceReload || hash !== window._lastHash) {
        console.log(`📍 Navigasi ke ${hash} (refresh=${forceReload})`);
        await targetFn();
        window._lastHash = hash;
      } else {
        console.log(`⏸️ Route ${hash} sudah aktif, tidak reload.`);
      }
    } else {
      console.warn("⚠️ Route tidak dikenal:", hash);
    }
  };

  // Jalankan pertama kali
  handleRoute(true);

  // Jalankan ulang kalau hash berubah
  window.addEventListener("hashchange", () => handleRoute(true));

  // 🔹 Tambahan: klik ulang menu aktif = reload paksa
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      const currentHash = location.hash || "#dashboard";
      if (link.getAttribute("href") === currentHash) {
        e.preventDefault();
        console.log(`🔁 Klik ulang menu aktif ${currentHash}, reload paksa...`);
        handleRoute(true);
      }
    });
  });
}

async function unloadAllModulesExcept(activeHash) {
  try {
    if (activeHash !== "#dashboard") {
      // dashboard sudah di-import statically, langsung panggil
      unloadDashboard?.();
    }
    if (activeHash !== "#perusahaan") {
      unloadPerusahaanShift?.();
    }

    // petugas mungkin loaded lazily — coba import modulnya secara dinamis dan panggil unload jika ada
    if (activeHash !== "#petugas") {
      try {
        const mod = await import("./admin-petugas.js");
        if (mod.unloadPetugas) {
          mod.unloadPetugas();
        }
      } catch (err) {
        // modul mungkin belum tersedia atau file belum ada — aman untuk diabaikan
        // console.debug("admin-petugas tidak tersedia untuk unload:", err);
      }
    }

    // jika ada modul lain yang loaded lazily, lakukan pola yang sama di sini
  } catch (err) {
    console.warn("⚠️ Error saat unload modul:", err);
  }
}

/* ===============================
   4️⃣ Highlight menu sidebar aktif
   =============================== */
function setActiveMenu(hash) {
  const menuItems = document.querySelectorAll(".nav-link");
  menuItems.forEach((item) => {
    if (item.getAttribute("href") === hash) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}
