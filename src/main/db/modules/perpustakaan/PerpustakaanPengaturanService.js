// Pengaturan Peminjaman (single-row config) — src/perpustakaan/PerpustakaanPengaturanPeminjaman.java.
// Tabel ASLI sik.sql `perpustakaan_set_peminjaman` TANPA kolom `id`/PK/UNIQUE
// sama sekali (bukan `id SMALLINT PK` seperti migration Postgres 021 yang
// sudah dibuang) — MySQL `ON DUPLICATE KEY UPDATE` butuh unique key buat
// deteksi konflik, jadi TIDAK BISA dipakai di sini. Kembali ke pola Java asli
// yang sesungguhnya: BtnEdit = DELETE ALL lalu INSERT baru (bukan UPSERT
// id=1), BtnHapus = DELETE ALL. Hasil akhirnya sama (selalu 0 atau 1 baris),
// "cuma 1 baris" itu memang ditegakkan di level APLIKASI, bukan constraint DB.
//
// DEVIASI SENGAJA dari Java asli: file Java ini TIDAK PUNYA pengecekan
// `akses`/`isCek()` sama sekali (oversight di kode asli — lihat Khanza.md).
// Permission `set_peminjaman_perpustakaan` MEMANG ADA di sik.sql, jadi di
// sini kita GATE tulisnya (lebih aman) — bukan replikasi bug.
import DatabaseService from '../../DatabaseService.js'

async function get() {
    const db = await DatabaseService.get()
    const { rows: [row] } = await db.query('SELECT max_pinjam, lama_pinjam, denda_perhari FROM perpustakaan_set_peminjaman LIMIT 1')
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
    const client = await db.connect()
    try {
        await client.query('START TRANSACTION')
        await client.query('DELETE FROM perpustakaan_set_peminjaman')
        await client.query(
            'INSERT INTO perpustakaan_set_peminjaman (max_pinjam, lama_pinjam, denda_perhari) VALUES (?, ?, ?)',
            [data.max_pinjam, data.lama_pinjam, data.denda_perhari]
        )
        await client.query('COMMIT')
        return { success: true }
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
}

async function deleteSetting() {
    const db = await DatabaseService.get()
    await db.query('DELETE FROM perpustakaan_set_peminjaman')
    return { success: true }
}

export default { get, upsert, deleteSetting }
