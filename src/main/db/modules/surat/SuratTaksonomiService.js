// Taksonomi arsip fisik Surat Menyurat — ditelusuri dari 9 file Java yang
// TERNYATA byte-for-byte identik polanya (cuma beda nama tabel/kolom/prefix):
//   SuratRak, SuratAlmari, SuratKlasifikasi, SuratSifat, SuratMap,
//   SuratIndeks, SuratRuang, SuratStatus, SuratBalas
// Makanya di sini SATU service generik (bukan 9 file copy-paste) yang
// diparameterkan lewat `jenis`. `TAKSONOMI` di bawah adalah WHITELIST —
// `jenis` dari renderer HARUS ada di daftar ini sebelum nama tabel/kolomnya
// dipakai di SQL (bukan diterima mentah dari input user).
//
// TEMUAN PENTING (jangan sampai salah): permission `surat_almari` beda dari
// nama TABEL `surat_lemari` — class Java-nya "SuratAlmari" tapi query-nya ke
// tabel "surat_lemari" dan akses.getsurat_almari(). Field `table` di bawah
// SENGAJA beda dari `permission`, jangan disamakan/disederhanakan. Semua
// tabel ASLI sik.sql pola-nya SAMA PERSIS: `(kd varchar(5), <kolom> varchar(50))`.
import DatabaseService from '../../DatabaseService.js'

const TAKSONOMI = {
    rak:         { table: 'surat_rak',         kolom: 'rak',         prefix: 'SR', permission: 'surat_rak',         label: 'Rak' },
    almari:      { table: 'surat_lemari',      kolom: 'lemari',      prefix: 'SA', permission: 'surat_almari',      label: 'Almari' },
    klasifikasi: { table: 'surat_klasifikasi', kolom: 'klasifikasi', prefix: 'SK', permission: 'surat_klasifikasi', label: 'Klasifikasi' },
    sifat:       { table: 'surat_sifat',       kolom: 'sifat',       prefix: 'SF', permission: 'surat_sifat',       label: 'Sifat' },
    map:         { table: 'surat_map',         kolom: 'map',         prefix: 'SM', permission: 'surat_map',         label: 'Map' },
    indeks:      { table: 'surat_indeks',      kolom: 'indeks',      prefix: 'SI', permission: 'surat_indeks',      label: 'Indeks' },
    ruang:       { table: 'surat_ruang',       kolom: 'ruang',       prefix: 'SG', permission: 'surat_ruang',       label: 'Ruang' },
    status:      { table: 'surat_status',      kolom: 'status',      prefix: 'SS', permission: 'surat_status',      label: 'Status' },
    balas:       { table: 'surat_balas',       kolom: 'balas',       prefix: 'SB', permission: 'surat_balas',       label: 'Status Balas' },
}

function getConfig(jenis) {
    const cfg = TAKSONOMI[jenis]
    if (!cfg) throw new Error(`Jenis taksonomi surat tidak dikenal: ${jenis}`)
    return cfg
}

function daftarJenis() {
    return Object.entries(TAKSONOMI).map(([jenis, cfg]) => ({ jenis, label: cfg.label, permission: cfg.permission }))
}

async function list(jenis, { page = 1, pageSize = 10, sortOrder = 'asc', search = '' } = {}) {
    const { table, kolom } = getConfig(jenis)
    const db = await DatabaseService.get()
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT kd, ${kolom} AS nama FROM ${table}
         WHERE kd LIKE ? OR ${kolom} LIKE ?
         ORDER BY kd ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM ${table} WHERE kd LIKE ? OR ${kolom} LIKE ?`,
        [like, like]
    )
    return { data: rows, total: count }
}

// Replika Valid.autoNomer(" surat_xxx ","PREFIX",3,TKd) di Java: PREFIX +
// (jumlah baris saat ini + 1), padding 3 digit (beda dari Parkir yang 4 digit).
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
    const { table, kolom } = getConfig(jenis)
    if (!kd?.trim()) return { success: false, message: 'Kode tidak boleh kosong' }
    const err = validate(nama)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(`INSERT INTO ${table} (kd, ${kolom}) VALUES (?, ?)`, [kd, nama])
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${kd}" sudah dipakai` }
        throw e
    }
}

// `oldKode` = kd ASLI (dari baris yang dipilih) — sama seperti Parkir, kode
// sendiri boleh diganti (rename) saat edit di Java asli.
async function update(jenis, oldKode, { kd, nama }) {
    const { table, kolom } = getConfig(jenis)
    if (!kd?.trim()) return { success: false, message: 'Kode tidak boleh kosong' }
    const err = validate(nama)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(
            `UPDATE ${table} SET kd=?, ${kolom}=? WHERE kd=?`,
            [kd, nama, oldKode]
        )
        if (rows.affectedRows === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${kd}" sudah dipakai` }
        throw e
    }
}

// Java asli hapus lewat checkbox multi-select (bisa hapus beberapa baris
// sekaligus) — kita sederhanakan jadi hapus 1 baris per aksi (konsisten
// dengan konvensi UI Khanza: tombol Hapus per-baris, lihat Khanza.md), bukan
// checkbox massal. Kemampuan hapus datanya tetap ada, cuma UX-nya beda.
async function deleteOne(jenis, kode) {
    const { table } = getConfig(jenis)
    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(`DELETE FROM ${table} WHERE kd=?`, [kode])
        return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
    } catch (e) {
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Tidak bisa dihapus — masih dipakai di Surat Masuk/Keluar' }
        }
        throw e
    }
}

export default { daftarJenis, getConfig, list, nextKode, create, update, deleteOne }
