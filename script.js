// ============================================================
// ⚙️ KONFIGURASI — GANTI DENGAN URL ANDA
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzvrvo0G-478j8lwGldb8RN6ZFKJuPGnL5NVtBypgjJDgDR3JgClelp09iTGOCa-IzW/exec';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1bKZdEl3egxhoBC0YmVOPEWSKjb0yiubPEprMdkU_ib4/edit';

// ============================================================
// STATE
// ============================================================
let students = [];
let html5QrCode = null;
let isScanning = false;
let lastScanned = { nim: '', time: 0 };

// ============================================================
// DOM
// ============================================================
const $ = id => document.getElementById(id);
const qrDisplay = $('qrDisplay');
const refreshBtn = $('refreshBtn');
const downloadQrBtn = $('downloadQrBtn');
const openSheetBtn = $('openSheetBtn');
const resetBtn = $('resetBtn');
const generateQrBtn = $('generateQrBtn');
const nimInput = $('nimInput');
const scannerContainer = $('scannerContainer');
const scanBtn = $('scanBtn');
const stopScanBtn = $('stopScanBtn');
const scanStatus = $('scanStatus');
const studentCount = $('studentCount');
const studentTableBody = $('studentTableBody');
const connectionDot = $('connectionDot');
const connectionMsg = $('connectionMsg');
const toast = $('toast');

// ============================================================
// TOAST
// ============================================================
let toastTimer = null;

