// js/admin-perusahaan-shift.js (FINAL — Scoped listener + Search + Filter + PDF + XLSX)
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  setDoc,
  doc,
  deleteDoc,
  query,
  where,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ======================================================
   Globals (scoped)
   ====================================================== */
const perusahaanContent = document.getElementById("perusahaanContent");
let perusahaanClickHandler = null;
let currentCompanyId = null;
let currentCompanyName = "";
let currentShiftId = null;

// ======= CACHE + PAGINATION STATE =======
let perusahaanCache = []; // cache data perusahaan setelah 1x load
let companyPage = 1;
let companyPageSize = 10; // default
let companySearchTerm = "";

// 🧩 PATCH START — Multi-cache Shift + Auto-Refresh
window.shiftCacheMap = window.shiftCacheMap || {}; // Cache per perusahaan
window.shiftCache = []; // Cache aktif
window.shiftCacheTimestamps = window.shiftCacheTimestamps || {}; // Waktu terakhir update per perusahaan
// 🧩 PATCH END

// debounce helper
function debounce(fn, wait = 350) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* ======================================================
   Public API
   ====================================================== */
export async function loadPerusahaanShift() {
  renderUI();
  await renderCompanyTable();

  // hookup search debounce
  const searchInput = document.getElementById("searchCompany");
  if (searchInput) {
    companySearchTerm = searchInput.value.trim().toLowerCase();
    const deb = debounce((val) => {
      companySearchTerm = (val || "").trim().toLowerCase();
      companyPage = 1;
      renderCompanyRowsPaginated();
    }, 350);
    searchInput.addEventListener("keyup", (ev) => {
      if (ev.key === "Enter") deb(ev.target.value);
      else deb(ev.target.value);
    });
  }

  const pageSizeSel = document.getElementById("companyPageSize");
  if (pageSizeSel) {
    pageSizeSel.addEventListener("change", (ev) => {
      companyPageSize = parseInt(ev.target.value) || 10;
      companyPage = 1;
      renderCompanyRowsPaginated();
    });
  }

  // scoped listener, hanya di dalam perusahaanContent
  perusahaanClickHandler = async (e) => handleClick(e);
  perusahaanContent.addEventListener("click", perusahaanClickHandler);

  // juga tangani filter input enter pada shift filter
  const filterStart = document.getElementById("filterStart");
  const filterEnd = document.getElementById("filterEnd");
  filterStart?.addEventListener("keyup", (ev) => {
    if (ev.key === "Enter") renderShiftTable();
  });
  filterEnd?.addEventListener("keyup", (ev) => {
    if (ev.key === "Enter") renderShiftTable();
  });

  console.log("✅ Listener perusahaan shift aktif");
}

export function unloadPerusahaanShift() {
  if (perusahaanClickHandler) {
    perusahaanContent.removeEventListener("click", perusahaanClickHandler);
    perusahaanClickHandler = null;
    console.log("🧹 Listener perusahaan shift dilepas");
  }
}

/* ======================================================
   Render UI
   ====================================================== */
