// Stok Opname Toko — src/toko/TokoInputStok.java (input) & TokoStokOpname.java
// (viewer/hapus) & riwayattoko.java (catat riwayat, posisi="Opname").
// TIDAK menyentuh jurnal Keuangan (dikonfirmasi dari investigasi) — makanya
// aman dibangun sekarang meski modul Penjualan/Pembelian/dst ditunda.
//
// KOREKSI PENTING (hasil audit ulang — versi sebelumnya SALAH di 2 hal):
// 1. Alur asli itu BATCH — satu layar nampilin SEMUA barang aktif sekaligus,
//    user isi kolom "Real" utk banyak baris, SATU tombol Simpan proses semua
//    baris terisi dalam SATU transaksi (kalau satu baris gagal, semua di-
//    rollback — lihat `TokoInputStok.BtnSimpanActionPerformed`, variabel
//    `sukses`). Versi sebelumnya cuma bisa 1 barang per submit — bukan cuma
//    beda UI, itu beda ALUR KERJA (opname toko biasanya puluhan-ratusan item
//    sekaligus).
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
// TokoInputStok.java (`select ... where tokobarang.status='1' and (...)`),
// TIDAK dipaginasi (aslinya nampilin semua sekaligus, difilter search saja).
async function listBarangUntukOpname({ search = '' } = {}) {
    const db = await DatabaseService.get()
    const like = `%${search}%`
    const { rows } = await db.query(
        `SELECT b.kode_brng, b.nama_brng, j.nm_jenis, b.kode_sat, b.dasar, b.stok
         FROM tokobarang b
         JOIN tokojenisbarang j ON j.kd_jenis = b.jenis
         WHERE b.aktif = TRUE
           AND ($1 = '' OR b.kode_brng ILIKE $2 OR b.nama_brng ILIKE $2 OR b.kode_sat ILIKE $2 OR j.nm_jenis ILIKE $2)
         ORDER BY b.nama_brng`,
        [search, like]
    )
    return rows
}

async function listOpname({ page = 1, pageSize = 10, sortOrder = 'desc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT o.kode_brng, b.nama_brng, o.tanggal, o.dasar, o.stok, o.real, o.selisih,
                (o.real * o.dasar) AS totalreal, o.nomihilang, o.keterangan
         FROM tokoopname o
         JOIN tokobarang b ON b.kode_brng = o.kode_brng
         WHERE b.nama_brng ILIKE $1 OR o.keterangan ILIKE $1
         ORDER BY o.tanggal ${dir}
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT count(*)::int AS count FROM tokoopname o JOIN tokobarang b ON b.kode_brng = o.kode_brng
         WHERE b.nama_brng ILIKE $1 OR o.keterangan ILIKE $1`,
        [like]
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
        await client.query('BEGIN')
        let diproses = 0
        for (const item of terisi) {
            const real = Number(item.real)
            if (Number.isNaN(real) || real < 0) continue // replika: Valid.SetAngka(...)>=0

            const { rows: [barang] } = await client.query('SELECT stok, dasar FROM tokobarang WHERE kode_brng=$1 FOR UPDATE', [item.kode_brng])
            if (!barang) throw new Error(`Barang ${item.kode_brng} tidak ditemukan`)

            const stokAwal = Number(barang.stok)
            const kurang = stokAwal - real
            const selisih = kurang > 0 ? kurang : 0
            const nomihilang = kurang > 0 ? kurang * Number(barang.dasar) : 0

            await client.query(
                `INSERT INTO tokoopname (kode_brng, tanggal, dasar, stok, real, selisih, nomihilang, keterangan)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [item.kode_brng, tanggal, barang.dasar, stokAwal, real, selisih, nomihilang, keterangan]
            )
            await client.query(
                `INSERT INTO toko_riwayat_barang (kode_brng, stok_awal, masuk, keluar, stok_akhir, posisi, tanggal, jam, petugas, status)
                 VALUES ($1,$2,$3,0,$4,'Opname',CURRENT_DATE,CURRENT_TIME,$5,'Simpan')`,
                [item.kode_brng, stokAwal, real, real, petugas || null]
            )
            await client.query('UPDATE tokobarang SET stok=$1 WHERE kode_brng=$2', [real, item.kode_brng])
            diproses++
        }
        await client.query('COMMIT')
        return { success: true, diproses }
    } catch (e) {
        await client.query('ROLLBACK')
        if (e.code === '23505') {
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
    const { rowCount } = await db.query('DELETE FROM tokoopname WHERE tanggal=$1 AND kode_brng=$2', [tanggal, kode_brng])
    return { success: rowCount > 0, message: rowCount === 0 ? 'Data tidak ditemukan' : undefined }
}

// src/toko/TokoRiwayatBarang.java — viewer read-only.
async function listRiwayat({ page = 1, pageSize = 10, sortOrder = 'desc', search = '', tgl1 = '', tgl2 = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const like = `%${search}%`
    const where = ['b.nama_brng ILIKE $1']
    const params = [like]
    if (tgl1 && tgl2) { params.push(tgl1, tgl2); where.push(`r.tanggal BETWEEN $${params.length - 1} AND $${params.length}`) }

    const { rows } = await db.query(
        `SELECT r.*, b.nama_brng
         FROM toko_riwayat_barang r
         JOIN tokobarang b ON b.kode_brng = r.kode_brng
         WHERE ${where.join(' AND ')}
         ORDER BY r.tanggal ${dir}, r.jam ${dir}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT count(*)::int AS count FROM toko_riwayat_barang r JOIN tokobarang b ON b.kode_brng = r.kode_brng WHERE ${where.join(' AND ')}`,
        params
    )
    return { data: rows, total: count }
}

export default { listBarangUntukOpname, listOpname, createOpnameBatch, deleteOpname, listRiwayat }
