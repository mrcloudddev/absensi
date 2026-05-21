const API_URL = "https://script.google.com/macros/s/AKfycbzQ1-YvNByd9a0AJ_bCjNq2EZbiGQyWI7zdx8iuhN2c85VilvMFjCytgg3CpjYC9EL7/exec"; // Ganti dengan URL Web App Anda

let dataSiswaGlobal = [];
let siswaTerpilih = null;
let html5QrScannerSiswa = null;

window.onload = async () => {
    try {
        const res = await fetch(`${API_URL}?target=data_siswa`);
        dataSiswaGlobal = await res.json();

        // Cek jika ada parameter otomatis via QR Mading (.../siswa/?nis=212201)
        const urlParams = new URLSearchParams(window.location.search);
        const nisDariQR = urlParams.get('nis');

        if (nisDariQR) {
            document.getElementById('nisInput').value = nisDariQR;
            prosesCariSiswa(nisDariQR);
        }
    } catch (err) {
        alert("Gagal memuat basis data siswa.");
    }
};

// Fungsi pencarian siswa berdasarkan NIS
function prosesCariSiswa(nis) {
    siswaTerpilih = dataSiswaGlobal.find(s => s.nis.trim() === nis.trim());
    
    if(siswaTerpilih) {
        document.getElementById('txtNama').innerText = siswaTerpilih.nama;
        document.getElementById('txtKelas').innerText = siswaTerpilih.kelas;
        document.getElementById('detailSiswa').classList.remove('hidden');
        
        // Jika scanner sedang jalan, matikan setelah berhasil mendeteksi
        matikanScanner();
    } else {
        alert("NIS Siswa tidak dikenali di sistem!");
        document.getElementById('detailSiswa').classList.add('hidden');
    }
}

// Handler Tombol Cari Manual
document.getElementById('btnCari').addEventListener('click', () => {
    const nis = document.getElementById('nisInput').value;
    prosesCariSiswa(nis);
});

// LOGIKA SAKELAR METODE (KETIK VS SCAN)
const btnModeKetik = document.getElementById('btnModeKetik');
const btnModeScan = document.getElementById('btnModeScan');
const zoneKetik = document.getElementById('zoneKetik');
const zoneScan = document.getElementById('zoneScan');

btnModeKetik.addEventListener('click', () => {
    btnModeKetik.classList.add('active');
    btnModeScan.classList.remove('active');
    zoneKetik.classList.remove('hidden');
    zoneScan.classList.add('hidden');
    matikanScanner();
});

btnModeScan.addEventListener('click', () => {
    btnModeScan.classList.add('active');
    btnModeKetik.classList.remove('active');
    zoneScan.classList.remove('hidden');
    zoneKetik.classList.add('hidden');
    nyalakanScanner();
});

// FUNGSI KONTROL KAMERA SCANNER
function nyalakanScanner() {
    if (!html5QrScannerSiswa) {
        html5QrScannerSiswa = new Html5QrcodeScanner(
            "reader-siswa", 
            { 
                fps: 15, 
                qrbox: (width, height) => {
                    return { width: width * 0.7, height: width * 0.7 }; // Kotak pindai proporsional di HP
                },
                aspectRatio: 1.0
            }, 
            false
        );
        
        html5QrScannerSiswa.render((decodedText) => {
            // decodedText berisi NIS hasil scan dari kamera HP siswa
            prosesCariSiswa(decodedText);
        }, (error) => {
            // Pemindaian gagal / mencari fokus (abaikan log agar bersih)
        });
    }
}

function matikanScanner() {
    if (html5QrScannerSiswa) {
        html5QrScannerSiswa.clear().then(() => {
            html5QrScannerSiswa = null;
        }).catch(err => console.error("Gagal mematikan kamera", err));
    }
}

// LOGIKA KIRIM DATA KE SPREADSHEET
document.getElementById('formAbsen').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!siswaTerpilih) return;

    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim Presensi...';
    btnSubmit.disabled = true;

    const payload = {
        nis: siswaTerpilih.nis,
        nama: siswaTerpilih.nama,
        kelas: siswaTerpilih.kelas,
        status: document.getElementById('statusAbsen').value,
        keterangan: document.getElementById('keterangan').value,
        metode: "Mandiri Berbasis QR"
    };

    try {
        const res = await fetch(`${API_URL}?target=absen`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if(result.status === "success") {
            alert(`Presensi ${siswaTerpilih.nama} berhasil masuk!`);
            window.location.href = window.location.pathname; // Segarkan halaman & reset
        }
    } catch (error) {
        alert("Gangguan jaringan, coba ulangi kirim.");
        btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim Presensi Masuk';
        btnSubmit.disabled = false;
    }
});
