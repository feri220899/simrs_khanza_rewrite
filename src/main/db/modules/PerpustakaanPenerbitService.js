// CRUD Penerbit — src/perpustakaan/PerpustakaanPenerbit.java. Beda dari 4
// taksonomi lain (PerpustakaanTaksonomiService.js): 6 kolom (bukan 2) dan
// auto-kode pakai query MAX() aktual (bukan row-count) — direplikasi persis
// dari `Valid.autoNomer3("... MAX(CONVERT(RIGHT(kode_penerbit,4),signed)) ...","PK",8,TKd)`.
// Fitur cetak (rptPenerbitPerpustakaan.jasper) TIDAK diimplementasi — belum
// ada subsistem cetak di khanza-desktop.
import DatabaseService from '../DatabaseService.js'

const SORTABLE = { kode_penerbit: 'kode_penerbit', nama_penerbit: 'nama_penerbit' }

async function list({ page = 1, pageSize = 10, sortBy = 'kode_penerbit', sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const col = SORTABLE[sortBy] || 'kode_penerbit'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT kode_penerbit, nama_penerbit, alamat_penerbit, no_telp, email, website_penerbit
         FROM perpustakaan_penerbit
         WHERE kode_penerbit ILIKE $1 OR nama_penerbit ILIKE $1
         ORDER BY ${col} ${dir}
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT count(*)::int AS count FROM perpustakaan_penerbit WHERE kode_penerbit ILIKE $1 OR nama_penerbit ILIKE $1',
        [like]
    )
    return { data: rows, total: count }
}

// Replika literal: MAX(RIGHT(kode_penerbit,4)::int), prefix "PK", total panjang
// 8 karakter (2 prefix + 6 digit).
async function nextKode() {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(RIGHT(kode_penerbit, 4), '\\D', '', 'g'), '')::int), 0) AS mx
         FROM perpustakaan_penerbit`
    )
    return 'PK' + String(mx + 1).padStart(6, '0')
}

function validate({ kode_penerbit, nama_penerbit }) {
    // Urutan SAMA seperti Java asli: Kode -> Nama. Alamat/telp/email/web
    // TIDAK wajib (sesuai investigasi, memang tidak divalidasi di sana).
    if (!kode_penerbit?.trim()) return 'Kode Penerbit tidak boleh kosong'
    if (!nama_penerbit?.trim()) return 'Nama Penerbit tidak boleh kosong'
    return null
}

async function create(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(
            `INSERT INTO perpustakaan_penerbit (kode_penerbit, nama_penerbit, alamat_penerbit, no_telp, email, website_penerbit)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [data.kode_penerbit, data.nama_penerbit, data.alamat_penerbit || null, data.no_telp || null, data.email || null, data.website_penerbit || null]
        )
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kode_penerbit}" sudah dipakai` }
        throw e
    }
}

async function update(oldKode, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query(
            `UPDATE perpustakaan_penerbit
             SET kode_penerbit=$1, nama_penerbit=$2, alamat_penerbit=$3, no_telp=$4, email=$5, website_penerbit=$6
             WHERE kode_penerbit=$7`,
            [data.kode_penerbit, data.nama_penerbit, data.alamat_penerbit || null, data.no_telp || null, data.email || null, data.website_penerbit || null, oldKode]
        )
        if (rowCount === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kode_penerbit}" sudah dipakai` }
        throw e
    }
}

async function deleteOne(kode) {
    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query('DELETE FROM perpustakaan_penerbit WHERE kode_penerbit=$1', [kode])
        return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === '23503') return { success: false, message: 'Tidak bisa dihapus — masih dipakai di data Koleksi' }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
