document.addEventListener("DOMContentLoaded", function () {
  const nipLogin = localStorage.getItem("nipLogin");
  if (!nipLogin) {
    alert("Silakan login terlebih dahulu.");
    window.location.href = "index.html";
    return;
  }

  // Tampilkan loading overlay
  document.getElementById("loadingOverlay").style.display = "flex";

  // Tanggal & Jam
  const now = new Date();
  document.getElementById("tanggal").innerText = now.toLocaleDateString("id-ID");
  updateJam();
  setInterval(updateJam, 1000);

  function updateJam() {
    document.getElementById("jam").innerText = new Date().toLocaleTimeString("id-ID");
  }

  // Lokasi & OpenCage
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lon = pos.coords.longitude.toFixed(5);
        getAlamatFromKoordinat(lat, lon);
      },
      () => document.getElementById("lokasi").innerText = "Tidak tersedia"
    );
  } else {
    document.getElementById("lokasi").innerText = "Tidak didukung";
  }

  // Data user
  fetch(`https://script.google.com/macros/s/AKfycbx9dTxpGo4NAsZ6iR6SxuY-fYk7vMMx5sDgs-g7yQd8BPna6ncFAec912og_a3-hF5Gyw/exec?nip=${nipLogin}`)
    .then(res => res.json())
    .then(data => {
      if (data.status === "success") {
        document.getElementById("nip").innerText = data.nip;
        document.getElementById("nama").innerText = data.nama;
        document.getElementById("perusahaan").innerText = data.perusahaan;
        document.querySelector(".avatar-foto img").src = data.foto || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
      } else {
        alert("NIP tidak ditemukan!");
        window.location.href = "index.html";
      }
    })
    .finally(() => {
      document.getElementById("loadingOverlay").style.display = "none";
    });
});

// Konversi koordinat ke alamat
function getAlamatFromKoordinat(lat, lon) {
  const apiKey = "2bbd755924364128b9e1b32f2ca00375";
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${apiKey}&language=id&pretty=1`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.results && data.results.length > 0) {
        const c = data.results[0].components;
        const alamat = `${c.hamlet || ''}, ${c.village || c.suburb || ''}, ${c.city_district || ''}, ${c.county || ''}, ${c.state || ''}`;
        document.getElementById("lokasi").innerText = alamat;
      } else {
        document.getElementById("lokasi").innerText = "Alamat tidak ditemukan";
      }
    })
    .catch(() => {
      document.getElementById("lokasi").innerText = "Gagal mengambil alamat";
    });
}

// SCAN QR
let html5QrCode;

function scanQRCode() {
  const qrResult = document.getElementById("qrResult");

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    (decodedText) => {
      localStorage.setItem("qrText", decodedText);
      qrResult.innerHTML = `<strong>✅ QR Terdeteksi:</strong> ${decodedText}`;
      html5QrCode.stop().then(() => {
        document.getElementById("reader").innerHTML = "";
      });
    },
    () => {}
  ).catch((err) => {
    qrResult.innerHTML = `❌ Tidak bisa akses kamera: ${err}`;
  });
}

// AMBIL FOTO
function ambilFoto() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";

  input.onchange = function () {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const base64 = e.target.result;
      localStorage.setItem("fotoAbsen", base64);
      document.getElementById("previewFoto").innerHTML =
        `<img src="${base64}" style="width:100%; border-radius:10px;" />`;
    };
    reader.readAsDataURL(file);
  };

  input.click();
}

// SUBMIT ABSEN
document.getElementById("absenForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const nip = document.getElementById("nip").innerText;
  const nama = document.getElementById("nama").innerText;
  const perusahaan = document.getElementById("perusahaan").innerText;
  const tanggal = document.getElementById("tanggal").innerText;
  const jam = document.getElementById("jam").innerText;
  const lokasi = document.getElementById("lokasi").innerText;
  const qr = localStorage.getItem("qrText") || "";
  const keterangan = document.getElementById("keterangan").value;
  const fotoBase64 = localStorage.getItem("fotoAbsen");

  if (!qr || !fotoBase64) {
    document.getElementById("status").innerText = "❌ Pastikan QR Code dan Foto sudah diisi!";
    return;
  }

  const formData = new FormData();
  formData.append("nip", nip);
  formData.append("nama", nama);
  formData.append("perusahaan", perusahaan);
  formData.append("tanggal", tanggal);
  formData.append("jam", jam);
  formData.append("lokasi", lokasi);
  formData.append("qr", qr);
  formData.append("keterangan", keterangan);
  formData.append("foto", fotoBase64);

  document.getElementById("status").innerText = "⏳ Mengirim data...";

  try {
    const res = await fetch("https://script.google.com/macros/s/AKfycbw1VV2WrRLYb0ekBXCMG8_jWbJvxJFhltY0zuro4bzjdD4ez2oWmw-KNgX_B1a6xNYDQg/exec", {
      method: "POST",
      body: formData,
    });

    const text = await res.text();
    document.getElementById("status").innerText = text;

    // Bersihkan data lokal
    localStorage.removeItem("fotoAbsen");
    localStorage.removeItem("qrText");

    document.getElementById("previewFoto").innerHTML = `<span>✅ Terkirim</span>`;
    document.getElementById("qrResult").innerHTML = "";

    // Redirect jika berhasil
    if (text.includes("berhasil")) {
      setTimeout(() => {
        window.location.href = "index.html";
      }, 2500);
    }

  } catch (err) {
    document.getElementById("status").innerText = "❌ Gagal mengirim: " + err.message;
  }
});
