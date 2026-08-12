// Taksonomi Jenis Barang Toko — src/toko/TokoJenis.java. Cuma 1 taksonomi
// (bukan keluarga 9/4 kayak Surat/Perpustakaan) jadi tidak perlu service
// generik — tabel ASLI sik.sql `tokojenisbarang(kd_jenis, nm_jenis)`
// (kd_jenis char(5) — bukan hasil migration Postgres yang sudah dibuang,
// lihat Khanza.md > "Prinsip Migrasi Data").
import DatabaseService from '../DatabaseService.js'

async function list({ page = 1, pageSize = 10, sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT kd_jenis, nm_jenis FROM tokojenisbarang
         WHERE kd_jenis LIKE ? OR nm_jenis LIKE ?
         ORDER BY kd_jenis ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT COUNT(*) AS count FROM tokojenisbarang WHERE kd_jenis LIKE ? OR nm_jenis LIKE ?',
        [like, like]
    )
    return { data: rows, total: count }
}

// Replika Valid.autoNomer("tokojenisbarang","J",2,Kd) — row-count based.
async function nextKode() {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT COUNT(*) AS n FROM tokojenisbarang')
    return 'J' + String(rows[0].n + 1).padStart(2, '0')
}

function validate({ kd_jenis, nm_jenis }) {
    if (!kd_jenis?.trim()) return 'Kode Jenis tidak boleh kosong'
    if (!nm_jenis?.trim()) return 'Nama Jenis tidak boleh kosong'
    return null
}

async function create(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query('INSERT INTO tokojenisbarang (kd_jenis, nm_jenis) VALUES (?, ?)', [data.kd_jenis, data.nm_jenis])
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${data.kd_jenis}" sudah dipakai` }
        throw e
    }
}

async function update(oldKode, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(
            'UPDATE tokojenisbarang SET kd_jenis=?, nm_jenis=? WHERE kd_jenis=?',
            [data.kd_jenis, data.nm_jenis, oldKode]
        )
        if (rows.affectedRows === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${data.kd_jenis}" sudah dipakai` }
        throw e
    }
}

async function deleteOne(kode) {
    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query('DELETE FROM tokojenisbarang WHERE kd_jenis=?', [kode])
        return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Tidak bisa dihapus — masih dipakai di Master Barang' }
        }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
