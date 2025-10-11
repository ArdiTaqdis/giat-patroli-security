const maxArea = 5;
let areaNow = 1;
window.areaFileCache = window.areaFileCache || {};
let nip, nama, perusahaan, fotoUser;

document.addEventListener("DOMContentLoaded", () => {
  // ==== Ambil data user ====
  const userData = localStorage.getItem("userData");
  if (userData) {
    const u = JSON.parse(userData);
    nip = u.nip;
    nama = u.nama;
    perusahaan = u.perusahaan || u.perusahaanNama;
    fotoUser = u.foto || u.fotoUrl;
  } else {
    nip = localStorage.getItem("nipLogin");
    nama = localStorage.getItem("nama");
    perusahaan = localStorage.getItem("perusahaan");
    fotoUser = localStorage.getItem("fotoUser");
  }

  if (!nip || !nama || !perusahaan) {
    alert("Silakan login terlebih dahulu.");
    window.location.href = "../login.html";
    return;
  }

  // ==== Tampilkan identitas ====
  document.getElementById("nip").innerText = nip;
  document.getElementById("nama").innerText = nama;
  document.getElementById("perusahaan").innerText = perusahaan;
  if (fotoUser) document.getElementById("fotoUser").src = fotoUser;

  // ==== Tentukan area aktif ====
  const progress = JSON.parse(localStorage.getItem("patroliProgress") || "{}");
  const now = Date.now();
  if (!progress.currentArea) {
    localStorage.setItem(
      "patroliProgress",
      JSON.stringify({ currentArea: 1, startTime: now })
    );
    areaNow = 1;
  } else {
    if (now - progress.startTime > 8 * 60 * 60 * 1000) {
      resetPatroli();
      areaNow = 1;
    } else {
      areaNow = progress.currentArea;
    }
  }
  updateAreaUI();
  cekDisable();

  // ==== Waktu & Lokasi ====
  const today = new Date();
  document.getElementById("tanggal").innerText =
    today.toLocaleDateString("id-ID");
  updateJam();
  setInterval(updateJam, 1000);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lon = pos.coords.longitude.toFixed(5);
        document.getElementById("lokasi").innerText = `📍 ${lat}, ${lon}`;
        getAlamatFromCoords(lat, lon);
      },
      () =>
        (document.getElementById("lokasi").innerText = "❌ Gagal ambil lokasi")
    );
  }
});

// ========== UTIL ==========
function updateJam() {
  document.getElementById("jam").innerText = new Date().toLocaleTimeString(
    "id-ID"
  );
}
function getAlamatFromCoords(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  fetch(url, { headers: { "User-Agent": "patroli-app/1.0" } })
    .then((res) => res.json())
    .then((data) => {
      const alamat = data.display_name || `${lat}, ${lon}`;
      document.getElementById("lokasi").innerText = alamat;
    })
    .catch(() => {
      document.getElementById(
        "lokasi"
      ).innerText = `${lat}, ${lon} (❌ alamat gagal)`;
    });
}
function updateAreaUI() {
  document.getElementById("areaNow").innerText = areaNow;
  document.getElementById("areaTitle").innerText = `Area ${areaNow}`;
  const progressPercent = Math.round(((areaNow - 1) / maxArea) * 100);
  const bar = document.getElementById("progressBar");
  if (bar) {
    bar.style.width = `${progressPercent}%`;
    bar.innerText = `${progressPercent}%`;
  }
}

// ========== AMBIL FOTO ==========
async function ambilFoto() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";
  input.click();

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    // ✅ Kompres + watermark
    const watermarkedBlob = await compressAndWatermark(file, nama, perusahaan);
    const finalFile = new File([watermarkedBlob], file.name, {
      type: "image/jpeg",
    });

    window.areaFileCache[`area${areaNow}`] = finalFile;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Preview = reader.result;
      document.getElementById("fotoPreviewMini").src = base64Preview;
      document.getElementById("fotoPreviewMini").style.display = "block";
    };
    reader.readAsDataURL(finalFile);
  };
}

function compressAndWatermark(
  file,
  namaPetugas,
  perusahaanPetugas,
  maxWidth = 400,
  quality = 0.5
) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        ctx.font = `${Math.floor(w * 0.04)}px Arial`;
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        ctx.textBaseline = "bottom";
        const margin = 15;
        const waktu = new Date().toLocaleString("id-ID");

        ctx.strokeText(`Nama: ${namaPetugas}`, margin, h - 3 * margin);
        ctx.fillText(`Nama: ${namaPetugas}`, margin, h - 3 * margin);
        ctx.strokeText(
          `Perusahaan: ${perusahaanPetugas}`,
          margin,
          h - 2 * margin
        );
        ctx.fillText(
          `Perusahaan: ${perusahaanPetugas}`,
          margin,
          h - 2 * margin
        );
        ctx.strokeText(`Waktu: ${waktu}`, margin, h - margin);
        ctx.fillText(`Waktu: ${waktu}`, margin, h - margin);

        canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
      };
    };
  });
}

