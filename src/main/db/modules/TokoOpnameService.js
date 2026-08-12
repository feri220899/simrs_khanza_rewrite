// Stok Opname Toko — src/toko/TokoInputStok.java (input) & TokoStokOpname.java
// (viewer/hapus) & riwayattoko.java (catatRiwayat, posisi="Opname"). TIDAK
// menyentuh jurnal Keuangan (dikonfirmasi dari investigasi).
//
// Tabel ASLI sik.sql (BUKAN hasil migration Postgres yang sudah dibuang):
// - `tokobarang.status` enum('0','1') — '1'=aktif, BUKAN kolom `aktif` BOOLEAN.
// - `tokoopname(kode_brng, dasar, tanggal, stok, real, selisih, nomihilang,
//   keterangan)`, PK KOMPOSIT (kode_brng, tanggal) — urutan kolom INSERT
//   dikonfirmasi dari TokoInputStok.java baris 475 (positional
//   `Sequel.menyimpantf2`, urutan HARUS persis: kode_brng, dasar, tanggal,
//   stok, real, selisih, nomihilang, keterangan).
// - `toko_riwayat_barang(kode_brng, stok_awal, masuk, keluar, stok_akhir,
//   posisi, tanggal, jam, petugas, status)` — dikonfirmasi dari
//   riwayattoko.catatRiwayat(): KHUSUS posisi='Opname', `masuk`=nilai Real
//   (BUKAN kuantitas barang masuk beneran), `keluar`=0 hardcode, DAN
//   `stok_akhir`=nilai Real juga (BUKAN stok_awal+masuk-keluar seperti
//   posisi transaksi lain) — field `masuk`/`stok_akhir` di-"pinjam" maknanya
//   khusus utk opname karena tabel riwayat ini dipakai bareng banyak jenis
//   transaksi (Pengadaan/Penjualan/Retur/dst, lihat enum `posisi`).
// - `real` itu KATA KUNCI RESERVED MySQL (sinonim tipe DOUBLE/FLOAT) — WAJIB
//   di-backtick tiap dipakai sebagai nama kolom, beda dari Postgres yang
//   tidak mempermasalahkan ini.
//
// KOREKSI PENTING dari audit sebelumnya (logic bisnis di bawah SUDAH BENAR,
// cuma dialect+skema yang perlu disesuaikan ke MySQL — lihat Khanza.md >
// "Prinsip Migrasi Data"):
// 1. Alur asli itu BATCH — satu layar nampilin SEMUA barang aktif sekaligus,
//    user isi kolom "Real" utk banyak baris, SATU tombol Simpan proses semua
//    baris terisi dalam SATU transaksi (kalau satu baris gagal, semua di-
//    rollback — lihat `TokoInputStok.BtnSimpanActionPerformed`, variabel
//    `sukses`).
// 2. `selisih` & `nomihilang` DIHITUNG OTOMATIS, bukan diisi manual, dan
//    `selisih` cuma mencatat KEKURANGAN (tidak pernah negatif) — replika
//    persis `TokoInputStok.getData()`:
//      kurang     = stok_sistem - real
//      selisih    = kurang>0 ? kurang : 0
//      nomihilang = kurang>0 ? kurang * harga : 0   (harga = tokobarang.dasar,
//                   sesuai fallback default `koneksiDB.HPPTOKO()` di Java asli
//                   kalau setting instalasi tidak ada — HPPTOKO/database.xml
//                   sendiri tidak kita replikasi, luar cakupan rewrite ini)
// Efek "Opname" itu OVERWRITE stok (bukan tambah/kurang seperti transaksi
// lain) — stok_akhir riwayat = nilai "Real" hasil hitung fisik langsung,
// begitu juga tokobarang.stok ditimpa langsung ke nilai itu.
import DatabaseService from '../DatabaseService.js'

// Daftar SEMUA barang aktif buat layar batch-entry — replika query utama
// TokoInputStok.java (`select ... where tokobarang.status='1' and (...) order
// by tokobarang.nama_brng`), TIDAK dipaginasi (aslinya nampilin semua
// sekaligus, difilter search saja).
async function listBarangUntukOpname({ search = '' } = {}) {
    const db = await DatabaseService.get()
    const like = `%${search}%`
    const { rows } = await db.query(
        `SELECT b.kode_brng, b.nama_brng, j.nm_jenis, b.kode_sat, b.dasar, b.stok
         FROM tokobarang b
         JOIN tokojenisbarang j ON j.kd_jenis = b.jenis
         WHERE b.status = '1'
           AND (? = '' OR b.kode_brng LIKE ? OR b.nama_brng LIKE ? OR b.kode_sat LIKE ? OR j.nm_jenis LIKE ?)
         ORDER BY b.nama_brng`,
        [search, like, like, like, like]
    )
    return rows
}

