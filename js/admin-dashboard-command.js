// js/admin-dashboard-command.js
// Command Center style replacement for admin-dashboard.js
// Compatible with your SPA router: exports default { loadDashboard } and named export unloadDashboard

import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================
   GLOBALS & CACHES
   ========================= */
const DATE_KEY = (d = new Date()) => d.toLocaleDateString("id-ID");
let jadwalPatroliCache = [];
let lastHash = "";
let allPatroliDocs = [];
let dashboardUnsub = null; // realtime listener
let dashboardListenerActive = false;

/* =========================
   BOOTSTRAP / SKELETON
   ========================= */
function ensureDashboardSkeleton() {
  // Ensure parent container exists (router shows #dashboardSection)
  let dashboardSection = document.getElementById("dashboardSection");
  if (!dashboardSection) {
    dashboardSection = document.createElement("section");
    dashboardSection.id = "dashboardSection";
    dashboardSection.className = "content";
    // if router doesn't have it, prepend to body
    document.body.prepend(dashboardSection);
  }

  // Command header (small & non-intrusive)
  if (!dashboardSection.querySelector(".command-header")) {
    const hdr = document.createElement("div");
    hdr.className = "command-header";
    hdr.innerHTML = `
      <div class="cmd-left">
        <div class="cmd-title">🛰️ Command Center Patroli</div>
        <div class="cmd-sub">Status Operasional & Live Feed</div>
      </div>
      <div class="cmd-right">
        <div id="headerTime" class="header-time" aria-live="polite">--:--:--</div>
      </div>
    `;
    dashboardSection.appendChild(hdr);
  }

  // Main container
  if (!dashboardSection.querySelector(".cc-container")) {
    const cont = document.createElement("div");
    cont.className = "cc-container";
    cont.innerHTML = `
    <!-- 🔹 Status Kondisi Lapangan -->
    <div id="systemWrap" class="card card-glass mb-3">
      <div class="card-body">
        <h5 class="card-title">📡 Kondisi Lapangan</h5>
        <div id="systemStatusBox" class="system-box">
          <div class="system-main">
            <div class="system-info">
              <div style="font-weight:700">Status Hari Ini</div>
              <div id="systemStatusText" style="font-size:18px">Memuat...</div>
              <small id="systemStatusSub" class="muted small"></small>
            </div>
            <div class="system-badge" id="systemBadge"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 🔹 Ringkasan Patroli -->
    

    <!-- 🔹 Live Feed Issue -->
    <div id="feedWrap" class="card card-glass mb-3">
      <div class="card-body">
        <h5 class="card-title">🚨 Live Feed Issue</h5>
        <div id="liveFeed" class="live-feed">⏳ Menunggu feed...</div>
      </div>
    </div>

    <!-- 🔹 Daftar Issue Area Not OK -->
    <div id="issuesWrap" class="card card-glass mb-3">
      <div class="card-body">
        <h5 class="card-title">🏢 Daftar Issue (Area Not OK)
          <small id="issueCount" class="text-muted"></small>
        </h5>
        <div id="issueListDemo">⏳ Memuat...</div>
      </div>
    </div>
  `;
    dashboardSection.appendChild(cont);
  }

  // Toast container
  if (!document.getElementById("toastContainer")) {
    const tc = document.createElement("div");
    tc.id = "toastContainer";
    tc.className = "toast-container";
    document.body.appendChild(tc);
  }
}

/* =========================
   STYLES (dark futuristik)
   ========================= */
