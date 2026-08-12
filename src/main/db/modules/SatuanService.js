// Satuan barang — src/inventory/DlgSatuan.java, tabel ASLI sik.sql
// `kodesatuan(kode_sat char(4), satuan)`. SHARED lintas modul Java asli
// (Toko, Dapur, IPSRS, Farmasi, dll) — SENGAJA tidak diberi prefix "Toko"
// meski konsumen pertamanya Toko, supaya modul lain nanti bisa pakai ulang
// tanpa migrasi/service baru.
import DatabaseService from '../DatabaseService.js'

async function list({ page = 1, pageSize = 10, sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT kode_sat, satuan FROM kodesatuan
         WHERE kode_sat LIKE ? OR satuan LIKE ?
         ORDER BY kode_sat ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT COUNT(*) AS count FROM kodesatuan WHERE kode_sat LIKE ? OR satuan LIKE ?',
        [like, like]
    )
    return { data: rows, total: count }
}

// Replika Valid.autoNomer("kodesatuan","S",2,Kd) — row-count based.
async function nextKode() {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT COUNT(*) AS n FROM kodesatuan')
    return 'S' + String(rows[0].n + 1).padStart(2, '0')
}

function validate({ kode_sat, satuan }) {
    if (!kode_sat?.trim()) return 'Kode Satuan tidak boleh kosong'
    if (!satuan?.trim()) return 'Nama Satuan tidak boleh kosong'
    return null
}

async function create(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query('INSERT INTO kodesatuan (kode_sat, satuan) VALUES (?, ?)', [data.kode_sat, data.satuan])
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${data.kode_sat}" sudah dipakai` }
        throw e
    }
}

async function update(oldKode, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(
            'UPDATE kodesatuan SET kode_sat=?, satuan=? WHERE kode_sat=?',
            [data.kode_sat, data.satuan, oldKode]
        )
        if (rows.affectedRows === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${data.kode_sat}" sudah dipakai` }
        throw e
    }
}

async function deleteOne(kode) {
    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query('DELETE FROM kodesatuan WHERE kode_sat=?', [kode])
        return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Tidak bisa dihapus — masih dipakai di Master Barang' }
        }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
