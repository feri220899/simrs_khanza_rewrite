// CRUD Master Barang Toko — src/toko/TokoBarang.java. Tabel ASLI sik.sql
// `tokobarang(kode_brng, nama_brng, kode_sat char(4), jenis char(5), stok,
// dasar, h_beli, distributor, grosir, retail, status enum('0','1'))` —
// PENTING: kolom aslinya `status` char ('1'=aktif, '0'=terhapus/sampah,
// dikonfirmasi dari src/toko/TokoBarang.java baris 817 & src/restore/
// DlgRestoreTokoBarang.java baris 428), BUKAN `aktif BOOLEAN` hasil migration
// Postgres yang sudah dibuang (lihat Khanza.md > "Prinsip Migrasi Data").
// - Harga jual (distributor/grosir/retail) DIHITUNG OTOMATIS dari field
//   "Beli" x persentase markup di `tokosetharga` (BUKAN `toko_setharga` —
//   nama tabel asli tanpa underscore, tabel MyISAM TANPA kolom `id` sama
//   sekali, cuma 1 baris data, pola Java-nya "delete semua lalu insert 1
//   baris baru", lihat src/setting/DlgSetHargaToko.java) — tapi tetap bisa
//   ditimpa manual sebelum simpan, sama seperti Java asli (auto-fill, bukan lock).
// - Hapus = SOFT DELETE (`status='0'`), bukan hard delete — ada menu
//   restore ("Data Sampah") yang di Java asli DIBATASI role "Admin Utama"
//   secara khusus (bukan cuma permission `toko_barang` biasa) — replikasi
//   lewat requirePermission + cek isFullAdmin di IPC (main/index.js).
import DatabaseService from '../DatabaseService.js'

const SORTABLE = { kode_brng: 'b.kode_brng', nama_brng: 'b.nama_brng', stok: 'b.stok' }

function roundUp100(n) {
    return Math.ceil(Number(n) / 100) * 100
}

async function list({ page = 1, pageSize = 10, sortBy = 'kode_brng', sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const col = SORTABLE[sortBy] || 'b.kode_brng'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT b.*, j.nm_jenis, s.satuan AS nama_satuan
         FROM tokobarang b
         JOIN tokojenisbarang j ON j.kd_jenis = b.jenis
         JOIN kodesatuan s ON s.kode_sat = b.kode_sat
         WHERE b.status = '1' AND (b.kode_brng LIKE ? OR b.nama_brng LIKE ?)
         ORDER BY ${col} ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM tokobarang WHERE status = '1' AND (kode_brng LIKE ? OR nama_brng LIKE ?)`,
        [like, like]
    )
    return { data: rows, total: count }
}

// "Data Sampah" — barang yang sudah di-soft-delete.
async function listSampah({ page = 1, pageSize = 10, search = '' } = {}) {
    const db = await DatabaseService.get()
    const like = `%${search}%`
    const { rows } = await db.query(
        `SELECT b.*, j.nm_jenis
         FROM tokobarang b
         JOIN tokojenisbarang j ON j.kd_jenis = b.jenis
         WHERE b.status = '0' AND (b.kode_brng LIKE ? OR b.nama_brng LIKE ?)
         ORDER BY b.kode_brng
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM tokobarang WHERE status = '0' AND (kode_brng LIKE ? OR nama_brng LIKE ?)`,
        [like, like]
    )
    return { data: rows, total: count }
}

async function nextKode() {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(RIGHT(kode_brng, 5), '[^0-9]', ''), '') AS UNSIGNED)), 0) AS mx
         FROM tokobarang`
    )
    // mysql2 balikin hasil CAST(...AS UNSIGNED) sebagai STRING (bukan number,
    // beda dari COUNT(*) biasa) — WAJIB Number() dulu, kalau tidak `mx + 1`
    // jadi concat string ("2"+1="21") bukan penjumlahan. Ketahuan lewat test
    // nyata: nextKode() berulang kali balikin kode yang sama/nyeleneh.
    return 'BT' + String(Number(mx) + 1).padStart(6, '0')
}