function injectCommandCenterStyles() {
  if (document.getElementById("adminDashboardCommandStyles")) return;
  const s = document.createElement("style");
  s.id = "adminDashboardCommandStyles";

  s.textContent = `
  :root {
    --bg-1:#071028;
    --bg-2:#0f1b33;
    --glass: rgba(255,255,255,0.04);
    --muted: rgba(255,255,255,0.6);
    --accent:#00e5ff;
    --success:#00e676;
    --danger:#ff5252;
    --card-radius:12px;
  }

  /* ========== Layout Global ========== */
  body, #dashboardSection {
    background: radial-gradient(circle at 10% 10%, var(--bg-1) 0%, var(--bg-2) 60%);
    color: #e6f7ff;
    font-family: Inter, Roboto, "Segoe UI", system-ui, -apple-system, sans-serif;
  }

  .command-header {
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:10px 14px;
    border-bottom:1px solid rgba(255,255,255,0.04);
    gap:12px;
  }
  .command-header .cmd-title {
    color:var(--accent);
    font-weight:700;
    font-size:15px;
  }
  .command-header .cmd-sub {
    color:var(--muted);
    font-size:12px;
    margin-top:2px;
  }
  .header-time {
    font-family:'Orbitron', monospace;
    color:#aeefff;
    font-weight:600;
    font-size:14px;
    text-align:right;
  }

  .cc-container {
    max-width:1200px;
    margin:14px auto;
    padding:12px;
    box-sizing:border-box;
  }

  /* ========== Cards & Grid ========== */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }

  .card {
    border-radius: var(--card-radius);
    overflow:hidden;
    border:1px solid rgba(255,255,255,0.04);
  }
  .card-glass {
    background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
    box-shadow: 0 6px 18px rgba(0,0,0,0.45);
  }
  .card .card-body {
    padding:12px;
  }

  /* ========== Stat Cards ========== */
  .stat-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    text-align: center;
    margin-top: 10px;
  }
  .stat-item {
    border-radius: 12px;
    padding: 14px 6px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .stat-item:hover {
    transform: scale(1.05);
    box-shadow: 0 0 12px rgba(255,255,255,0.1);
  }
  .stat-item h2 {
    margin: 4px 0 2px;
    font-size: 22px;
    color: #fff;
  }
  .stat-item p {
    margin: 0;
    font-size: 13px;
    color: rgba(255,255,255,0.7);
  }
  .stat-item .icon {
    font-size: 22px;
    opacity: 0.8;
    margin-bottom: 2px;
  }
  .stat-item.total { background: linear-gradient(180deg, #0288d1aa, #0277bda0); }
  .stat-item.ok { background: linear-gradient(180deg, #00c853aa, #43a047a0); }
  .stat-item.danger { background: linear-gradient(180deg, #ff5252aa, #d32f2fa0); }

  /* ========== Perusahaan Belum Patroli ========== */
  .belum-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    margin-bottom: 10px;
    border-radius: 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
  .belum-card:hover {
    transform: translateY(-2px);
    background: rgba(255,255,255,0.06);
    box-shadow: 0 6px 14px rgba(0,0,0,0.3);
  }
  .belum-left { display:flex; align-items:flex-start; gap:12px; }
  .belum-icon { font-size:22px; margin-top:2px; }
  .belum-nama {
    font-weight:700;
    color:#ffcc80;
    font-size:15px;
  }
  .belum-shift {
    font-size:13px;
    color:rgba(255,255,255,0.8);
    margin-top:4px;
  }
  .belum-shift .label { color:rgba(255,255,255,0.5); }
  .belum-shift .dot {
    display:inline-block;
    width:6px; height:6px;
    background:rgba(255,255,255,0.3);
    border-radius:50%; margin:0 6px;
  }
  .belum-badge {
    background: linear-gradient(90deg, #ff7043, #d84315);
    color:#fff; font-weight:700;
    border-radius:8px;
    padding:6px 10px;
    font-size:12px;
    box-shadow:0 2px 6px rgba(0,0,0,0.3);
  }

  /* ========== Issue List per Perusahaan ========== */
  .issue-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 10px;
    transition: all 0.2s ease;
  }
  .issue-card:hover {
    background: rgba(255,255,255,0.05);
    transform: translateY(-2px);
  }

  /* ========== Live Feed Issue (Kuning Berkedip) ========== */
  @keyframes pulseAlert {
    0% { box-shadow: 0 0 8px rgba(255,193,7,0.5); }
    50% { box-shadow: 0 0 20px rgba(255,87,34,0.8); }
    100% { box-shadow: 0 0 8px rgba(255,193,7,0.5); }
  }
  .live-item {
    background: linear-gradient(135deg, #ff9800 0%, #ffeb3b 100%);
    border-left: 5px solid #ff5722;
    border-radius: 12px;
    padding: 12px 14px;
    margin-bottom: 10px;
    color: #1a1a1a;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 10px rgba(255,193,7,0.4);
    animation: pulseAlert 2.5s infinite ease-in-out;
    transition: transform 0.2s ease;
  }
  .live-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(255,87,34,0.6);
  }
  .live-item strong { color:#000; font-weight:700; }
  .live-item small {
    display:block;
    margin-top:2px;
    font-size:13px;
    color:#212121;
  }
  .live-item .live-issue {
    margin-top:6px;
    color:#000;
    font-weight:600;
    font-style:italic;
    background:rgba(255,255,255,0.25);
    padding:4px 6px;
    border-radius:6px;
    display:inline-block;
  }

  /* ✅ Tombol Centang di Live Feed */
  .btn-check {
    background: linear-gradient(90deg, #4caf50, #2e7d32);
    color:#fff;
    border:none;
    border-radius:50%;
    width:36px; height:36px;
    font-size:18px;
    font-weight:bold;
    cursor:pointer;
    box-shadow:0 3px 6px rgba(0,0,0,0.3);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .btn-check:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 10px rgba(0,255,0,0.3);
  }

  /* ✨ Fade-out animasi saat issue diselesaikan */
  .live-item.removing {
    opacity: 0;
    transform: scale(0.98);
    filter: brightness(0.8);
    transition: all 0.4s ease-in-out;
  }

  /* ========== Responsive ========== */
  @media (max-width:820px){
    .cards-grid{ grid-template-columns: repeat(2,1fr); }
    .command-header{ flex-direction:column; align-items:flex-start; gap:6px; padding:10px; }
    .header-time{ align-self:flex-end; }
  }
  @media (max-width:420px){
    .cards-grid{ grid-template-columns: repeat(2,1fr); gap:8px; }
    .header-time{ font-size:12px; }
  }

  /* ========== Status Koneksi ========== */
  #connStatus.online{ color: var(--success); font-weight:700; }
  #connStatus.offline{ color: var(--danger); font-weight:700; }
  `;

  document.head.appendChild(s);
}

