const scriptURL = 'https://script.google.com/macros/s/AKfycbxy9J8w86sn_5mctVRQNpGX7BK-XRhXMoid7PgsYDdOPOx1z3QVn2iyfc5oal4sOS9dyA/exec';
let table, allData = [];

document.addEventListener("DOMContentLoaded", async () => {
  moment.locale('id');
  const res = await fetch(scriptURL + '?action=getPatroli');
  allData = await res.json();
  document.getElementById("loadingOverlay").style.display = "none";

  table = $('#dataTabel').DataTable({
    data: allData,
    columns: generateColumns(),
    dom: 'Bfrtip',
    buttons: ['excelHtml5', 'pdfHtml5', 'print'],
    scrollX: true
  });

  setupFilters();
});

function generateColumns() {
  const base = [
    { data: 'Timestamp', render: d => new Date(d).toLocaleString('id-ID') },
    { data: 'NIP' }, { data: 'Nama' }, { data: 'Perusahaan' },
    { data: 'Tanggal', render: d => moment(d).format('DD/MM/YYYY') },
    { data: 'Jam' }, { data: 'Lokasi' }
  ];

  for (let i = 1; i <= 5; i++) {
    base.push({ data: `QR${i}` });
    base.push({ data: `Foto${i}`, render: d => d ? `<img src="${d}">` : '-' });
    base.push({ data: `Ket${i}` });
  }

  base.push({
    data: 'Status',
    render: d => {
      if (d === "Done") return `<span style="color: white; background: #4caf50; padding: 4px 10px; border-radius: 8px;">${d}</span>`;
      if (d === "Expired") return `<span style="color: white; background: #f44336; padding: 4px 10px; border-radius: 8px;">${d}</span>`;
      return `<span style="color: white; background: #ff9800; padding: 4px 10px; border-radius: 8px;">${d || 'Proses'}</span>`;
    }
  });

  base.push({
    data: null,
    render: (d, t, row, meta) => `
      <button onclick="cetakPDF(${meta.row})">📄 PDF</button>  
      <button class="edit" onclick="openEditModal(${meta.row})">✏️ Edit</button>
      <button class="hapus" onclick="hapusData(${meta.row})">🗑️ Hapus</button>`
  });

  return base;
}

function setupFilters() {
  $('#filterTimestamp').daterangepicker({
    timePicker: true, timePicker24Hour: true,
    locale: { format: 'DD/MM/YYYY HH:mm' },
    autoUpdateInput: false
  });

  $('#filterTimestamp').on('apply.daterangepicker', function(ev, picker) {
    const start = picker.startDate;
    const end = picker.endDate;
    $(this).val(start.format('DD/MM/YYYY HH:mm') + ' - ' + end.format('DD/MM/YYYY HH:mm'));
    $.fn.dataTable.ext.search.push(function(settings, data) {
      const ts = data[0];
      const tsDate = moment(ts, 'D/M/YYYY, H:mm:ss');
      return tsDate.isBetween(start, end, null, '[]');
    });
    table.draw();
  });

  $('#filterTimestamp').on('cancel.daterangepicker', function() {
    $(this).val('');
    $.fn.dataTable.ext.search.pop();
    table.draw();
  });

  const perusahaanSet = new Set(allData.map(d => d.Perusahaan));
  perusahaanSet.forEach(p => {
    $('#filterPerusahaan').append(`<option value="${p}">${p}</option>`);
  });

  $('#filterPerusahaan, #filterStatus').on('change', () => table.draw());

  $.fn.dataTable.ext.search.push(function(settings, data) {
    const perusahaan = $('#filterPerusahaan').val();
    const status = $('#filterStatus').val();
    const perusahaanData = data[3];
    const statusData = data[21];
    return (!perusahaan || perusahaanData === perusahaan) &&
           (!status || statusData === status);
  });
}

function openEditModal(index) {
  const d = allData[index];
  document.getElementById('editNip').value = d.NIP;
  document.getElementById('editNama').value = d.Nama;
  document.getElementById('editStatus').value = d.Status || '';
  document.getElementById('editModal').style.display = "flex";
  document.getElementById('editModal').dataset.index = index;
}

function tutupModal() {
  document.getElementById('editModal').style.display = "none";
}

async function simpanEdit() {
  document.getElementById("loadingOverlay").style.display = "flex";
  const index = document.getElementById('editModal').dataset.index;
  const row = allData[index];
  const statusBaru = document.getElementById('editStatus').value;

  const payload = new URLSearchParams();
  payload.append('action', 'updateKeterangan1');
  payload.append('timestamp', row.Timestamp);
  payload.append('status', statusBaru);

  try {
    const res = await fetch(scriptURL, { method: 'POST', body: payload });
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
  payload.append('action', 'deleteAbsen');
  payload.append('timestamp', row.Timestamp);

  fetch(scriptURL, { method: "POST", body: payload })
    .then(res => res.text())
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
    ["Status", data.Status]
  ];

  rows.forEach((r, i) => doc.text(`${r[0]}: ${r[1]}`, 14, 35 + (i * 8)));

  let y = 35 + rows.length * 8 + 10;
  for (let i = 1; i <= 5; i++) {
    doc.text(`Area ${i}`, 14, y);
    doc.text(`QR${i}: ${data[`QR${i}`] || '-'}`, 20, y + 6);
    doc.text(`Ket${i}: ${data[`Ket${i}`] || '-'}`, 20, y + 12);
    y += 20;
  }

  doc.save(`Patroli_${data.Nama}_${data.Tanggal}.pdf`);
}