function renderUI() {
  perusahaanContent.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <button class="btn btn-success" id="btnAddCompany">
          <i class="fas fa-plus"></i> Tambah Perusahaan
        </button>
      </div>
      <div class="d-flex align-items-center" style="gap:8px">
        <div class="input-group" style="width:260px">
         <button class="btn btn-sm btn-outline-info" id="btnRefreshShift">
          <i class="fas fa-sync-alt"></i> Refresh
        </button>
          <input type="text" id="searchCompany" class="form-control form-control-sm" placeholder="Cari perusahaan...">
          <div class="input-group-append">
            <button class="btn btn-sm btn-outline-secondary" id="btnSearchCompany"><i class="fas fa-search"></i></button>
          </div>
        </div>
      </div>
    </div>
 <select id="companyPageSize" class="form-control form-control-sm" style="width:100px;">
          <option value="5">5 / hal</option>
          <option value="10" selected>10 / hal</option>
          <option value="25">25 / hal</option>
          <option value="50">50 / hal</option>
  </select>
    <table class="table table-bordered table-striped">
      <thead>
        <tr>
          <th>Nama</th><th>Alamat</th><th>PIC</th><th>No. WA</th><th>Aksi</th>
        </tr>
      </thead>
      <tbody id="companyTable"></tbody>
    </table>
     <div id="companyPagination" class="d-flex justify-content-center align-items-center" style="gap:8px;margin-top:8px;"></div>

    <!-- Modal Perusahaan -->
    <div class="modal fade" id="companyModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title" id="companyModalTitle">Tambah Perusahaan</h5>
            <button type="button" class="close text-white" data-dismiss="modal">&times;</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="companyId">
            <div class="form-group"><label>Nama</label><input type="text" id="nama" class="form-control"></div>
            <div class="form-group"><label>Alamat</label><input type="text" id="alamat" class="form-control"></div>
            <div class="form-group"><label>PIC</label><input type="text" id="pic" class="form-control"></div>
            <div class="form-group"><label>No. WA</label><input type="text" id="noWa" class="form-control"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-dismiss="modal">Batal</button>
            <button class="btn btn-primary" id="btnSaveCompany" disabled>Simpan</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Shift -->
    <div class="modal fade" id="shiftModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-info text-white">
            <h5 class="modal-title"><i class="fas fa-clock"></i> Jadwal Patroli</h5>
            <button type="button" class="close text-white" data-dismiss="modal">&times;</button>
          </div>
          <div class="modal-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h5 id="shiftCompanyTitle" class="mb-0"></h5>
              <div class="d-flex align-items-center" style="gap:8px">
                <input type="time" id="filterStart" class="form-control form-control-sm" style="width:110px">
                <span>-</span>
                <input type="time" id="filterEnd" class="form-control form-control-sm" style="width:110px">
                <button class="btn btn-sm btn-outline-secondary" id="btnFilterShift"><i class="fas fa-filter"></i></button>
                <button class="btn btn-sm btn-outline-danger" id="btnClearFilter"><i class="fas fa-times"></i></button>
                <button class="btn btn-sm btn-outline-success" id="btnExportPDF"><i class="fas fa-file-pdf"></i> PDF</button>
                <button class="btn btn-sm btn-outline-primary" id="btnExportXLS"><i class="fas fa-file-excel"></i> XLSX</button>
              </div>
            </div>

            <button class="btn btn-success btn-sm mb-2" id="btnAddShift"><i class="fas fa-plus"></i> Tambah Shift</button>

            <table class="table table-striped table-sm">
              <thead>
                <tr>
                  <th>Nama Shift</th><th>Jam Mulai</th><th>Jam Selesai</th><th>Interval</th><th>Area</th><th>Aksi</th>
                </tr>
              </thead>
              <tbody id="shiftTableBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Add/Edit Shift -->
    <div class="modal fade" id="addShiftModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-success text-white">
            <h5 class="modal-title" id="shiftModalTitle">Tambah Shift</h5>
            <button type="button" class="close text-white" data-dismiss="modal">&times;</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="shiftId">
            <div class="form-group"><label>Nama Shift</label><input type="text" id="shiftName" class="form-control"></div>
            <div class="form-group"><label>Jam Mulai</label><input type="time" id="shiftStart" class="form-control"></div>
            <div class="form-group"><label>Jam Selesai</label><input type="time" id="shiftEnd" class="form-control"></div>
            <div class="form-group"><label>Interval (menit)</label><input type="number" id="shiftInterval" class="form-control" value="120" min="10"></div>
            <div class="form-group"><label>Jumlah Area</label><input type="number" id="shiftArea" class="form-control" value="5" min="1"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-dismiss="modal">Batal</button>
            <button class="btn btn-success" id="saveShiftBtn"disabled>Simpan</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loader -->
    <div id="loaderOverlay" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.7);z-index:9999;align-items:center;justify-content:center;">
      <div class="spinner-border text-danger" style="width:3rem;height:3rem;"></div>
    </div>
  `;

  // hookup simple search triggers
  document
    .getElementById("btnSearchCompany")
    .addEventListener("click", () => renderCompanyTable());
  document.getElementById("searchCompany").addEventListener("keyup", (e) => {
    if (e.key === "Enter") renderCompanyTable();
  });

  // hookup filter & export buttons (listeners are handled in handleClick via delegation as well)
}

/* ======================================================
   Company CRUD
   ====================================================== */
async function renderCompanyTable() {
  const tbody = document.getElementById("companyTable");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="text-center">⏳ Memuat...</td></tr>`;

  try {
    const snap = await getDocs(collection(db, "perusahaan"));
    // cache results
    perusahaanCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Gagal load perusahaan:", err);
    perusahaanCache = [];
  }

  // set search term from input (initial)
  const input = document.getElementById("searchCompany");
  companySearchTerm = (input?.value || "").trim().toLowerCase();
  companyPage = 1;
  // render first page
  renderCompanyRowsPaginated();
}

