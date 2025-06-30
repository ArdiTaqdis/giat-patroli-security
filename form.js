window.onload = function () {
  const nipLogin = localStorage.getItem("nipLogin");
  if (!nipLogin) {
    alert("Silakan login terlebih dahulu.");
    window.location.href = "index.html";
    return;
  }

  // Set tanggal & jam
  const now = new Date();
  document.getElementById("tanggal").innerText = now.toLocaleDateString("id-ID");
  updateJam();
  setInterval(updateJam, 1000);

  function updateJam() {
    const jam = new Date().toLocaleTimeString("id-ID");
    document.getElementById("jam").innerText = jam;
  }

  // Ambil lokasi
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lon = pos.coords.longitude.toFixed(5);
        document.getElementById("lokasi").innerText = `${lat}, ${lon}`;
      },
      () => {
        document.getElementById("lokasi").innerText = "Tidak tersedia";
      }
    );
  } else {
    document.getElementById("lokasi").innerText = "Tidak didukung";
  }

  // Ambil data user dari spreadsheet
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
    });
};

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


// Fungsi SCAN QR CODE
function scanQRCode() {
  const qrReader = new Html5Qrcode("reader");

  qrReader.start(
    { facingMode: "environment" }, // pakai kamera belakang
    {
      fps: 10,
      qrbox: 250
    },
    (decodedText, decodedResult) => {
      document.getElementById("qrResult").innerText = `📍 QR: ${decodedText}`;
      document.getElementById("keterangan").value = decodedText;
      qrReader.stop(); // stop scanning setelah berhasil
    },
    (errorMessage) => {
      console.warn(`QR scan error: ${errorMessage}`);
    }
  ).catch((err) => {
    console.error(`QR init error: ${err}`);
    alert("Gagal membuka kamera untuk scan QR.");
  });
}
