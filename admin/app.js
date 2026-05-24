// GANTI DENGAN URL DEPLOY GOOGLE APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbx1qP2sxfhksk6lKzAc_jNnRbw22re2fvLl2qqSfKYWYcrPGd8NBTX2vmuQjx0yg3IM/exec";

let dataSiswaAdmin = [];
let html5QrcodeScanner = null;

window.onload = async () => {
    try {
        const res = await fetch(`${API_URL}?target=data_siswa`);
        dataSiswaAdmin = await res.json();
        
        initDropdowns();
        initQRScanner();
        muatLogPresensi(); // Memuat log presensi di awal buka
        muatLogKasus();    // Memuat log kasus pelanggaran di awal buka
    } catch (err) {
        alert("Gagal terhubung ke database Google Sheets.");
    }
};

function initDropdowns() {
    const selectAbsen = document.getElementById('adminPilihSiswa');
    const selectKasusBeneran = document.getElementById('kasusPilihSiswa');
    
    if(selectAbsen) selectAbsen.innerHTML = '<option value="">-- Pilih Siswa --</option>';
    if(selectKasusBeneran) selectKasusBeneran.innerHTML = '<option value="">-- Pilih Siswa --</option>';

    dataSiswaAdmin.forEach(s => {
        let opt = `<option value="${s.nis}">${s.nama} (${s.kelas})</option>`;
        if(selectAbsen) selectAbsen.innerHTML += opt;
        if(selectKasusBeneran) selectKasusBeneran.innerHTML += opt;
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.remove('hidden');
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
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

    try {
        const res = await fetch(`${API_URL}?target=absen`, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        if(result.status === "success") {
            alert(`Berhasil menyimpan presensi: ${siswa.nama}`);
            document.getElementById('formAdminAbsen').reset();
            muatLogPresensi();
        }
    } catch (error) {
        alert("Gagal menyimpan presensi.");
    }
});

// LOGIKA REKAP KASUS SISWA OLEH ADMIN
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

    try {
        const res = await fetch(`${API_URL}?target=tambah_kasus`, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        if(result.status === "success") {
            alert(`Catatan kasus untuk ${siswa.nama} berhasil dimasukkan.`);
            document.getElementById('formKasus').reset();
            muatLogKasus(); // Otomatis refresh daftar tabel log kasus setelah ditambahkan
        }
    } catch (error) {
        alert("Gagal menyimpan data kasus.");
    }
});

// DOWNLOAD DATA REKAP KE FILE CSV EXCEL
async function downloadCSV(target, filename) {
    try {
        const res = await fetch(`${API_URL}?target=${target}`);
        const data = await res.json();
        
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        
        data.forEach(row => {
            let r = row.map(val => {
                let text = val ? val.toString().replace(/"/g, '""') : "";
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
        const cocok = dataSiswaAdmin.some(s => s.nis.trim() === decodedText.trim());
        
        if (cocok) {
            selectAbsen.value = decodedText.trim();
            alert(`QR Terbaca! Siswa: ${dataSiswaAdmin.find(s => s.nis == decodedText).nama}`);
        } else {
            alert(`QR Code terbaca: [ ${decodedText} ], namun tidak terdaftar di database siswa.`);
        }
    }

    html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 15, qrbox: 250 }, false);
    html5QrcodeScanner.render(onScanSuccess, (err) => {});
}

// FUNGSI TARIK DATA LOG ABSENSI KHUSUS HARI INI SAJA
async function muatLogPresensi() {
    const tbody = document.getElementById('logPresensiBody');
    if(!tbody) return;

    try {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 15px; text-align: center; color: #718096;">🔄 Memproses sinkronisasi Google Sheets...</td></tr>`;

        const res = await fetch(`${API_URL}?target=rekap_absen`);
        if (!res.ok) throw new Error("Gagal mengambil respons dari Apps Script");
        
        const data = await res.json();
        tbody.innerHTML = "";
        
        if (!data || data.length <= 1) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 15px; text-align: center; color: #a0aec0;">Belum ada riwayat presensi hari ini.</td></tr>`;
            return;
        }

        const hariIni = new Date();
        const tgl = String(hariIni.getDate()).padStart(2, '0');
        const bln = String(hariIni.getMonth() + 1).padStart(2, '0');
        const thn = hariIni.getFullYear();
        
        const formatSatu = `${tgl}/${bln}/${thn}`;
        const formatDua = `${thn}-${bln}-${tgl}`;

        let adaDataHariIni = false;

        for (let i = data.length - 1; i > 0; i--) {
            const row = data[i];
            if (!row || row.length < 5) continue; 

            const timestampRaw = row[0] ? row[0].toString() : "";

            if (!timestampRaw.includes(formatSatu) && !timestampRaw.includes(formatDua)) {
                continue; 
            }

            adaDataHariIni = true;

            const nis = row[1] ? row[1].toString() : "-";
            const nama = row[2] ? row[2].toString() : "-";
            const kelas = row[3] ? row[3].toString() : "-";
            const status = row[4] ? row[4].toString() : "-";
            const metode = row[6] ? row[6].toString() : (row[5] ? row[5].toString() : "Mandiri"); 

            let color = "#4a5568";
            const statusCek = status.toLowerCase();
            if(statusCek.includes("hadir")) color = "#48bb78";
            else if(statusCek.includes("izin")) color = "#ecc94b";
            else if(statusCek.includes("sakit")) color = "#4299e1";
            else if(statusCek.includes("alpa")) color = "#f56565";

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

        if (!adaDataHariIni) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 15px; text-align: center; color: #a0aec0;">Belum ada riwayat presensi masuk untuk hari ini.</td></tr>`;
        }

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 15px; text-align: center; color: #e53e3e;">⚠️ Gagal memuat log presensi.</td></tr>`;
    }
}

// FUNGSI TARIK DATA LOG KASUS / PELANGGARAN SISWA SECARA VISUAL
async function muatLogKasus() {
    const tbody = document.getElementById('logKasusBody');
    if(!tbody) return;

    try {
        tbody.innerHTML = `<tr><td colspan="4" style="padding: 15px; text-align: center; color: #718096;">🔄 Memproses sinkronisasi data kasus...</td></tr>`;

        // Memanfaatkan target 'rekap_kasus' yang sudah terintegrasi di Apps Script Anda
        const res = await fetch(`${API_URL}?target=rekap_kasus`);
        if (!res.ok) throw new Error("Gagal mengambil data rekap kasus");

        const data = await res.json();
        tbody.innerHTML = "";

        if (!data || data.length <= 1) {
            tbody.innerHTML = `<tr><td colspan="4" style="padding: 15px; text-align: center; color: #a0aec0;">Belum ada riwayat catatan kasus siswa.</td></tr>`;
            return;
        }

        // Loop terbalik agar input pelanggaran terbaru berada di tumpukan paling atas tabel
        for (let i = data.length - 1; i > 0; i--) {
            const row = data[i];
            if (!row || row.length < 3) continue; // Skip baris kosong

            // Pemetaan indeks array Spreadsheet Kasus: [Timestamp, NIS, Nama, Jenis Kasus, Tindakan/Solusi]
            const nis = row[1] ? row[1].toString() : "-";
            const nama = row[2] ? row[2].toString() : "-";
            const kasus = row[3] ? row[3].toString() : "-";
            const tindakan = row[4] ? row[4].toString() : "-";

            let tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #e2e8f0";
            tr.innerHTML = `
                <td style="padding: 12px; color: #4a5568;">${nis}</td>
                <td style="padding: 12px; font-weight: 600; color: #2d3748;">${nama}</td>
                <td style="padding: 12px; color: #e53e3e; font-weight: 500;">⚠️ ${kasus}</td>
                <td style="padding: 12px; color: #2b6cb0; font-style: italic;">${tindakan}</td>
            `;
            tbody.appendChild(tr);
        }
    } catch (err) {
        console.error("Detail Error Log Kasus:", err);
        tbody.innerHTML = `<tr><td colspan="4" style="padding: 15px; text-align: center; color: #e53e3e;">⚠️ Gagal sinkronisasi daftar kasus.</td></tr>`;
    }
}
