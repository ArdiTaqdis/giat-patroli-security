// js/pending.js
import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// URL Apps Script untuk upload foto ke Drive
const scriptURL =
  "https://script.google.com/macros/s/AKfycbz2vbn5_aBuGPc_22TEzwVfJDDBNyeXvATbLrF60uKgaNSJLqLh9XdRKIlBnuhF9aVv/exec";

// Cache global dari form.js
window.areaFileCache = window.areaFileCache || {};
window.resetCountdownRunning = false; // 🔒 cegah duplikat countdown interval

document.addEventListener("DOMContentLoaded", () => {
  renderPending();
  initProgressUI();
  checkAutoResetTimer(); // ✅ digabung jadi satu event listener
});

// =================== UI & DATA ===================

// Ambil data pending dari localStorage (area1..5)
function getPending() {
  const arr = [];
  for (let i = 1; i <= 5; i++) {
    const raw = localStorage.getItem(`patroliArea${i}`);
    if (raw) {
      const obj = JSON.parse(raw);
      arr.push({ ...obj, area: i });
    }
  }
  return arr;
}

// Tampilkan data pending di tabel
function renderPending() {
  const tbody = document.querySelector("#pendingTable tbody");
  tbody.innerHTML = "";

  const data = getPending();
  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; color:#777; padding:20px;">
          ✅ Tidak ada data pending
        </td>
      </tr>`;
    resetProgressUI();
    return;
  }

  data.forEach((item, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.area}</td>
      <td>${item.tanggal}</td>
      <td>${item.jam}</td>
      <td>${item.nama}</td>
      <td><span class="badge badge-pending">Pending</span></td>
      <td>
        <button class="btn btn-detail" onclick="lihatFoto(${i})">Lihat Foto</button>
      </td>`;
    tbody.appendChild(tr);
  });

  // Tambahkan tombol kirim semua di bawah tabel
  const tfoot = document.createElement("tfoot");
  tfoot.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center; padding:16px;">
        <button class="btn btn-kirim-semua" onclick="kirimSemua()">
          📤 Kirim Semua Data Pending
        </button>
      </td>
    </tr>`;
  tbody.parentElement.appendChild(tfoot);
}

// =================== KIRIM SEMUA DATA ===================
window.kirimSemua = async function () {
  const data = getPending();
  if (data.length === 0) {
    alert("✅ Tidak ada data pending.");
    return;
  }
  if (!navigator.onLine) {
    alert("⚠️ Tidak ada koneksi internet.");
    return;
  }
  if (
    !confirm(
      `Apakah Anda yakin ingin mengirim semua ${data.length} data patroli?`
    )
  )
    return;

  showLoading();
  startProgressUI(data.length);

  try {
    for (let i = 0; i < data.length; i++) {
      await kirimSatuData(data[i]);
      localStorage.removeItem(`patroliArea${data[i].area}`);
      delete window.areaFileCache[`area${data[i].area}`];

      updateProgressUI(i + 1, data.length);
      showProgressToast(i + 1, data.length);
    }

    // ✅ Setelah semua data dikirim ke Firestore, kirim batch summary ke Apps Script
    await updateDailySummaryBatch(data);

    // ✅ Update progress terakhir
    const shiftId = localStorage.getItem("shiftAktif");
    const patroli = localStorage.getItem("patroliAktif");
    if (shiftId && patroli) {
      const key = `progress-${shiftId}-${patroli}`;
      let prog = JSON.parse(localStorage.getItem(key) || "{}");
      prog.pending = 0;
      localStorage.setItem(key, JSON.stringify(prog));
    }

    // ✅ Catat waktu patroli selesai & jadwalkan auto reset
    localStorage.setItem("lastPatroliDone", Date.now());

    const resetTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const jamReset = resetTime.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    showToastNotif(
      `✅ Semua data berhasil dikirim! Sistem akan reset otomatis dalam 8 jam (sekitar pukul ${jamReset}).`,
      "#43a047",
      100
    );

    hideLoading();
    completeProgressUI();
    renderPending();
    showProgressToast(data.length, data.length);

    setTimeout(() => {
      // ✅ Aktifkan mode filter shift sebelum redirect
      localStorage.setItem("filterShiftByTime", "true");
      window.location.href = "../pages/jadwalpatroli.html";
    }, 1800);
  } catch (err) {
    hideLoading();
    alert("❌ Gagal kirim beberapa data: " + err.message);
    resetProgressUI();
  }
};

// =================== LOGIKA KIRIM DATA ===================
async function kirimSatuData(item) {
  let file = window.areaFileCache[`area${item.area}`];
  if (!file && item.fotoBase64) {
    file = await base64ToFile(
      item.fotoBase64,
      `${item.nip}_area${item.area}.jpg`
    );
  }
  if (!file) throw new Error("File foto tidak ditemukan!");

  const base64File = await fileToBase64(file);

  const res = await fetch(scriptURL, {
    method: "POST",
    body: new URLSearchParams({
      action: "uploadPatroli",
      file: base64File,
      namaFile: `${item.nip}_area${item.area}_${Date.now()}.jpg`,
    }),
  });

  const result = await res.json();
  if (result.status !== "success") throw new Error(result.message);

  await addDoc(collection(db, "patroli"), {
    nip: item.nip,
    nama: item.nama,
    perusahaan: item.perusahaan,
    tanggal: item.tanggal,
    jam: item.jam,
    lokasi: item.lokasi,
    area: item.area,
    fotoUrl: result.url,
    keterangan: item.keterangan,
    status: item.status || "OK", // 🟢 Tambahan: status area (OK / Not OK)
    timestamp: serverTimestamp(),
  });
}

// =================== UTILITAS ===================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
  });
}
function base64ToFile(base64, filename) {
  return fetch(base64)
    .then((res) => res.blob())
    .then((blob) => new File([blob], filename, { type: "image/jpeg" }));
}

// =================== PROGRESS UI ===================
function initProgressUI() {
  const container = document.createElement("div");
  container.id = "progressContainer";
  container.style = `
    display:none;
    margin-top:15px;
    text-align:center;
    font-size:0.9rem;
    color:#333;
  `;
  container.innerHTML = `
    <div style="width:100%;background:#eee;border-radius:8px;overflow:hidden;height:10px;">
      <div id="progressBar" style="width:0%;height:10px;background:linear-gradient(90deg,#e53935,#ff7043);transition:width 0.3s;"></div>
    </div>
    <p id="progressText" style="margin-top:8px;">0 / 0 data dikirim</p>
  `;
  document.body.appendChild(container);
}
function startProgressUI(total) {
  const cont = document.getElementById("progressContainer");
  cont.style.display = "block";
  document.getElementById("progressBar").style.width = "0%";
  document.getElementById(
    "progressText"
  ).textContent = `0 / ${total} data dikirim`;
}
function updateProgressUI(current, total) {
  const percent = Math.round((current / total) * 100);
  document.getElementById("progressBar").style.width = `${percent}%`;
  document.getElementById(
    "progressText"
  ).textContent = `${current} / ${total} data dikirim`;
}
function completeProgressUI() {
  document.getElementById("progressBar").style.width = "100%";
  document.getElementById(
    "progressText"
  ).textContent = `✅ Semua data terkirim!`;
  setTimeout(resetProgressUI, 1200);
}
function resetProgressUI() {
  const cont = document.getElementById("progressContainer");
  if (cont) cont.style.display = "none";
}

// =================== OVERLAY ===================
function showSuccessOverlay() {
  document.getElementById("successOverlay").style.display = "flex";
}
window.closeOverlay = function () {
  document.getElementById("successOverlay").style.display = "none";
};
function showLoading() {
  document.getElementById("loadingOverlay").style.display = "flex";
}
function hideLoading() {
  document.getElementById("loadingOverlay").style.display = "none";
}

// =================== TOAST DENGAN PROGRESS BAR ===================
// =================== TOAST DENGAN BAR DI ATAS ===================
function showToastNotif(msg, color = "#43a047", progress = 0) {
  let toast = document.getElementById("toastNotif");
  let progressBar;

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastNotif";
    document.body.appendChild(toast);
  }

  // Buat progress bar di atas
  progressBar = document.getElementById("toastProgressBar");
  if (!progressBar) {
    progressBar = document.createElement("div");
    progressBar.id = "toastProgressBar";
    toast.appendChild(progressBar);
  }

  toast.style.background = color;
  toast.innerHTML = `<div style="margin-top:8px;">${msg}</div>`;
  toast.appendChild(progressBar);
  toast.classList.add("show");

  // Update progress bar (0–100%)
  progressBar.style.width = `${progress}%`;

  // 🔧 Auto-hide hanya untuk toast selesai (bukan progress oranye)
  if ((progress === 0 || progress === 100) && color !== "#fb8c00") {
    setTimeout(() => toast.classList.remove("show"), 4000);
  }
}

function showProgressToast(current, total) {
  const percent = Math.round((current / total) * 100);
  if (current < total) {
    showToastNotif(
      `📤 Mengirim data ${current} / ${total}...`,
      "#fb8c00",
      percent
    );
  } else {
    showToastNotif(
      `✅ Semua ${total} data berhasil dikirim! Sistem akan reset otomatis dalam 8 jam.`,
      "#43a047",
      100
    );
  }
}

// =================== AUTO RESET 8 JAM ===================
const RESET_DELAY_HOURS = 8;

function checkAutoResetTimer() {
  const lastDone = localStorage.getItem("lastPatroliDone");
  if (!lastDone) return;

  const now = Date.now();
  const elapsed = now - parseInt(lastDone);
  const limit = RESET_DELAY_HOURS * 60 * 60 * 1000;

  if (elapsed >= limit) {
    resetAllPatroli();
    showToastNotif(
      "🔄 Sistem telah direset otomatis (8 jam setelah patroli terakhir).",
      "#43a047",
      100
    );
  } else {
    startResetCountdown(lastDone);
  }
}

function resetAllPatroli() {
  for (let i = 1; i <= 5; i++) localStorage.removeItem(`patroliArea${i}`);
  localStorage.removeItem("patroliProgress");
  localStorage.removeItem("lastPatroliDone");
  showToastNotif(
    "✅ Semua data patroli telah dihapus. Sistem siap digunakan kembali.",
    "#43a047",
    100
  );
}

// =================== COUNTDOWN RESET PROGRESS ===================
function startResetCountdown(lastDoneTime) {
  if (window.resetCountdownRunning) return;
  window.resetCountdownRunning = true;

  const limit = RESET_DELAY_HOURS * 60 * 60 * 1000;

  const update = () => {
    const elapsed = Date.now() - parseInt(lastDoneTime);
    const remaining = Math.max(0, limit - elapsed);
    const progress = (elapsed / limit) * 100;
    const jamTersisa = (remaining / (1000 * 60 * 60)).toFixed(1);

    showToastNotif(
      `🕒 Sistem akan reset otomatis dalam ${jamTersisa} jam.`,
      "#fb8c00",
      progress
    );

    if (elapsed >= limit) {
      clearInterval(interval);
      resetAllPatroli();
      showToastNotif(
        "🔄 Sistem telah direset otomatis (8 jam setelah patroli terakhir).",
        "#43a047",
        100
      );
    }
  };

  update();
  const interval = setInterval(update, 60 * 1000);
}

// =================== ENGINE UPDATE DAILY SUMMARY (BATCH) ===================
async function updateDailySummaryBatch(patrolData) {
  if (!patrolData || patrolData.length === 0) return;

  // Ambil tanggal dari data pertama
  const tanggal = patrolData[0].tanggal;

  // Siapkan payload: hanya data penting
  const payload = {
    tanggal,
    items: patrolData.map((d) => ({
      perusahaan: d.perusahaan,
      status: d.status || "OK",
    })),
  };

  try {
    console.log("🚀 Mengirim batch summary:", payload);

    const res = await fetch(
      "https://script.google.com/macros/s/AKfycby4ITYJez9vPTyWIH-oPr31FsnWHZS5SvG1qQ2Ce-0pRU7N90oVuGa4hBJAz2Aaqmni/exec", // ganti dengan URL Apps Script kamu
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateSummaryBatch",
          payload,
        }),
      }
    );

    const text = await res.text();
    console.log("✅ Response batch summary:", text);
  } catch (err) {
    console.error("❌ Gagal update batch summary:", err);
  }
}
