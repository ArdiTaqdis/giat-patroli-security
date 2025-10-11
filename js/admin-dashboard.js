// js/admin-dashboard.js (FINAL – full UI tanpa Chart.js)
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  onSnapshot,
  updateDoc,
  limit,
  startAfter,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* -----------------------
   GLOBALS & CACHES
   ----------------------- */
const DATE_KEY = (d = new Date()) => d.toLocaleDateString("id-ID");
let jadwalPatroliCache = [];
let lastHash = "";
let allPatroliDocs = [];
let dashboardUnsub = null; // simpan listener lama
let currentPage = 1;
let itemsPerPage = 10; // tampilkan 10 laporan per halaman
let lastVisibleDoc = null;
let firstVisibleDoc = null;
let paginationStack = []; // simpan history snapshot

/* -----------------------
   BOOTSTRAP UI INJECTION
   ----------------------- */
function ensureDashboardSkeleton() {
  let dashboardSection = document.querySelector("#dashboardSection");
  if (!dashboardSection) {
    dashboardSection = document.createElement("section");
    dashboardSection.id = "dashboardSection";
    document.body.prepend(dashboardSection);
  }

  let cont = dashboardSection.querySelector(".container-fluid");
  if (!cont) {
    cont = document.createElement("div");
    cont.className = "container-fluid";
    dashboardSection.appendChild(cont);
  }

  if (!cont.querySelector("#dashboardCards")) {
    const cardsRow = document.createElement("div");
    cardsRow.id = "dashboardCards";
    cardsRow.className = "row";
    cont.appendChild(cardsRow);
  }

  if (!cont.querySelector("#dashboardMainRow")) {
    const row = document.createElement("div");
    row.id = "dashboardMainRow";
    row.className = "row mt-3";

    // ✅ Bikin satu kolom lebar penuh
    const full = document.createElement("div");
    full.className = "col-12";
    full.innerHTML = `
    <div id="statusWrap" class="mb-3"></div>

    <div id="perusahaanWrap" class="card mb-3">
      <div class="card-body">
        <h5 class="card-title">🏢 Perusahaan Belum Patroli</h5>
        <div id="belumPatroliCompanyList">⏳ Memuat...</div>
      </div>
    </div>

    
    <div id="issuesWrap" class="card mb-3">
      <div class="card-body">
        <h5 class="card-title">
          🚨 Daftar Issue (Area Not OK)
          <small id="issueCount" class="text-muted"></small>
        </h5>
        <div id="issueListDemo">⏳ Memuat...</div>
      </div>
    </div>
  `;

    row.appendChild(full);
    cont.appendChild(row);
  }

  if (!document.querySelector("#toastContainer")) {
    const tc = document.createElement("div");
    tc.id = "toastContainer";
    document.body.appendChild(tc);
  }
}

/* -----------------------
   STYLES
   ----------------------- */
