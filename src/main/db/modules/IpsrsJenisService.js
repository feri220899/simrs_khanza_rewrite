// Taksonomi Jenis Barang IPSRS — src/ipsrs/IPSRSJenis.java. Tabel ASLI sik.sql
// `ipsrsjenisbarang(kd_jenis, nm_jenis)` (kd_jenis char(5)) — pola identik
// TokoJenisService.js (tokojenisbarang), cuma nama tabel beda.
import DatabaseService from '../DatabaseService.js'

async function list({ page = 1, pageSize = 10, sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT kd_jenis, nm_jenis FROM ipsrsjenisbarang
         WHERE kd_jenis LIKE ? OR nm_jenis LIKE ?
         ORDER BY kd_jenis ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT COUNT(*) AS count FROM ipsrsjenisbarang WHERE kd_jenis LIKE ? OR nm_jenis LIKE ?',
        [like, like]
    )
    return { data: rows, total: count }
}

// Semua barang jenis IPSRS dipakai buat dropdown FK (mis. form Barang) —
// tidak dipaginasi, replika query kombo Java (`select * from ipsrsjenisbarang
// order by kd_jenis`).
async function listAll() {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT kd_jenis, nm_jenis FROM ipsrsjenisbarang ORDER BY kd_jenis')
    return rows
}

// Replika Valid.autoNomer("ipsrsjenisbarang","J",2,Kd) — row-count based.
async function nextKode() {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT COUNT(*) AS n FROM ipsrsjenisbarang')
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
        await db.query('INSERT INTO ipsrsjenisbarang (kd_jenis, nm_jenis) VALUES (?, ?)', [data.kd_jenis, data.nm_jenis])
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
            'UPDATE ipsrsjenisbarang SET kd_jenis=?, nm_jenis=? WHERE kd_jenis=?',
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
        const { rows } = await db.query('DELETE FROM ipsrsjenisbarang WHERE kd_jenis=?', [kode])
        return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Tidak bisa dihapus — masih dipakai di Master Barang' }
        }
        throw e
    }
}

export default { list, listAll, nextKode, create, update, deleteOne }
