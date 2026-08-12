// CRUD Anggota — src/perpustakaan/PerpustakaanAnggota.java.
// `jenis_anggota` combobox tetap {Pasien,Pegawai,Umum} tapi TIDAK ada FK ke
// tabel pasien/pegawai — cuma penanda kategori + field teks bebas `nomer_id`
// (No.RM/NIP/No.KTP diisi manual, bukan lookup). Tabel ASLI sik.sql
// `perpustakaan_anggota` — field cocok 1:1. Fitur cetak kartu anggota/daftar
// anggota (Jasper) TIDAK diimplementasi.
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
         WHERE no_anggota LIKE ? OR nama_anggota LIKE ? OR nomer_id LIKE ?
         ORDER BY ${col} ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT COUNT(*) AS count FROM perpustakaan_anggota WHERE no_anggota LIKE ? OR nama_anggota LIKE ? OR nomer_id LIKE ?',
        [like, like, like]
    )
    return { data: rows, total: count }
}

async function nextKode() {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(RIGHT(no_anggota, 8), '[^0-9]', ''), '') AS UNSIGNED)), 0) AS mx
         FROM perpustakaan_anggota`
    )
    // mysql2 balikin CAST(...AS UNSIGNED) sebagai STRING — WAJIB Number().
    return 'AP' + String(Number(mx) + 1).padStart(6, '0')
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
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.no_anggota, data.nama_anggota, data.tmp_lahir, data.tgl_lahir || null, data.j_kel || null,
             data.alamat, data.no_telp, data.email, data.tgl_gabung || null, data.masa_berlaku || null,
             data.jenis_anggota, data.nomer_id]
        )
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `No. Anggota "${data.no_anggota}" sudah dipakai` }
        throw e
    }
}

async function update(oldNoAnggota, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(
            `UPDATE perpustakaan_anggota
             SET no_anggota=?, nama_anggota=?, tmp_lahir=?, tgl_lahir=?, j_kel=?, alamat=?,
                 no_telp=?, email=?, tgl_gabung=?, masa_berlaku=?, jenis_anggota=?, nomer_id=?
             WHERE no_anggota=?`,
            [data.no_anggota, data.nama_anggota, data.tmp_lahir, data.tgl_lahir || null, data.j_kel || null,
             data.alamat, data.no_telp, data.email, data.tgl_gabung || null, data.masa_berlaku || null,
             data.jenis_anggota, data.nomer_id, oldNoAnggota]
        )
        if (rows.affectedRows === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `No. Anggota "${data.no_anggota}" sudah dipakai` }
        throw e
    }
}

// CATATAN (beda dari Java asli yg tidak cek sama sekali): kita tolak hapus
// anggota yang masih punya pinjaman aktif, biar tidak jadi orphan record di
// perpustakaan_peminjaman — perbaikan kecil, bukan replikasi bug.
async function deleteOne(noAnggota) {
    const db = await DatabaseService.get()
    const { rows: [{ n }] } = await db.query(
        `SELECT COUNT(*) AS n FROM perpustakaan_peminjaman WHERE no_anggota=? AND status_pinjam='Masih Dipinjam'`,
        [noAnggota]
    )
    if (n > 0) return { success: false, message: 'Tidak bisa dihapus — anggota masih punya pinjaman aktif' }

    try {
        const { rows } = await db.query('DELETE FROM perpustakaan_anggota WHERE no_anggota=?', [noAnggota])
        return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Tidak bisa dihapus — masih ada riwayat pinjam/denda' }
        }
        throw e
    }
}

export default { list, nextKode, create, update, deleteOne }