function openCompanyModal(isEdit = false, data = {}) {
  $("#companyModal").modal("show");
  document.getElementById("companyModalTitle").textContent = isEdit
    ? "Edit Perusahaan"
    : "Tambah Perusahaan";
  document.getElementById("companyId").value = data.id || "";
  document.getElementById("nama").value = data.nama || "";
  document.getElementById("alamat").value = data.alamat || "";
  document.getElementById("pic").value = data.pic || "";
  document.getElementById("noWa").value = data.noWa || "";

  document.getElementById("btnSaveCompany").onclick = async () => {
    const nama = document.getElementById("nama").value.trim();
    if (!nama) return showToast("⚠️ Nama wajib diisi.", "warning");

    const payload = {
      nama,
      alamat: document.getElementById("alamat").value.trim(),
      pic: document.getElementById("pic").value.trim(),
      noWa: document.getElementById("noWa").value.trim(),
    };

    showLoader(true);
    try {
      const id = document.getElementById("companyId").value;

      if (id) {
        await setDoc(doc(db, "perusahaan", id), payload);

        // ✅ Update cache lokal agar sinkron tanpa re-fetch
        const idx = perusahaanCache.findIndex((p) => p.id === id);
        if (idx !== -1) perusahaanCache[idx] = { id, ...payload };
      } else {
        const ref = await addDoc(collection(db, "perusahaan"), payload);

        // ✅ Tambahkan ke cache tanpa re-fetch
        const newDoc = { id: ref.id, ...payload };
        perusahaanCache.unshift(newDoc);
      }

      showToast("✅ Data perusahaan disimpan.", "success");
      $("#companyModal").modal("hide");

      // ✅ Render ulang tabel dari cache saja
      renderCompanyRowsPaginated();
    } catch (err) {
      console.error(err);
      showToast("❌ Gagal menyimpan data.", "danger");
    } finally {
      showLoader(false);
    }
  };
}

window.editCompany = (id, nama, alamat, pic, noWa) =>
  openCompanyModal(true, { id, nama, alamat, pic, noWa });

window.deleteCompany = async (id) => {
  if (!confirm("Yakin hapus perusahaan ini?")) return;
  showLoader(true);

  try {
    await deleteDoc(doc(db, "perusahaan", id));
    showToast("🗑️ Perusahaan dihapus.", "warning");

    // ✅ Hapus dari cache lokal tanpa re-fetch
    perusahaanCache = perusahaanCache.filter((p) => p.id !== id);

    // ✅ Render ulang tabel langsung dari cache
    renderCompanyRowsPaginated();
  } catch (err) {
    console.error(err);
    showToast("❌ Gagal menghapus data.", "danger");
  } finally {
    showLoader(false);
  }
};

/* ======================================================
   Shift CRUD + Render + Filter
   ====================================================== */
