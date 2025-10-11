// =======================
// 🔒 LOGIN SUPER HEMAT & OFFLINE READY
// =======================
import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =======================
// 🔧 Aktifkan Offline Persistence (IndexedDB)
// =======================
try {
  await enableIndexedDbPersistence(db);
  console.log("💾 Firestore offline mode aktif.");
} catch (err) {
  console.warn("⚠️ Offline persistence gagal:", err.message);
}

// =======================
// ⚡ Cek Login Cache di LocalStorage
// =======================
document.addEventListener("DOMContentLoaded", async () => {
  const userData = localStorage.getItem("userData");

  if (userData) {
    const user = JSON.parse(userData);
    if (user.nip && user.nama) {
      console.log("✅ Auto-login dari cache:", user.nama);
      window.location.href = "dashboard/dashboard.html";
      return;
    }
  }
});

// =======================
// 🔑 FORM LOGIN
// =======================
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nip = document.getElementById("nipInput").value.trim();

  if (!nip) {
    alert("Masukkan NIP terlebih dahulu!");
    return;
  }

  // tampilkan loading kecil
  const btn = document.querySelector("#loginForm button[type=submit]");
  const oldText = btn.textContent;
  btn.textContent = "Memeriksa...";
  btn.disabled = true;

  try {
    const userRef = doc(db, "dataUser", nip);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();

      // ✅ Simpan ke localStorage untuk login offline
      localStorage.setItem(
        "userData",
        JSON.stringify({
          nip,
          nama: data.nama || "",
          perusahaanId: data.perusahaanId || "",
          perusahaanNama: data.perusahaanNama || "-",
          fotoUrl: data.fotoUrl || "",
          role: data.role || "petugas",
        })
      );

      showToast(
        "✅ Login berhasil, selamat datang " + (data.nama || nip),
        "#43a047"
      );

      setTimeout(() => {
        window.location.href = "dashboard/dashboard.html";
      }, 800);
    } else {
      alert("❌ NIP tidak ditemukan di database.");
    }
  } catch (err) {
    console.error("❌ Error login:", err);

    // 🚀 Mode offline: kalau pernah login sebelumnya, izinkan login
    const cache = localStorage.getItem("userData");
    if (cache) {
      const data = JSON.parse(cache);
      if (data.nip === nip) {
        alert("⚠️ Offline mode: login menggunakan cache lokal.");
        window.location.href = "dashboard/dashboard.html";
        return;
      }
    }

    alert("❌ Tidak bisa login. Pastikan koneksi internet aktif.");
  } finally {
    btn.textContent = oldText;
    btn.disabled = false;
  }
});

// =======================
// 🎯 Fungsi Toast Notifikasi
// =======================
function showToast(msg, color = "#333") {
  let toast = document.createElement("div");
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background: color,
    color: "white",
    padding: "10px 16px",
    borderRadius: "8px",
    fontSize: "0.9rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    zIndex: 9999,
    opacity: 0,
    transition: "opacity 0.3s ease",
  });
  document.body.appendChild(toast);
  setTimeout(() => (toast.style.opacity = "1"), 20);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}