/* =========================
   HELPERS
   ========================= */
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

// bnearrrrrrrrrrrrrrrrrrrr
function setLoadingState() {
  const issues = document.getElementById("issueListDemo");
  if (issues) issues.innerHTML = `⏳ Memuat data issue...`;

  const belum = document.getElementById("belumPatroliCompanyList");
  if (belum) belum.innerHTML = `⏳ Memuat daftar perusahaan...`;

  const live = document.getElementById("liveFeed");
  if (live) live.innerHTML = `⏳ Menunggu feed issue...`;
}

// salahhhhhhhhhhhhhhhhhh
// function setLoadingState() {
//   const cards = document.getElementById("dashboardCards");
//   if (cards)
//     if (issues)
//            cards.innerHTML = `<div class="col-12 text-center muted"> Memuat data dashboard...</div>`;
//        const issues = document.getElementById("issueListDemo");
//       issues.innerHTML = ` Memuat...`;
//   const belum = document.getElementById("belumPatroliCompanyList");
//   if (belum) belum.innerHTML = ` Memuat...`;
//   const live = document.getElementById("liveFeed");
//   if (live) live.innerHTML = ` Menunggu feed...`;
// }

/* Toast */
window.showToastNotif = function (msg, color = "#333") {
  const tc = document.getElementById("toastContainer");
  if (!tc) return;
  const t = document.createElement("div");
  t.innerText = msg;
  Object.assign(t.style, {
    background: color,
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "8px",
    marginTop: "8px",
    boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
    maxWidth: "320px",
    fontWeight: 600,
  });
  tc.appendChild(t);
  setTimeout(() => (t.style.opacity = "1"), 20);
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 400);
  }, 3800);
};