// 🧩 PATCH START — openShiftModal dengan Multi-cache Shift
// 🧩 PATCH START — openShiftModal dengan Multi-cache + Auto-Refresh (1 jam)
window.openShiftModal = async (companyId, namaPerusahaan) => {
  currentCompanyId = companyId;
  currentCompanyName = namaPerusahaan;

  $("#shiftModal").modal("show");
  document.getElementById(
    "shiftCompanyTitle"
  ).textContent = `📅 ${currentCompanyName}`;

  document.getElementById("filterStart").value = "";
  document.getElementById("filterEnd").value = "";

  // Hitung umur cache (1 jam = 3600000 ms)
  const lastUpdated = window.shiftCacheTimestamps[currentCompanyId] || 0;
  const cacheAge = Date.now() - lastUpdated;
  const cacheExpired = cacheAge > 60 * 60 * 1000; // > 1 jam

  if (window.shiftCacheMap[currentCompanyId] && !cacheExpired) {
    console.log(
      `🟢 Load shift dari cache untuk ${currentCompanyName} (umur cache ${Math.floor(
        cacheAge / 60000
      )} menit)`
    );
    window.shiftCache = window.shiftCacheMap[currentCompanyId];
    renderShiftRowsFromCache();
  } else {
    console.log(
      cacheExpired
        ? `⏰ Cache ${currentCompanyName} kedaluwarsa, refresh data...`
        : `📥 Fetch shift baru untuk perusahaan: ${currentCompanyName}`
    );
    window.shiftCache = [];
    await renderShiftTable();
    window.shiftCacheMap[currentCompanyId] = [...window.shiftCache];
    window.shiftCacheTimestamps[currentCompanyId] = Date.now();
  }
};
// 🧩 PATCH END

// 🧩 PATCH END

async function renderShiftTable() {
  const tbody = document.getElementById("shiftTableBody");
  tbody.innerHTML = `<tr><td colspan="6" class="text-center">⏳ Memuat...</td></tr>`;

  if (!currentCompanyId) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Pilih perusahaan terlebih dahulu.</td></tr>`;
    return;
  }

  const q = query(
    collection(db, "jadwalPatroli"),
    where("perusahaanId", "==", currentCompanyId)
  );
  const snap = await getDocs(q);
  const rows = [];
  snap.forEach((s) => rows.push({ id: s.id, ...s.data() }));

  // apply filter by time range if provided
  const filterStart = document.getElementById("filterStart").value;
  const filterEnd = document.getElementById("filterEnd").value;

  let filtered = rows;
  if (filterStart || filterEnd) {
    filtered = rows.filter((r) => {
      if (!r.jamMulai || !r.jamSelesai) return false;
      const [h1, m1] = (r.jamMulai || "00:00").split(":").map(Number);
      const [h2, m2] = (r.jamSelesai || "00:00").split(":").map(Number);
      const rStart = h1 * 60 + m1;
      const rEnd = h2 * 60 + m2;

      let fStart = -Infinity;
      let fEnd = Infinity;
      if (filterStart) {
        const [fh1, fm1] = filterStart.split(":").map(Number);
        fStart = fh1 * 60 + fm1;
      }
      if (filterEnd) {
        const [fh2, fm2] = filterEnd.split(":").map(Number);
        fEnd = fh2 * 60 + fm2;
      }

      // intersect shift time with filter window (we want shifts that start inside window OR overlap)
      return rStart >= fStart && rStart <= fEnd;
    });
  }

  tbody.innerHTML = "";
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Belum ada shift yang cocok.</td></tr>`;
    return;
  }

  // 🧩 PATCH START — Simpan hasil fetch ke cache global
  window.shiftCache = rows;
  window.shiftCacheMap[currentCompanyId] = rows;
  // 🧩 PATCH END

  // 🧩 PATCH START — Update timestamp saat fetch data baru
  window.shiftCacheTimestamps[currentCompanyId] = Date.now();
  // 🧩 PATCH END

  filtered.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(s.nama)}</td>
      <td>${escapeHtml(s.jamMulai)}</td>
      <td>${escapeHtml(s.jamSelesai)}${
      s.crossesMidnight ? " <span class='text-muted'>(+1)</span>" : ""
    }</td>

      <td>${escapeHtml(String(s.interval || ""))}</td>
      <td>${escapeHtml(String(s.area || ""))}</td>
      <td>
        <button class="btn btn-sm btn-info" onclick="window.editShift('${
          s.id
        }')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="window.deleteShift('${
          s.id
        }'disabled)">Hapus</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// 🧩 PATCH START — Helper renderShiftRowsFromCache
