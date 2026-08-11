<template>
    <div>
        <h1 class="text-xl font-bold mb-1">Parkir — Masuk / Keluar</h1>
        <div class="alert mt-3">
            <span class="text-sm">
                <strong>Temuan SOP:</strong> <code>DlgParkirMasuk.java</code> asli TIDAK menyimpan transaksi
                apa pun ke database — cuma lookup tarif dari "Jenis & Tarif" lalu cetak karcis fisik.
                Tidak ada tabel log masuk/keluar di Khanza asli, jadi tidak ada CRUD untuk halaman ini.
                Kalau RS butuh fitur pencatatan histori masuk/keluar, itu FITUR BARU di luar cakupan
                rewrite 1:1 — perlu didiskusikan dulu sebelum dibangun.
            </span>
        </div>
    </div>
</template>
