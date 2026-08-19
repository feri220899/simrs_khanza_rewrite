// CRUD Inventaris (eksemplar fisik per judul buku) — src/perpustakaan/PerpustakaanInventaris.java.
// 1 baris perpustakaan_buku (katalog/judul) bisa punya banyak baris di sini
// (tiap eksemplar fisik). `status_buku` = state fisik eksemplar saat ini
// (Ada/Rusak/Hilang/Dipinjam/-) — DIUBAH OTOMATIS oleh PerpustakaanSirkulasiService
// saat pinjam/kembali, bukan diedit manual dari sini. Tabel ASLI sik.sql
// `perpustakaan_inventaris` — field cocok 1:1. Fitur cetak barcode
// (rptBarcodePerpustakaan.jasper) TIDAK diimplementasi.
import DatabaseService from '../../DatabaseService.js'

const SORTABLE = { no_inventaris: 'i.no_inventaris', kode_buku: 'i.kode_buku', harga: 'i.harga', status_buku: 'i.status_buku' }

async function list({ page = 1, pageSize = 10, sortBy = 'no_inventaris', sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const col = SORTABLE[sortBy] || 'i.no_inventaris'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT i.no_inventaris, i.kode_buku, b.judul_buku, i.asal_buku, i.tgl_pengadaan, i.harga,
                i.status_buku, i.kd_ruang, r.nm_ruang, i.no_rak, i.no_box
         FROM perpustakaan_inventaris i
         LEFT JOIN perpustakaan_buku b  ON b.kode_buku = i.kode_buku
         LEFT JOIN perpustakaan_ruang r ON r.kd_ruang  = i.kd_ruang
         WHERE i.no_inventaris LIKE ? OR b.judul_buku LIKE ?
         ORDER BY ${col} ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM perpustakaan_inventaris i
         LEFT JOIN perpustakaan_buku b ON b.kode_buku = i.kode_buku
         WHERE i.no_inventaris LIKE ? OR b.judul_buku LIKE ?`,
        [like, like]
    )
    return { data: rows, total: count }
}

// Replika LCount Java: "<jumlah record> | <total nilai inventaris (Rp)>"
async function summary() {
    const db = await DatabaseService.get()
    const { rows: [row] } = await db.query(
        'SELECT COUNT(*) AS jumlah, COALESCE(SUM(harga),0) AS nilai_total FROM perpustakaan_inventaris'
    )
    return row
}

async function nextKode() {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(RIGHT(no_inventaris, 8), '[^0-9]', ''), '') AS UNSIGNED)), 0) AS mx
         FROM perpustakaan_inventaris`
    )
    // mysql2 balikin CAST(...AS UNSIGNED) sebagai STRING — WAJIB Number().
    return 'IP' + String(Number(mx) + 1).padStart(6, '0')
}

function validate({ no_inventaris, kode_buku, harga, kd_ruang }) {
    if (!no_inventaris?.trim()) return 'No. Inventaris tidak boleh kosong'
    if (!kode_buku?.trim()) return 'Judul (Koleksi) tidak boleh kosong'
    if (harga === undefined || harga === null || String(harga).trim() === '' || Number(harga) === 0) return 'Harga tidak boleh kosong'
    if (!kd_ruang?.trim()) return 'Ruang tidak boleh kosong'
    return null
}

async function create(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(
            `INSERT INTO perpustakaan_inventaris
                (no_inventaris, kode_buku, asal_buku, tgl_pengadaan, harga, status_buku, kd_ruang, no_rak, no_box)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.no_inventaris, data.kode_buku, data.asal_buku || '-', data.tgl_pengadaan || null,
             data.harga, data.status_buku || 'Ada', data.kd_ruang, data.no_rak || null, data.no_box || null]
        )
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `No. Inventaris "${data.no_inventaris}" sudah dipakai` }
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Koleksi/Ruang yang dipilih tidak valid' }
        }
        throw e
    }
}

async function update(oldNoInventaris, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(
            `UPDATE perpustakaan_inventaris
             SET no_inventaris=?, kode_buku=?, asal_buku=?, tgl_pengadaan=?, harga=?,
                 status_buku=?, kd_ruang=?, no_rak=?, no_box=?
             WHERE no_inventaris=?`,
            [data.no_inventaris, data.kode_buku, data.asal_buku || '-', data.tgl_pengadaan || null,
             data.harga, data.status_buku || 'Ada', data.kd_ruang, data.no_rak || null, data.no_box || null, oldNoInventaris]
        )
        if (rows.affectedRows === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `No. Inventaris "${data.no_inventaris}" sudah dipakai` }
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Koleksi/Ruang yang dipilih tidak valid' }
        }
        throw e
    }
}

async function deleteOne(noInventaris) {
    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query('DELETE FROM perpustakaan_inventaris WHERE no_inventaris=?', [noInventaris])
        return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Tidak bisa dihapus — masih ada riwayat pinjam/denda' }
        }
        throw e
    }
}

export default { list, summary, nextKode, create, update, deleteOne }
