// Pengaturan Peminjaman (single-row config) — src/perpustakaan/PerpustakaanPengaturanPeminjaman.java.
// Java asli enforce "cuma 1 baris" di level APLIKASI (BtnSimpan tolak kalau
// row count > 0, BtnEdit = DELETE ALL lalu INSERT baru, BtnHapus = DELETE
// ALL) — di sini disederhanakan jadi UPSERT ke id=1 (migration 021: PK id
// SMALLINT + CHECK id=1), hasil akhirnya SAMA (selalu 0 atau 1 baris),
// implementasinya lebih aman (UPDATE biasa, bukan delete+insert).
//
// DEVIASI SENGAJA dari Java asli: file Java ini TIDAK PUNYA pengecekan
// `akses`/`isCek()` sama sekali (oversight di kode asli — lihat Khanza.md).
// Permission `set_peminjaman_perpustakaan` MEMANG ADA di sik.sql, jadi di
// sini kita GATE tulisnya (lebih aman) — bukan replikasi bug.
import DatabaseService from '../DatabaseService.js'

async function get() {
    const db = await DatabaseService.get()
    const { rows: [row] } = await db.query('SELECT max_pinjam, lama_pinjam, denda_perhari FROM perpustakaan_set_peminjaman WHERE id=1')
    return row || null
}

function validate({ max_pinjam, lama_pinjam, denda_perhari }) {
    if (!max_pinjam || Number(max_pinjam) === 0) return 'Maksimal Buku tidak boleh kosong'
    if (!lama_pinjam || Number(lama_pinjam) === 0) return 'Maksimal Lama Peminjaman tidak boleh kosong'
    if (denda_perhari === undefined || denda_perhari === null || Number(denda_perhari) === 0) return 'Denda per hari tidak boleh kosong'
    return null
}

async function upsert(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    await db.query(
        `INSERT INTO perpustakaan_set_peminjaman (id, max_pinjam, lama_pinjam, denda_perhari)
         VALUES (1, $1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET max_pinjam=$1, lama_pinjam=$2, denda_perhari=$3`,
        [data.max_pinjam, data.lama_pinjam, data.denda_perhari]
    )
    return { success: true }
}

async function deleteSetting() {
    const db = await DatabaseService.get()
    await db.query('DELETE FROM perpustakaan_set_peminjaman WHERE id=1')
    return { success: true }
}

export default { get, upsert, deleteSetting }
