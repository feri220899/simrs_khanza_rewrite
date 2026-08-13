// CRUD Master Barang IPSRS — src/ipsrs/IPSRSBarang.java. Tabel ASLI sik.sql
// `ipsrsbarang(kode_brng, nama_brng, kode_sat char(4), jenis char(5), stok,
// harga, status enum('0','1'))` — pola soft-delete/restore/hardDelete IDENTIK
// TokoBarangService.js (tokobarang), cuma:
// - Cuma SATU kolom harga (bukan dasar/h_beli/distributor/grosir/retail
//   kayak Toko) — jadi TIDAK ADA fungsi `calcHarga()` di sini.
// - Kode Barang DIKETIK MANUAL di Java asli (tidak ada `Valid.autoNomer(...)`
//   di IPSRSBarang.java, beda dari Toko) — TAPI atas permintaan eksplisit
//   user, `nextKode()` DITAMBAHKAN di sini sbg fitur baru di luar 1:1
//   (data contoh `B00001`..`B00014` di sik.sql memang berurutan, walau itu
//   hasil input manual yang konsisten, bukan hasil generator Java asli).
// - Restore/hardDelete ("Data Sampah") direplika dari src/restore/
//   DlgRestoreIPSRSBarang.java, gate-nya identik pola Toko: Admin Utama/
//   Administrator saja (dicek di IPC, bukan cuma permission `ipsrs_barang`).
//
// RESOLVED: index ganda di kolom `jenis` (`KEY jenis (jenis(1))` prefix +
// `KEY jenis_2 (jenis)` full) yang bikin FK `ipsrsbarang_ibfk_2` gagal di
// MySQL 9.6 — sudah diperbaiki manual oleh user langsung di database
// (index prefix redundan dihapus). Lihat memori project "Bug FK
// ipsrsbarang.jenis" utk detail historis.
import DatabaseService from '../DatabaseService.js'

const SORTABLE = { kode_brng: 'b.kode_brng', nama_brng: 'b.nama_brng', stok: 'b.stok' }

async function list({ page = 1, pageSize = 10, sortBy = 'kode_brng', sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const col = SORTABLE[sortBy] || 'b.kode_brng'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT b.*, j.nm_jenis, s.satuan AS nama_satuan
         FROM ipsrsbarang b
         JOIN ipsrsjenisbarang j ON j.kd_jenis = b.jenis
         JOIN kodesatuan s ON s.kode_sat = b.kode_sat
         WHERE b.status = '1' AND (b.kode_brng LIKE ? OR b.nama_brng LIKE ? OR s.satuan LIKE ? OR j.nm_jenis LIKE ?)
         ORDER BY ${col} ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count 
         FROM ipsrsbarang b
         JOIN ipsrsjenisbarang j ON j.kd_jenis = b.jenis
         JOIN kodesatuan s ON s.kode_sat = b.kode_sat
         WHERE b.status = '1' AND (b.kode_brng LIKE ? OR b.nama_brng LIKE ? OR s.satuan LIKE ? OR j.nm_jenis LIKE ?)`,
        [like, like, like, like]
    )
    return { data: rows, total: count }
}

// Fitur baru (bukan dari Java asli, lihat catatan header) — pola sama
// TokoBarangService.nextKode(): ambil suffix numerik terbesar dari 5 digit
// terakhir kode_brng, +1. Format 'B00001', 'B00002', dst, mengikuti pola
// data contoh yang sudah ada di sik.sql.
async function nextKode() {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(RIGHT(kode_brng, 5), '[^0-9]', ''), '') AS UNSIGNED)), 0) AS mx
         FROM ipsrsbarang`
    )
    // mysql2 balikin hasil CAST(...AS UNSIGNED) sebagai STRING — WAJIB
    // Number() dulu (lihat catatan sama di TokoBarangService.nextKode()).
    return 'B' + String(Number(mx) + 1).padStart(5, '0')
}

