const scriptURL =
  "https://script.google.com/macros/s/AKfycbx1r9XWC2Go7qgUU0f0A_0rmJ0EwziNpp3zFfk8apY7OOH76zLlPnSex2H5dK7oYWS_KA/exec";

document.addEventListener("DOMContentLoaded", () => {
  renderPending();
});

// 🔑 Ambil semua data patroliArea* dari localStorage
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

// 🔑 Tampilkan data ke tabel
function renderPending() {
  const tbody = document.querySelector("#pendingTable tbody");
  tbody.innerHTML = "";

  const data = getPending();
  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; color:#777; padding:20px;">
          ✅ Tidak ada data pending
        </td>
      </tr>`;
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
        <button class="btn btn-kirim" onclick="kirimData(${i}, this)">Kirim</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// 🔎 Lihat foto
function lihatFoto(index) {
  const data = getPending();
  const item = data[index];
  if (!item) return;

  const w = window.open("", "_blank");
  w.document.write(`
    <html>
      <head><title>Foto Area ${item.area}</title></head>
      <body style="margin:0;display:flex;align-items:center;justify-content:center;background:#111;">
        <img src="${item.foto}" style="max-width:100%;max-height:100%;" />
      </body>
    </html>
  `);
}

// 🚀 Kirim data ke Apps Script
async function kirimData(index, el) {
  const data = getPending();
  const item = data[index];
  if (!item) return;

  if (!navigator.onLine) {
    alert("⚠️ Tidak ada koneksi internet. Coba lagi saat online.");
    return;
  }

  if (!confirm(`Kirim data patroli Area ${item.area}?`)) return;

  try {
    el.disabled = true;
    el.textContent = "Mengirim...";
    showLoading();

    await fetch(scriptURL, {
      method: "POST",
      mode: "no-cors", // 🔑 bypass CORS
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "patroliArea",
        nip: item.nip,
        nama: item.nama,
        perusahaan: item.perusahaan,
        tanggal: item.tanggal,
        jam: item.jam,
        lokasi: item.lokasi,
        area: item.area,
        foto: item.foto,
        keterangan: item.keterangan,
      }),
    });

    hideLoading();

    // ✅ anggap sukses (karena no-cors tidak bisa baca response)
    localStorage.removeItem(`patroliArea${item.area}`);
    alert(`✅ Data Area ${item.area} berhasil dikirim!`);
    renderPending();
    if (getPending().length === 0) showSuccessOverlay();
  } catch (err) {
    hideLoading();
    console.error(err);
    alert("❌ Terjadi kesalahan koneksi: " + err.message);
    el.disabled = false;
    el.textContent = "Kirim";
  }
}

// 🚀 Kirim Semua Data Sekaligus
async function kirimSemua() {
  const data = getPending();
  if (data.length === 0) {
    alert("✅ Tidak ada data pending.");
    return;
  }

  if (!navigator.onLine) {
    alert("⚠️ Tidak ada koneksi internet.");
    return;
  }

  if (!confirm(`Kirim semua (${data.length}) data patroli ke server?`)) return;

  try {
    showLoading();
    for (let i = 0; i < data.length; i++) {
      const item = data[i];

      await fetch(scriptURL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "patroliArea",
          nip: item.nip,
          nama: item.nama,
          perusahaan: item.perusahaan,
          tanggal: item.tanggal,
          jam: item.jam,
          lokasi: item.lokasi,
          area: item.area,
          foto: item.foto,
          keterangan: item.keterangan,
        }),
      });
    }

    // ✅ Semua sukses → hapus semua key
    for (let i = 1; i <= 5; i++) {
      localStorage.removeItem(`patroliArea${i}`);
    }

    renderPending();
    hideLoading();
    showSuccessOverlay();
  } catch (err) {
    hideLoading();
    console.error(err);
    alert("❌ Terjadi kesalahan koneksi: " + err.message);
  }
}

function showSuccessOverlay() {
  document.getElementById("successOverlay").style.display = "flex";
}
function closeOverlay() {
  document.getElementById("successOverlay").style.display = "none";
}

function showLoading() {
  document.getElementById("loadingOverlay").style.display = "flex";
}
function hideLoading() {
  document.getElementById("loadingOverlay").style.display = "none";
}
