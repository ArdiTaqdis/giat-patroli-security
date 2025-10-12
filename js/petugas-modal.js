import {
  fileToBase64,
  fetchWithTimeout,
  showOverlay,
  hideOverlay,
} from "./petugas-utils.js";
import {
  showModalSmart,
  closeModalSmart,
  logBootstrapVersion,
} from "./modal-utils.js"; // ✅ dipakai dari file luar

import { savePetugas, cachedPetugas } from "./petugas-sync.js";
import { db } from "./firebase.js";
import {
  getDocs,
  collection,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const scriptURL =
  "https://script.google.com/macros/s/AKfycbyNfD1Jyd26-PA0hpF-blLLwr0brWqpRNuWi7tYVXYRvVZC09aBqGY6GTV7xYon8NDC/exec";

/* ============================================================
   🔹 FUNGSI UTAMA: TAMBAH / EDIT PETUGAS
   ============================================================ */
export async function openPetugasModal(isEdit = false, petugas = null) {
  const old = document.getElementById("petugasModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.classList.add("modal", "fade");
  modal.id = "petugasModal";
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title">${isEdit ? "Edit" : "Tambah"} Petugas</h5>
          <button type="button" class="close text-white" data-dismiss="modal">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="petugasId" value="${petugas?.id || ""}">
          <div class="form-group">
            <label>NIP</label>
            <input type="text" id="nip" class="form-control"
                   value="${petugas?.nip || ""}" ${isEdit ? "disabled" : ""}>
          </div>
          <div class="form-group">
            <label>Nama</label>
            <input type="text" id="nama" class="form-control" value="${
              petugas?.nama || ""
            }">
          </div>
          <div class="form-group">
            <label>Perusahaan</label>
            <select id="perusahaanSelect" class="form-control">
              <option>Memuat...</option>
            </select>
          </div>
          <div class="form-group">
            <label>Foto Petugas</label>
            <input type="file" id="fotoFile" class="form-control" accept="image/*">
            <img id="previewFoto" src="${petugas?.fotoUrl || ""}"
                 style="width:60px;height:60px;border-radius:50%;
                 margin-top:8px;${
                   petugas?.fotoUrl ? "display:block" : "display:none"
                 };">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-dismiss="modal">Batal</button>
          <button class="btn btn-primary" id="btnSavePetugas">
            ${isEdit ? "Simpan Perubahan" : "Tambah Petugas"}
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  await loadPerusahaanDropdown(petugas?.perusahaanId || "");
  showModalSmart(modal);

  const fotoFile = modal.querySelector("#fotoFile");
  const preview = modal.querySelector("#previewFoto");
  fotoFile.onchange = () => {
    const f = fotoFile.files[0];
    if (f) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = "block";
      };
      reader.readAsDataURL(f);
    }
  };

  modal.querySelector("#btnSavePetugas").onclick = async () => {
    const nip = document.getElementById("nip").value.trim();
    const nama = document.getElementById("nama").value.trim();
    const select = document.getElementById("perusahaanSelect");
    const perusahaanId = select.value;
    const perusahaanNama = select.options[select.selectedIndex]?.text || "";
    const file = document.getElementById("fotoFile");

    if (!nip || !nama || !perusahaanId) return alert("⚠️ Lengkapi semua data!");

    // 🔍 Cek duplikat NIP sebelum simpan
    if (!isEdit) {
      const duplikat = cachedPetugas.find(
        (p) => (p.nip || p.NIP || "").toString().trim() === nip
      );
      if (duplikat) {
        alert(
          `⚠️ NIP ${nip} sudah digunakan oleh:\n🧍‍♂️ ${
            duplikat.nama || "-"
          }\n🏢 ${duplikat.perusahaanNama || "-"}\n\nSilakan gunakan NIP lain.`
        );
        return;
      }
    }

    showOverlay("Menyimpan data...");
    let fotoUrl = petugas?.fotoUrl || "";

    try {
      // 🔸 Upload foto jika ada
      if (file.files.length > 0) {
        const base64 = await fileToBase64(file.files[0]);
        const res = await fetchWithTimeout(scriptURL, {
          method: "POST",
          body: new URLSearchParams({
            action: "uploadFotoPetugas",
            file: base64,
            namaFile: `${nip}_${Date.now()}.jpg`,
          }),
        });
        const result = await res.json();
        if (result.status === "success") fotoUrl = result.url;
      }

      // 🔸 Simpan data ke Firestore
      await savePetugas({
        id: nip,
        nip,
        nama,
        perusahaanId,
        perusahaanNama,
        fotoUrl,
        role: "petugas",
      });

      hideOverlay();
      showSuccessToast("✅ Data petugas berhasil disimpan!");

      // 🔁 Refresh tabel admin tanpa reload
      import("./admin-petugas.js").then((m) => m.loadPetugas());

      // 🔹 Kosongkan semua field untuk input berikutnya
      document.getElementById("nip").value = "";
      document.getElementById("nama").value = "";
      document.getElementById("perusahaanSelect").selectedIndex = 0;

      const fotoInput = document.getElementById("fotoFile");
      const previewFoto = document.getElementById("previewFoto");
      if (fotoInput) fotoInput.value = "";
      if (previewFoto) {
        previewFoto.src = "";
        previewFoto.style.display = "none";
      }

      // 🔹 Fokus otomatis ke NIP untuk entry berikutnya
      document.getElementById("nip").focus();
    } catch (err) {
      hideOverlay();
      alert("❌ Gagal: " + err.message);
    }
  };
}

/** 🔽 Muat data perusahaan untuk dropdown */
async function loadPerusahaanDropdown(selectedId = "") {
  const select = document.getElementById("perusahaanSelect");
  select.innerHTML = `<option>Memuat...</option>`;

  try {
    const snap = await getDocs(collection(db, "perusahaan"));
    select.innerHTML = `<option value="">-- Pilih Perusahaan --</option>`;
    snap.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.data().nama;
      if (d.id === selectedId) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("❌ Gagal memuat perusahaan:", err);
    select.innerHTML = `<option value="">⚠️ Gagal memuat data</option>`;
  }
}

/** 🔔 Toast sukses modern */
function showSuccessToast(message = "✅ Data berhasil disimpan!") {
  const el = document.createElement("div");
  el.textContent = message;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    background: "#4caf50",
    color: "#fff",
    padding: "12px 18px",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
    opacity: 0,
    transform: "translateY(20px)",
    transition: "all .4s ease",
    zIndex: 9999,
  });
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  }, 50);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    setTimeout(() => el.remove(), 400);
  }, 3000);
}
