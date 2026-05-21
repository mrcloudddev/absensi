// GANTI DENGAN URL DEPLOY GOOGLE APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbx1qP2sxfhksk6lKzAc_jNnRbw22re2fvLl2qqSfKYWYcrPGd8NBTX2vmuQjx0yg3IM/exec"; 

let dataSiswaGlobal = [];
let siswaTerpilih = null;

window.onload = async () => {
    try {
        // 1. Ambil data master siswa dari Google Sheets API
        const res = await fetch(`${API_URL}?target=data_siswa`);
        dataSiswaGlobal = await res.json();

        // 2. Cek Parameter URL (Skenario Scan QR Mading Kelas)
        // Format link QR: https://username.github.io/repo/siswa/?nis=212201
        const urlParams = new URLSearchParams(window.location.search);
        const nisDariQR = urlParams.get('nis');

        if (nisDariQR) {
            document.getElementById('nisInput').value = nisDariQR;
            prosesCariSiswa(nisDariQR);
        }
    } catch (err) {
        alert("Gagal memuat data siswa. Pastikan URL API Web App sudah benar.");
    }
};

function prosesCariSiswa(nis) {
    siswaTerpilih = dataSiswaGlobal.find(s => s.nis.trim() === nis.trim());
    
    if(siswaTerpilih) {
        document.getElementById('txtNama').innerText = siswaTerpilih.nama;
        document.getElementById('txtKelas').innerText = siswaTerpilih.kelas;
        document.getElementById('detailSiswa').classList.remove('hidden');
    } else {
        alert("NIS Siswa tidak ditemukan dalam sistem database!");
        document.getElementById('detailSiswa').classList.add('hidden');
    }
}

document.getElementById('btnCari').addEventListener('click', () => {
    const nis = document.getElementById('nisInput').value;
    prosesCariSiswa(nis);
});

document.getElementById('formAbsen').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!siswaTerpilih) return;

    // Kunci tombol kirim agar tidak terjadi double submit
    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.innerText = "Mengirim...";
    btnSubmit.disabled = true;

    const payload = {
        nis: siswaTerpilih.nis,
        nama: siswaTerpilih.nama,
        kelas: siswaTerpilih.kelas,
        status: document.getElementById('statusAbsen').value,
        keterangan: document.getElementById('keterangan').value,
        metode: "Mandiri (Siswa)"
    };

    try {
        const res = await fetch(`${API_URL}?target=absen`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if(result.status === "success") {
            alert("Presensi Anda berhasil disimpan!");
            window.location.href = window.location.pathname; // Clear URL parameters & Reset form
        }
    } catch (error) {
        alert("Terjadi kesalahan jaringan saat mengirim data absensi.");
        btnSubmit.innerText = "Kirim Kehadiran";
        btnSubmit.disabled = false;
    }
});