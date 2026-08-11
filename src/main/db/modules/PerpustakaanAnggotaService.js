// CRUD Anggota — src/perpustakaan/PerpustakaanAnggota.java.
// `jenis_anggota` combobox tetap {Pasien,Pegawai,Umum} tapi TIDAK ada FK ke
// tabel pasien/pegawai — cuma penanda kategori + field teks bebas `nomer_id`
// (No.RM/NIP/No.KTP diisi manual, bukan lookup). Fitur cetak kartu
// anggota/daftar anggota (Jasper) TIDAK diimplementasi.
import DatabaseService from '../DatabaseService.js'

const SORTABLE = { no_anggota: 'no_anggota', nama_anggota: 'nama_anggota', tgl_gabung: 'tgl_gabung' }

async function list({ page = 1, pageSize = 10, sortBy = 'no_anggota', sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const col = SORTABLE[sortBy] || 'no_anggota'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT no_anggota, nama_anggota, tmp_lahir, tgl_lahir, j_kel, alamat, no_telp, email,
                tgl_gabung, masa_berlaku, jenis_anggota, nomer_id
         FROM perpustakaan_anggota
         WHERE no_anggota ILIKE $1 OR nama_anggota ILIKE $1 OR nomer_id ILIKE $1
         ORDER BY ${col} ${dir}
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT count(*)::int AS count FROM perpustakaan_anggota WHERE no_anggota ILIKE $1 OR nama_anggota ILIKE $1 OR nomer_id ILIKE $1',
        [like]
    )
    return { data: rows, total: count }
}

async function nextKode() {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(RIGHT(no_anggota, 8), '\\D', '', 'g'), '')::int), 0) AS mx
         FROM perpustakaan_anggota`
    )
    return 'AP' + String(mx + 1).padStart(6, '0')
}

// Urutan validasi sama seperti Java asli. tgl_lahir/tgl_gabung/masa_berlaku
// TIDAK divalidasi wajib (defaultnya combobox tanggal, selalu terisi).
function validate({ no_anggota, nama_anggota, tmp_lahir, alamat, no_telp, email, nomer_id, jenis_anggota }) {
    if (!no_anggota?.trim()) return 'No. Anggota tidak boleh kosong'
    if (!nama_anggota?.trim()) return 'Nama tidak boleh kosong'
    if (!tmp_lahir?.trim()) return 'Tempat Lahir tidak boleh kosong'
    if (!alamat?.trim()) return 'Alamat tidak boleh kosong'
    if (!no_telp?.trim()) return 'No. Telp tidak boleh kosong'
    if (!email?.trim()) return 'Email tidak boleh kosong'
    if (!nomer_id?.trim()) return 'No. RM/NIP/No. KTP tidak boleh kosong'
    if (!['Pasien', 'Pegawai', 'Umum'].includes(jenis_anggota)) return 'Jenis Anggota harus Pasien/Pegawai/Umum'
    return null
}

async function create(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(
            `INSERT INTO perpustakaan_anggota
                (no_anggota, nama_anggota, tmp_lahir, tgl_lahir, j_kel, alamat, no_telp, email, tgl_gabung, masa_berlaku, jenis_anggota, nomer_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [data.no_anggota, data.nama_anggota, data.tmp_lahir, data.tgl_lahir || null, data.j_kel || null,
             data.alamat, data.no_telp, data.email, data.tgl_gabung || null, data.masa_berlaku || null,
             data.jenis_anggota, data.nomer_id]
        )
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `No. Anggota "${data.no_anggota}" sudah dipakai` }
        throw e
    }
}

async function update(oldNoAnggota, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query(
            `UPDATE perpustakaan_anggota
             SET no_anggota=$1, nama_anggota=$2, tmp_lahir=$3, tgl_lahir=$4, j_kel=$5, alamat=$6,
                 no_telp=$7, email=$8, tgl_gabung=$9, masa_berlaku=$10, jenis_anggota=$11, nomer_id=$12
             WHERE no_anggota=$13`,
            [data.no_anggota, data.nama_anggota, data.tmp_lahir, data.tgl_lahir || null, data.j_kel || null,
             data.alamat, data.no_telp, data.email, data.tgl_gabung || null, data.masa_berlaku || null,
             data.jenis_anggota, data.nomer_id, oldNoAnggota]
        )
        if (rowCount === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `No. Anggota "${data.no_anggota}" sudah dipakai` }
        throw e
    }
}

// CATATAN (beda dari Java asli yg tidak cek sama sekali): kita tolak hapus
// anggota yang masih punya pinjaman aktif, biar tidak jadi orphan record di
// perpustakaan_peminjaman — perbaikan kecil, bukan replikasi bug.
async function deleteOne(noAnggota) {
    const db = await DatabaseService.get()
    const { rows: [{ n }] } = await db.query(
        `SELECT count(*)::int AS n FROM perpustakaan_peminjaman WHERE no_anggota=$1 AND status_pinjam='Masih Dipinjam'`,
        [noAnggota]
    )
    if (n > 0) return { success: false, message: 'Tidak bisa dihapus — anggota masih punya pinjaman aktif' }

    try {
        const { rowCount } = await db.query('DELETE FROM perpustakaan_anggota WHERE no_anggota=$1', [noAnggota])
        return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === '23503') return { success: false, message: 'Tidak bisa dihapus — masih ada riwayat pinjam/denda' }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