// 🧩 PATCH START — Helper renderShiftRowsFromCache
function renderShiftRowsFromCache() {
  const tbody = document.getElementById("shiftTableBody");
  if (!tbody) return;

  const rows = window.shiftCache || [];
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Belum ada shift tersimpan.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  rows.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(s.nama)}</td>
      <td>${escapeHtml(s.jamMulai)}</td>
      <td>${escapeHtml(s.jamSelesai)}</td>
      <td>${escapeHtml(String(s.interval || ""))}</td>
      <td>${escapeHtml(String(s.area || ""))}</td>
      <td>
        <button class="btn btn-sm btn-info" onclick="window.editShift('${
          s.id
        }')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="window.deleteShift('${
          s.id
        }')"disabled>Hapus</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

console.log(`💾 Render shift dari cache (${window.shiftCache.length} item)`);

// 🧩 PATCH END

/* ======================================================
   Event handler (delegated)
   ====================================================== */
async function handleClick(e) {
  const id = e.target?.id;

  // Company: add
  if (id === "btnAddCompany") {
    openCompanyModal(false, {});
    return;
  }

  // Shift modal add
  if (id === "btnAddShift") {
    currentShiftId = null;
    document.getElementById("shiftModalTitle").textContent = "Tambah Shift";
    ["shiftId", "shiftName", "shiftStart", "shiftEnd"].forEach(
      (el) => (document.getElementById(el).value = "")
    );
    document.getElementById("shiftInterval").value = 120;
    document.getElementById("shiftArea").value = 5;
    $("#addShiftModal").modal("show");
    return;
  }

  // 🧩 PATCH START — Manual Refresh Shift Cache
  if (id === "btnRefreshShift") {
    if (!currentCompanyId)
      return showToast("⚠️ Pilih perusahaan terlebih dahulu.", "warning");

    const confirmRefresh = confirm(
      `Yakin ingin memperbarui jadwal untuk ${currentCompanyName}? Data cache akan diganti.`
    );
    if (!confirmRefresh) return;

    showLoader(true);
    try {
      console.log(`🔄 Manual refresh shift untuk ${currentCompanyName}`);
      window.shiftCache = [];
      await renderShiftTable(); // Ambil ulang dari Firestore
      window.shiftCacheMap[currentCompanyId] = [...window.shiftCache];
      window.shiftCacheTimestamps[currentCompanyId] = Date.now();
      showToast("✅ Jadwal diperbarui dari server.", "success");
    } catch (err) {
      console.error(err);
      showToast("❌ Gagal refresh jadwal.", "danger");
    } finally {
      showLoader(false);
    }
    return;
  }
  // 🧩 PATCH END

  // Filter shifts
  if (id === "btnFilterShift") {
    await renderShiftTable();
    return;
  }
  if (id === "btnClearFilter") {
    document.getElementById("filterStart").value = "";
    document.getElementById("filterEnd").value = "";
    await renderShiftTable();
    return;
  }

  // Export PDF
  if (id === "btnExportPDF") {
    await exportShiftPDF();
    return;
  }

  // Export XLSX
  if (id === "btnExportXLS") {
    await exportShiftXLSX();
    return;
  }

  // Save shift (add/edit)
  if (id === "saveShiftBtn") {
    const start = document.getElementById("shiftStart").value;
    const end = document.getElementById("shiftEnd").value;

    if (!start || !end) {
      return showToast("⚠️ Jam mulai dan jam selesai wajib diisi.", "warning");
    }
    // ======================== PATCH: shift lintas hari ========================
    const [h1, m1] = start.split(":").map(Number);
    const [h2, m2] = end.split(":").map(Number);

    let totalStart = h1 * 60 + m1;
    let totalEnd = h2 * 60 + m2;
    let crossesMidnight = false;

    // Jika jam selesai <= jam mulai → artinya lewat tengah malam
    if (totalEnd <= totalStart) {
      totalEnd += 24 * 60; // tambahkan 24 jam
      crossesMidnight = true;
    }

    const durationMinutes = totalEnd - totalStart;
    if (durationMinutes <= 0 || durationMinutes > 24 * 60) {
      return showToast("⚠️ Durasi shift tidak valid.", "warning");
    }
    // ========================================================================

    const payload = {
      perusahaanId: currentCompanyId,
      perusahaanNama: currentCompanyName,
      nama: document.getElementById("shiftName").value.trim(),
      jamMulai: start,
      jamSelesai: end,
      interval: parseInt(document.getElementById("shiftInterval").value) || 0,
      area: parseInt(document.getElementById("shiftArea").value) || 0,
      crossesMidnight,
      durationMinutes,
      updatedAt: Date.now(),
    };

    if (!payload.nama)
      return showToast("⚠️ Nama shift wajib diisi.", "warning");

    // confirm on edit
    if (currentShiftId) {
      const ok = confirm("Apakah kamu yakin ingin memperbarui shift ini?");
      if (!ok) return;
    }

    showLoader(true);
    // 🧩 PATCH START — Optimized Add/Edit Shift (Zero Read Refresh)
    try {
      if (currentShiftId) {
        await setDoc(doc(db, "jadwalPatroli", currentShiftId), payload);
        showToast("✏️ Shift diperbarui.", "info");

        // ✅ Update langsung di cache shift jika sudah dimuat sebelumnya
        if (window.shiftCache && Array.isArray(window.shiftCache)) {
          const idx = window.shiftCache.findIndex(
            (s) => s.id === currentShiftId
          );
          if (idx !== -1)
            window.shiftCache[idx] = { id: currentShiftId, ...payload };
        }
      } else {
        const ref = await addDoc(collection(db, "jadwalPatroli"), payload);
        showToast("✅ Shift berhasil ditambahkan.", "success");

        // ✅ Tambah ke cache lokal tanpa re-fetch
        if (!window.shiftCache) window.shiftCache = [];
        window.shiftCache.unshift({ id: ref.id, ...payload });
      }

      $("#addShiftModal").modal("hide");

      // ✅ Render ulang tabel dari cache tanpa getDocs()
      if (window.shiftCache) renderShiftRowsFromCache();
      else await renderShiftTable(); // fallback pertama kali
    } catch (err) {
      console.error(err);
      showToast("❌ Gagal menyimpan shift.", "danger");
    } finally {
      showLoader(false);
    }
    // 🧩 PATCH END

    return;
  }
}

