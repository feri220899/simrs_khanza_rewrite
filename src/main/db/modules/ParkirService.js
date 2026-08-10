// Contoh service Fase 1 — polanya: 1 file per modul, query langsung ke
// Postgres, di-expose lewat IPC handler di main/index.js. Ini menggantikan
// peran ParkirController+Model di arsitektur Express referensi.
//
// Sebelum menambah aksi baru (input kendaraan masuk, dst), WAJIB baca dulu
// src/parkir/DlgParkirMasuk.java yang asli (lihat SOP di Khanza.md) —
// catatan penting: layar itu TIDAK menyimpan transaksi apa pun ke DB, cuma
// lookup tarif lalu cetak karcis. Jangan tambah tabel transaksi tanpa
// didiskusikan dulu sebagai fitur baru.
import DatabaseService from '../DatabaseService.js'

async function listJenis() {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT kd_parkir, jns_parkir, biaya, jenis FROM parkir_jenis ORDER BY kd_parkir')
    return rows
}

async function cekBarcode(kodeBarcode) {
    const db = await DatabaseService.get()
    const { rows: [row] } = await db.query(
        'SELECT nomer_kartu FROM parkir_barcode WHERE kode_barcode = $1',
        [kodeBarcode]
    )
    return row || null
}

export default { listJenis, cekBarcode }