// Replika hitung harga jual otomatis dari tokosetharga (persentase markup).
// Tabel ini SELALU cuma 1 baris (tanpa kolom id, tanpa PK) — Java-nya hapus
// semua+insert baru tiap kali diubah, jadi cukup SELECT tanpa WHERE.
async function calcHarga(beli) {
    const db = await DatabaseService.get()
    const { rows: [setharga] } = await db.query('SELECT distributor, grosir, retail FROM tokosetharga LIMIT 1')
    if (!setharga || !beli) return { distributor: 0, grosir: 0, retail: 0 }
    const b = Number(beli)
    return {
        distributor: roundUp100(b + b * (Number(setharga.distributor) / 100)),
        grosir: roundUp100(b + b * (Number(setharga.grosir) / 100)),
        retail: roundUp100(b + b * (Number(setharga.retail) / 100)),
    }
}

// Urutan validasi SAMA Java asli.
function validate({ kode_brng, nama_brng, dasar, h_beli, distributor, grosir, retail, kode_sat, jenis }) {
    if (!kode_brng?.trim()) return 'Kode Barang tidak boleh kosong'
    if (!nama_brng?.trim()) return 'Nama Barang tidak boleh kosong'
    if (dasar === undefined || dasar === null || String(dasar).trim() === '') return 'Harga Dasar tidak boleh kosong'
    if (h_beli === undefined || h_beli === null || String(h_beli).trim() === '') return 'Harga Beli tidak boleh kosong'
    if (distributor === undefined || distributor === null || String(distributor).trim() === '') return 'Harga Distributor tidak boleh kosong'
    if (grosir === undefined || grosir === null || String(grosir).trim() === '') return 'Harga Grosir tidak boleh kosong'
    if (retail === undefined || retail === null || String(retail).trim() === '') return 'Harga Retail tidak boleh kosong'
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
            `INSERT INTO tokobarang (kode_brng, nama_brng, kode_sat, jenis, stok, dasar, h_beli, distributor, grosir, retail, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1')`,
            [data.kode_brng, data.nama_brng, data.kode_sat, data.jenis, data.stok || 0, data.dasar,
             data.h_beli, data.distributor, data.grosir, data.retail]
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
            `UPDATE tokobarang
             SET kode_brng=?, nama_brng=?, kode_sat=?, jenis=?, dasar=?, h_beli=?, distributor=?, grosir=?, retail=?
             WHERE kode_brng=?`,
            [data.kode_brng, data.nama_brng, data.kode_sat, data.jenis, data.dasar, data.h_beli,
             data.distributor, data.grosir, data.retail, oldKode]
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
    const { rows } = await db.query(`UPDATE tokobarang SET status='0' WHERE kode_brng=? AND status='1'`, [kode])
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
}

async function restore(kode) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(`UPDATE tokobarang SET status='1' WHERE kode_brng=? AND status='0'`, [kode])
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan di sampah' : undefined }
}

// Replika BtnHapus di src/restore/DlgRestoreTokoBarang.java — HAPUS PERMANEN
// (`Sequel.meghapus`, DELETE beneran), beda dari `deleteOne()` di atas yang
// cuma soft-delete. Cuma boleh dipakai ke baris yang SUDAH di sampah
// (status='0') — sama seperti aslinya, tombol ini cuma ada di dalam dialog
// "Data Sampah" yang isinya emang cuma barang non-aktif.
async function hardDelete(kode) {
    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query(`DELETE FROM tokobarang WHERE kode_brng=? AND status='0'`, [kode])
        return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan di sampah' : undefined }
    } catch (e) {
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Tidak bisa dihapus permanen — masih ada riwayat opname/transaksi yang mengacu ke barang ini' }
        }
        throw e
    }
}

export default { list, listSampah, nextKode, calcHarga, create, update, deleteOne, restore, hardDelete }
