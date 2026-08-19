// Riwayat Barang IPSRS — src/ipsrs/IPSRSRiwayatBarang.java (viewer
// read-only) + src/ipsrs/riwayatnonmedis.java (`catatRiwayat`, dipanggil
// modul lain yang mengubah stok). Tabel ASLI sik.sql
// `ipsrs_riwayat_barang(kode_brng, stok_awal, masuk, keluar, stok_akhir,
// posisi enum('Pengadaan','Penerimaan','Retur Beli','Opname','Stok Keluar',
// 'Pengambilan UTD','Hibah'), tanggal, jam, petugas, status
// enum('Simpan','Hapus'))`.
//
// KHUSUS posisi='Opname': `masuk`=nilai Real hasil opname (BUKAN kuantitas
// barang masuk beneran) DAN `stok_akhir`=nilai Real juga (BUKAN
// stok_awal+masuk-keluar seperti posisi transaksi lain) — replika persis
// `riwayatnonmedis.catatRiwayat()` baris 48-57 (field "dipinjam" maknanya
// khusus utk opname). Posisi lain (Pengadaan/Penerimaan/dst — SEMUA milik
// modul yang ditunda ke Fase 3) pakai rumus stok_akhir = stok_awal+masuk-keluar.
import DatabaseService from '../../DatabaseService.js'

async function catatRiwayat(client, { kode_brng, masuk = 0, keluar = 0, posisi, petugas, status = 'Simpan' }) {
    const { rows: [barang] } = await client.query('SELECT stok FROM ipsrsbarang WHERE kode_brng=?', [kode_brng])
    const stokAwal = barang ? Number(barang.stok) : 0
    const stokAkhir = posisi === 'Opname' ? masuk : stokAwal + masuk - keluar

    await client.query(
        `INSERT INTO ipsrs_riwayat_barang (kode_brng, stok_awal, masuk, keluar, stok_akhir, posisi, tanggal, jam, petugas, status)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_DATE, CURRENT_TIME, ?, ?)`,
        [kode_brng, stokAwal, masuk, posisi === 'Opname' ? 0 : keluar, stokAkhir, posisi, petugas || null, status]
    )
    return stokAkhir
}

// src/ipsrs/IPSRSRiwayatBarang.java — viewer read-only.
async function list({ page = 1, pageSize = 10, sortOrder = 'desc', search = '', tgl1 = '', tgl2 = '', kode_brng = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const like = `%${search}%`
    const where = ['(b.nama_brng LIKE ? OR r.kode_brng LIKE ? OR r.petugas LIKE ? OR r.status LIKE ?)']
    const params = [like, like, like, like]
    if (tgl1 && tgl2) { where.push('r.tanggal BETWEEN ? AND ?'); params.push(tgl1, tgl2) }
    if (kode_brng) { where.push('r.kode_brng = ?'); params.push(kode_brng) }

    const { rows } = await db.query(
        `SELECT r.*, b.nama_brng
         FROM ipsrs_riwayat_barang r
         JOIN ipsrsbarang b ON b.kode_brng = r.kode_brng
         WHERE ${where.join(' AND ')}
         ORDER BY r.tanggal ${dir}, r.jam ${dir}
         LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM ipsrs_riwayat_barang r JOIN ipsrsbarang b ON b.kode_brng = r.kode_brng WHERE ${where.join(' AND ')}`,
        params
    )
    return { data: rows, total: count }
}

export default { catatRiwayat, list }
