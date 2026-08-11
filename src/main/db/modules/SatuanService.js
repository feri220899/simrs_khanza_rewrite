// Satuan barang — src/inventory/DlgSatuan.java, tabel `kodesatuan(kode_sat,
// satuan)`. SHARED lintas modul Java asli (Toko, Dapur, IPSRS, Farmasi, dll)
// — SENGAJA tidak diberi prefix "Toko" meski konsumen pertamanya Toko,
// supaya modul lain nanti bisa pakai ulang tanpa migrasi/service baru.
import DatabaseService from '../DatabaseService.js'

async function list({ page = 1, pageSize = 10, sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT kode_sat, satuan FROM kodesatuan
         WHERE kode_sat ILIKE $1 OR satuan ILIKE $1
         ORDER BY kode_sat ${dir}
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT count(*)::int AS count FROM kodesatuan WHERE kode_sat ILIKE $1 OR satuan ILIKE $1',
        [like]
    )
    return { data: rows, total: count }
}

// Replika Valid.autoNomer("kodesatuan","S",2,Kd) — row-count based.
async function nextKode() {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT count(*)::int AS n FROM kodesatuan')
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
        await db.query('INSERT INTO kodesatuan (kode_sat, satuan) VALUES ($1,$2)', [data.kode_sat, data.satuan])
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kode_sat}" sudah dipakai` }
        throw e
    }
}

async function update(oldKode, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query(
            'UPDATE kodesatuan SET kode_sat=$1, satuan=$2 WHERE kode_sat=$3',
            [data.kode_sat, data.satuan, oldKode]
        )
        if (rowCount === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kode_sat}" sudah dipakai` }
        throw e
    }
}

async function deleteOne(kode) {
    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query('DELETE FROM kodesatuan WHERE kode_sat=$1', [kode])
        return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === '23503') return { success: false, message: 'Tidak bisa dihapus — masih dipakai di Master Barang' }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
