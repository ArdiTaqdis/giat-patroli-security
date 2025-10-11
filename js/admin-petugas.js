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

export async function loadPetugas() {
  renderUI();

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

  // 🔁 Sync Manual
  petugasContent.addEventListener("click", (e) => {
    const id = e.target.id;
    if (id === "btnAddPetugas") openPetugasModal(false);
    else if (id === "btnSyncManual") {
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = "⏳ Sinkron...";
      fetchAndCache(false, (data) => {
        filtered = [...data];
        renderTable();
        updateLastSyncTime();
        flashSyncIndicator();
        btn.textContent = "✅ Sinkron Berhasil";
        setTimeout(() => {
          btn.textContent = "🔁 Sync Manual";
          btn.disabled = false;
        }, 2000);
      });
    }
  });

  // 🔁 Saat online kembali
  window.addEventListener("online", async () => {
    await syncOfflineBuffer();
    filtered = [...cachedPetugas];
    renderTable();
    updateLastSyncTime();
    flashSyncIndicator();
  });

  // 🔹 Tampilkan waktu sync terakhir dari localStorage (kalau ada)
  const savedTime = localStorage.getItem("lastSyncTime");
  if (savedTime) {
    const el = document.getElementById("lastSyncTime");
    if (el) el.textContent = savedTime + " WIB";
  }
}

function renderUI() {
  petugasContent.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <button class="btn btn-success" id="btnAddPetugas"><i class="fas fa-plus"></i> Tambah Petugas</button>
        <button class="btn btn-outline-primary" id="btnSyncManual">🔁 Sync Manual</button>
      </div>
      <div id="lastSync" style="font-size:0.9rem;color:#666;text-align:right;">
        🕒 Terakhir sinkron: <span id="lastSyncTime">Belum pernah</span>
      </div>
    </div>

    <div class="d-flex justify-content-end mb-2">
      <input type="text" id="searchInput" class="form-control" style="max-width:250px" placeholder="Cari nama / NIP...">
    </div>

    <table class="table table-bordered table-striped">
      <thead>
        <tr><th>NIP</th><th>Nama</th><th>Perusahaan</th><th>Foto</th><th>Aksi</th></tr>
      </thead>
      <tbody id="petugasTable"></tbody>
    </table>

    <div id="paginationControls" class="mt-3 d-flex justify-content-between align-items-center"></div>
  `;

  // 🔍 Search
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
        <td>${d.nip}</td><td>${d.nama}</td><td>${d.perusahaanNama || "-"}</td>
        <td>${
          d.fotoUrl
            ? `<img src="${d.fotoUrl}" style="width:40px;height:40px;border-radius:50%;">`
            : "-"
        }</td>
        <td>
          <button class="btn btn-sm btn-info" onclick="window.editPetugas('${
            d.id
          }')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-danger" onclick="window.delPetugas('${
            d.id
          }')"><i class="fas fa-trash"></i></button>
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
  const p = cachedPetugas.find((x) => x.id === id);
  if (!p) return alert("Data tidak ditemukan!");
  openPetugasModal(true, p);
};

function updateLastSyncTime() {
  const el = document.getElementById("lastSyncTime");
  if (!el) return;
  const now = new Date();
  const formatted = now.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour12: false,
  });
  el.textContent = formatted + " WIB";
  localStorage.setItem("lastSyncTime", formatted);
}

function flashSyncIndicator() {
  const el = document.getElementById("lastSync");
  if (!el) return;
  el.style.transition = "background 0.5s";
  el.style.background = "#c8e6c9";
  setTimeout(() => (el.style.background = "transparent"), 1000);
}
