// Taksonomi jenis denda "lain-lain" — src/perpustakaan/PerpustakaanDenda.java.
// `besar_denda` = PERSENTASE dari harga buku (bukan nominal Rupiah tetap),
// dipakai PerpustakaanBayarDendaService buat hitung denda tab "Lain-lain".
// Terpisah total dari `denda_perhari` (perpustakaan_set_peminjaman) yang
// dipakai utk denda keterlambatan. Tabel ASLI sik.sql `perpustakaan_denda`
// — field cocok 1:1.
import DatabaseService from '../../DatabaseService.js'

const SORTABLE = { kode_denda: 'kode_denda', jenis_denda: 'jenis_denda' }

async function list({ page = 1, pageSize = 10, sortBy = 'kode_denda', sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const col = SORTABLE[sortBy] || 'kode_denda'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT kode_denda, jenis_denda, besar_denda FROM perpustakaan_denda
         WHERE kode_denda LIKE ? OR jenis_denda LIKE ?
         ORDER BY ${col} ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT COUNT(*) AS count FROM perpustakaan_denda WHERE kode_denda LIKE ? OR jenis_denda LIKE ?',
        [like, like]
    )
    return { data: rows, total: count }
}

async function nextKode() {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT COUNT(*) AS n FROM perpustakaan_denda')
    return 'JD' + String(rows[0].n + 1).padStart(3, '0')
}

function validate({ kode_denda, jenis_denda, besar_denda }) {
    if (!kode_denda?.trim()) return 'Kode tidak boleh kosong'
    if (!jenis_denda?.trim()) return 'Nama tidak boleh kosong'
    if (besar_denda === undefined || besar_denda === null || String(besar_denda).trim() === '') return 'Besar Denda tidak boleh kosong'
    return null
}

async function create(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO perpustakaan_denda (kode_denda, jenis_denda, besar_denda) VALUES (?, ?, ?)',
            [data.kode_denda, data.jenis_denda, data.besar_denda]
        )
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${data.kode_denda}" sudah dipakai` }
        throw e
    }
}

async function update(oldKode, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(
            'UPDATE perpustakaan_denda SET kode_denda=?, jenis_denda=?, besar_denda=? WHERE kode_denda=?',
            [data.kode_denda, data.jenis_denda, data.besar_denda, oldKode]
        )
        if (rows.affectedRows === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${data.kode_denda}" sudah dipakai` }
        throw e
    }
}

async function deleteOne(kode) {
    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query('DELETE FROM perpustakaan_denda WHERE kode_denda=?', [kode])
        return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Tidak bisa dihapus — masih dipakai di riwayat Bayar Denda' }
        }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
