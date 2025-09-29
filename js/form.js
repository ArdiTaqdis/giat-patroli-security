const maxArea = 5;
let areaNow = 1;
const areaFotoCache = {};
const beforeUnloadHandler = (e) => {
  e.preventDefault();
  e.returnValue = "";
};

let nip, nama, perusahaan, fotoUser;

document.addEventListener("DOMContentLoaded", () => {
  // window.addEventListener("beforeunload", beforeUnloadHandler);

  // ==== Ambil data user ====
  const userData = localStorage.getItem("userData");
  if (userData) {
    const u = JSON.parse(userData);
    nip = u.nip;
    nama = u.nama;
    perusahaan = u.perusahaan;
    fotoUser = u.foto;
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

  // ==== Tentukan area yang sedang dikerjakan ====
  const progress = JSON.parse(localStorage.getItem("patroliProgress") || "{}");
  const now = Date.now();
  if (!progress.currentArea) {
    localStorage.setItem(
      "patroliProgress",
      JSON.stringify({
        currentArea: 1,
        startTime: now,
      })
    );
    areaNow = 1;
  } else {
    // reset otomatis setelah 12 jam
    if (now - progress.startTime > 12 * 60 * 60 * 1000) {
      resetPatroli();
      areaNow = 1;
    } else {
      areaNow = progress.currentArea;
    }
  }
  updateAreaLabel();

  // ==== Waktu dan Lokasi ====
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

async function ambilFoto() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";
  input.click();

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await resizeImage(reader.result);
      const withText = await addWatermark(
        compressed,
        nama,
        perusahaan,
        new Date().toLocaleString("id-ID")
      );
      document.getElementById("fotoPreviewMini").src = withText;
      document.getElementById("fotoPreviewMini").style.display = "block";
      areaFotoCache[`area${areaNow}`] = withText;
    };
    reader.readAsDataURL(file);
  };
}

function addWatermark(base64Str, namaPetugas, perusahaanPetugas, waktu) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      ctx.font = `${Math.floor(img.width * 0.035)}px Arial`;
      ctx.fillStyle = "white";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;
      ctx.textBaseline = "bottom";
      const margin = 20;

      ctx.strokeText(`Nama: ${namaPetugas}`, margin, img.height - 3 * margin);
      ctx.fillText(`Nama: ${namaPetugas}`, margin, img.height - 3 * margin);
      ctx.strokeText(
        `Perusahaan: ${perusahaanPetugas}`,
        margin,
        img.height - 2 * margin
      );
      ctx.fillText(
        `Perusahaan: ${perusahaanPetugas}`,
        margin,
        img.height - 2 * margin
      );
      ctx.strokeText(`Tanggal & Waktu: ${waktu}`, margin, img.height - margin);
      ctx.fillText(`Tanggal & Waktu: ${waktu}`, margin, img.height - margin);

      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
  });
}

function resizeImage(base64Str, maxWidth = 400, quality = 0.7) {
  return new Promise((resolve) => {
    let img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
  });
}

function updateAreaLabel() {
  document.getElementById("areaNow").innerText = areaNow;
  document.getElementById("areaTitle").innerText = `Area ${areaNow}`;
}

// ==== Simpan Per Area ====
function simpanArea() {
  const foto = areaFotoCache[`area${areaNow}`];
  const ket = document.getElementById("keterangan").value.trim();
  if (!foto) {
    alert("Ambil foto sebelum menyimpan.");
    return;
  }

  document.getElementById("loadingOverlay").style.display = "flex";

  const lokasi = document.getElementById("lokasi").innerText;
  const tanggal = document.getElementById("tanggal").innerText;
  const jam = document.getElementById("jam").innerText;

  // simpan data area ke localStorage
  localStorage.setItem(
    `patroliArea${areaNow}`,
    JSON.stringify({
      nip,
      nama,
      perusahaan,
      tanggal,
      jam,
      lokasi,
      foto,
      keterangan: ket,
      timestamp: new Date().toISOString(),
    })
  );

  // update progress
  const nextArea = areaNow + 1;
  const progress = JSON.parse(localStorage.getItem("patroliProgress") || "{}");
  if (nextArea <= maxArea) {
    localStorage.setItem(
      "patroliProgress",
      JSON.stringify({
        currentArea: nextArea,
        startTime: progress.startTime || Date.now(),
      })
    );
  } else {
    // ✅ semua area selesai → reset ke area 1
    localStorage.setItem(
      "patroliProgress",
      JSON.stringify({
        currentArea: 1, // 🚀 balik ke area 1
        startTime: Date.now(), // simpan waktu baru (untuk auto reset 12 jam)
      })
    );
    alert(
      "🎉 Anda sudah menyelesaikan patroli 5 area. " +
        "Silakan kirim data ke server melalui menu Absen Pending."
    );
  }

  // feedback jika belum 5 area
  if (nextArea <= maxArea) {
    alert(`✅ Anda sudah melakukan patroli di Area ${areaNow}.`);
  }

  setTimeout(() => {
    document.getElementById("loadingOverlay").style.display = "none";
    // kembali ke dashboard
    window.location.href = "../dashboard/dashboard.html";
  }, 800);
}

// ==== Reset Progress ====
function resetPatroli() {
  for (let i = 1; i <= maxArea; i++) {
    localStorage.removeItem(`patroliArea${i}`);
  }
  localStorage.removeItem("patroliProgress");
}
