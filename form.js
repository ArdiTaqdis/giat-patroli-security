const scriptURL = "https://script.google.com/macros/s/AKfycbyMo-HUC8VoDEflt6eBTKGrVUMnrbvbjNRLXru9Ddd5Yzko1E07ZXM9_TD3dZzO0wUK8Q/exec";
let areaNow = 1;
const maxArea = 5;

const beforeUnloadHandler = (e) => {
  e.preventDefault();
  e.returnValue = '';
};

document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("beforeunload", beforeUnloadHandler);

  const nip = localStorage.getItem("nipLogin");
  const nama = localStorage.getItem("nama");
  const perusahaan = localStorage.getItem("perusahaan");
  const fotoUser = localStorage.getItem("fotoUser");

  if (!nip || !nama || !perusahaan) {
    alert("Silakan login terlebih dahulu.");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("nip").innerText = nip;
  document.getElementById("nama").innerText = nama;
  document.getElementById("perusahaan").innerText = perusahaan;
  document.getElementById("fotoUser").src = fotoUser || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  const now = new Date();
  document.getElementById("tanggal").innerText = now.toLocaleDateString("id-ID");
  document.getElementById("jam").innerText = now.toLocaleTimeString("id-ID");
  setInterval(() => {
    document.getElementById("jam").innerText = new Date().toLocaleTimeString("id-ID");
  }, 1000);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lon = pos.coords.longitude.toFixed(5);
        document.getElementById("lokasi").innerText = `Lat: ${lat}, Lon: ${lon}`;
        getAlamatFromKoordinat(lat, lon);
      },
      () => document.getElementById("lokasi").innerText = "❌ Akses lokasi ditolak",
      { timeout: 8000 }
    );
  }

  updateAreaUI();
});

function getAlamatFromKoordinat(lat, lon) {
  const apiKey = "2bbd755924364128b9e1b32f2ca00375";
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${apiKey}&language=id`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data.results?.length) {
        const c = data.results[0].components;
        const alamat = [c.hamlet, c.village, c.suburb, c.city_district, c.city || c.county, c.state].filter(Boolean).join(', ');
        document.getElementById("lokasi").innerText = alamat;
      }
    })
    .catch(() => document.getElementById("lokasi").innerText = "Gagal ambil alamat");
}

function updateAreaUI() {
  document.getElementById("areaNow").innerText = areaNow;
  document.getElementById("areaTitle").innerText = `Area ${areaNow}`;
  document.getElementById("qrResult").innerHTML = "";
  document.getElementById("reader").innerHTML = "";
  document.getElementById("previewFoto").innerHTML = `<span>📸 Foto akan tampil di sini</span>`;
  document.getElementById("keterangan").value = "";

  const areaData = JSON.parse(localStorage.getItem(`area${areaNow}`) || "{}");
  if (areaData.qr) document.getElementById("qrResult").innerHTML = `<strong>✅ QR:</strong> ${areaData.qr}`;
  if (areaData.foto) document.getElementById("previewFoto").innerHTML = `<img src="${areaData.foto}" style="width:100%; border-radius:10px;" />`;
  if (areaData.ket) document.getElementById("keterangan").value = areaData.ket;

  document.getElementById("nextBtn").innerText = areaNow < maxArea ? "➡️ Area Berikutnya" : "📤 Kirim Semua Data";
}

function saveCurrentAreaData(newData) {
  const current = JSON.parse(localStorage.getItem(`area${areaNow}`) || "{}");
  const updated = { ...current, ...newData };
  localStorage.setItem(`area${areaNow}`, JSON.stringify(updated));
}

function ambilFoto() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      document.getElementById("previewFoto").innerHTML = `<img src="${base64}" style="width:100%; border-radius:10px;" />`;
      saveCurrentAreaData({ foto: base64 });
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

let html5QrCode;
function scanQRCode() {
  const qrResult = document.getElementById("qrResult");
  if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    (decodedText) => {
      qrResult.innerHTML = `<strong>✅ QR:</strong> ${decodedText}`;
      saveCurrentAreaData({ qr: decodedText });
      html5QrCode.stop().then(() => (document.getElementById("reader").innerHTML = ""));
    },
    () => {}
  ).catch(err => {
    qrResult.innerHTML = `❌ Tidak bisa akses kamera: ${err}`;
  });
}

function nextArea() {
  // Simpan keterangan dulu
  const ket = document.getElementById("keterangan").value;
  saveCurrentAreaData({ ket });

  // ⏳ Beri jeda kecil agar save() sempat selesai
  setTimeout(() => {
    const areaData = JSON.parse(localStorage.getItem(`area${areaNow}`) || "{}");

    if (!areaData.qr || !areaData.foto) {
      alert(`Mohon isi QR dan Foto untuk Area ${areaNow} terlebih dahulu.`);
      return;
    }

    if (areaNow < maxArea) {
      areaNow++;
      updateAreaUI();
    } else {
      kirimSemuaData();
    }
  }, 100); // jeda 100ms agar simpan selesai
}


function prevArea() {
  if (areaNow > 1) {
    areaNow--;
    updateAreaUI();
  }
}

async function kirimSemuaData() {
  document.getElementById("loadingOverlay").style.display = "flex";

  const nip = document.getElementById("nip").innerText;
  const nama = document.getElementById("nama").innerText;
  const perusahaan = document.getElementById("perusahaan").innerText;
  const tanggal = document.getElementById("tanggal").innerText || "";
  const jam = document.getElementById("jam").innerText || "";
  const lokasi = document.getElementById("lokasi").innerText || "Lokasi tidak tersedia";

  const formBody = new URLSearchParams({ action: "patroli", nip, nama, perusahaan, tanggal, jam, lokasi });

  for (let i = 1; i <= maxArea; i++) {
    const data = JSON.parse(localStorage.getItem(`area${i}`) || "{}");
    formBody.append(`qr${i}`, data.qr || "");
    formBody.append(`foto${i}`, data.foto || "");
    formBody.append(`ket${i}`, data.ket || "");
  }

  try {
    const res = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString()
    });

    const text = await res.text();
    document.getElementById("status").innerText = text;
    document.getElementById("loadingOverlay").style.display = "none";

    if (text.toLowerCase().includes("berhasil")) {
      alert("✅ Data patroli berhasil dikirim!");
      for (let i = 1; i <= maxArea; i++) localStorage.removeItem(`area${i}`);
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      setTimeout(() => (window.location.href = "index.html"), 2500);
    }
  } catch (err) {
    document.getElementById("loadingOverlay").style.display = "none";
    document.getElementById("status").innerText = "❌ Gagal mengirim: " + err.message;
  }
}
