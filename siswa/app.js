// ISI DENGAN URL DEPLOY WEB APP GOOGLE APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbzQ1-YvNByd9a0AJ_bCjNq2EZbiGQyWI7zdx8iuhN2c85VilvMFjCytgg3CpjYC9EL7/exec"; 

let dataSiswaGlobal = [];
let siswaTerpilih = null;
let html5QrScannerSiswa = null;

window.onload = async () => {
    try {
        const res = await fetch(`${API_URL}?target=data_siswa`);
        dataSiswaGlobal = await res.json();

        // Otomatisasi URL parameter (Skenario Siswa Scan QR Mading)
        const urlParams = new URLSearchParams(window.location.search);
        const nisDariQR = urlParams.get('nis');

        if (nisDariQR) {
            document.getElementById('nisInput').value = nisDariQR;
            prosesCariSiswa(nisDariQR);
        }
    } catch (err) {
        alert("Gagal sinkronisasi data siswa dari Google Sheets.");
    }
};

function prosesCariSiswa(nis) {
    siswaTerpilih = dataSiswaGlobal.find(s => s.nis.trim() === nis.trim());
    
    if(siswaTerpilih) {
        document.getElementById('txtNama').innerText = siswaTerpilih.nama;
        document.getElementById('txtKelas').innerText = siswaTerpilih.kelas;
        document.getElementById('detailSiswa').classList.remove('hidden');
        matikanScanner();
    } else {
        alert("NIS tidak terdaftar!");
        document.getElementById('detailSiswa').classList.add('hidden');
    }
}

document.getElementById('btnCari').addEventListener('click', () => {
    const nis = document.getElementById('nisInput').value;
    prosesCariSiswa(nis);
});

// Kontrol Sakelar Tab Mode
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

function nyalakanScanner() {
    if (!html5QrScannerSiswa) {
        html5QrScannerSiswa = new Html5QrcodeScanner(
            "reader-siswa", 
            { 
                fps: 15, 
                qrbox: (w, h) => ({ width: w * 0.7, height: w * 0.7 }), 
                aspectRatio: 1.0,
                // MEMAKSA MENGGUNAKAN KAMERA BELAKANG HP:
                videoConstraints: {
                    facingMode: "environment"
                }
            }, 
            false
        );
        html5QrScannerSiswa.render((text) => {
            prosesCariSiswa(text);
        }, (err) => {});
    }
}

function matikanScanner() {
    if (html5QrScannerSiswa) {
        html5QrScannerSiswa.clear().then(() => { html5QrScannerSiswa = null; }).catch(e => {});
    }
}

// Submit Data Kehadiran
document.getElementById('formAbsen').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!siswaTerpilih) return;

    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses Presensi...';
    btnSubmit.disabled = true;

    const payload = {
        nis: siswaTerpilih.nis,
        nama: siswaTerpilih.nama,
        kelas: siswaTerpilih.kelas,
        status: document.getElementById('statusAbsen').value,
        keterangan: document.getElementById('keterangan').value,
        metode: "Mandiri (QR/Ketik)"
    };

    try {
        const res = await fetch(`${API_URL}?target=absen`, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        if(result.status === "success") {
            alert(`Presensi ${siswaTerpilih.nama} berhasil dikirim!`);
            window.location.href = window.location.pathname; // refresh & reset form
        }
    } catch (error) {
        alert("Koneksi gagal, silakan kirim ulang.");
        btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim Presensi Masuk';
        btnSubmit.disabled = false;
    }
});