/* ======================================================
   Edit / Delete shift
   ====================================================== */
window.editShift = async (id) => {
  showLoader(true);
  try {
    const ref = doc(db, "jadwalPatroli", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      showToast("❌ Data shift tidak ditemukan.", "danger");
      return;
    }
    const s = snap.data();
    currentShiftId = id;
    document.getElementById("shiftModalTitle").textContent = "Edit Shift";
    document.getElementById("shiftId").value = id;
    document.getElementById("shiftName").value = s.nama || "";
    document.getElementById("shiftStart").value = s.jamMulai || "";
    document.getElementById("shiftEnd").value = s.jamSelesai || "";
    document.getElementById("shiftInterval").value = s.interval || 120;
    document.getElementById("shiftArea").value = s.area || 5;
    $("#addShiftModal").modal("show");
  } catch (err) {
    console.error(err);
    showToast("❌ Gagal memuat data shift.", "danger");
  } finally {
    showLoader(false);
  }
};

window.deleteShift = async (id) => {
  if (!confirm("Yakin hapus shift ini?")) return;
  showLoader(true);
  try {
    // 🧩 PATCH START — Optimized Delete Shift (Zero Read Refresh)
    await deleteDoc(doc(db, "jadwalPatroli", id));
    showToast("🗑️ Shift dihapus.", "warning");

    // ✅ Hapus langsung dari cache tanpa getDocs ulang
    if (window.shiftCache && Array.isArray(window.shiftCache)) {
      window.shiftCache = window.shiftCache.filter((s) => s.id !== id);
      renderShiftRowsFromCache();
    } else {
      await renderShiftTable(); // fallback
    }
    // 🧩 PATCH END
  } catch (err) {
    console.error(err);
    showToast("❌ Gagal menghapus shift.", "danger");
  } finally {
    showLoader(false);
  }
};

