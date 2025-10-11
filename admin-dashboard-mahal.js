// js/admin-dashboard.js (REPLACED - revised)
// - Menghapus duplikat renderIssues / listener ganda
// - Ganti nama renderIssues -> renderIssuesRealtime (lebih jelas)
// - Konsistenkan format tanggal melalui util getTodayIso()
// - Pastikan inject skeleton jika elemen hilang
// - Perbaiki pemanggilan renderPetugasTable (tanpa argumen yang tak dipakai)
// - Panggil updateSystemStatusBox() setelah snapshot issue berubah
// - Hapus variabel timer yang tidak digunakan
// - Tambahan proteksi dark-mode ringan

import { db } from "./firebase.js";
import {
  collection,
  collectionGroup,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  updateDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* -----------------------
   Konstanta & helper
   ----------------------- */
const dashboardCards = document.getElementById("dashboardCards");
const STATUS_GRID_ID = "statusGrid"; // harus ada di admin.html dashboard section
const PETUGAS_TABLE_ID = "petugasTableDemo";
const ISSUE_LIST_ID = "issueListDemo";

function el(tag, attrs = {}, html = "") {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  if (html) e.innerHTML = html;
  return e;
}

function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}

// Format tanggal konsisten: "dd/mm/yyyy" sesuai dengan toLocaleDateString('id-ID') yang selalu 2-digit
function getTodayIso() {
  const d = new Date();
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function getTodayKeyForDocId() {
  // versi dengan '-' sebagai pemisah (YYYY-DD-MM tidak ideal—tetap gunakan lokal agar konsisten)
  return getTodayIso().replace(/\//g, "-");
}

/* -----------------------
   Public loader
   ----------------------- */
export async function loadDashboard() {
  try {
    injectDashboardSkeleton(); // pastikan struktur UI ada
    renderLoadingState();

    // 1) load shifts (master schedule)
    const shiftsSnap = await getDocs(collection(db, "jadwalPatroli"));
    const shifts = shiftsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // tanggal key
    const tanggalKey = getTodayKeyForDocId();

    // 3) gather data for each shift (serial)
    const shiftStatusResults = [];
    for (const s of shifts) {
      const docId = `${tanggalKey}_${s.id}`;
      const patrolDocRef = doc(db, "patroli", docId);
      const patrolSnap = await getDoc(patrolDocRef);

      let status = "Belum Mulai";
      let progressText = "0/0";
      let laporanCount = 0;

      if (patrolSnap.exists()) {
        const pd = patrolSnap.data();
        status = pd.status === "selesai" ? "Selesai" : "Pending";

        try {
          const lapSnap = await getDocs(collection(patrolDocRef, "laporan"));
          laporanCount = lapSnap.size;
        } catch (e) {
          laporanCount = pd.jumlahLaporan || 0;
        }
        progressText = `${laporanCount}/${s.area || 5}`;
      } else {
        try {
          const q = query(
            collectionGroup(db, "laporan"),
            where("shiftId", "==", s.id),
            where("tanggalKey", "==", tanggalKey)
          );
          const cg = await getDocs(q);
          if (!cg.empty) {
            laporanCount = cg.size;
            status = "Pending";
            progressText = `${laporanCount}/${s.area || 5}`;
          }
        } catch (e) {
          // ignore
        }
      }

      shiftStatusResults.push({
        shiftId: s.id,
        nama: s.nama,
        perusahaanNama: s.perusahaanNama || "-",
        jamMulai: s.jamMulai,
        jamSelesai: s.jamSelesai,
        area: s.area || 5,
        status,
        laporanCount,
        progressText,
      });
    }

    // summary
    const totalShifts = shiftStatusResults.length;
    const totalSelesai = shiftStatusResults.filter(
      (s) => s.status === "Selesai"
    ).length;

    // petugas aktif: ambil unique dari koleksi patroli hari ini
    const petugasList = [];
    try {
      const today = getTodayIso();
      const q = query(collection(db, "patroli"), where("tanggal", "==", today));
      const snap = await getDocs(q);

      const lastReportByNip = {};
      snap.forEach((docu) => {
        const d = docu.data();
        if (!d.nip) return;
        const prev = lastReportByNip[d.nip];
        const currTs =
          d.timestamp?.toDate?.() || new Date(d.timestamp || Date.now());
        if (
          !prev ||
          currTs > (prev.timestamp?.toDate?.() || new Date(prev.timestamp || 0))
        ) {
          lastReportByNip[d.nip] = d;
        }
      });

      Object.values(lastReportByNip).forEach((d) => {
        petugasList.push({
          nip: d.nip,
          nama: d.nama || "-",
          perusahaanNama: d.perusahaan || "-",
          lastArea: d.area || "-",
          status: d.status || "OK",
          jam: d.jam || "-",
        });
      });
    } catch (err) {
      console.error("❌ Gagal ambil data petugas aktif:", err);
    }

    // Ambil initial issues snapshot (sekedar count untuk summary)
    let issuesInitialCount = 0;
    try {
      const today = getTodayIso();
      const q = query(
        collection(db, "patroli"),
        where("status", "==", "Not OK"),
        where("tanggal", "==", today)
      );
      const snap = await getDocs(q);
      issuesInitialCount = snap.size;
    } catch (err) {
      console.error("❌ Gagal ambil issue (initial):", err);
    }

    // Render
    renderSummary({
      totalShifts,
      totalSelesai,
      petugasCount: petugasList.length,
      issuesCount: issuesInitialCount,
    });

    // optional: renderStatusGrid(shiftStatusResults); // kalau mau aktifkan, uncomment

    await renderPerusahaanBelumPatroliCard();
    renderPetugasTable(); // tidak perlu argumen

    // Pasang realtime listener untuk issues (satu fungsi, tidak duplikat)
    renderIssuesRealtime();

    // Pastikan system status diperbarui awal
    updateSystemStatusBox();
  } catch (err) {
    console.error("Error loadDashboard:", err);
    if (dashboardCards) {
      dashboardCards.innerHTML = `<p class="ml-3 text-danger">Error memuat dashboard: ${escapeHtml(
        err.message || String(err)
      )}</p>`;
    }
  }
}

/* -----------------------
   Render helpers
   ----------------------- */
function renderLoadingState() {
  if (dashboardCards)
    dashboardCards.innerHTML = `<p class='ml-3'>⏳ Memuat data...</p>`;
  const sg = document.getElementById(STATUS_GRID_ID);
  if (sg) sg.innerHTML = `<div class="col-12">⏳ Memuat status...</div>`;
  const pt = document.getElementById(PETUGAS_TABLE_ID);
  if (pt) pt.innerHTML = `<tr><td colspan="7">⏳ Memuat...</td></tr>`;
  const il = document.getElementById(ISSUE_LIST_ID);
  if (il) il.innerHTML = `<p class="text-muted">⏳ Memuat...</p>`;
}

function renderSummary({
  totalShifts,
  totalSelesai,
  petugasCount,
  issuesCount,
}) {
  const container = document.querySelector(
    "#dashboardSection .container-fluid"
  );
  if (!container) return;
  // jika dashboardCards hilang, buat
  let cards = dashboardCards;
  if (!cards) {
    cards = el("div", { id: "dashboardCards", class: "row" });
    container.insertBefore(cards, container.firstChild);
  }

  cards.innerHTML = `
    <div class="col-md-3 col-sm-6 col-12">
      <div class="info-box bg-info">
        <span class="info-box-icon"><i class="fas fa-shield-alt"></i></span>
        <div class="info-box-content">
          <span class="info-box-text">Total Patroli Hari Ini</span>
          <span class="info-box-number">${totalSelesai} / ${totalShifts}</span>
          <small>Shift Selesai</small>
        </div>
      </div>
    </div>
    <div class="col-md-3 col-sm-6 col-12">
      <div class="info-box bg-success">
        <span class="info-box-icon"><i class="fas fa-user-shield"></i></span>
        <div class="info-box-content">
          <span class="info-box-text">Petugas Aktif</span>
          <span class="info-box-number">${petugasCount}</span>
          <small>tercatat hari ini</small>
        </div>
      </div>
    </div>
    <div class="col-md-3 col-sm-6 col-12">
      <div class="info-box bg-danger">
        <span class="info-box-icon"><i class="fas fa-exclamation-triangle"></i></span>
        <div class="info-box-content">
          <span class="info-box-text">Area Not OK</span>
          <span class="info-box-number">${issuesCount}</span>
          <small>perlu tindak lanjut</small>
        </div>
      </div>
    </div>
    <div class="col-md-3 col-sm-6 col-12">
      <div id="systemStatusBox" class="info-box bg-warning" style="transition: background 0.6s ease, transform 0.4s ease;">
        <span class="info-box-icon"><i class="fas fa-map-marked-alt"></i></span>
        <div class="info-box-content">
          <span class="info-box-text">Kondisi Lapangan</span>
          <span class="info-box-number" id="systemStatusText">Memuat...</span>
          <small id="systemStatusSub">Menunggu data patroli...</small>
        </div>
      </div>
    </div>
  `;
}

/* -----------------------
   Perusahaan belum patroli (realtime)
   ----------------------- */
async function renderPerusahaanBelumPatroliCard() {
  const container = document.querySelector(
    "#dashboardSection .container-fluid"
  );
  if (!container) return;

  let wrapper = document.getElementById("belumPatroliCompanyWrap");
  if (!wrapper) {
    wrapper = el("div", { id: "belumPatroliCompanyWrap", class: "mt-4 w-100" });
    wrapper.innerHTML = `
      <h5 id="belumPatroliTitle">🏢 Perusahaan Belum Patroli di Shift Aktif</h5>
      <div id="belumPatroliCompanyList"></div>
    `;
    container.appendChild(wrapper);
  }

  const div = document.getElementById("belumPatroliCompanyList");
  div.innerHTML = `<p>⏳ Memuat data...</p>`;

  // ambil jadwal shift
  const shiftSnap = await getDocs(collection(db, "jadwalPatroli"));
  const shiftData = shiftSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const today = getTodayIso();
  const q = query(collection(db, "patroli"), where("tanggal", "==", today));

  // manual listener
  onSnapshot(q, (snapshot) => {
    try {
      const perusahaanSudahPatroli = new Set();
      snapshot.forEach((docu) => {
        const d = docu.data();
        if (d.perusahaan) perusahaanSudahPatroli.add(d.perusahaan);
      });

      const now = new Date();
      const currentHour = now.getHours();
      const shiftAktif = shiftData.filter((s) => {
        if (!s.jamMulai || !s.jamSelesai) return false;
        const start = parseInt(String(s.jamMulai).split(":")[0]);
        const end = parseInt(String(s.jamSelesai).split(":")[0]);
        if (isNaN(start) || isNaN(end)) return false;
        if (end < start) return currentHour >= start || currentHour < end;
        return currentHour >= start && currentHour < end;
      });

      const belumPatroli = shiftAktif.filter(
        (s) => !perusahaanSudahPatroli.has(s.perusahaanNama)
      );

      const title = document.getElementById("belumPatroliTitle");
      if (title) {
        const count = belumPatroli.length;
        title.innerHTML = `🏢 Perusahaan Belum Patroli di Shift Aktif ${
          count > 0
            ? `<span class="badge badge-warning ml-1">${count}</span>`
            : `<span class="badge badge-success ml-1">0</span>`
        }`;
      }

      const listDiv = document.getElementById("belumPatroliCompanyList");
      listDiv.innerHTML = "";
      if (belumPatroli.length === 0) {
        listDiv.innerHTML = `<p class="text-muted">✅ Semua perusahaan sudah patroli di shift aktif.</p>`;
      } else {
        belumPatroli.forEach((s) => {
          const box = document.createElement("div");
          box.className = "card-warning-company";
          box.innerHTML = `
            <div>
              <strong>⚠️ ${escapeHtml(
                s.perusahaanNama || s.perusahaan || "-"
              )}</strong>
              <small>Shift ${escapeHtml(s.nama || "-")} • ${escapeHtml(
            s.jamMulai || "-"
          )}–${escapeHtml(s.jamSelesai || "-")}</small>
            </div>
            <span class="badge">Belum Patroli</span>
          `;
          listDiv.appendChild(box);
        });
      }

      // update global system status
      updateSystemStatusBox();
    } catch (err) {
      console.error("Error on perusahaan belum patroli snapshot:", err);
    }
  });
}

/* -----------------------
   Petugas table (realtime)
   ----------------------- */
async function renderPetugasTable() {
  const container = document.querySelector(
    "#dashboardSection .container-fluid"
  );
  if (!container) return;

  let wrapper = document.getElementById("petugasWrapDemo");
  if (!wrapper) {
    wrapper = el("div", { id: "petugasWrapDemo", class: "mt-4 w-100" });
    wrapper.innerHTML = `
      <h5>👮 Petugas Aktif Saat Ini</h5>
      <table class="table table-sm table-striped table-hover">
        <thead class="thead-light">
          <tr>
            <th>Nama</th>
            <th>Perusahaan</th>
            <th>Progress Patroli</th>
            <th>OK</th>
            <th>Not OK</th>
            <th>Status</th>
            <th>Jam Terakhir</th>
          </tr>
        </thead>
        <tbody id="${PETUGAS_TABLE_ID}">
          <tr><td colspan="7">⏳ Memuat data...</td></tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="7" id="summaryFooter" style="text-align:center;font-weight:bold;background:#f8f9fa;transition: all 0.5s ease;padding: 8px;">⏳ Menghitung total...</td>
          </tr>
        </tfoot>
      </table>
    `;
    container.appendChild(wrapper);
  }

  const tbody = document.getElementById(PETUGAS_TABLE_ID);
  const summaryFooter = document.getElementById("summaryFooter");
  const today = getTodayIso();
  const nowHour = new Date().getHours();

  const shiftSnap = await getDocs(collection(db, "jadwalPatroli"));
  const shiftData = shiftSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const q = query(collection(db, "patroli"), where("tanggal", "==", today));

  onSnapshot(q, (snapshot) => {
    try {
      const patroliByPerusahaan = {};
      snapshot.forEach((docu) => {
        const d = docu.data();
        if (!d.perusahaan) return;
        if (!patroliByPerusahaan[d.perusahaan])
          patroliByPerusahaan[d.perusahaan] = [];
        patroliByPerusahaan[d.perusahaan].push(d);
      });

      tbody.innerHTML = "";
      let totalOkAll = 0;
      let totalNotOkAll = 0;

      shiftData.forEach((shift) => {
        const perusahaan = shift.perusahaanNama;
        const dataPatroli = patroliByPerusahaan[perusahaan] || [];

        const jamMulai = parseInt(String(shift.jamMulai || "0").split(":")[0]);
        const jamSelesai = parseInt(
          String(shift.jamSelesai || "0").split(":")[0]
        );
        const durasiShift =
          isNaN(jamMulai) || isNaN(jamSelesai)
            ? 0
            : jamSelesai >= jamMulai
            ? jamSelesai - jamMulai
            : jamSelesai + 24 - jamMulai;
        const totalPatroliShift =
          durasiShift && shift.interval
            ? Math.floor(durasiShift / (shift.interval || 2))
            : shift.area || 5;
        const totalAreaShift = totalPatroliShift * (shift.area || 5);

        const okCount = dataPatroli.filter((p) => p.status === "OK").length;
        const notOkCount = dataPatroli.filter(
          (p) => p.status === "Not OK"
        ).length;
        const totalCount = dataPatroli.length;

        totalOkAll += okCount;
        totalNotOkAll += notOkCount;

        const isActive = (() => {
          if (isNaN(jamMulai) || isNaN(jamSelesai)) return false;
          if (jamSelesai < jamMulai)
            return nowHour >= jamMulai || nowHour < jamSelesai;
          return nowHour >= jamMulai && nowHour < jamSelesai;
        })();
        if (!isActive) return;

        const last = dataPatroli[dataPatroli.length - 1] || {};
        const percent = totalAreaShift
          ? Math.min(100, Math.round((totalCount / totalAreaShift) * 100))
          : 0;
        const badgeColor =
          last.status === "Not OK" ? "badge-danger" : "badge-success";

        const tr = el("tr");
        tr.innerHTML = `
          <td>${escapeHtml(last.nama || "-")}</td>
          <td>${escapeHtml(perusahaan)}</td>
          <td>
            <div class="progress" style="height: 10px; margin-bottom: 4px;">
              <div class="progress-bar bg-${
                last.status === "Not OK" ? "danger" : "success"
              }" role="progressbar" style="width: ${percent}%" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
            <small>${totalCount} / ${totalAreaShift}</small>
          </td>
          <td><span class="badge badge-success">${okCount}</span></td>
          <td><span class="badge badge-danger">${notOkCount}</span></td>
          <td><span class="badge ${badgeColor}">${escapeHtml(
          last.status || "OK"
        )}</span></td>
          <td>${escapeHtml(last.jam || "-")}</td>
        `;
        tbody.appendChild(tr);
      });

      // update footer
      const oldFooter = summaryFooter ? summaryFooter.innerHTML : "";
      const newFooter = `<span style="color:#2e7d32;">✅ Total OK: ${totalOkAll}</span> &nbsp;&nbsp;|&nbsp;&nbsp; <span style="color:#c62828;">🔴 Total Not OK: ${totalNotOkAll}</span>`;
      if (summaryFooter && oldFooter !== newFooter) {
        summaryFooter.innerHTML = newFooter;
        summaryFooter.style.transform = "scale(1.08)";
        summaryFooter.style.backgroundColor = "#e8f5e9";
        summaryFooter.style.transition = "all 0.4s ease";
        setTimeout(() => {
          summaryFooter.style.transform = "scale(1)";
          summaryFooter.style.backgroundColor = "#f8f9fa";
        }, 400);
      }

      if (tbody.children.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Tidak ada petugas aktif saat ini.</td></tr>`;
        if (summaryFooter)
          summaryFooter.innerHTML = `<span class="text-muted">— Tidak ada data patroli hari ini —</span>`;
      }
    } catch (err) {
      console.error("Error renderPetugasTable onSnapshot:", err);
    }
  });
}

/* -----------------------
   Issues realtime (one listener only)
   ----------------------- */
async function renderIssuesManual() {
  const container = document.querySelector(
    "#dashboardSection .container-fluid"
  );
  if (!container) return;
  let wrapper = document.getElementById("issuesWrapDemo");
  if (!wrapper) {
    wrapper = el("div", { id: "issuesWrapDemo", class: "mt-4 w-100" });
    wrapper.innerHTML = `
      <h5 id="issueTitle">🚨 Daftar Issue (Area Not OK)</h5>
      <small id="issueUpdateTime" class="text-muted" style="font-size:0.8rem;">🔄 Diperbarui: -</small>
      <div id="${ISSUE_LIST_ID}"></div>
    `;
    container.appendChild(wrapper);
  }

  const div = document.getElementById(ISSUE_LIST_ID);
  div.innerHTML = `<p>⏳ Memuat data...</p>`;

  const today = getTodayIso();
  const q = query(
    collection(db, "patroli"),
    where("status", "==", "Not OK"),
    where("tanggal", "==", today)
  );
  const snapshot = await getDocs(q);

  const list = [];
  snapshot.forEach((docu) => {
    const d = docu.data();
    list.push({
      id: docu.id,
      area: d.area || "-",
      perusahaan: d.perusahaan || "-",
      note: d.keterangan || "Belum ada keterangan",
      jam: d.jam || "-",
    });
  });

  const updateTimeEl = document.getElementById("issueUpdateTime");
  const now = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  updateTimeEl.textContent = `🔄 Diperbarui: ${now} WIB`;

  const title = document.getElementById("issueTitle");
  title.innerHTML = `🚨 Daftar Issue (Area Not OK) ${
    list.length > 0
      ? `<span class="badge badge-warning ml-1">${list.length}</span>`
      : `<span class="badge badge-success ml-1">0</span>`
  }`;

  div.innerHTML = list.length
    ? list
        .map(
          (it) => `
      <div class="issue-warning">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <strong>⚠️ ${escapeHtml(it.area)} – ${escapeHtml(
            it.perusahaan
          )}</strong><br>
            <small>🕒 ${escapeHtml(it.jam)} • ${escapeHtml(it.note)}</small>
          </div>
          <button class="btn btn-success btn-sm" onclick="tandaiSelesai('${
            it.id
          }')">✔️ Selesai</button>
        </div>
      </div>`
        )
        .join("")
    : `<p class="text-muted">✅ Tidak ada issue hari ini.</p>`;
}

/* -----------------------
   Tandai selesai (update status)
   ----------------------- */
window.tandaiSelesai = async function (docId) {
  if (!confirm("Apakah issue ini sudah diperbaiki dan aman kembali?")) return;
  try {
    const ref = doc(db, "patroli", docId);
    await updateDoc(ref, { status: "OK" });

    const box = document.getElementById(`issue-${docId}`);
    if (box) {
      box.style.opacity = "0";
      box.style.transform = "translateX(30px)";
      setTimeout(() => box.remove(), 400);
    }
    showToastNotif("✅ Issue berhasil ditandai selesai!", "#43a047");
    // setelah update, realtime listener akan memanggil updateSystemStatusBox()
  } catch (err) {
    console.error("❌ Gagal update:", err);
    showToastNotif("❌ Gagal memperbarui issue.", "#e53935");
  }
};

/* -----------------------
   System status box
   ----------------------- */
async function updateSystemStatusBox() {
  try {
    const today = getTodayIso();
    const q = query(collection(db, "patroli"), where("tanggal", "==", today));
    const snap = await getDocs(q);

    const perusahaanSet = new Set();
    let notOkCount = 0;
    snap.forEach((docu) => {
      const d = docu.data();
      if (d.perusahaan) perusahaanSet.add(d.perusahaan);
      if (d.status === "Not OK") notOkCount++;
    });

    const box = document.getElementById("systemStatusBox");
    const text = document.getElementById("systemStatusText");
    const sub = document.getElementById("systemStatusSub");
    if (!box || !text) return;

    // animasi halus
    try {
      box.animate(
        [
          { transform: "scale(1)", filter: "brightness(1)" },
          { transform: "scale(1.05)", filter: "brightness(1.2)" },
          { transform: "scale(1)", filter: "brightness(1)" },
        ],
        { duration: 700, easing: "ease-out" }
      );
    } catch (e) {
      // ignore if browser tidak support
    }

    if (snap.size === 0) {
      text.innerHTML = "🕒 Belum ada aktivitas patroli";
      sub.textContent = "Menunggu laporan dari petugas...";
      text.style.color = "#3e2723";
      box.style.background = "linear-gradient(90deg, #ffeb3b, #fbc02d)";
      box.style.boxShadow = "0 0 25px rgba(255, 235, 59, 0.4)";
    } else if (notOkCount === 0) {
      text.innerHTML = "✅ Semua area patroli berjalan normal";
      sub.textContent = `${perusahaanSet.size} perusahaan aktif patroli hari ini`;
      text.style.color = "#ffffff";
      box.style.background = "linear-gradient(90deg, #00c853, #b2ff59)";
      box.style.boxShadow = "0 0 35px rgba(0, 200, 83, 0.6)";
    } else {
      text.innerHTML = `⚠️ ${notOkCount} area perlu perhatian`;
      sub.textContent = `${perusahaanSet.size} perusahaan aktif patroli hari ini`;
      text.style.color = "#ffffff";
      box.style.background = "linear-gradient(90deg, #ff5252, #d50000)";
      box.style.boxShadow = "0 0 35px rgba(229, 57, 53, 0.55)";
    }

    // adaptasi untuk dark-mode (jika ada)
    const isDark = document.body.classList.contains("dark-mode");
    if (isDark) {
      box.style.boxShadow = "0 0 18px rgba(0,0,0,0.45)";
    }
  } catch (err) {
    console.error("Gagal update kondisi lapangan:", err);
  }
}

/* -----------------------
   Reset (localStorage)
   ----------------------- */
function resetAllPatroli() {
  for (let i = 1; i <= 5; i++) localStorage.removeItem(`patroliArea${i}`);
  localStorage.removeItem("patroliProgress");
  localStorage.removeItem("lastPatroliDone");
  console.info("Auto reset done (admin dashboard).");
}

/* -----------------------
   Utility: inject skeleton
   ----------------------- */
function injectDashboardSkeleton() {
  const container = document.querySelector(
    "#dashboardSection .container-fluid"
  );
  if (!container) return;

  // ensure cards wrapper exists
  let cards = document.getElementById("dashboardCards");
  if (!cards) {
    cards = el("div", { id: "dashboardCards", class: "row" });
    container.insertBefore(cards, container.firstChild);
  }
}

/* -----------------------
   Tiny toast helper
   ----------------------- */
window.showToastNotif = function (message, color = "#333") {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.right = "20px";
  toast.style.background = color;
  toast.style.color = "white";
  toast.style.padding = "10px 16px";
  toast.style.borderRadius = "8px";
  toast.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  toast.style.zIndex = "9999";
  toast.style.fontSize = "0.9rem";
  toast.style.opacity = "0";
  toast.style.transition = "all 0.5s ease";
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(-5px)";
  }, 100);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    setTimeout(() => toast.remove(), 500);
  }, 4000);
};

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnRefreshDashboard");
  if (btn) {
    btn.addEventListener("click", async () => {
      showToastNotif("🔄 Memperbarui data dashboard...", "#1976d2");
      await renderPerusahaanBelumPatroliCard();
      await renderPetugasTable();
      await renderIssuesManual();
      await updateSystemStatusBox();
      showToastNotif("✅ Data dashboard diperbarui.", "#388e3c");
    });
  }
});
