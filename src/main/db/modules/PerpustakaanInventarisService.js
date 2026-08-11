// CRUD Inventaris (eksemplar fisik per judul buku) — src/perpustakaan/PerpustakaanInventaris.java.
// 1 baris perpustakaan_buku (katalog/judul) bisa punya banyak baris di sini
// (tiap eksemplar fisik). `status_buku` = state fisik eksemplar saat ini
// (Ada/Rusak/Hilang/Dipinjam/-) — DIUBAH OTOMATIS oleh PerpustakaanSirkulasiService
// saat pinjam/kembali, bukan diedit manual dari sini. Fitur cetak barcode
// (rptBarcodePerpustakaan.jasper) TIDAK diimplementasi.
import DatabaseService from '../DatabaseService.js'

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
         WHERE i.no_inventaris ILIKE $1 OR b.judul_buku ILIKE $1
         ORDER BY ${col} ${dir}
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT count(*)::int AS count FROM perpustakaan_inventaris i
         LEFT JOIN perpustakaan_buku b ON b.kode_buku = i.kode_buku
         WHERE i.no_inventaris ILIKE $1 OR b.judul_buku ILIKE $1`,
        [like]
    )
    return { data: rows, total: count }
}

// Replika LCount Java: "<jumlah record> | <total nilai inventaris (Rp)>"
async function summary() {
    const db = await DatabaseService.get()
    const { rows: [row] } = await db.query(
        'SELECT count(*)::int AS jumlah, COALESCE(SUM(harga),0)::numeric AS nilai_total FROM perpustakaan_inventaris'
    )
    return row
}

async function nextKode() {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(RIGHT(no_inventaris, 8), '\\D', '', 'g'), '')::int), 0) AS mx
         FROM perpustakaan_inventaris`
    )
    return 'IP' + String(mx + 1).padStart(6, '0')
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
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [data.no_inventaris, data.kode_buku, data.asal_buku || '-', data.tgl_pengadaan || null,
             data.harga, data.status_buku || 'Ada', data.kd_ruang, data.no_rak || null, data.no_box || null]
        )
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `No. Inventaris "${data.no_inventaris}" sudah dipakai` }
        if (e.code === '23503') return { success: false, message: 'Koleksi/Ruang yang dipilih tidak valid' }
        throw e
    }
}

async function update(oldNoInventaris, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query(
            `UPDATE perpustakaan_inventaris
             SET no_inventaris=$1, kode_buku=$2, asal_buku=$3, tgl_pengadaan=$4, harga=$5,
                 status_buku=$6, kd_ruang=$7, no_rak=$8, no_box=$9
             WHERE no_inventaris=$10`,
            [data.no_inventaris, data.kode_buku, data.asal_buku || '-', data.tgl_pengadaan || null,
             data.harga, data.status_buku || 'Ada', data.kd_ruang, data.no_rak || null, data.no_box || null, oldNoInventaris]
        )
        if (rowCount === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `No. Inventaris "${data.no_inventaris}" sudah dipakai` }
        if (e.code === '23503') return { success: false, message: 'Koleksi/Ruang yang dipilih tidak valid' }
        throw e
    }
}

async function deleteOne(noInventaris) {
    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query('DELETE FROM perpustakaan_inventaris WHERE no_inventaris=$1', [noInventaris])
        return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === '23503') return { success: false, message: 'Tidak bisa dihapus — masih ada riwayat pinjam/denda' }
        throw e
    }
}

export default { list, summary, nextKode, create, update, deleteOne }