/* ======================================================
   Export PDF & XLSX
   ====================================================== */
async function exportShiftPDF() {
  if (!currentCompanyId)
    return showToast("⚠️ Buka jadwal perusahaan terlebih dahulu.", "warning");
  showLoader(true);
  try {
    const q = query(
      collection(db, "jadwalPatroli"),
      where("perusahaanId", "==", currentCompanyId)
    );
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach((d) => {
      const s = d.data();
      rows.push([
        s.nama || "",
        s.jamMulai || "",
        s.jamSelesai || "",
        `${s.interval || ""} mnt`,
        `${s.area || ""}`,
      ]);
    });

    if (rows.length === 0)
      return showToast("⚠️ Tidak ada shift untuk diekspor.", "warning");

    if (!window.jspdf)
      return showToast(
        "⚠️ jsPDF belum terpasang. Tambahkan jsPDF di HTML.",
        "warning"
      );
    const { jsPDF } = window.jspdf;
    const docPDF = new jsPDF();
    docPDF.setFontSize(12);
    docPDF.text(`Jadwal Patroli - ${currentCompanyName}`, 14, 14);
    docPDF.autoTable({
      head: [["Nama Shift", "Jam Mulai", "Jam Selesai", "Interval", "Area"]],
      body: rows,
      startY: 20,
      styles: { fontSize: 10 },
    });
    docPDF.save(`Jadwal-${sanitizeFileName(currentCompanyName)}.pdf`);
    showToast("📄 PDF berhasil diekspor.", "success");
  } catch (err) {
    console.error(err);
    showToast("❌ Gagal ekspor PDF.", "danger");
  } finally {
    showLoader(false);
  }
}

async function exportShiftXLSX() {
  if (!currentCompanyId)
    return showToast("⚠️ Buka jadwal perusahaan terlebih dahulu.", "warning");
  if (!window.XLSX)
    return showToast(
      "⚠️ SheetJS (xlsx) belum terpasang. Tambahkan xlsx.full.min.js di HTML.",
      "warning"
    );
  showLoader(true);
  try {
    const q = query(
      collection(db, "jadwalPatroli"),
      where("perusahaanId", "==", currentCompanyId)
    );
    const snap = await getDocs(q);
    const data = [];
    snap.forEach((d) => {
      const s = d.data();
      data.push({
        "Nama Shift": s.nama || "",
        "Jam Mulai": s.jamMulai || "",
        "Jam Selesai": s.jamSelesai || "",
        "Interval(menit)": s.interval || "",
        Area: s.area || "",
      });
    });
    if (data.length === 0)
      return showToast("⚠️ Tidak ada shift untuk diekspor.", "warning");

    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
    const filename = `Jadwal-${sanitizeFileName(currentCompanyName)}.xlsx`;
    window.XLSX.writeFile(wb, filename);
    showToast("📁 XLSX berhasil diekspor.", "success");
  } catch (err) {
    console.error(err);
    showToast("❌ Gagal ekspor XLSX.", "danger");
  } finally {
    showLoader(false);
  }
}

/* ======================================================
   Utilities
   ====================================================== */
