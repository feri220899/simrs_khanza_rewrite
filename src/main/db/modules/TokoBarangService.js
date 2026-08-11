// CRUD Master Barang Toko — src/toko/TokoBarang.java.
// - Harga jual (distributor/grosir/retail) DIHITUNG OTOMATIS dari field
//   "Beli" x persentase markup di `toko_setharga` (migration 008, dipakai
//   ulang di sini) — tapi tetap bisa ditimpa manual sebelum simpan, sama
//   seperti Java asli (auto-fill, bukan lock).
// - Hapus = SOFT DELETE (`aktif=false`), bukan hard delete — ada menu
//   restore ("Data Sampah") yang di Java asli DIBATASI role "Admin Utama"
//   secara khusus (bukan cuma permission `toko_barang` biasa) — replikasi
//   lewat requirePermission + cek role Administrator di IPC (main/index.js).
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
         WHERE b.aktif = TRUE AND (b.kode_brng ILIKE $1 OR b.nama_brng ILIKE $1)
         ORDER BY ${col} ${dir}
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT count(*)::int AS count FROM tokobarang WHERE aktif = TRUE AND (kode_brng ILIKE $1 OR nama_brng ILIKE $1)`,
        [like]
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
         WHERE b.aktif = FALSE AND (b.kode_brng ILIKE $1 OR b.nama_brng ILIKE $1)
         ORDER BY b.kode_brng
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT count(*)::int AS count FROM tokobarang WHERE aktif = FALSE AND (kode_brng ILIKE $1 OR nama_brng ILIKE $1)`,
        [like]
    )
    return { data: rows, total: count }
}

async function nextKode() {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(RIGHT(kode_brng, 5), '\\D', '', 'g'), '')::int), 0) AS mx
         FROM tokobarang`
    )
    return 'BT' + String(mx + 1).padStart(6, '0')
}

// Replika hitung harga jual otomatis dari toko_setharga (persentase markup).
async function calcHarga(beli) {
    const db = await DatabaseService.get()
    const { rows: [setharga] } = await db.query('SELECT distributor, grosir, retail FROM toko_setharga WHERE id=1')
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
            `INSERT INTO tokobarang (kode_brng, nama_brng, kode_sat, jenis, stok, dasar, h_beli, distributor, grosir, retail, aktif)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE)`,
            [data.kode_brng, data.nama_brng, data.kode_sat, data.jenis, data.stok || 0, data.dasar,
             data.h_beli, data.distributor, data.grosir, data.retail]
        )
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kode_brng}" sudah dipakai` }
        if (e.code === '23503') return { success: false, message: 'Jenis Barang/Satuan yang dipilih tidak valid' }
        throw e
    }
}

async function update(oldKode, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query(
            `UPDATE tokobarang
             SET kode_brng=$1, nama_brng=$2, kode_sat=$3, jenis=$4, dasar=$5, h_beli=$6, distributor=$7, grosir=$8, retail=$9
             WHERE kode_brng=$10`,
            [data.kode_brng, data.nama_brng, data.kode_sat, data.jenis, data.dasar, data.h_beli,
             data.distributor, data.grosir, data.retail, oldKode]
        )
        if (rowCount === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kode_brng}" sudah dipakai` }
        if (e.code === '23503') return { success: false, message: 'Jenis Barang/Satuan yang dipilih tidak valid' }
        throw e
    }
}

async function deleteOne(kode) {
    const db = await DatabaseService.get()
    const { rowCount } = await db.query('UPDATE tokobarang SET aktif=FALSE WHERE kode_brng=$1 AND aktif=TRUE', [kode])
    return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan' : undefined }
}

async function restore(kode) {
    const db = await DatabaseService.get()
    const { rowCount } = await db.query('UPDATE tokobarang SET aktif=TRUE WHERE kode_brng=$1 AND aktif=FALSE', [kode])
    return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan di sampah' : undefined }
}

// Replika BtnHapus di src/restore/DlgRestoreTokoBarang.java — HAPUS PERMANEN
// (`Sequel.meghapus`, DELETE beneran), beda dari `deleteOne()` di atas yang
// cuma soft-delete. Cuma boleh dipakai ke baris yang SUDAH di sampah
// (aktif=FALSE) — sama seperti aslinya, tombol ini cuma ada di dalam dialog
// "Data Sampah" yang isinya emang cuma barang non-aktif.
async function hardDelete(kode) {
    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query('DELETE FROM tokobarang WHERE kode_brng=$1 AND aktif=FALSE', [kode])
        return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan di sampah' : undefined }
    } catch (e) {
        if (e.code === '23503') return { success: false, message: 'Tidak bisa dihapus permanen — masih ada riwayat opname/transaksi yang mengacu ke barang ini' }
        throw e
    }
}

export default { list, listSampah, nextKode, calcHarga, create, update, deleteOne, restore, hardDelete }