// ==============================
// 🔹 Ambil Ringkasan Harian dari Firestore + Cache Browser 10 detik
// ==============================
let summaryCache = { data: null, timestamp: 0 };

// export async function renderSummaryFromDailyDoc(forceRefresh = false) {
//   try {
//     const now = Date.now();

//     // 🧠 Gunakan cache jika belum 10 detik
//     if (
//       !forceRefresh &&
//       summaryCache.data &&
//       now - summaryCache.timestamp < 10000
//     ) {
//       console.log("🟢 Menggunakan cache summary (hemat read)");
//       updateSummaryUI(summaryCache.data);
//       return;
//     }

//     const today = new Date().toISOString().split("T")[0]; // yyyy-mm-dd
//     const res = await fetch(
//       `https://firestore.googleapis.com/v1/projects/giat-scurity/databases/(default)/documents/dailySummary/${today}`
//     );

//     if (!res.ok) {
//       console.warn("⚠️ Tidak bisa ambil dailySummary:", res.status);
//       return;
//     }

//     const data = await res.json();
//     const fields = data.fields || {};

//     let total = 0,
//       ok = 0,
//       notok = 0;

//     for (const [nama, val] of Object.entries(fields)) {
//       const f = val.mapValue.fields;
//       total += parseInt(f.total?.integerValue || 0);
//       ok += parseInt(f.ok?.integerValue || 0);
//       notok += parseInt(f.notok?.integerValue || 0);
//     }

//     const summary = { total, ok, notok };
//     summaryCache = { data: summary, timestamp: now }; // simpan cache
//     console.log("📦 Summary Firestore diperbarui:", summary);

//     updateSummaryUI(summary);
//   } catch (err) {
//     console.error("❌ renderSummaryFromDailyDoc error:", err);
//     const cards = document.getElementById("dashboardCards");
//     if (cards)
//       cards.innerHTML = `<p class="muted text-center">⚠️ Tidak bisa memuat data summary.</p>`;
//   }
// }

// function updateSummaryUI(summary) {
//   const { total, ok, notok } = summary;
//   const cards = document.getElementById("dashboardCards");
//   if (!cards) return;

//   cards.innerHTML = `
//     <div class="stat-row">
//       <div class="stat-item total">
//         <div class="icon">📋</div>
//         <h2>${total}</h2>
//         <p>Total Patroli</p>
//       </div>
//       <div class="stat-item ok">
//         <div class="icon">✅</div>
//         <h2>${ok}</h2>
//         <p>Area OK</p>
//       </div>
//       <div class="stat-item danger">
//         <div class="icon">⚠️</div>
//         <h2>${notok}</h2>
//         <p>Area Not OK</p>
//       </div>
//     </div>
//   `;
// }

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