function injectMinimalStyles() {
  if (document.getElementById("adminDashboardStyles")) return;
  const s = document.createElement("style");
  s.id = "adminDashboardStyles";

  s.textContent = `
  /* ===============================
     🔹 Layout dasar dashboard
     =============================== */
  #dashboardSection {
    min-height: calc(100vh - 100px);
    display: flex;
    flex-direction: column;
  }

  #dashboardMainRow {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 1rem;
  }

  #dashboardMainRow > .col-lg-8,
  #dashboardMainRow > .col-lg-4 {
    display: flex;
    flex-direction: column;
  }

  #dashboardMainRow .card {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-bottom: 1rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    border: none;
  }

  #dashboardMainRow .card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  #dashboardMainRow .table-responsive {
    max-height: 45vh;
    overflow-y: auto;
  }

  /* ===============================
     🔹 Info Box Cards
     =============================== */
  #dashboardCards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 15px;
  }

  .info-box {
    display: flex;
    align-items: center;
    background: #fff;
    border-radius: 10px;
    padding: 14px;
    color: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: transform 0.2s ease;
  }

  .info-box:hover {
    transform: scale(1.02);
  }

  .info-box-icon {
    font-size: 30px;
    margin-right: 12px;
  }

  .info-box-content {
    flex: 1;
  }

  /* ===============================
     🔹 Warna background tiap box
     =============================== */
  .bg-info { background: #039be5; }
  .bg-success { background: #43a047; }
  .bg-danger { background: #e53935; }
  .bg-warning { background: #fbc02d; color: #333; }

  /* ===============================
     🔹 Responsive – 2 kolom di ponsel
     =============================== */
  @media (max-width: 600px) {
    #dashboardCards {
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    #dashboardCards .info-box {
      border-radius: 12px;
      text-align: center;
      flex-direction: column;
      padding: 16px 8px;
    }
    .info-box-icon {
      margin: 0 0 6px 0;
    }
    .info-box-content {
      text-align: center;
    }
  }

  /* ===============================
     🔹 Layar kecil: tumpuk vertikal
     =============================== */
  @media (max-width: 991px) {
    #dashboardMainRow {
      flex-direction: column;
    }
    #dashboardMainRow .col-lg-8,
    #dashboardMainRow .col-lg-4 {
      width: 100%;
    }

    /* ===============================
   🔻 Issue Cards - Area Not OK
   =============================== */
.issue-card {
  background: linear-gradient(135deg, #ff5252, #d50000);
  color: white;
  border-radius: 12px;
  margin-bottom: 10px;
  padding: 12px 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.issue-card:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 10px rgba(0,0,0,0.25);
}

.issue-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.issue-icon {
  font-size: 22px;
  margin-right: 10px;
}

.issue-text {
  flex: 1;
}

.issue-action button {
  border: none;
  background: rgba(255,255,255,0.2);
  color: white;
  border-radius: 8px;
  padding: 4px 8px;
  cursor: pointer;
}

.issue-action button:hover {
  background: rgba(255,255,255,0.3);
}

.navbar {
  background: linear-gradient(135deg, #ef5350, #e53935); /* merah lembut ke agak tua */
  color: #fff !important;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  border-bottom: 2px solid #c62828;
}

/* 🔹 Ikon hamburger */
.navbar .navbar-toggler-icon,
.navbar i,
.navbar button {
  color: #fff !important;
}

/* 🔹 Kalau teks judul di dalam navbar */
.navbar-brand,
.navbar h1,
.navbar h2,
.navbar h3 {
  color: #fff !important;
  font-weight: 600;
}

/* 🔹 Hilangkan garis bawah kalau pakai link */
.navbar a {
  color: #fff !important;
  text-decoration: none;
}

  }

  `;

  document.head.appendChild(s);
}

/* -----------------------
   INIT
   ----------------------- */
/* -----------------------
   INIT (ANTI DOUBLE LISTENER)
   ----------------------- */
let dashboardListenerActive = false;

