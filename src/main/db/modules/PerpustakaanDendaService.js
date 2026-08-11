// Taksonomi jenis denda "lain-lain" — src/perpustakaan/PerpustakaanDenda.java.
// `besar_denda` = PERSENTASE dari harga buku (bukan nominal Rupiah tetap),
// dipakai PerpustakaanBayarDendaService buat hitung denda tab "Lain-lain".
// Terpisah total dari `denda_perhari` (perpustakaan_set_peminjaman) yang
// dipakai utk denda keterlambatan.
import DatabaseService from '../DatabaseService.js'

const SORTABLE = { kode_denda: 'kode_denda', jenis_denda: 'jenis_denda' }

async function list({ page = 1, pageSize = 10, sortBy = 'kode_denda', sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const col = SORTABLE[sortBy] || 'kode_denda'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT kode_denda, jenis_denda, besar_denda FROM perpustakaan_denda
         WHERE kode_denda ILIKE $1 OR jenis_denda ILIKE $1
         ORDER BY ${col} ${dir}
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT count(*)::int AS count FROM perpustakaan_denda WHERE kode_denda ILIKE $1 OR jenis_denda ILIKE $1',
        [like]
    )
    return { data: rows, total: count }
}

async function nextKode() {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT count(*)::int AS n FROM perpustakaan_denda')
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
            'INSERT INTO perpustakaan_denda (kode_denda, jenis_denda, besar_denda) VALUES ($1,$2,$3)',
            [data.kode_denda, data.jenis_denda, data.besar_denda]
        )
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kode_denda}" sudah dipakai` }
        throw e
    }
}

async function update(oldKode, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query(
            'UPDATE perpustakaan_denda SET kode_denda=$1, jenis_denda=$2, besar_denda=$3 WHERE kode_denda=$4',
            [data.kode_denda, data.jenis_denda, data.besar_denda, oldKode]
        )
        if (rowCount === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kode_denda}" sudah dipakai` }
        throw e
    }
}

async function deleteOne(kode) {
    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query('DELETE FROM perpustakaan_denda WHERE kode_denda=$1', [kode])
        return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === '23503') return { success: false, message: 'Tidak bisa dihapus — masih dipakai di riwayat Bayar Denda' }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
