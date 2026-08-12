// CRUD Member Toko — src/toko/TokoMember.java. `jk` cuma huruf pertama
// ('L'/'P') dari combobox "LAKI-LAKI"/"Perempuan" di Java asli. Tabel ASLI
// sik.sql `tokomember(no_member, nama, jk, tmp_lahir, tgl_lahir, alamat,
// no_telp, email)` — field-nya cocok 1:1, dialect disesuaikan ke MySQL.
import DatabaseService from '../DatabaseService.js'

const SORTABLE = { no_member: 'no_member', nama: 'nama' }

async function list({ page = 1, pageSize = 10, sortBy = 'no_member', sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const col = SORTABLE[sortBy] || 'no_member'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT no_member, nama, jk, tmp_lahir, tgl_lahir, alamat, no_telp, email
         FROM tokomember
         WHERE no_member LIKE ? OR nama LIKE ?
         ORDER BY ${col} ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT COUNT(*) AS count FROM tokomember WHERE no_member LIKE ? OR nama LIKE ?',
        [like, like]
    )
    return { data: rows, total: count }
}

// Replika autoNomer3(MAX(RIGHT(no_member,7))) — prefix M, pad 7, MAX-based global.
// MySQL 8+ REGEXP_REPLACE (bukan Postgres regexp_replace(...,'g')) — MySQL
// ganti SEMUA kecocokan by default, tidak butuh flag 'g'.
async function nextKode() {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(RIGHT(no_member, 7), '[^0-9]', ''), '') AS UNSIGNED)), 0) AS mx
         FROM tokomember`
    )
    // mysql2 balikin hasil CAST(...AS UNSIGNED) sebagai STRING — WAJIB
    // Number() dulu, lihat catatan sama di TokoBarangService.nextKode().
    return 'M' + String(Number(mx) + 1).padStart(7, '0')
}

// Urutan validasi SAMA Java asli: NoMember -> Nama -> NoTelp -> Alamat.
// tmp_lahir/tgl_lahir/jk/email TIDAK wajib (sesuai investigasi).
function validate({ no_member, nama, no_telp, alamat }) {
    if (!no_member?.trim()) return 'No. Member tidak boleh kosong'
    if (!nama?.trim()) return 'Nama Member tidak boleh kosong'
    if (!no_telp?.trim()) return 'No. Telp tidak boleh kosong'
    if (!alamat?.trim()) return 'Alamat tidak boleh kosong'
    return null
}

async function create(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(
            `INSERT INTO tokomember (no_member, nama, jk, tmp_lahir, tgl_lahir, alamat, no_telp, email)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.no_member, data.nama, data.jk || null, data.tmp_lahir || null, data.tgl_lahir || null,
             data.alamat, data.no_telp, data.email || null]
        )
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `No. Member "${data.no_member}" sudah dipakai` }
        throw e
    }
}

async function update(oldNoMember, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(
            `UPDATE tokomember SET no_member=?, nama=?, jk=?, tmp_lahir=?, tgl_lahir=?, alamat=?, no_telp=?, email=?
             WHERE no_member=?`,
            [data.no_member, data.nama, data.jk || null, data.tmp_lahir || null, data.tgl_lahir || null,
             data.alamat, data.no_telp, data.email || null, oldNoMember]
        )
        if (rows.affectedRows === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `No. Member "${data.no_member}" sudah dipakai` }
        throw e
    }
}

async function deleteOne(noMember) {
    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query('DELETE FROM tokomember WHERE no_member=?', [noMember])
        return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Tidak bisa dihapus — masih dipakai di transaksi lain' }
        }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
