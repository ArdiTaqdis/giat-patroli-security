const scriptURL =
  "https://script.google.com/macros/s/AKfycbxy9J8w86sn_5mctVRQNpGX7BK-XRhXMoid7PgsYDdOPOx1z3QVn2iyfc5oal4sOS9dyA/exec";

let table,
  allData = [];

document.addEventListener("DOMContentLoaded", async () => {
  moment.locale("id");
  const res = await fetch(scriptURL + "?action=getPatroli");
  allData = await res.json();
  document.getElementById("loadingOverlay").style.display = "none";

  table = $("#dataTabel").DataTable({
    data: allData,
    columns: generateColumns(),
    dom: "Bfrtip",
    buttons: ["excelHtml5", "pdfHtml5", "print"],
    scrollX: true,
  });

  setupFilters();
});

function generateColumns() {
  return [
    { data: "Timestamp", render: (d) => new Date(d).toLocaleString("id-ID") },
    { data: "NIP" },
    { data: "Nama" },
    { data: "Perusahaan" },
    { data: "Tanggal", render: (d) => moment(d).format("DD/MM/YYYY") },
    { data: "Jam" },
    { data: "Lokasi" },
    { data: "Area" },
    {
      data: "Foto",
      render: (d) => (d ? `<img src="${d}" alt="foto">` : "-"),
    },
    { data: "Keterangan" },
    {
      data: null,
      render: (d, t, row, meta) => `
        <button onclick="cetakPDF(${meta.row})">📄 PDF</button>  
        <button class="edit" onclick="openEditModal(${meta.row})">✏️ Edit</button>
        <button class="hapus" onclick="hapusData(${meta.row})">🗑️ Hapus</button>`,
    },
  ];
}

function setupFilters() {
  // Filter Tanggal
  $("#filterTanggal").daterangepicker({
    locale: { format: "DD/MM/YYYY" },
    autoUpdateInput: false,
  });

  $("#filterTanggal").on("apply.daterangepicker", function (ev, picker) {
    const start = picker.startDate;
    const end = picker.endDate;
    $(this).val(start.format("DD/MM/YYYY") + " - " + end.format("DD/MM/YYYY"));

    $.fn.dataTable.ext.search.push(function (settings, data) {
      const tanggal = moment(data[4], "DD/MM/YYYY");
      return tanggal.isBetween(start, end, "day", "[]");
    });
    table.draw();
  });

  $("#filterTanggal").on("cancel.daterangepicker", function () {
    $(this).val("");
    $.fn.dataTable.ext.search.pop();
    table.draw();
  });

  // Filter Perusahaan
  const perusahaanSet = new Set(allData.map((d) => d.Perusahaan));
  perusahaanSet.forEach((p) => {
    $("#filterPerusahaan").append(`<option value="${p}">${p}</option>`);
  });

  // Filter Area
  const areaSet = new Set(allData.map((d) => d.Area));
  areaSet.forEach((a) => {
    $("#filterArea").append(`<option value="${a}">${a}</option>`);
  });

  // Custom filter perusahaan + area + keterangan
  $.fn.dataTable.ext.search.push(function (settings, data, dataIndex) {
    const perusahaan = $("#filterPerusahaan").val();
    const area = $("#filterArea").val();
    const ketKeyword = $("#filterKeterangan").val().toLowerCase();

    const perusahaanData = data[3];
    const areaData = data[7];
    const ketData = data[9] ? data[9].toLowerCase() : "";

    return (
      (!perusahaan || perusahaanData === perusahaan) &&
      (!area || areaData === area) &&
      (!ketKeyword || ketData.includes(ketKeyword))
    );
  });

  $("#filterPerusahaan, #filterArea, #filterKeterangan").on(
    "input change",
    () => table.draw()
  );
}

function openEditModal(index) {
  const d = allData[index];
  document.getElementById("editNip").value = d.NIP;
  document.getElementById("editNama").value = d.Nama;
  document.getElementById("editKeterangan").value = d.Keterangan || "";
  document.getElementById("editModal").style.display = "flex";
  document.getElementById("editModal").dataset.index = index;
}

function tutupModal() {
  document.getElementById("editModal").style.display = "none";
}

async function simpanEdit() {
  document.getElementById("loadingOverlay").style.display = "flex";
  const index = document.getElementById("editModal").dataset.index;
  const row = allData[index];
  const ketBaru = document.getElementById("editKeterangan").value;

  const payload = new URLSearchParams();
  payload.append("action", "updateKeterangan");
  payload.append("timestamp", row.Timestamp);
  payload.append("keterangan", ketBaru);

  try {
    const res = await fetch(scriptURL, { method: "POST", body: payload });
    const msg = await res.text();
    alert(msg);
    location.reload();
  } catch (err) {
    alert("❌ Gagal simpan perubahan.");
  } finally {
    document.getElementById("loadingOverlay").style.display = "none";
  }
}

function hapusData(index) {
  if (!confirm("Yakin ingin menghapus data ini?")) return;
  const row = allData[index];
  const payload = new URLSearchParams();
  payload.append("action", "deleteAbsen");
  payload.append("timestamp", row.Timestamp);

  fetch(scriptURL, { method: "POST", body: payload })
    .then((res) => res.text())
    .then(alert)
    .then(() => location.reload());
}

function cetakPDF(index) {
  const data = allData[index];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(`Laporan Patroli - ${data.Nama}`, 14, 20);

  const rows = [
    ["NIP", data.NIP],
    ["Nama", data.Nama],
    ["Perusahaan", data.Perusahaan],
    ["Tanggal", data.Tanggal],
    ["Jam", data.Jam],
    ["Lokasi", data.Lokasi],
    ["Area", data.Area],
    ["Keterangan", data.Keterangan || "-"],
  ];

  rows.forEach((r, i) => doc.text(`${r[0]}: ${r[1]}`, 14, 35 + i * 8));

  doc.save(`Patroli_${data.Nama}_${data.Tanggal}.pdf`);
}