function showToast(msg, type = 'info') {
  toast.textContent = msg;
  toast.className = 'toast show ' + type;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ============================================================
// CONNECTION STATUS
// ============================================================
function setConnection(state, msg) {
  connectionDot.className = 'dot ' + state;
  connectionMsg.textContent = msg;
}

// ============================================================
// FETCH DATA DARI GOOGLE SHEETS
// ============================================================
async function loadStudents() {
  setConnection('loading', 'Memuat data dari Google Sheets...');

  try {
    const res = await fetch(
      `${API_URL}?action=getStudents&t=${Date.now()}`
    );

    const json = await res.json();

    if (json.status === 'success') {
      students = json.data;

      renderStudents();

      setConnection(
        '',
        `Terhubung • ${students.length} mahasiswa`
      );
    } else {
      throw new Error(json.message);
    }

  } catch (err) {
    console.error(err);

    setConnection(
      'offline',
      'Gagal terhubung: ' + err.message
    );

    showToast(
      'Gagal memuat data',
      'error'
    );
  }
}

// ============================================================
// RENDER TABEL
// ============================================================
function renderStudents() {
  const total = students.length;

  const hadir = students.filter(
    s => s.Status === 'Hadir'
  ).length;

  studentCount.textContent = `${hadir}/${total} hadir`;

  if (total === 0) {
    studentTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          Belum ada data mahasiswa
        </td>
      </tr>
    `;

    return;
  }

  studentTableBody.innerHTML = students.map(s => `
    <tr>
      <td>${escapeHtml(s.NIM)}</td>
      <td>${escapeHtml(s.Nama)}</td>
      <td>${escapeHtml(s.Kelas)}</td>
      <td>${escapeHtml(s.Jurusan)}</td>

      <td>
        <span class="status-badge ${
          s.Status === 'Hadir'
            ? 'status-hadir'
            : 'status-menunggu'
        }">
          ${escapeHtml(s.Status || 'Menunggu')}
        </span>
      </td>

      <td>
        ${escapeHtml(s['Waktu Hadir'] || '-')}
      </td>
    </tr>
  `).join('');
}

// ============================================================
// ESCAPE HTML
// ============================================================
function escapeHtml(str) {
  return String(str ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );
}

// ============================================================
// GENERATE QR BERDASARKAN NAMA
// ============================================================
function generateQrCode() {

  // Ambil nama dari input
  const namaInput = (nimInput.value || '').trim();

  // Kalau input kosong → gunakan mahasiswa pertama
  if (!namaInput) {

    if (students.length === 0) {
      showToast(
        'Belum ada data mahasiswa',
        'error'
      );
      return;
    }

    const mahasiswaPertama = students[0];

    buatQR(
      mahasiswaPertama.NIM,
      mahasiswaPertama.Nama
    );

    return;
  }

  // Cari mahasiswa berdasarkan nama
  const mahasiswa = students.find(s =>
    String(s.Nama || '').trim().toLowerCase() ===
    namaInput.toLowerCase()
  );

  // Kalau nama tidak ditemukan
  if (!mahasiswa) {

    showToast(
      `Nama "${namaInput}" tidak ditemukan`,
      'error'
    );

    return;
  }

  // Kalau ditemukan → buat QR menggunakan NIM
  buatQR(
    mahasiswa.NIM,
    mahasiswa.Nama
  );
}

// ============================================================
// BUAT QR
// ============================================================
function buatQR(nim, nama) {

  QRCode.toDataURL(
    String(nim),
    {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'H'
    },

    (err, url) => {

      if (err) {
        showToast(
          'Gagal generate QR',
          'error'
        );

        return;
      }

      qrDisplay.innerHTML = `
        <img
          src="${url}"
          alt="QR ${nama}"
        >
      `;

      // Simpan data QR
      qrDisplay.dataset.currentNim = nim;
      qrDisplay.dataset.currentNama = nama;

      showToast(
        `QR untuk ${nama} berhasil dibuat`,
        'success'
      );
    }
  );
}

// ============================================================
// DOWNLOAD QR
// ============================================================
function downloadQr() {

  const img = qrDisplay.querySelector('img');

  if (!img) {

    showToast(
      'Generate QR terlebih dahulu',
      'error'
    );

    return;
  }

  const nama =
    qrDisplay.dataset.currentNama ||
    'presensi';

  const link = document.createElement('a');

  link.download =
    `QR-${nama.replace(/\s+/g, '-')}.png`;

  link.href = img.src;

  link.click();
}

// ============================================================
// SCAN QR
// ============================================================
async function startScan() {

  if (isScanning) return;

  scannerContainer.style.display = 'block';

  scanBtn.classList.add('hidden');

  stopScanBtn.classList.remove('hidden');

  scanStatus.textContent =
    'Arahkan kamera ke QR Code...';

  try {

    html5QrCode =
      new Html5Qrcode('qrReader');

    await html5QrCode.start(

      // Kamera belakang
      { facingMode: 'environment' },

      {
        fps: 10,
        qrbox: {
          width: 250,
          height: 250
        }
      },

      onScanSuccess,

      () => {}
    );

    isScanning = true;

  } catch (err) {

    console.error(err);

    scanStatus.textContent =
      '❌ Gagal akses kamera: ' +
      err.message;

    showToast(
      'Gagal akses kamera. Pastikan HTTPS & izin kamera.',
      'error'
    );

    stopScan();
  }
}

// ============================================================
// KETIKA QR BERHASIL DISCANN
// ============================================================
async function onScanSuccess(decodedText) {

  // QR berisi NIM
  const nim = decodedText.trim();

  const now = Date.now();

  // Cegah scan berulang dalam 3 detik
  if (
    lastScanned.nim === nim &&
    now - lastScanned.time < 3000
  ) {
    return;
  }

  lastScanned = {
    nim: nim,
    time: now
  };

  scanStatus.textContent =
    `📷 Terdeteksi: ${nim}`;

  await sendPresensi(nim);
}

// ============================================================
// KIRIM PRESENSI KE GOOGLE SHEETS
// ============================================================
async function sendPresensi(nim) {

  try {

    setConnection(
      'loading',
      `Memproses NIM ${nim}...`
    );

    const res = await fetch(
      `${API_URL}?action=presensi&nim=${encodeURIComponent(nim)}&t=${Date.now()}`
    );

    const json = await res.json();

    if (json.status === 'success') {

      showToast(
        `✅ ${json.nama} — Hadir (${json.waktu})`,
        'success'
      );

      scanStatus.textContent =
        `✅ ${json.nama} berhasil presensi`;

    } else if (json.status === 'info') {

      showToast(
        `ℹ️ ${json.nama} sudah presensi (${json.waktu})`,
        'info'
      );

      scanStatus.textContent =
        `ℹ️ ${json.nama} sudah presensi`;

    } else {

      showToast(
        `❌ ${json.message}`,
        'error'
      );

      scanStatus.textContent =
        `❌ ${json.message}`;
    }

    await loadStudents();

  } catch (err) {

    console.error(err);

    showToast(
      'Gagal kirim presensi: ' +
      err.message,
      'error'
    );

    setConnection(
      'offline',
      'Gagal kirim presensi'
    );
  }
}

// ============================================================
// STOP SCANNER
// ============================================================
async function stopScan() {

  if (html5QrCode) {

    try {

      await html5QrCode.stop();

      html5QrCode.clear();

    } catch (e) {
      // abaikan error
    }

    html5QrCode = null;
  }

  scannerContainer.style.display =
    'none';

  scanBtn.classList.remove('hidden');

  stopScanBtn.classList.add('hidden');

  isScanning = false;
}

// ============================================================
// RESET PRESENSI
// ============================================================
async function resetPresensi() {

  if (
    !confirm(
      'Yakin reset semua status presensi ke "Menunggu"?'
    )
  ) {
    return;
  }

  try {

    setConnection(
      'loading',
      'Mereset presensi...'
    );

    const res = await fetch(
      `${API_URL}?action=reset&t=${Date.now()}`
    );

    const json = await res.json();

    if (json.status === 'success') {

      showToast(
        '✅ Presensi berhasil direset',
        'success'
      );

      await loadStudents();

    } else {

      throw new Error(
        json.message
      );
    }

  } catch (err) {

    showToast(
      'Gagal reset: ' +
      err.message,
      'error'
    );

    setConnection(
      'offline',
      'Gagal reset'
    );
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================
refreshBtn.addEventListener(
  'click',
  loadStudents
);

downloadQrBtn.addEventListener(
  'click',
  downloadQr
);

openSheetBtn.addEventListener(
  'click',
  () => window.open(
    SHEET_URL,
    '_blank'
  )
);

resetBtn.addEventListener(
  'click',
  resetPresensi
);

generateQrBtn.addEventListener(
  'click',
  generateQrCode
);

scanBtn.addEventListener(
  'click',
  startScan
);

stopScanBtn.addEventListener(
  'click',
  stopScan
);

// Klik QR → generate mahasiswa pertama
qrDisplay.addEventListener(
  'click',
  () => generateQrCode()
);

// Enter di input nama → generate QR
nimInput.addEventListener(
  'keypress',
  e => {

    if (e.key === 'Enter') {
      generateQrCode();
    }

  }
);

// ============================================================
// INIT
// ============================================================
loadStudents().then(() => {

  if (students.length > 0) {

    // Generate QR mahasiswa pertama
    buatQR(
      students[0].NIM,
      students[0].Nama
    );
  }

});