/* Issues list */
function renderIssues(docs) {
  const div = document.getElementById("issueListDemo");
  const badgeCount = document.getElementById("issueCount");
  if (!div) return;
  div.innerHTML = "";

  if (!docs.length) {
    if (badgeCount) badgeCount.textContent = "";
    div.innerHTML = `<p class="muted">✅ Tidak ada issue aktif hari ini.</p>`;
    return;
  }

  // 🔹 Kelompokkan per perusahaan
  const grouped = docs.reduce((acc, d) => {
    const key = d.perusahaan || "Tanpa Nama";
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  // 🔹 Update jumlah total perusahaan bermasalah
  const totalCompanies = Object.keys(grouped).length;
  if (badgeCount) badgeCount.textContent = `(${totalCompanies})`;

  // 🔹 Render daftar perusahaan + jumlah issue
  Object.entries(grouped).forEach(([nama, arr]) => {
    const item = document.createElement("div");
    item.className = "issue-card";
    item.innerHTML = `
      <div class="issue-content">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="font-size:20px">🏢</div>
          <div>
            <strong>${escapeHtml(nama)}</strong><br>
            <small class="muted">${arr.length} Issue${
      arr.length > 1 ? "s" : ""
    }</small>
          </div>
        </div>
      </div>
    `;
    div.appendChild(item);
  });
}

/* Perusahaan belum patroli */
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
  if (!belum.length) {
    div.innerHTML = `<p class="muted">✅ Semua perusahaan sudah patroli.</p>`;
    return;
  }

  div.innerHTML = belum
    .map(
      (s) => `
      <div class="belum-card">
        <div class="belum-left">
          <div class="belum-icon">⚠️</div>
          <div class="belum-info">
            <div class="belum-nama">${escapeHtml(s.perusahaanNama)}</div>
            <div class="belum-shift">
              <span class="label">Shift:</span> ${escapeHtml(s.nama || "-")}
              <span class="dot"></span>
              <span class="label">Jam:</span> ${escapeHtml(
                s.jamMulai || ""
              )}–${escapeHtml(s.jamSelesai || "")}
            </div>
          </div>
        </div>
        <div class="belum-right">
          <span class="belum-badge">Belum Patroli</span>
        </div>
      </div>
    `
    )
    .join("");
}

/* System status box */
function updateSystemStatusBox(docs) {
  const box = document.getElementById("systemStatusBox");
  const text = document.getElementById("systemStatusText");
  const sub = document.getElementById("systemStatusSub");
  const badge = document.getElementById("systemBadge");
  const textSmall = document.getElementById("systemStatusTextSmall");
  if (!box || !text) return;

  const notok = docs.filter((d) => d.status === "Not OK").length;
  const perusahaanCount = new Set(docs.map((d) => d.perusahaan)).size;

  if (!docs.length) {
    text.innerText = "🕒 Belum ada aktivitas patroli";
    sub.innerText = "Menunggu laporan dari petugas...";
    badge.innerText = "STANDBY";
    badge.style.background = "linear-gradient(90deg,#ffeb3b,#fbc02d)";
    if (textSmall) textSmall.innerText = "Belum ada aktivitas";
  } else if (notok === 0) {
    text.innerText = "✅ Semua area patroli normal";
    sub.innerText = `${perusahaanCount} perusahaan aktif patroli hari ini`;
    badge.innerText = "NORMAL";
    badge.style.background = "linear-gradient(90deg,#00c853,#8ef57c)";
    if (textSmall) textSmall.innerText = "Semua area OK";
  } else {
    text.innerText = `⚠️ ${notok} area perlu perhatian`;
    sub.innerText = `${perusahaanCount} perusahaan aktif patroli hari ini`;
    badge.innerText = "ISSUE";
    badge.style.background = "linear-gradient(90deg,#ff5252,#d50000)";
    if (textSmall) textSmall.innerText = `${notok} issue`;
  }
}

/* Live feed small summary */
function updateLiveFeed(docs) {
  const live = document.getElementById("liveFeed");
  if (!live) return;
  live.innerHTML = "";

  if (!docs.length) {
    live.innerHTML = `<div class="live-item muted">✅ Tidak ada issue aktif.</div>`;
    return;
  }

  const sorted = docs.slice().sort((a, b) => {
    const ta = a.timestamp?.seconds ? a.timestamp.seconds : 0;
    const tb = b.timestamp?.seconds ? b.timestamp.seconds : 0;
    return tb - ta;
  });

  const recent = sorted.slice(0, 20);

  recent.forEach((r) => {
    const waktu = r.timestamp?.seconds
      ? new Date(r.timestamp.seconds * 1000).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : r.jam || "-";
    const area = r.area || "-";
    const nama = r.nama || "-";
    const perusahaan = r.perusahaan || "-";
    const ket = r.keterangan || "(Tidak ada keterangan)";

    const item = document.createElement("div");
    item.className = "live-item";
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <strong>👮‍♂️ ${escapeHtml(nama)}</strong> — ${escapeHtml(
      perusahaan
    )}<br>
          <small>🕓 ${escapeHtml(waktu)} • Area: ${escapeHtml(area)}</small><br>
          <div class="live-issue">🔹 ${escapeHtml(ket)}</div>
        </div>
        <button class="btn-check" onclick="tandaiSelesai('${r.id}')">✅</button>
      </div>
    `;
    live.appendChild(item);
  });
}

/* =========================
   PRELOAD jadwalPatroli
   ========================= */
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

/* =========================
   ACTIONS
   ========================= */
window.tandaiSelesai = async function (id) {
  const card = document
    .querySelector(`[onclick*="${id}"]`)
    ?.closest(".live-item");

  if (!confirm("Apakah issue ini sudah ditangani dan selesai?")) return;

  try {
    // 💫 Tambahkan class animasi fade-out
    if (card) {
      card.classList.add("removing");
    }

    // Tunggu animasi selesai (~400ms)
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Update status di Firestore
    await updateDoc(doc(db, "patroli", id), { status: "OK" });

    showToastNotif("✅ Issue ditandai selesai", "#43a047");
  } catch (e) {
    console.error("tandaiSelesai err:", e);
    showToastNotif("Gagal update issue", "#e53935");

    // Kalau gagal, kembalikan warna
    if (card) card.classList.remove("removing");
  }
};

/* =========================
   CONNECTION STATUS (header/footer)
   ========================= */
function initConnectionStatus() {
  const el = document.getElementById("connStatus");
  if (!el) return;
  function setOnline() {
    el.className = "online";
    el.textContent = "Online";
  }
  function setOffline() {
    el.className = "offline";
    el.textContent = "Offline";
  }
  window.addEventListener("online", setOnline);
  window.addEventListener("offline", setOffline);
  // initial
  if (navigator.onLine) setOnline();
  else setOffline();
}

/* =========================
   CLOCK (non-intrusive)
   ========================= */
function initHeaderClock() {
  const el = document.getElementById("headerTime");
  if (!el) return;
  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleTimeString("id-ID");
  }
  tick();
  setInterval(tick, 1000);
}

/* =========================
   LISTENERS: realtime patroli
   ========================= */
function listenPatroliRealtime() {
  const today = DATE_KEY();

  // 🔹 Ambil hanya laporan Not OK (hemat baca)
  const q = query(
    collection(db, "patroli"),
    where("tanggal", "==", today),
    where("status", "==", "Not OK")
  );

  if (dashboardUnsub) dashboardUnsub();

  dashboardUnsub = onSnapshot(
    q,
    (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // 🔹 Update tampilan sesuai data aktif
      renderIssues(docs);
      updateLiveFeed(docs);
      updateSystemStatusBox(docs);
    },
    (err) => {
      console.error("Realtime listener failed:", err);
      showToastNotif("Listener error: " + err.message, "#e53935");
    }
  );
}

/* =========================
   PUBLIC: loadDashboard
   ========================= */
export async function loadDashboard() {
  try {
    // console.log("📊 Memuat Dashboard Command Center...");

    if (dashboardListenerActive && dashboardUnsub) {
      console.log("⚙️ Listener dashboard sudah aktif — skip init ulang.");
      ensureDashboardSkeleton();
      injectCommandCenterStyles();
      initHeaderClock();
      initConnectionStatus();
      return;
    }

    ensureDashboardSkeleton();
    injectCommandCenterStyles();
    setLoadingState();

    await preloadJadwalPatroli();

    // 🔹 Tidak ambil summary lagi (hemat read)
    // await renderSummaryFromDailyDoc(true);

    // 🔹 Jalankan realtime issue & feed
    listenPatroliRealtime();

    initHeaderClock();
    initConnectionStatus();

    dashboardListenerActive = true;
    console.log("✅ Dashboard Command Center aktif (Realtime Mode).");
  } catch (err) {
    console.error("❌ loadDashboard error:", err);
    showToastNotif("Gagal memuat dashboard: " + err.message, "#e53935");
  }
}

/* =========================
   PUBLIC: unloadDashboard (named export)
   ========================= */
export function unloadDashboard() {
  if (dashboardUnsub) {
    console.log("🧹 Mematikan listener dashboard...");
    dashboardUnsub();
    dashboardUnsub = null;
  }
  dashboardListenerActive = false;
  // keep DOM so router can show/hide; do not remove elements to allow quick reload
}

/* =========================
   default export (for router import)
   ========================= */
export default {
  loadDashboard,
};
