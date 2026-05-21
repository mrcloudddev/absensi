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
            csvContent += r + "\r\n";
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