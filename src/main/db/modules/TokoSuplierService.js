// CRUD Suplier Toko — src/toko/TokoSuplier.java.
import DatabaseService from '../DatabaseService.js'

const SORTABLE = { kode_suplier: 'kode_suplier', nama_suplier: 'nama_suplier' }

async function list({ page = 1, pageSize = 10, sortBy = 'kode_suplier', sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const col = SORTABLE[sortBy] || 'kode_suplier'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT kode_suplier, nama_suplier, alamat, kota, no_telp, nama_bank, rekening
         FROM tokosuplier
         WHERE kode_suplier ILIKE $1 OR nama_suplier ILIKE $1
         ORDER BY ${col} ${dir}
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT count(*)::int AS count FROM tokosuplier WHERE kode_suplier ILIKE $1 OR nama_suplier ILIKE $1',
        [like]
    )
    return { data: rows, total: count }
}

// Replika Valid.autoNomer("tokosuplier","S",4,Kd) — row-count based.
async function nextKode() {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT count(*)::int AS n FROM tokosuplier')
    return 'S' + String(rows[0].n + 1).padStart(4, '0')
}

// Urutan validasi SAMA Java asli: Kd -> Nm -> Alamat -> Telp -> Kota -> Bank -> NoRek.
function validate({ kode_suplier, nama_suplier, alamat, no_telp, kota, nama_bank, rekening }) {
    if (!kode_suplier?.trim()) return 'Kode Suplier tidak boleh kosong'
    if (!nama_suplier?.trim()) return 'Nama Suplier tidak boleh kosong'
    if (!alamat?.trim()) return 'Alamat tidak boleh kosong'
    if (!no_telp?.trim()) return 'No. Telp tidak boleh kosong'
    if (!kota?.trim()) return 'Kota tidak boleh kosong'
    if (!nama_bank?.trim()) return 'Nama Bank tidak boleh kosong'
    if (!rekening?.trim()) return 'No. Rekening tidak boleh kosong'
    return null
}

async function create(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(
            `INSERT INTO tokosuplier (kode_suplier, nama_suplier, alamat, kota, no_telp, nama_bank, rekening)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [data.kode_suplier, data.nama_suplier, data.alamat, data.kota, data.no_telp, data.nama_bank, data.rekening]
        )
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kode_suplier}" sudah dipakai` }
        throw e
    }
}

async function update(oldKode, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query(
            `UPDATE tokosuplier SET kode_suplier=$1, nama_suplier=$2, alamat=$3, kota=$4, no_telp=$5, nama_bank=$6, rekening=$7
             WHERE kode_suplier=$8`,
            [data.kode_suplier, data.nama_suplier, data.alamat, data.kota, data.no_telp, data.nama_bank, data.rekening, oldKode]
        )
        if (rowCount === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kode_suplier}" sudah dipakai` }
        throw e
    }
}

async function deleteOne(kode) {
    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query('DELETE FROM tokosuplier WHERE kode_suplier=$1', [kode])
        return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === '23503') return { success: false, message: 'Tidak bisa dihapus — masih dipakai di transaksi lain' }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