// Dropdown FK (mis. baris detail Permintaan/Pengajuan/Surat Pemesanan) —
// cuma barang aktif, tidak dipaginasi.
async function listAktif() {
    const db = await DatabaseService.get()
    const { rows } = await db.query(
        `SELECT b.kode_brng, b.nama_brng, b.kode_sat, s.satuan AS nama_satuan, b.stok, b.harga
         FROM ipsrsbarang b JOIN kodesatuan s ON s.kode_sat = b.kode_sat
         WHERE b.status = '1' ORDER BY b.nama_brng`
    )
    return rows
}

// "Data Sampah" — barang yang sudah di-soft-delete.
async function listSampah({ page = 1, pageSize = 10, search = '' } = {}) {
    const db = await DatabaseService.get()
    const like = `%${search}%`
    const { rows } = await db.query(
        `SELECT b.*, j.nm_jenis
         FROM ipsrsbarang b
         JOIN ipsrsjenisbarang j ON j.kd_jenis = b.jenis
         WHERE b.status = '0' AND (b.kode_brng LIKE ? OR b.nama_brng LIKE ?)
         ORDER BY b.kode_brng
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM ipsrsbarang WHERE status = '0' AND (kode_brng LIKE ? OR nama_brng LIKE ?)`,
        [like, like]
    )
    return { data: rows, total: count }
}

// Urutan validasi SAMA Java asli (BtnSimpanActionPerformed).
function validate({ kode_brng, nama_brng, harga, kode_sat, jenis }) {
    if (!kode_brng?.trim()) return 'Kode Barang tidak boleh kosong'
    if (!nama_brng?.trim()) return 'Nama Barang tidak boleh kosong'
    if (harga === undefined || harga === null || String(harga).trim() === '') return 'Harga Barang tidak boleh kosong'
    if (!kode_sat?.trim()) return 'Satuan tidak boleh kosong'
    if (!jenis?.trim()) return 'Jenis Barang tidak boleh kosong'
    return null
}

async function create(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(
            `INSERT INTO ipsrsbarang (kode_brng, nama_brng, kode_sat, jenis, stok, harga, status)
             VALUES (?, ?, ?, ?, ?, ?, '1')`,
            [data.kode_brng, data.nama_brng, data.kode_sat, data.jenis, data.stok || 0, data.harga]
        )
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${data.kode_brng}" sudah dipakai` }
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Jenis Barang/Satuan yang dipilih tidak valid' }
        }
        throw e
    }
}

async function update(oldKode, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(
            `UPDATE ipsrsbarang SET kode_brng=?, nama_brng=?, kode_sat=?, jenis=?, harga=? WHERE kode_brng=?`,
            [data.kode_brng, data.nama_brng, data.kode_sat, data.jenis, data.harga, oldKode]
        )
        if (rows.affectedRows === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode "${data.kode_brng}" sudah dipakai` }
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Jenis Barang/Satuan yang dipilih tidak valid' }
        }
        throw e
    }
}

async function deleteOne(kode) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(`UPDATE ipsrsbarang SET status='0' WHERE kode_brng=? AND status='1'`, [kode])
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
}

async function restore(kode) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(`UPDATE ipsrsbarang SET status='1' WHERE kode_brng=? AND status='0'`, [kode])
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan di sampah' : undefined }
}

// Replika BtnHapus di src/restore/DlgRestoreIPSRSBarang.java — HAPUS
// PERMANEN, cuma boleh ke baris yang sudah di sampah (status='0').
async function hardDelete(kode) {
    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(`DELETE FROM ipsrsbarang WHERE kode_brng=? AND status='0'`, [kode])
        return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan di sampah' : undefined }
    } catch (e) {
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Tidak bisa dihapus permanen — masih ada riwayat/transaksi yang mengacu ke barang ini' }
        }
        throw e
    }
}

export default { list, nextKode, listAktif, listSampah, create, update, deleteOne, restore, hardDelete }
