// GANTI DENGAN URL DEPLOY GOOGLE APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbx1qP2sxfhksk6lKzAc_jNnRbw22re2fvLl2qqSfKYWYcrPGd8NBTX2vmuQjx0yg3IM/exec";

let dataSiswaAdmin = [];
let html5QrcodeScanner = null;

window.onload = async () => {
    // Jalankan otentikasi login admin sederhana di sini jika dibutuhkan
    // let pass = prompt("Masukkan Password Admin:"); if(pass !== "12345") { document.body.innerHTML = "Akses Ditolak"; return; }

    try {
        const res = await fetch(`${API_URL}?target=data_siswa`);
        dataSiswaAdmin = await res.json();
        
        initDropdowns();
        initQRScanner();
        muatLogPresensi(); // Memuat log ketika admin pertama kali membuka web
    } catch (err) {
        alert("Gagal terhubung ke database Google Sheets.");
    }
};

function initDropdowns() {
    const selectAbsen = document.getElementById('adminPilihSiswa');
    const selectKasus = document.getElementById('kasusPilihSiswa');
    
    // Reset dropdown tapi sisakan opsi placeholder pertama
    selectAbsen.innerHTML = '<option value="">-- Pilih Siswa --</option>';
    selectKasus.innerHTML = '<option value="">-- Pilih Siswa --</option>';

    dataSiswaAdmin.forEach(s => {
        let opt = `<option value="${s.nis}">${s.nama} (${s.kelas})</option>`;
        selectAbsen.innerHTML += opt;
        selectKasus.innerHTML += opt;
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.remove('hidden');
    event.currentTarget.classList.add('active');
}

// LOGIKA INPUT ABSENSI OLEH ADMIN
document.getElementById('formAdminAbsen').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nis = document.getElementById('adminPilihSiswa').value;
    if(!nis) return alert("Pilih siswa terlebih dahulu!");

    const siswa = dataSiswaAdmin.find(s => s.nis == nis);
    const payload = {
        nis: siswa.nis,
        nama: siswa.nama,
        kelas: siswa.kelas,
        status: document.getElementById('adminStatus').value,
        metode: "Input Manual Admin"
    };

    const res = await fetch(`${API_URL}?target=absen`, { method: 'POST', body: JSON.stringify(payload) });
    const result = await res.json();
    if(result.status === "success") {
        alert(`Berhasil menyimpan presensi: ${siswa.nama}`);
        document.getElementById('formAdminAbsen').reset();
        muatLogPresensi(); // Segera perbarui log setelah admin menginput manual
    }
});

// LOGIKA REKAP KASUS SISWA
document.getElementById('formKasus').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nis = document.getElementById('kasusPilihSiswa').value;
    if(!nis) return alert("Pilih siswa terlebih dahulu!");

    const siswa = dataSiswaAdmin.find(s => s.nis == nis);
    const payload = {
        nis: siswa.nis,
        nama: siswa.nama,
        kasus: document.getElementById('jenisKasus').value,
        tindakan: document.getElementById('tindakan').value
    };

    const res = await fetch(`${API_URL}?target=tambah_kasus`, { method: 'POST', body: JSON.stringify(payload) });
    const result = await res.json();
    if(result.status === "success") {
        alert(`Catatan kasus untuk ${siswa.nama} berhasil dimasukkan.`);
        document.getElementById('formKasus').reset();
    }
});

// DOWNLOAD DATA REKAP KE FILE CSV EXCEL
async function downloadCSV(target, filename) {
    try {
        const res = await fetch(`${API_URL}?target=${target}`);
        const data = await res.json();
        
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Menggunakan BOM \uFEFF agar terbaca rapi di Excel
        
        data.forEach(row => {
            let r = row.map(val => {
                let text = val.toString().replace(/"/g, '""'); // Escape tanda petik dua
                return `"${text}"`;
            }).join(",");
            csvContent += r + "\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        alert("Gagal mengunduh file rekap.");
    }
}

// LOGIKA QR CODE SCANNER KARTU PELAJAR
function initQRScanner() {
    function onScanSuccess(decodedText) {
        const selectAbsen = document.getElementById('adminPilihSiswa');
        // Cari apakah NIS terdaftar
        const cocok = dataSiswaAdmin.some(s => s.nis.trim() === decodedText.trim());
        
        if (cocok) {
            selectAbsen.value = decodedText.trim();
            alert(`QR Terbaca! Siswa: ${dataSiswaAdmin.find(s => s.nis == decodedText).nama}`);
        } else {
            alert(`QR Code terbaca: [ ${decodedText} ], namun tidak terdaftar di database siswa.`);
        }
    }

    html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 15, qrbox: 250 }, false);
    html5QrcodeScanner.render(onScanSuccess, (err) => { /* Silent error scanner */ });
}

// FUNGSI TARIK DATA LOG ABSENSI UNTUK MONITORING REAL-TIME
async function muatLogPresensi() {
    const tbody = document.getElementById('logPresensiBody');
    if(!tbody) return;

    try {
        // Tarik data menggunakan target rekap_absen yang sudah ada di Apps Script
        const res = await fetch(`${API_URL}?target=rekap_absen`);
        const data = await res.json();
        
        tbody.innerHTML = "";
        
        // Cek jika data kosong atau hanya berisi baris header saja
        if (!data || data.length <= 1) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 15px; text-align: center; color: #a0aec0;">Belum ada riwayat presensi hari ini.</td></tr>`;
            return;
        }

        // Looping data terbalik (dari data paling baru masuk / paling bawah di Sheet)
        // Melewatkan data[0] karena merupakan header kolom
        for (let i = data.length - 1; i > 0; i--) {
            const row = data[i];
            
            // Pemetaan urutan kolom Spreadsheet: [Timestamp, NIS, Nama, Kelas, Status, Keterangan, Metode]
            const nis = row[1] || "-";
            const nama = row[2] || "-";
            const kelas = row[3] || "-";
            const status = row[4] || "-";
            const metode = row[6] || row[5] || "Mandiri"; 

            // Penentuan warna badge status presensi
            let color = "#4a5568";
            if(status.toLowerCase().includes("hadir")) color = "#48bb78";
            if(status.toLowerCase().includes("izin")) color = "#ecc94b";
            if(status.toLowerCase().includes("sakit")) color = "#4299e1";
            if(status.toLowerCase().includes("alpa")) color = "#f56565";

            let tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #e2e8f0";
            tr.innerHTML = `
                <td style="padding: 12px; color: #4a5568;">${nis}</td>
                <td style="padding: 12px; font-weight: 600;">${nama}</td>
                <td style="padding: 12px; color: #4a5568;">${kelas}</td>
                <td style="padding: 12px;">
                    <span style="background: ${color}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                        ${status}
                    </span>
                </td>
                <td style="padding: 12px; color: #718096; font-size: 13px;">${metode}</td>
            `;
            tbody.appendChild(tr);
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 15px; text-align: center; color: #e53e3e;">Gagal memuat data log. Silakan klik Refresh Data.</td></tr>`;
    }
}
