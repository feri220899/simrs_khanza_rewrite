// CRUD Parkir — ditelusuri persis dari kode Java asli sesuai SOP di Khanza.md:
//   - src/parkir/DlgParkirJenis.java   -> jenis & tarif parkir
//   - src/parkir/DlgParkirBarcode.java -> kartu/barcode parkir
//   - src/parkir/DlgParkirMasuk.java   -> TERBUKTI tidak simpan apa pun ke DB
//     (cuma lookup tarif + cetak karcis), jadi TIDAK ADA fungsi createMasuk()
//     di sini — itu bukan kelalaian, itu memang bukan CRUD di aslinya.
import DatabaseService from '../DatabaseService.js'

// ── Jenis & Tarif (DlgParkirJenis.java) ─────────────────────────────────────

// Kontrak {page,pageSize,sortBy,sortOrder,search} -> {data,total} ini WAJIB
// buat semua list ke depan — biar cocok langsung sama `useServerTable` di
// renderer (lihat Khanza.md > "Konvensi UI"), bukan koleksi ad-hoc per modul.
// `sortBy` di-whitelist lewat lookup object (bukan langsung ditempel ke SQL)
// supaya tidak ada celah SQL injection dari nama kolom.
const JENIS_SORTABLE = { kd_parkir: 'kd_parkir', jns_parkir: 'jns_parkir', biaya: 'biaya', jenis: 'jenis' }

async function listJenis({ page = 1, pageSize = 10, sortBy = 'kd_parkir', sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const col = JENIS_SORTABLE[sortBy] || 'kd_parkir'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT kd_parkir, jns_parkir, biaya, jenis FROM parkir_jenis
         WHERE kd_parkir ILIKE $1 OR jns_parkir ILIKE $1
         ORDER BY ${col} ${dir}
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT count(*)::int AS count FROM parkir_jenis WHERE kd_parkir ILIKE $1 OR jns_parkir ILIKE $1',
        [like]
    )
    return { data: rows, total: count }
}

// Replika Valid.autoNomer(tabMode, "P", 4, TKd) di Java: "P" + (jumlah baris
// saat ini + 1), padding 4 digit. Skema sederhana ini SAMA PERSIS dgn
// aslinya (bukan cari celah nomor yang kehapus) — replikasi apa adanya.
async function nextJenisKode() {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT count(*)::int AS n FROM parkir_jenis')
    return 'P' + String(rows[0].n + 1).padStart(4, '0')
}

function validateJenis({ kd_parkir, jns_parkir, biaya, jenis }) {
    // Urutan pengecekan SAMA seperti BtnSimpanActionPerformed asli (kode -> nama -> biaya)
    if (!kd_parkir?.trim()) return 'ID Jenis tidak boleh kosong'
    if (!jns_parkir?.trim()) return 'Jenis Parkir tidak boleh kosong'
    if (biaya === undefined || biaya === null || String(biaya).trim() === '') return 'Biaya tidak boleh kosong'
    if (!['Harian', 'Jam'].includes(jenis)) return 'Sistem harus "Harian" atau "Jam"'
    return null
}

async function createJenis(data) {
    const err = validateJenis(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO parkir_jenis (kd_parkir, jns_parkir, biaya, jenis) VALUES ($1, $2, $3, $4)',
            [data.kd_parkir, data.jns_parkir, data.biaya, data.jenis]
        )
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kd_parkir}" sudah dipakai` }
        throw e
    }
}

// `oldKode` = kd_parkir ASLI (dari baris yang dipilih user) — bukan dari form,
// karena di Java asli kode itu sendiri bisa DIGANTI (rename) saat edit; WHERE
// clause-nya pakai kode lama, SET-nya pakai semua field termasuk kode baru.
async function updateJenis(oldKode, data) {
    const err = validateJenis(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query(
            'UPDATE parkir_jenis SET kd_parkir=$1, jns_parkir=$2, biaya=$3, jenis=$4 WHERE kd_parkir=$5',
            [data.kd_parkir, data.jns_parkir, data.biaya, data.jenis, oldKode]
        )
        if (rowCount === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode "${data.kd_parkir}" sudah dipakai` }
        throw e
    }
}

async function deleteJenis(kode) {
    const db = await DatabaseService.get()
    const { rowCount } = await db.query('DELETE FROM parkir_jenis WHERE kd_parkir=$1', [kode])
    return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan' : undefined }
}

// ── Kartu / Barcode (DlgParkirBarcode.java) ─────────────────────────────────

const BARCODE_SORTABLE = { kode_barcode: 'kode_barcode', nomer_kartu: 'nomer_kartu' }

async function listBarcode({ page = 1, pageSize = 10, sortBy = 'kode_barcode', sortOrder = 'asc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const col = BARCODE_SORTABLE[sortBy] || 'kode_barcode'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT kode_barcode, nomer_kartu FROM parkir_barcode
         WHERE kode_barcode ILIKE $1 OR nomer_kartu ILIKE $1
         ORDER BY ${col} ${dir}
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        'SELECT count(*)::int AS count FROM parkir_barcode WHERE kode_barcode ILIKE $1 OR nomer_kartu ILIKE $1',
        [like]
    )
    return { data: rows, total: count }
}

async function cekBarcode(kodeBarcode) {
    const db = await DatabaseService.get()
    const { rows: [row] } = await db.query(
        'SELECT nomer_kartu FROM parkir_barcode WHERE kode_barcode = $1',
        [kodeBarcode]
    )
    return row || null
}

// Replika Valid.autoNomer(tabMode, "K", 4, nomer_kartu) — beda dari Jenis:
// yang di-auto-suggest itu NOMOR KARTU, bukan kode barcode (kode barcode
// dikosongkan, dimaksudkan diisi manual/hasil scan alat).
async function nextKartuNomor() {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT count(*)::int AS n FROM parkir_barcode')
    return 'K' + String(rows[0].n + 1).padStart(4, '0')
}

function validateBarcode({ kode_barcode, nomer_kartu }) {
    if (!kode_barcode?.trim()) return 'Kode Barcode tidak boleh kosong'
    if (!nomer_kartu?.trim()) return 'Nomer Kartu tidak boleh kosong'
    return null
}

async function createBarcode(data) {
    const err = validateBarcode(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO parkir_barcode (kode_barcode, nomer_kartu) VALUES ($1, $2)',
            [data.kode_barcode, data.nomer_kartu]
        )
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode barcode "${data.kode_barcode}" sudah dipakai` }
        throw e
    }
}

async function updateBarcode(oldKode, data) {
    const err = validateBarcode(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query(
            'UPDATE parkir_barcode SET kode_barcode=$1, nomer_kartu=$2 WHERE kode_barcode=$3',
            [data.kode_barcode, data.nomer_kartu, oldKode]
        )
        if (rowCount === 0) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus)' }
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: `Kode barcode "${data.kode_barcode}" sudah dipakai` }
        throw e
    }
}

async function deleteBarcode(kode) {
    const db = await DatabaseService.get()
    const { rowCount } = await db.query('DELETE FROM parkir_barcode WHERE kode_barcode=$1', [kode])
    return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan' : undefined }
}

export default {
    listJenis, nextJenisKode, createJenis, updateJenis, deleteJenis,
    listBarcode, cekBarcode, nextKartuNomor, createBarcode, updateBarcode, deleteBarcode,
}
