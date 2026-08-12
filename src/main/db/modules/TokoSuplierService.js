// CRUD Suplier Toko — src/toko/TokoSuplier.java. Tabel ASLI sik.sql
// `tokosuplier(kode_suplier, nama_suplier, alamat, kota, no_telp, nama_bank,
// rekening)` — field-nya cocok 1:1 dgn yang sudah dibangun, cuma dialect-nya
// yang disesuaikan ke MySQL (lihat Khanza.md > "Prinsip Migrasi Data").
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
         WHERE kode_suplier LIKE ? OR nama_suplier LIKE ?
         ORDER BY ${col} ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT COUNT(*) AS count FROM tokosuplier WHERE kode_suplier LIKE ? OR nama_suplier LIKE ?',
        [like, like]
    )
    return { data: rows, total: count }
}

// Replika Valid.autoNomer("tokosuplier","S",4,Kd) — row-count based.
async function nextKode() {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT COUNT(*) AS n FROM tokosuplier')
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
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [data.kode_suplier, data.nama_suplier, data.alamat, data.kota, data.no_telp, data.nama_bank, data.rekening]
        )
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${data.kode_suplier}" sudah dipakai` }
        throw e
    }
}

async function update(oldKode, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(
            `UPDATE tokosuplier SET kode_suplier=?, nama_suplier=?, alamat=?, kota=?, no_telp=?, nama_bank=?, rekening=?
             WHERE kode_suplier=?`,
            [data.kode_suplier, data.nama_suplier, data.alamat, data.kota, data.no_telp, data.nama_bank, data.rekening, oldKode]
        )
        if (rows.affectedRows === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${data.kode_suplier}" sudah dipakai` }
        throw e
    }
}

async function deleteOne(kode) {
    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query('DELETE FROM tokosuplier WHERE kode_suplier=?', [kode])
        return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Tidak bisa dihapus — masih dipakai di transaksi lain' }
        }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
