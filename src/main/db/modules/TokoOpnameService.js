// Stok Opname Toko — src/toko/TokoInputStok.java (input) & TokoStokOpname.java
// (viewer/hapus) & riwayattoko.java (catat riwayat, posisi="Opname").
// TIDAK menyentuh jurnal Keuangan (dikonfirmasi dari investigasi) — makanya
// aman dibangun sekarang meski modul Penjualan/Pembelian/dst ditunda.
//
// Efek "Opname" itu OVERWRITE stok (bukan tambah/kurang seperti transaksi
// lain) — stok_akhir riwayat = nilai "Real" hasil hitung fisik langsung,
// begitu juga tokobarang.stok ditimpa langsung ke nilai itu.
import DatabaseService from '../DatabaseService.js'

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

function validate({ kode_brng, tanggal, real, keterangan }) {
    if (!kode_brng?.trim()) return 'Barang tidak boleh kosong'
    if (!tanggal) return 'Tanggal tidak boleh kosong'
    if (real === undefined || real === null || String(real).trim() === '') return 'Stok Real (hasil hitung fisik) tidak boleh kosong'
    if (!keterangan?.trim()) return 'Keterangan tidak boleh kosong'
    return null
}

async function createOpname(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    const { rows: [barang] } = await db.query('SELECT stok, dasar FROM tokobarang WHERE kode_brng=$1', [data.kode_brng])
    if (!barang) return { success: false, message: 'Barang tidak ditemukan' }

    const stokAwal = Number(barang.stok)
    const real = Number(data.real)
    const selisih = real - stokAwal

    const client = await db.connect()
    try {
        await client.query('BEGIN')
        await client.query(
            `INSERT INTO tokoopname (kode_brng, tanggal, dasar, stok, real, selisih, nomihilang, keterangan)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [data.kode_brng, data.tanggal, barang.dasar, stokAwal, real, selisih, data.nomihilang || null, data.keterangan]
        )
        await client.query(
            `INSERT INTO toko_riwayat_barang (kode_brng, stok_awal, masuk, keluar, stok_akhir, posisi, tanggal, jam, petugas, status)
             VALUES ($1,$2,$3,0,$4,'Opname',CURRENT_DATE,CURRENT_TIME,$5,'Simpan')`,
            [data.kode_brng, stokAwal, real, real, data.petugas || null]
        )
        await client.query('UPDATE tokobarang SET stok=$1 WHERE kode_brng=$2', [real, data.kode_brng])
        await client.query('COMMIT')
        return { success: true }
    } catch (e) {
        await client.query('ROLLBACK')
        if (e.code === '23505') return { success: false, message: 'Barang ini sudah di-opname pada tanggal tersebut' }
        throw e
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

export default { listOpname, createOpname, deleteOpname, listRiwayat }
