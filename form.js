const scriptURL = "https://script.google.com/macros/s/AKfycbxy9J8w86sn_5mctVRQNpGX7BK-XRhXMoid7PgsYDdOPOx1z3QVn2iyfc5oal4sOS9dyA/exec";
let areaNow = 1;
const maxArea = 5;
const areaFotoCache = {};
const areaQRCache = {};
const areaKetCache = {};

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
  if (fotoUser) document.getElementById("fotoUser").src = fotoUser;

  const now = new Date();
  document.getElementById("tanggal").innerText = now.toLocaleDateString("id-ID");
  updateJam();
  setInterval(updateJam, 1000);

  // Ambil geolokasi dan alamat
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude.toFixed(5);
      const lon = pos.coords.longitude.toFixed(5);
      document.getElementById("lokasi").innerText = `📍 ${lat}, ${lon}`;
      getAlamatFromCoords(lat, lon);
    }, () => {
      document.getElementById("lokasi").innerText = "❌ Gagal ambil lokasi";
    });
  }

  updateNavButtons();
});

function updateJam() {
  document.getElementById("jam").innerText = new Date().toLocaleTimeString("id-ID");
}

function getAlamatFromCoords(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  fetch(url, {
    headers: { 'User-Agent': 'patroli-app/1.0' }
  })
    .then(res => res.json())
    .then(data => {
      const alamat = data.display_name || `${lat}, ${lon}`;
      document.getElementById("lokasi").innerText = alamat;
    })
    .catch(() => {
      document.getElementById("lokasi").innerText = `${lat}, ${lon} (❌ alamat gagal)`;
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
      document.getElementById("fotoPreviewMini").src = compressed;
      document.getElementById("fotoPreviewMini").style.display = "block";
      areaFotoCache[`area${areaNow}`] = compressed;
    };
    reader.readAsDataURL(file);
  };
}

function resizeImage(base64Str, maxWidth = 400, quality = 0.7) {
  return new Promise((resolve) => {
    let img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scaleSize = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scaleSize;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const newBase64 = canvas.toDataURL("image/jpeg", quality);
      resolve(newBase64);
    };
  });
}

function nextArea() {
  const foto = areaFotoCache[`area${areaNow}`];
  const ket = document.getElementById("keterangan").value.trim();
  const qr = document.getElementById("qrResult").innerText.trim();

  if (!foto || !qr) {
    alert("Lengkapi QR dan Foto sebelum lanjut.");
    return;
  }

  document.getElementById("loadingOverlay").style.display = "flex";
  areaKetCache[`area${areaNow}`] = ket;
  areaQRCache[`area${areaNow}`] = qr;

  setTimeout(() => {
    localStorage.setItem(`fotoArea${areaNow}`, foto);
    localStorage.setItem(`ketArea${areaNow}`, ket);
    localStorage.setItem(`qrArea${areaNow}`, qr);

    if (areaNow < maxArea) {
      areaNow++;
      document.getElementById("areaNow").innerText = areaNow;
      document.getElementById("areaTitle").innerText = `Area ${areaNow}`;
      resetFormForNewArea();
      updateNavButtons();
    } else {
      openModal();
    }

    document.getElementById("loadingOverlay").style.display = "none";
  }, 800);
}

function prevArea() {
  if (areaNow > 1) {
    areaNow--;
    document.getElementById("areaNow").innerText = areaNow;
    document.getElementById("areaTitle").innerText = `Area ${areaNow}`;
    loadFormForArea();
    updateNavButtons();
  }
}

function updateNavButtons() {
  document.getElementById("prevBtn").disabled = areaNow === 1;
  document.getElementById("nextBtn").innerText = areaNow === 5 ? '✅ Selesai' : '➡️ Area Berikutnya';
}

function resetFormForNewArea() {
  document.getElementById("fotoPreviewMini").src = "";
  document.getElementById("fotoPreviewMini").style.display = "none";
  document.getElementById("qrResult").innerText = "";
  document.getElementById("keterangan").value = "";
}

function loadFormForArea() {
  const qr = localStorage.getItem(`qrArea${areaNow}`) || "";
  const ket = localStorage.getItem(`ketArea${areaNow}`) || "";
  const foto = localStorage.getItem(`fotoArea${areaNow}`) || "";

  document.getElementById("qrResult").innerText = qr;
  document.getElementById("keterangan").value = ket;
  document.getElementById("fotoPreviewMini").src = foto;
  document.getElementById("fotoPreviewMini").style.display = foto ? "block" : "none";
}

function scanQRCode() {
  const qrDiv = document.getElementById("reader");
  qrDiv.innerHTML = "";

  const html5QrCode = new Html5Qrcode("reader");
  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    (decodedText) => {
      html5QrCode.stop();
      document.getElementById("qrResult").innerText = decodedText;
      qrDiv.innerHTML = "";
    },
    () => {}
  ).catch(err => {
    document.getElementById("qrResult").innerText = "❌ Gagal scan: " + err;
  });
}

// Modal kirim
function openModal() {
  document.getElementById("modalKirim").style.display = "flex";
}
function closeModal() {
  document.getElementById("modalKirim").style.display = "none";
}

async function submitFinal() {
  if (areaNow < 5) {
    alert("⚠️ Lengkapi semua area terlebih dahulu.");
    return;
  }

  for (let i = 1; i <= 5; i++) {
    if (!localStorage.getItem(`fotoArea${i}`) || !localStorage.getItem(`qrArea${i}`)) {
      alert(`Data Area ${i} belum lengkap.`);
      return;
    }
  }

  document.getElementById("loadingOverlay").style.display = "flex";

  const nip = localStorage.getItem("nipLogin");
  const nama = localStorage.getItem("nama");
  const perusahaan = localStorage.getItem("perusahaan");
  const lokasi = document.getElementById("lokasi").innerText;
  const tanggal = document.getElementById("tanggal").innerText;
  const jam = document.getElementById("jam").innerText;
  const timestamp = new Date().toISOString();

  const formData = {
    action: "patroli",
    nip, nama, perusahaan, tanggal, jam, lokasi, timestamp,
    status: "Proses"
  };

  for (let i = 1; i <= 5; i++) {
    formData[`qr${i}`] = localStorage.getItem(`qrArea${i}`);
    formData[`foto${i}`] = localStorage.getItem(`fotoArea${i}`);
    formData[`ket${i}`] = localStorage.getItem(`ketArea${i}`) || "";
  }

  try {
    const res = await fetch(scriptURL, {
      method: "POST",
      body: new URLSearchParams(formData)
    });

    const result = await res.json();

    if (result.status === "success") {
      // ✅ Bersihkan semua cache dan redirect
      for (let i = 1; i <= 5; i++) {
        localStorage.removeItem(`qrArea${i}`);
        localStorage.removeItem(`fotoArea${i}`);
        localStorage.removeItem(`ketArea${i}`);
      }

      window.removeEventListener("beforeunload", beforeUnloadHandler); // ⬅️ Ini penting!
      window.location.href = "index.html"; // ⬅️ Redirect tanpa alert keluar
    } else {
      alert("❌ Gagal mengirim data.");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("❌ Terjadi kesalahan saat kirim.");
  } finally {
    closeModal();
    document.getElementById("loadingOverlay").style.display = "none";
  }
}