export async function loadDashboard() {
  try {
    console.log("📊 Memuat Dashboard (hybrid mode)...");

    // 🔹 Hindari double listener
    if (dashboardListenerActive && dashboardUnsub) {
      console.log(
        "⚙️ Listener dashboard sudah aktif — skip inisialisasi ulang."
      );
      return;
    }

    // 🔹 Bersihkan listener lama
    if (dashboardUnsub) {
      dashboardUnsub();
      dashboardUnsub = null;
    }

    ensureDashboardSkeleton();
    injectMinimalStyles();
    setLoadingState();

    await preloadJadwalPatroli();

    // 🔹 Tentukan tanggal hari ini (format sama dengan dailySummary)
    const today = new Date().toLocaleDateString("id-ID");

    /* =====================================================
       1️⃣ AMBIL SUMMARY DARI SERVER (DAILYSUMMARY)
       ===================================================== */
    const docRef = doc(db, "dailySummary", today);
    const snap = await getDocs(
      query(collection(db, "patroli"), where("tanggal", "==", today))
    );

    // realtime summary dari dokumen server-side
    onSnapshot(docRef, (snapSum) => {
      if (snapSum.exists()) {
        console.log("✅ dailySummary ditemukan dari server.");
        renderSummaryFromDailyDoc(snapSum.data());
      } else {
        console.warn("⚠️ dailySummary belum ada, fallback ke client count.");
        // fallback hitung manual dari data patroli
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderSummaryFromDocs(docs);
      }
    });

    /* =====================================================
       2️⃣ RENDER DETAIL (PETUGAS, PERUSAHAAN, ISSUE)
       ===================================================== */
    const q = query(collection(db, "patroli"), where("tanggal", "==", today));

    const firstSnap = await getDocs(q);
    const docs = firstSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log("✅ Data awal dashboard dimuat:", docs.length);

    // render awal
    renderPerusahaanBelumPatroli(docs);
    renderIssues(docs);
    updateSystemStatusBox(docs);

    // 🔄 realtime listener Firestore
    dashboardUnsub = onSnapshot(
      q,
      (snapshot) => {
        const allDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderPerusahaanBelumPatroli(allDocs);
        renderIssues(allDocs);
        updateSystemStatusBox(allDocs);
      },
      (err) => {
        console.error("❌ Listener dashboard error:", err);
        showToastNotif("Listener error: " + err.message, "#e53935");
      }
    );

    dashboardListenerActive = true;
    console.log(
      "✅ Dashboard hybrid aktif (server summary + realtime detail)."
    );
  } catch (err) {
    console.error("❌ loadDashboard hybrid error:", err);
    showToastNotif("Gagal memuat dashboard: " + err.message, "#e53935");
  }
}

/* -----------------------
   🔻 Tambahan opsional
   ----------------------- */
// Fungsi ini bisa dipanggil oleh router.js kalau user pindah tab
export function unloadDashboard() {
  if (dashboardUnsub) {
    console.log("🧹 Mematikan listener dashboard...");
    dashboardUnsub();
    dashboardUnsub = null;
  }
  dashboardListenerActive = false;
}

/* -----------------------
   PRELOAD jadwalPatroli
   ----------------------- */
async function preloadJadwalPatroli() {
  try {
    const snap = await getDocs(collection(db, "jadwalPatroli"));
    jadwalPatroliCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    jadwalPatroliCache.forEach((s) => {
      if (!s.perusahaanNama && s.perusahaan) s.perusahaanNama = s.perusahaan;
    });
  } catch (e) {
    console.warn("Tidak bisa load jadwalPatroli:", e);
    jadwalPatroliCache = [];
  }
}

/* -----------------------
   LISTENER GLOBAL
   ----------------------- */
function listenPatroliRealtime() {
  const today = DATE_KEY();
  const q = query(collection(db, "patroli"), where("tanggal", "==", today));

  onSnapshot(
    q,
    (snapshot) => {
      const currentHash = snapshot.docs
        .map((d) => d.id + (d.updateTime || ""))
        .join("|");
      if (currentHash === lastHash) return;
      lastHash = currentHash;

      allPatroliDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      renderSummaryFromDocs(allPatroliDocs);

      renderIssues(allPatroliDocs);
      renderPerusahaanBelumPatroli(allPatroliDocs);
      updateSystemStatusBox(allPatroliDocs);
    },
    (err) => console.error("Realtime listener failed:", err)
  );
}

/* -----------------------
   dailySummary doc listener
   ----------------------- */
function listenDailySummary() {
  const today = new Date().toLocaleDateString("id-ID");
  const docRef = doc(db, "dailySummary", today);

  onSnapshot(docRef, (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();
    renderSummaryFromDailyDoc(data);

    // kalau mau langsung render perusahaan belum patroli dari summary
    if (data.perusahaanBelumPatroli?.length > 0) {
      const div = document.getElementById("belumPatroliCompanyList");
      div.innerHTML = data.perusahaanBelumPatroli
        .map(
          (n) => `
        <div class="card-warning-company">
          <div><strong>⚠️ ${n}</strong><br><small>Belum kirim laporan hari ini</small></div>
          <span class="badge">Belum Patroli</span>
        </div>`
        )
        .join("");
    }
  });
}

/* -----------------------
   SUMMARY HEADER
   ----------------------- */
