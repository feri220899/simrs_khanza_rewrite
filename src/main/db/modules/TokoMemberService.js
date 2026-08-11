// CRUD Member Toko — src/toko/TokoMember.java. `jk` cuma huruf pertama
// ('L'/'P') dari combobox "LAKI-LAKI"/"Perempuan" di Java asli.
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
         WHERE no_member ILIKE $1 OR nama ILIKE $1
         ORDER BY ${col} ${dir}
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT count(*)::int AS count FROM tokomember WHERE no_member ILIKE $1 OR nama ILIKE $1',
        [like]
    )
    return { data: rows, total: count }
}

// Replika autoNomer3(MAX(RIGHT(no_member,7))) — prefix M, pad 7, MAX-based global.
async function nextKode() {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(RIGHT(no_member, 7), '\\D', '', 'g'), '')::int), 0) AS mx
         FROM tokomember`
    )
    return 'M' + String(mx + 1).padStart(7, '0')
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
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [data.no_member, data.nama, data.jk || null, data.tmp_lahir || null, data.tgl_lahir || null,
             data.alamat, data.no_telp, data.email || null]
        )
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `No. Member "${data.no_member}" sudah dipakai` }
        throw e
    }
}

async function update(oldNoMember, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query(
            `UPDATE tokomember SET no_member=$1, nama=$2, jk=$3, tmp_lahir=$4, tgl_lahir=$5, alamat=$6, no_telp=$7, email=$8
             WHERE no_member=$9`,
            [data.no_member, data.nama, data.jk || null, data.tmp_lahir || null, data.tgl_lahir || null,
             data.alamat, data.no_telp, data.email || null, oldNoMember]
        )
        if (rowCount === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `No. Member "${data.no_member}" sudah dipakai` }
        throw e
    }
}

async function deleteOne(noMember) {
    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query('DELETE FROM tokomember WHERE no_member=$1', [noMember])
        return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === '23503') return { success: false, message: 'Tidak bisa dihapus — masih dipakai di transaksi lain' }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