function showLoader(show) {
  const el = document.getElementById("loaderOverlay");
  if (el) el.style.display = show ? "flex" : "none";
}

function showToast(message, type = "info") {
  const colors = {
    success: "#28a745",
    danger: "#dc3545",
    warning: "#ffc107",
    info: "#17a2b8",
  };
  const toast = document.createElement("div");
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "25px",
    right: "25px",
    background: colors[type] || "#333",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "8px",
    zIndex: 99999,
    opacity: "0",
    transition: "opacity 0.25s, transform 0.3s",
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(-6px)";
  }, 50);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 300);
  }, 3600);
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}

// escape strings for single-quoted inline onclick args
function escapeJs(s) {
  if (s == null) return "";
  return String(s).replace(/'/g, "\\'");
}

function sanitizeFileName(name) {
  return (name || "export").replace(/[^a-z0-9_\-\.]/gi, "_");
}

function renderCompanyRowsPaginated() {
  const tbody = document.getElementById("companyTable");
  if (!tbody) return;

  const search = companySearchTerm || "";
  const filtered = perusahaanCache.filter((r) => {
    if (!search) return true;
    return (r.nama || "").toLowerCase().includes(search);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / companyPageSize));
  if (companyPage > totalPages) companyPage = totalPages;

  const startIdx = (companyPage - 1) * companyPageSize;
  const pageItems = filtered.slice(startIdx, startIdx + companyPageSize);

  tbody.innerHTML = "";
  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Tidak ada data ditemukan.</td></tr>`;
  } else {
    pageItems.forEach((d) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(d.nama)}</td>
        <td>${escapeHtml(d.alamat || "-")}</td>
        <td>${escapeHtml(d.pic || "-")}</td>
        <td>${escapeHtml(d.noWa || "-")}</td>
        <td>
          <button class="btn btn-sm btn-info" onclick="window.editCompany('${
            d.id
          }','${escapeJs(d.nama)}','${escapeJs(d.alamat || "")}','${escapeJs(
        d.pic || ""
      )}','${escapeJs(d.noWa || "")}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-danger" onclick="window.deleteCompany('${
            d.id
          }')"><i class="fas fa-trash"></i></button>
          <button class="btn btn-sm btn-primary" onclick="window.openShiftModal('${
            d.id
          }','${escapeJs(
        d.nama
      )}')"><i class="fas fa-clock"></i> Jadwal</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
  const container = document.getElementById("companyPagination");
  if (!container) return;
  container.innerHTML = "";

  const prev = document.createElement("button");
  prev.className = "btn btn-sm btn-outline-secondary";
  prev.textContent = "Prev";
  prev.disabled = companyPage <= 1;
  prev.onclick = () => {
    companyPage = Math.max(1, companyPage - 1);
    renderCompanyRowsPaginated();
  };
  container.appendChild(prev);

  const maxButtons = 7;
  let start = Math.max(1, companyPage - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages, start + maxButtons - 1);
  if (end - start + 1 < maxButtons) start = Math.max(1, end - maxButtons + 1);

  for (let p = start; p <= end; p++) {
    const b = document.createElement("button");
    b.className = `btn btn-sm ${
      p === companyPage ? "btn-primary" : "btn-outline-secondary"
    }`;
    b.textContent = p;
    b.onclick = () => {
      companyPage = p;
      renderCompanyRowsPaginated();
    };
    container.appendChild(b);
  }

  const next = document.createElement("button");
  next.className = "btn btn-sm btn-outline-secondary";
  next.textContent = "Next";
  next.disabled = companyPage >= totalPages;
  next.onclick = () => {
    companyPage = Math.min(totalPages, companyPage + 1);
    renderCompanyRowsPaginated();
  };
  container.appendChild(next);

  const info = document.createElement("span");
  info.style.marginLeft = "12px";
  info.className = "text-muted";
  info.textContent = `Hal. ${companyPage} dari ${totalPages} • ${perusahaanCache.length} total`;
  container.appendChild(info);
}
