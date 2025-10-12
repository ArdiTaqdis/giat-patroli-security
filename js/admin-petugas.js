import {
  cachedPetugas,
  fetchAndCache,
  loadCache,
  savePetugas,
  syncOfflineBuffer,
} from "./petugas-sync.js";
import { showToast } from "./petugas-utils.js";
import { openPetugasModal } from "./petugas-modal.js";
import { db } from "./firebase.js";
import {
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const petugasContent = document.getElementById("petugasContent");
let filtered = [];
let currentPage = 1;
const perPage = 10;
const CACHE_DURATION = 1000 * 60 * 5;
let eventListenersAttached = false; // 🧩 flag anti-event ganda

/* ============================================================
   🔹 LOAD PETUGAS (utama)
   ============================================================ */
export async function loadPetugas() {
  renderUI();
  console.log(
    "🔍 Deteksi Bootstrap:",
    typeof bootstrap !== "undefined"
      ? "v5.x"
      : window.$
      ? "v4.x (jQuery)"
      : "tidak ada"
  );

  filtered = loadCache();
  renderTable();

  // 🔁 Auto sync setiap 5 menit
  setInterval(() => {
    fetchAndCache(true, (data) => {
      filtered = [...data];
      renderTable();
      updateLastSyncTime();
      flashSyncIndicator();
    });
  }, CACHE_DURATION);

  // 🧠 Tambahkan event listener hanya sekali
  if (!eventListenersAttached) {
    petugasContent.addEventListener("click", (e) => {
      const id = e.target.id;

      // ➕ Tambah Petugas
      if (id === "btnAddPetugas") {
        // 🚫 Cegah modal ganda
        if (document.querySelector(".modal.show")) {
          console.warn("⚠️ Modal sudah terbuka, abaikan klik duplikat");
          return;
        }
        openPetugasModal(false);
      }

      // 🔁 Sync Manual
      // 🔁 Sync Manual
      else if (id === "btnSyncManual") {
        const btn = e.target.closest("#btnSyncManual");
        if (!btn) return;

        btn.disabled = true;
        btn.innerHTML = "⏳ Sinkronisasi...";
        btn.classList.remove("btn-outline-primary");
        btn.classList.add("btn-warning");

        // 🔁 Ambil data terbaru & update UI setelah selesai
        fetchAndCache(false)
          .then((data) => {
            // data hasil dari Firestore sudah disimpan ke cache
            filtered = [...data];
            renderTable();

            updateLastSyncTime();
            flashSyncIndicator();

            localStorage.setItem(
              "lastSyncCount",
              cachedPetugas.length.toString()
            );

            // 🎉 Ubah tampilan tombol sukses
            btn.innerHTML = "✅ Sinkron Berhasil";
            btn.classList.remove("btn-warning");
            btn.classList.add("btn-success");

            // 🔄 Balik ke normal lagi
            setTimeout(() => {
              btn.innerHTML = "🔁 Sync Manual";
              btn.classList.remove("btn-success");
              btn.classList.add("btn-outline-primary");
              btn.disabled = false;
            }, 2000);
          })
          .catch((err) => {
            console.error("❌ Gagal sinkron:", err);
            btn.innerHTML = "❌ Gagal Sinkron";
            btn.classList.remove("btn-warning");
            btn.classList.add("btn-danger");
            setTimeout(() => {
              btn.innerHTML = "🔁 Sync Manual";
              btn.classList.remove("btn-danger");
              btn.classList.add("btn-outline-primary");
              btn.disabled = false;
            }, 2500);
          });
      }
    });
    eventListenersAttached = true; // 🔒 supaya listener gak nambah dobel
  }

  // 🔁 Saat online kembali
  window.addEventListener("online", async () => {
    await syncOfflineBuffer();
    filtered = [...cachedPetugas];
    renderTable();
    updateLastSyncTime();
    flashSyncIndicator();
  });

  // ⏱️ Tampilkan waktu & jumlah data terakhir sinkron
  const savedTime = localStorage.getItem("lastSyncTime");
  const elTime = document.getElementById("lastSyncTime");
  const elContainer = document.getElementById("lastSync");

  // ⏱️ Inisialisasi tampilan waktu & jumlah data sync
  initLastSyncDisplay();
}

/* ============================================================
   🎨 UI & TABEL
   ============================================================ */
function renderUI() {
  petugasContent.innerHTML = `
    <style>
      #lastSync {
        font-size: 0.9rem;
        color: #555;
        line-height: 1.4;
      }
      #lastSync strong {
        color: #298df8ff;
      }

    </style>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <button class="btn btn-success" id="btnAddPetugas">
          <i class="fas fa-plus"></i> Tambah Petugas
        </button>
        <button class="btn btn-outline-primary" id="btnSyncManual">
          🔁 Sync Manual
        </button>
      </div>
      <div id="lastSync" style="font-size:0.9rem;color:#666;text-align:right;">
        🕒 Terakhir sinkron: <span id="lastSyncTime">Belum pernah</span>
      </div>
    </div>

    <div class="d-flex justify-content-end mb-2">
      <input type="text" id="searchInput" class="form-control" 
             style="max-width:250px" placeholder="Cari nama / NIP...">
    </div>

    <table class="table table-bordered table-striped">
      <thead>
        <tr>
          <th>NIP</th>
          <th>Nama</th>
          <th>Perusahaan</th>
          <th>Foto</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody id="petugasTable"></tbody>
    </table>

    <div id="paginationControls" class="mt-3 d-flex justify-content-between align-items-center"></div>
  `;

  // 🔍 Search real-time
  document.getElementById("searchInput").oninput = (e) => {
    const term = e.target.value.toLowerCase();
    filtered = cachedPetugas.filter(
      (p) =>
        p.nip?.toLowerCase().includes(term) ||
        p.nama?.toLowerCase().includes(term) ||
        (p.perusahaanNama || "").toLowerCase().includes(term)
    );
    currentPage = 1;
    renderTable();
  };
}

function renderTable() {
  const tbody = document.getElementById("petugasTable");
  tbody.innerHTML = "";

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Tidak ada data</td></tr>`;
    return;
  }

  const totalPages = Math.ceil(filtered.length / perPage);
  const start = (currentPage - 1) * perPage;
  filtered.slice(start, start + perPage).forEach((d) => {
    tbody.innerHTML += `
      <tr>
        <td>${d.nip}</td>
        <td>${d.nama}</td>
        <td>${d.perusahaanNama || "-"}</td>
        <td>${
          d.fotoUrl
            ? `<img src="${d.fotoUrl}" style="width:40px;height:40px;border-radius:50%;">`
            : "-"
        }</td>
        <td>
          <button class="btn btn-sm btn-info" onclick="window.editPetugas('${
            d.id
          }')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="window.delPetugas('${
            d.id
          }')">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>`;
  });
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const c = document.getElementById("paginationControls");
  if (totalPages <= 1) return (c.innerHTML = "");
  c.innerHTML = `
    <button class="btn btn-outline-secondary btn-sm" id="prevPage" ${
      currentPage === 1 ? "disabled" : ""
    }>⬅️ Sebelumnya</button>
    <span>Halaman ${currentPage} dari ${totalPages}</span>
    <button class="btn btn-outline-secondary btn-sm" id="nextPage" ${
      currentPage === totalPages ? "disabled" : ""
    }>Berikutnya ➡️</button>
  `;
  c.querySelector("#prevPage").onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  };
  c.querySelector("#nextPage").onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  };
}