async function listOpname({ page = 1, pageSize = 10, sortOrder = 'desc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT o.kode_brng, b.nama_brng, o.tanggal, o.dasar, o.stok, o.\`real\`, o.selisih,
                (o.\`real\` * o.dasar) AS totalreal, o.nomihilang, o.keterangan
         FROM tokoopname o
         JOIN tokobarang b ON b.kode_brng = o.kode_brng
         WHERE b.nama_brng LIKE ? OR o.keterangan LIKE ?
         ORDER BY o.tanggal ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM tokoopname o JOIN tokobarang b ON b.kode_brng = o.kode_brng
         WHERE b.nama_brng LIKE ? OR o.keterangan LIKE ?`,
        [like, like]
    )
    return { data: rows, total: count }
}

// Replika BtnSimpanActionPerformed: Keterangan kosong -> "data kosong" kalau
// tidak ada satupun baris terisi -> proses SEMUA baris terisi dalam SATU
// transaksi, batal semua kalau ada satu yang gagal.
async function createOpnameBatch({ tanggal, keterangan, items, petugas }) {
    if (!keterangan?.trim()) return { success: false, message: 'Keterangan tidak boleh kosong' }
    if (!tanggal) return { success: false, message: 'Tanggal tidak boleh kosong' }

    const terisi = (items || []).filter(it => it.real !== undefined && it.real !== null && String(it.real).trim() !== '')
    if (terisi.length === 0) return { success: false, message: 'Maaf, data kosong' }

    const db = await DatabaseService.get()
    const client = await db.connect()
    try {
        await client.query('START TRANSACTION')
        let diproses = 0
        for (const item of terisi) {
            const real = Number(item.real)
            if (Number.isNaN(real) || real < 0) continue // replika: Valid.SetAngka(...)>=0

            const { rows: [barang] } = await client.query('SELECT stok, dasar FROM tokobarang WHERE kode_brng=? FOR UPDATE', [item.kode_brng])
            if (!barang) throw new Error(`Barang ${item.kode_brng} tidak ditemukan`)

            const stokAwal = Number(barang.stok)
            const kurang = stokAwal - real
            const selisih = kurang > 0 ? kurang : 0
            const nomihilang = kurang > 0 ? kurang * Number(barang.dasar) : 0

            await client.query(
                `INSERT INTO tokoopname (kode_brng, dasar, tanggal, stok, \`real\`, selisih, nomihilang, keterangan)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [item.kode_brng, barang.dasar, tanggal, stokAwal, real, selisih, nomihilang, keterangan]
            )
            // riwayattoko.catatRiwayat(kodebarang, real, 0, "Opname", petugas, "Simpan")
            // — utk posisi Opname, masuk=real DAN stok_akhir=real (bukan
            // stok_awal+masuk-keluar), lihat catatan panjang di atas.
            await client.query(
                `INSERT INTO toko_riwayat_barang (kode_brng, stok_awal, masuk, keluar, stok_akhir, posisi, tanggal, jam, petugas, status)
                 VALUES (?, ?, ?, 0, ?, 'Opname', CURRENT_DATE, CURRENT_TIME, ?, 'Simpan')`,
                [item.kode_brng, stokAwal, real, real, petugas || null]
            )
            await client.query('UPDATE tokobarang SET stok=? WHERE kode_brng=?', [real, item.kode_brng])
            diproses++
        }
        await client.query('COMMIT')
        return { success: true, diproses }
    } catch (e) {
        await client.query('ROLLBACK')
        if (e.code === 'ER_DUP_ENTRY') {
            return { success: false, message: 'Terjadi kesalahan saat pemrosesan data, transaksi dibatalkan — ada barang yang sudah di-opname pada tanggal ini' }
        }
        return { success: false, message: 'Terjadi kesalahan saat pemrosesan data, transaksi dibatalkan. Periksa kembali data sebelum melanjutkan menyimpan.' }
    } finally {
        client.release()
    }
}

// Replika persis: hapus baris opname TIDAK mengembalikan stok (opname itu
// overwrite, bukan pergerakan yang bisa "dibalik" secara aritmatik).
async function deleteOpname({ tanggal, kode_brng }) {
    const db = await DatabaseService.get()
    const { rows } = await db.query('DELETE FROM tokoopname WHERE tanggal=? AND kode_brng=?', [tanggal, kode_brng])
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
}

// src/toko/TokoRiwayatBarang.java — viewer read-only.
async function listRiwayat({ page = 1, pageSize = 10, sortOrder = 'desc', search = '', tgl1 = '', tgl2 = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const like = `%${search}%`
    const where = ['b.nama_brng LIKE ?']
    const params = [like]
    if (tgl1 && tgl2) { where.push('r.tanggal BETWEEN ? AND ?'); params.push(tgl1, tgl2) }

    const { rows } = await db.query(
        `SELECT r.*, b.nama_brng
         FROM toko_riwayat_barang r
         JOIN tokobarang b ON b.kode_brng = r.kode_brng
         WHERE ${where.join(' AND ')}
         ORDER BY r.tanggal ${dir}, r.jam ${dir}
         LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM toko_riwayat_barang r JOIN tokobarang b ON b.kode_brng = r.kode_brng WHERE ${where.join(' AND ')}`,
        params
    )
    return { data: rows, total: count }
}

export default { listBarangUntukOpname, listOpname, createOpnameBatch, deleteOpname, listRiwayat }