function renderSummaryFromDailyDoc(summary) {
  const total = summary.total || 0;
  const ok = summary.okCount || 0;
  const notok = summary.notOkCount || 0;
  const perusahaanAktif = (summary.perusahaanAktif || []).length;

  const cards = document.getElementById("dashboardCards");
  if (!cards) return;
  cards.innerHTML = `
    <div class="col-md-3 col-sm-6 col-12">
      <div class="info-box bg-info">
        <div class="info-box-icon">📋</div>
        <div class="info-box-content">
          <div style="font-weight:600">Total Patroli</div>
          <div style="font-size:20px">${total}</div>
          <small>Total laporan</small>
        </div>
      </div>
    </div>
    <div class="col-md-3 col-sm-6 col-12">
      <div class="info-box bg-success">
        <div class="info-box-icon">✅</div>
        <div class="info-box-content">
          <div style="font-weight:600">Area OK</div>
          <div style="font-size:20px">${ok}</div>
          <small>Patroli berjalan</small>
        </div>
      </div>
    </div>
    <div class="col-md-3 col-sm-6 col-12">
      <div class="info-box bg-danger">
        <div class="info-box-icon">⚠️</div>
        <div class="info-box-content">
          <div style="font-weight:600">Area Not OK</div>
          <div style="font-size:20px">${notok}</div>
          <small>Perlu perhatian</small>
        </div>
      </div>
    </div>
    <div class="col-md-3 col-sm-6 col-12">
      <div id="systemStatusBox" class="info-box bg-warning">
        <div class="info-box-icon"></div>
        <div class="info-box-content">
          <div style="font-weight:600">Kondisi Lapangan</div>
          <div id="systemStatusText">Memuat...</div>
          <small id="systemStatusSub">${perusahaanAktif} perusahaan aktif</small>
        </div>
      </div>
    </div>
  `;
}

function renderSummaryFromDocs(docs) {
  const total = docs.length;
  const ok = docs.filter((d) => d.status === "OK").length;
  const notok = docs.filter((d) => d.status === "Not OK").length;
  const perusahaanAktif = new Set(docs.map((d) => d.perusahaan || "-")).size;
  renderSummaryFromDailyDoc({
    total,
    okCount: ok,
    notOkCount: notok,
    perusahaanAktif: Array.from(new Set(docs.map((d) => d.perusahaan || "-"))),
  });
}

/* -----------------------
   PETUGAS TABLE
   ----------------------- */
/* -----------------------
   ISSUES
   ----------------------- */
function renderIssues(docs) {
  const div = document.getElementById("issueListDemo");
  const badgeCount = document.getElementById("issueCount");
  if (!div) return;
  div.innerHTML = "";

  const issues = docs.filter((d) => d.status === "Not OK");
  if (badgeCount)
    badgeCount.textContent = issues.length ? `(${issues.length})` : "";

  if (!issues.length)
    return (div.innerHTML = `<p class="text-muted">✅ Tidak ada issue hari ini.</p>`);

  // 🔸 Card merah lembut untuk setiap issue
  issues.forEach((it) => {
    const box = document.createElement("div");
    box.className = "issue-card";
    box.id = `issue-${it.id}`;
    box.innerHTML = `
      <div class="issue-content">
        <div class="issue-icon">⚠️</div>
        <div class="issue-text">
          <strong>Area ${escapeHtml(it.area || "-")}</strong><br>
          <small>${escapeHtml(it.perusahaan || "-")} • ${escapeHtml(
      it.jam || "-"
    )}</small><br>
          <small>${escapeHtml(it.keterangan || "Belum ada keterangan")}</small>
        </div>
        <div class="issue-action">
          <button class="btn btn-light btn-sm" onclick="tandaiSelesai('${
            it.id
          }')">✔️</button>
        </div>
      </div>
    `;
    div.appendChild(box);
  });
}

/* -----------------------
   PERUSAHAAN BELUM PATROLI
   ----------------------- */