/* ============================================================
   🧹 ACTION BUTTONS
   ============================================================ */
window.delPetugas = async (id) => {
  if (!confirm("Hapus petugas ini?")) return;
  await deleteDoc(doc(db, "dataUser", id));
  const idx = cachedPetugas.findIndex((p) => p.id === id);
  if (idx >= 0) cachedPetugas.splice(idx, 1);
  localStorage.setItem("cachePetugas", JSON.stringify(cachedPetugas));
  renderTable();
  showToast("🗑️ Petugas dihapus", "warning");
};

window.editPetugas = (id) => {
  // 🚫 Cegah modal ganda saat klik edit cepat
  if (document.querySelector(".modal.show")) {
    console.warn("⚠️ Modal sudah terbuka, abaikan klik edit duplikat");
    return;
  }
  const p = cachedPetugas.find((x) => x.id === id);
  if (!p) return alert("Data tidak ditemukan!");
  openPetugasModal(true, p);
};

/* ============================================================
   ⏱️ UTILITAS SYNC
   ============================================================ */
function updateLastSyncTime() {
  try {
    const el = document.getElementById("lastSync");
    if (!el) return; // elemen belum dirender

    const now = new Date();
    const formatted = now.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour12: false,
    });

    const total = cachedPetugas?.length || 0;

    // Pastikan elemen innerHTML tidak menghapus node lain
    el.innerHTML = `
      🕒 Terakhir sinkron: <span id="lastSyncTime">${formatted}</span> WIB
      <br>📦 Total data: <strong>${total}</strong> petugas
    `;

    // Simpan ke localStorage
    localStorage.setItem("lastSyncTime", formatted);
    localStorage.setItem("lastSyncCount", total.toString());
  } catch (err) {
    console.error("❌ Gagal update waktu sync:", err);
  }
}

function initLastSyncDisplay() {
  const el = document.getElementById("lastSync");
  if (!el) return;

  const savedTime = localStorage.getItem("lastSyncTime") || "Belum pernah";
  const savedCount =
    localStorage.getItem("lastSyncCount") || cachedPetugas?.length || 0;

  el.innerHTML = `
    🕒 Terakhir sinkron: <span id="lastSyncTime">${savedTime}</span> WIB
    <br>📦 Total data: <strong>${savedCount}</strong> petugas
  `;
}