// ========== SIMPAN PER AREA ==========
function simpanArea() {
  const ket = document.getElementById("keterangan").value.trim();
  const status = document.getElementById("statusArea")
    ? document.getElementById("statusArea").value
    : "OK";

  if (status === "Not OK" && ket === "") {
    alert("⚠️ Keterangan wajib diisi jika status 'Not OK'!");
    document.getElementById("keterangan").focus();
    return;
  }

  const file = window.areaFileCache[`area${areaNow}`];
  if (!file) {
    alert("📸 Ambil foto area terlebih dahulu sebelum menyimpan.");
    return;
  }

  // 🔹 Tampilkan overlay loading
  document.getElementById("loadingOverlay").style.display = "flex";

  const lokasi = document.getElementById("lokasi").innerText;
  const tanggal = document.getElementById("tanggal").innerText;
  const jam = document.getElementById("jam").innerText;

  const reader = new FileReader();
  reader.onload = () => {
    const base64File = reader.result;

    // ✅ Simpan ke localStorage
    localStorage.setItem(
      `patroliArea${areaNow}`,
      JSON.stringify({
<<<<<<< HEAD
        nip,
        nama,
        perusahaan,
        tanggal,
        jam,
        lokasi,
        foto: file.name,
        fotoPreview: document.getElementById("fotoPreviewMini").src || "",
        fotoBase64: base64File,
        keterangan: ket,
        status,
        timestamp: new Date().toISOString(),
=======
        currentArea: nextArea,
        // startTime: progress.startTime || Date.now(),
        startTime:Date.now(),// reset 12 jam setelah absen terakhir
>>>>>>> d116ae6fad36c7873ab10e5bc6e8df9677b169a8
      })
    );

    // ✅ Update progress shift + patroli
    const shiftId = localStorage.getItem("shiftAktif");
    const patroli = localStorage.getItem("patroliAktif");
    if (shiftId && patroli) {
      const key = `progress-${shiftId}-${patroli}`;
      let prog = JSON.parse(localStorage.getItem(key) || "{}");
      prog.areaDone = (prog.areaDone || 0) + 1;
      prog.pending = (prog.pending || 0) + 1;
      localStorage.setItem(key, JSON.stringify(prog));
    }

    // ✅ Update progress umum
    const nextArea = areaNow + 1;
    const progress = JSON.parse(
      localStorage.getItem("patroliProgress") || "{}"
    );

    if (nextArea <= maxArea) {
      localStorage.setItem(
        "patroliProgress",
        JSON.stringify({
          currentArea: nextArea,
          startTime: progress.startTime || Date.now(),
        })
      );

      alert(
        `✅ Area ${areaNow} (${status}) tersimpan. Anda akan diarahkan ke Jadwal Patroli.`
      );
    } else {
      localStorage.setItem(
        "patroliProgress",
        JSON.stringify({ currentArea: 1, startTime: Date.now() })
      );

      alert("🎉 Patroli 5 area selesai. Silakan cek status di Jadwal Patroli.");

      // ✅ Setelah semua area selesai, aktifkan patroli berikutnya
      const labels = ["A", "B", "C", "D"];
      const shiftId = localStorage.getItem("shiftAktif");
      const patroli = localStorage.getItem("patroliAktif");
      if (shiftId && patroli) {
        const currentKey = `progress-${shiftId}-${patroli}`;
        let current = JSON.parse(localStorage.getItem(currentKey) || "{}");
        current.areaDone = 5;
        current.pending = 0;
        localStorage.setItem(currentKey, JSON.stringify(current));

        const idx = labels.indexOf(patroli);
        const nextLabel = labels[idx + 1];
        if (nextLabel) {
          const nextKey = `progress-${shiftId}-${nextLabel}`;
          let next = JSON.parse(localStorage.getItem(nextKey) || "{}");
          next.unlocked = true; // 🔓 patroli berikutnya aktif
          localStorage.setItem(nextKey, JSON.stringify(next));
        }
      }
    }

    // ✅ Setelah alert, tampilkan overlay redirect
    setTimeout(() => {
      document.getElementById("loadingOverlay").style.display = "none";
      document.getElementById("redirectOverlay").style.display = "flex";

      setTimeout(() => {
        localStorage.setItem("filterShiftByTime", "true");
        window.location.href = "../pages/jadwalpatroli.html";
      }, 1500);
    }, 800);
  };

  reader.readAsDataURL(file);
}

// ========== CEK DISABLE ==========
function cekDisable() {
  const saved = localStorage.getItem(`patroliArea${areaNow}`);
  const btn = document.getElementById("simpanBtn");
  if (saved && btn) {
    btn.disabled = true;
    btn.innerText = "✔️ Sudah Disimpan";
  } else if (btn) {
    btn.disabled = false;
    btn.innerText = "💾 Simpan Area";
  }
}

// ========== RESET ==========
function resetPatroli() {
  for (let i = 1; i <= maxArea; i++) {
    localStorage.removeItem(`patroliArea${i}`);
  }
  localStorage.removeItem("patroliProgress");
}