function renderPerusahaanBelumPatroli(docs) {
  const div = document.getElementById("belumPatroliCompanyList");
  if (!div) return;

  const done = new Set(docs.map((d) => d.perusahaan));
  const now = new Date().getHours();
  const aktifShifts = jadwalPatroliCache.filter((s) => {
    if (!s.jamMulai || !s.jamSelesai) return true;
    const start = parseInt((s.jamMulai || "00:00").split(":")[0]);
    const end = parseInt((s.jamSelesai || "00:00").split(":")[0]);
    return end < start ? now >= start || now < end : now >= start && now < end;
  });

  const belum = aktifShifts.filter((s) => !done.has(s.perusahaanNama));
  if (!belum.length)
    return (div.innerHTML = `<p class="text-muted">✅ Semua perusahaan sudah patroli.</p>`);

  div.innerHTML = belum
    .map(
      (s) => `
    <div class="card-warning-company">
      <div><strong>⚠️ ${escapeHtml(
        s.perusahaanNama
      )}</strong><br><small>Shift ${escapeHtml(s.nama || "-")} • ${escapeHtml(
        s.jamMulai || ""
      )}–${escapeHtml(s.jamSelesai || "")}</small></div>
      <span class="badge">Belum Patroli</span>
    </div>
  `
    )
    .join("");
}

/* -----------------------
   STATUS BOX
   ----------------------- */
function updateSystemStatusBox(docs) {
  const box = document.getElementById("systemStatusBox");
  const text = document.getElementById("systemStatusText");
  const sub = document.getElementById("systemStatusSub");
  if (!box || !text) return;

  const notok = docs.filter((d) => d.status === "Not OK").length;
  const perusahaanCount = new Set(docs.map((d) => d.perusahaan)).size;

  if (!docs.length) {
    text.innerText = "🕒 Belum ada aktivitas patroli";
    sub.innerText = "Menunggu laporan dari petugas...";
    box.style.background = "linear-gradient(90deg,#ffeb3b,#fbc02d)";
  } else if (notok === 0) {
    text.innerText = "✅ Semua area patroli normal";
    sub.innerText = `${perusahaanCount} perusahaan aktif patroli hari ini`;
    box.style.background = "linear-gradient(90deg,#00c853,#b2ff59)";
  } else {
    text.innerText = `⚠️ ${notok} area perlu perhatian`;
    sub.innerText = `${perusahaanCount} perusahaan aktif patroli hari ini`;
    box.style.background = "linear-gradient(90deg,#ff5252,#d50000)";
  }
}

/* -----------------------
   HELPERS
   ----------------------- */
function setLoadingState() {
  const petugas = document.getElementById("petugasTableDemo");
  if (petugas)
    petugas.innerHTML = `<tr><td colspan="6">⏳ Memuat data...</td></tr>`;
  const issues = document.getElementById("issueListDemo");
  if (issues) issues.innerHTML = `⏳ Memuat...`;
  const belum = document.getElementById("belumPatroliCompanyList");
  if (belum) belum.innerHTML = `⏳ Memuat...`;
  const cards = document.getElementById("dashboardCards");
  if (cards)
    cards.innerHTML = `<div class="col-12 text-center text-muted">⏳ Memuat data dashboard...</div>`;
}
function escapeHtml(s) {
  if (!s && s !== 0) return "";
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}
window.tandaiSelesai = async function (id) {
  if (!confirm("Apakah issue ini sudah selesai?")) return;
  try {
    await updateDoc(doc(db, "patroli", id), { status: "OK" });
    showToastNotif("✅ Issue ditandai selesai", "#43a047");
  } catch (e) {
    console.error("tandaiSelesai err:", e);
    showToastNotif("Gagal update issue", "#e53935");
  }
};
window.showToastNotif = function (msg, color = "#333") {
  const tc = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.innerText = msg;
  Object.assign(t.style, {
    background: color,
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "8px",
    margin: "8px",
    boxShadow: "0 3px 8px rgba(0,0,0,0.12)",
  });
  tc.appendChild(t);
  setTimeout(() => (t.style.opacity = "1"), 20);
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 400);
  }, 3800);
};

/* -----------------------
   Public default export
   ----------------------- */
export default {
  loadDashboard,
};
