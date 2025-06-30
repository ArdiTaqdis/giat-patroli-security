document.addEventListener("DOMContentLoaded", function () {
  const nipLogin = localStorage.getItem("nipLogin");
  if (!nipLogin) {
    alert("Silakan login terlebih dahulu.");
    window.location.href = "index.html";
    return;
  }

  // ⏳ Tampilkan loading spinner
  document.getElementById("loadingOverlay").style.display = "flex";

  // Tanggal dan jam
  const now = new Date();
  document.getElementById("tanggal").innerText = now.toLocaleDateString("id-ID");
  updateJam();
  setInterval(updateJam, 1000);

  function updateJam() {
    document.getElementById("jam").innerText = new Date().toLocaleTimeString("id-ID");
  }

  // 📍 Ambil lokasi & ubah jadi alamat dengan OpenCage
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
  (pos) => {
    const lat = pos.coords.latitude.toFixed(5);
    const lon = pos.coords.longitude.toFixed(5);
    getAlamatFromKoordinat(lat, lon); // Panggil OpenCage
  },
  () => {
    document.getElementById("lokasi").innerText = "Tidak tersedia";
  }
);

  } else {
    document.getElementById("lokasi").innerText = "Tidak didukung";
  }

  // Ambil data user
  fetch(`https://script.google.com/macros/s/AKfycbx9dTxpGo4NAsZ6iR6SxuY-fYk7vMMx5sDgs-g7yQd8BPna6ncFAec912og_a3-hF5Gyw/exec?nip=${nipLogin}`)
    .then((res) => res.json())
    .then((data) => {
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
      // ✅ Sembunyikan spinner setelah semuanya siap
      document.getElementById("loadingOverlay").style.display = "none";
    });
});

// ✅ Konversi koordinat ke alamat (pakai OpenCage)
function getLocationName(lat, lon) {
  const apiKey = "2bbd755924364128b9e1b32f2ca00375";
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${apiKey}&language=id`;

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      if (data && data.results && data.results.length > 0) {
        const lokasi = data.results[0].formatted;
        document.getElementById("lokasi").innerText = lokasi;
      } else {
        document.getElementById("lokasi").innerText = "Alamat tidak ditemukan";
      }
    })
    .catch(() => {
      document.getElementById("lokasi").innerText = "Gagal mengambil alamat";
    });
}



// Fungsi SCAN QR CODE
let html5QrCode;

function scanQRCode() {
  const qrResult = document.getElementById("qrResult");
  const qrCodeText = document.getElementById("qrCodeText");

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  html5QrCode.start(
    { facingMode: "environment" }, // Kamera belakang
    {
      fps: 10,
      qrbox: 250
    },
    (decodedText) => {
      qrCodeText.value = decodedText; // ✅ Masukkan ke textarea
      qrResult.innerHTML = `<strong>✅ QR Terdeteksi:</strong> ${decodedText}`;

      html5QrCode.stop().then(() => {
        document.getElementById("reader").innerHTML = ""; // Bersihkan scanner
      });
    },
    (errorMessage) => {
      // console.warn(`QR Error: ${errorMessage}`);
    }
  ).catch((err) => {
    qrResult.innerHTML = `❌ Tidak bisa akses kamera: ${err}`;
  });
}




// FUNGSI AMBLI FOTO
function ambilFoto() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment"; // kamera belakang

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

// ALMAT KOORDINAT DETAIL
function getAlamatFromKoordinat(lat, lon) {
  const apiKey = "2bbd755924364128b9e1b32f2ca00375"; // API Key OpenCage
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

document.getElementById("absenForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const nip = document.getElementById("nip").innerText;
  const nama = document.getElementById("nama").innerText;
  const perusahaan = document.getElementById("perusahaan").innerText;
  const tanggal = document.getElementById("tanggal").innerText;
  const jam = document.getElementById("jam").innerText;
  const lokasi = document.getElementById("lokasi").innerText;
  const qr = document.getElementById("qrResult").innerText;
  const keterangan = document.getElementById("keterangan").value;
  const fotoBase64 = localStorage.getItem("fotoUser");

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
    const res = await fetch("https://script.google.com/macros/s/AKf.../exec", {
      method: "POST",
      body: formData,
    });

    const text = await res.text();
    document.getElementById("status").innerText = text;
    localStorage.removeItem("fotoUser");
    document.getElementById("previewFoto").innerHTML = `<span>✅ Terkirim</span>`;
  } catch (err) {
    document.getElementById("status").innerText = "❌ Gagal mengirim: " + err.message;
  }
});
