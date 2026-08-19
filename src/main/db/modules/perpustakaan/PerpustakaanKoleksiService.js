// CRUD Koleksi (katalog buku) — src/perpustakaan/PerpustakaanKoleksi.java.
// FK ke 4 tabel taksonomi (penerbit/pengarang/kategori/jenis) — Java asli
// nge-join semuanya sekaligus di query tampil, kita replikasi persis. Tabel
// ASLI sik.sql `perpustakaan_buku` — field cocok 1:1 (termasuk `jml_halaman`
// yang char(5), BUKAN integer — disimpan apa adanya sebagai string).
// Fitur cetak (rptKoleksiPerpustakaan.jasper) TIDAK diimplementasi.
import DatabaseService from '../../DatabaseService.js'

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
         WHERE b.kode_buku LIKE ? OR b.judul_buku LIKE ? OR b.isbn LIKE ?
         ORDER BY ${col} ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM perpustakaan_buku
         WHERE kode_buku LIKE ? OR judul_buku LIKE ? OR isbn LIKE ?`,
        [like, like, like]
    )
    return { data: rows, total: count }
}

// Replika literal: MAX(RIGHT(kode_buku,8)::int), prefix "KP", total 8 karakter.
async function nextKode() {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(RIGHT(kode_buku, 8), '[^0-9]', ''), '') AS UNSIGNED)), 0) AS mx
         FROM perpustakaan_buku`
    )
    // mysql2 balikin CAST(...AS UNSIGNED) sebagai STRING — WAJIB Number().
    return 'KP' + String(Number(mx) + 1).padStart(6, '0')
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
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.kode_buku, data.judul_buku, data.jml_halaman, data.kode_penerbit, data.kode_pengarang,
             data.thn_terbit || null, data.isbn || null, data.id_kategori, data.id_jenis]
        )
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${data.kode_buku}" sudah dipakai` }
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Penerbit/Pengarang/Kategori/Jenis yang dipilih tidak valid' }
        }
        throw e
    }
}

async function update(oldKode, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(
            `UPDATE perpustakaan_buku
             SET kode_buku=?, judul_buku=?, jml_halaman=?, kode_penerbit=?, kode_pengarang=?,
                 thn_terbit=?, isbn=?, id_kategori=?, id_jenis=?
             WHERE kode_buku=?`,
            [data.kode_buku, data.judul_buku, data.jml_halaman, data.kode_penerbit, data.kode_pengarang,
             data.thn_terbit || null, data.isbn || null, data.id_kategori, data.id_jenis, oldKode]
        )
        if (rows.affectedRows === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${data.kode_buku}" sudah dipakai` }
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Penerbit/Pengarang/Kategori/Jenis yang dipilih tidak valid' }
        }
        throw e
    }
}

async function deleteOne(kode) {
    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query('DELETE FROM perpustakaan_buku WHERE kode_buku=?', [kode])
        return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Tidak bisa dihapus — masih ada eksemplar di data Inventaris' }
        }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
