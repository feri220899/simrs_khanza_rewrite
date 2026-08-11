// CRUD Koleksi (katalog buku) — src/perpustakaan/PerpustakaanKoleksi.java.
// FK ke 4 tabel taksonomi (penerbit/pengarang/kategori/jenis) — Java asli
// nge-join semuanya sekaligus di query tampil, kita replikasi persis.
// Fitur cetak (rptKoleksiPerpustakaan.jasper) TIDAK diimplementasi.
import DatabaseService from '../DatabaseService.js'

const SORTABLE = { kode_buku: 'b.kode_buku', judul_buku: 'b.judul_buku', thn_terbit: 'b.thn_terbit' }

async function list({ page = 1, pageSize = 10, sortBy = 'kode_buku', sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const col = SORTABLE[sortBy] || 'b.kode_buku'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT b.kode_buku, b.judul_buku, b.jml_halaman, b.isbn, b.thn_terbit,
                b.kode_penerbit, p.nama_penerbit,
                b.kode_pengarang, pg.nama_pengarang,
                b.id_kategori, k.nama_kategori,
                b.id_jenis, j.nama_jenis
         FROM perpustakaan_buku b
         LEFT JOIN perpustakaan_penerbit p  ON p.kode_penerbit  = b.kode_penerbit
         LEFT JOIN perpustakaan_pengarang pg ON pg.kode_pengarang = b.kode_pengarang
         LEFT JOIN perpustakaan_kategori k  ON k.id_kategori    = b.id_kategori
         LEFT JOIN perpustakaan_jenis_buku j ON j.id_jenis      = b.id_jenis
         WHERE b.kode_buku ILIKE $1 OR b.judul_buku ILIKE $1 OR b.isbn ILIKE $1
         ORDER BY ${col} ${dir}
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT count(*)::int AS count FROM perpustakaan_buku
         WHERE kode_buku ILIKE $1 OR judul_buku ILIKE $1 OR isbn ILIKE $1`,
        [like]
    )
    return { data: rows, total: count }
}

// Replika literal: MAX(RIGHT(kode_buku,8)::int), prefix "KP", total 8 karakter.
async function nextKode() {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(RIGHT(kode_buku, 8), '\\D', '', 'g'), '')::int), 0) AS mx
         FROM perpustakaan_buku`
    )
    return 'KP' + String(mx + 1).padStart(6, '0')
}

// Urutan validasi SAMA seperti Java asli — Jenis dicek SEBELUM Kategori
// (kuirk asli, bukan salah ketik) meski di form Kategori tampil lebih dulu.
function validate({ kode_buku, judul_buku, jml_halaman, kode_penerbit, kode_pengarang, id_jenis, id_kategori }) {
    if (!kode_buku?.trim()) return 'Kode Koleksi tidak boleh kosong'
    if (!judul_buku?.trim()) return 'Judul tidak boleh kosong'
    if (jml_halaman === undefined || jml_halaman === null || String(jml_halaman).trim() === '') return 'Jml. Halaman tidak boleh kosong'
    if (!kode_penerbit?.trim()) return 'Penerbit tidak boleh kosong'
    if (!kode_pengarang?.trim()) return 'Pengarang tidak boleh kosong'
    if (!id_jenis?.trim()) return 'Jenis tidak boleh kosong'
    if (!id_kategori?.trim()) return 'Kategori tidak boleh kosong'
    return null
}

async function create(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(
            `INSERT INTO perpustakaan_buku
                (kode_buku, judul_buku, jml_halaman, kode_penerbit, kode_pengarang, thn_terbit, isbn, id_kategori, id_jenis)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [data.kode_buku, data.judul_buku, data.jml_halaman, data.kode_penerbit, data.kode_pengarang,
             data.thn_terbit || null, data.isbn || null, data.id_kategori, data.id_jenis]
        )
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kode_buku}" sudah dipakai` }
        if (e.code === '23503') return { success: false, message: 'Penerbit/Pengarang/Kategori/Jenis yang dipilih tidak valid' }
        throw e
    }
}

async function update(oldKode, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query(
            `UPDATE perpustakaan_buku
             SET kode_buku=$1, judul_buku=$2, jml_halaman=$3, kode_penerbit=$4, kode_pengarang=$5,
                 thn_terbit=$6, isbn=$7, id_kategori=$8, id_jenis=$9
             WHERE kode_buku=$10`,
            [data.kode_buku, data.judul_buku, data.jml_halaman, data.kode_penerbit, data.kode_pengarang,
             data.thn_terbit || null, data.isbn || null, data.id_kategori, data.id_jenis, oldKode]
        )
        if (rowCount === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kode_buku}" sudah dipakai` }
        if (e.code === '23503') return { success: false, message: 'Penerbit/Pengarang/Kategori/Jenis yang dipilih tidak valid' }
        throw e
    }
}

async function deleteOne(kode) {
    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query('DELETE FROM perpustakaan_buku WHERE kode_buku=$1', [kode])
        return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === '23503') return { success: false, message: 'Tidak bisa dihapus — masih ada eksemplar di data Inventaris' }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
