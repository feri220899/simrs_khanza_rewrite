// Taksonomi Perpustakaan — 4 tabel 2-kolom identik polanya di Java asli
// (PerpustakaanJenis, PerpustakaanRuang, PerpustakaanPengarang,
// PerpustakaanKategori), cuma beda nama tabel/kolom PK/prefix kode. SATU
// service generik, whitelist di TAKSONOMI (bukan terima nama tabel mentah
// dari renderer) — pola sama persis SuratTaksonomiService.js.
//
// PENTING: nama kolom PK & kolom nilai BEDA-BEDA per tabel (bukan seragam
// "kd"/"nama" kayak Surat) — id_jenis/nama_jenis, kd_ruang/nm_ruang,
// kode_pengarang/nama_pengarang, id_kategori/nama_kategori. Field `pk`/`kolom`
// di bawah dikonfirmasi ulang persis sama dgn CREATE TABLE asli sik.sql (jadi
// koreksi lama di migration Postgres 021 — id_kategori bukan kode_kategori,
// nama_jenis bukan nm_jenis — TERBUKTI BENAR, tidak perlu diubah lagi, cuma
// dialect SQL yang disesuaikan ke MySQL).
import DatabaseService from '../DatabaseService.js'

const TAKSONOMI = {
    jenis:     { table: 'perpustakaan_jenis_buku', pk: 'id_jenis',       kolom: 'nama_jenis',     prefix: 'JK', permission: 'jenis_perpustakaan',     label: 'Jenis Koleksi' },
    ruang:     { table: 'perpustakaan_ruang',      pk: 'kd_ruang',       kolom: 'nm_ruang',       prefix: 'RP', permission: 'ruang_perpustakaan',     label: 'Ruang' },
    pengarang: { table: 'perpustakaan_pengarang',  pk: 'kode_pengarang', kolom: 'nama_pengarang', prefix: 'PP', permission: 'pengarang_perpustakaan', label: 'Pengarang' },
    kategori:  { table: 'perpustakaan_kategori',   pk: 'id_kategori',    kolom: 'nama_kategori',  prefix: 'KK', permission: 'kategori_perpustakaan',  label: 'Kategori' },
}

function getConfig(jenis) {
    const cfg = TAKSONOMI[jenis]
    if (!cfg) throw new Error(`Jenis taksonomi perpustakaan tidak dikenal: ${jenis}`)
    return cfg
}

function daftarJenis() {
    return Object.entries(TAKSONOMI).map(([jenis, cfg]) => ({ jenis, label: cfg.label, permission: cfg.permission }))
}

async function list(jenis, { page = 1, pageSize = 10, sortOrder = 'asc', search = '' } = {}) {
    const { table, pk, kolom } = getConfig(jenis)
    const db = await DatabaseService.get()
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT ${pk} AS kd, ${kolom} AS nama FROM ${table}
         WHERE ${pk} LIKE ? OR ${kolom} LIKE ?
         ORDER BY ${pk} ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM ${table} WHERE ${pk} LIKE ? OR ${kolom} LIKE ?`,
        [like, like]
    )
    return { data: rows, total: count }
}

// Replika Valid.autoNomer(tabMode,"XX",3,TKd) di Java: prefix + (jumlah baris
// saat ini + 1), padding 3 digit — sama utk keempat taksonomi ini.
async function nextKode(jenis) {
    const { table, prefix } = getConfig(jenis)
    const db = await DatabaseService.get()
    const { rows } = await db.query(`SELECT COUNT(*) AS n FROM ${table}`)
    return prefix + String(rows[0].n + 1).padStart(3, '0')
}

function validate(nama) {
    if (!nama?.trim()) return 'Nama tidak boleh kosong'
    return null
}

async function create(jenis, { kd, nama }) {
    const { table, pk, kolom } = getConfig(jenis)
    if (!kd?.trim()) return { success: false, message: 'Kode tidak boleh kosong' }
    const err = validate(nama)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(`INSERT INTO ${table} (${pk}, ${kolom}) VALUES (?, ?)`, [kd, nama])
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${kd}" sudah dipakai` }
        throw e
    }
}

async function update(jenis, oldKode, { kd, nama }) {
    const { table, pk, kolom } = getConfig(jenis)
    if (!kd?.trim()) return { success: false, message: 'Kode tidak boleh kosong' }
    const err = validate(nama)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(
            `UPDATE ${table} SET ${pk}=?, ${kolom}=? WHERE ${pk}=?`,
            [kd, nama, oldKode]
        )
        if (rows.affectedRows === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${kd}" sudah dipakai` }
        throw e
    }
}

async function deleteOne(jenis, kode) {
    const { table, pk } = getConfig(jenis)
    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(`DELETE FROM ${table} WHERE ${pk}=?`, [kode])
        return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        // FK dari perpustakaan_buku (kalau taksonomi ini masih dipakai koleksi)
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Tidak bisa dihapus — masih dipakai di data Koleksi' }
        }
        throw e
    }
}

export default { daftarJenis, getConfig, list, nextKode, create, update, deleteOne }
