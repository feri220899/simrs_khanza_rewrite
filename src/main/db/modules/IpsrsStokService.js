// Stok Opname IPSRS — src/ipsrs/IPSRSInputStok.java (input) & IPSRSStokOpname
// .java (viewer/hapus) & riwayatnonmedis.java (catatRiwayat, posisi="Opname").
// TIDAK menyentuh jurnal Keuangan (dikonfirmasi dari investigasi — beda dari
// modul transaksi lain yang ditunda ke Fase 3).
//
// Tabel ASLI sik.sql:
// - `ipsrsbarang.status` enum('0','1').
// - `ipsrsopname(kode_brng, h_beli, tanggal, stok, real, selisih, nomihilang,
//   lebih, nomilebih, keterangan)`, PK KOMPOSIT (kode_brng, tanggal) —
//   urutan kolom INSERT dikonfirmasi dari IPSRSInputStok.java baris 692
//   (positional `Sequel.menyimpantf2`, urutan HARUS persis).
// - `real` KATA KUNCI RESERVED MySQL — WAJIB di-backtick.
//
// BEDA dari TokoOpnameService.js (yang cuma catat KEKURANGAN): IPSRS catat
// DUA ARAH — kurang (`selisih`/`nomihilang`) DAN lebih (`lebih`/`nomilebih`)
// — replika persis `IPSRSInputStok.getData()` baris 1132-1172:
//   kurang = stok_sistem - real
//   kurang>0 -> selisih=kurang, nomihilang=kurang*harga, lebih=0, nomilebih=0
//   kurang<=0 -> selisih=0, nomihilang=0, lebih=-kurang, nomilebih=-kurang*harga
// Efek "Opname" itu OVERWRITE stok (bukan tambah/kurang) — stok_akhir riwayat
// = nilai "Real", ipsrsbarang.stok ditimpa langsung ke nilai itu.
import DatabaseService from '../DatabaseService.js'
import IpsrsRiwayatService from './IpsrsRiwayatService.js'

// Replika 2 query kombo Java (ppBelumOpname vs default) — `belumOpname=true`
// sembunyikan barang yang sudah di-opname pada tanggal yang sama (replika
// `where kode_brng not in (select kode_brng from ipsrsopname where tanggal=?)`).
async function listBarangUntukOpname({ tanggal, search = '', belumOpname = false } = {}) {
    const db = await DatabaseService.get()
    const like = `%${search}%`
    const filterOpname = belumOpname && tanggal
        ? 'AND b.kode_brng NOT IN (SELECT kode_brng FROM ipsrsopname WHERE tanggal = ?)'
        : ''
    const params = belumOpname && tanggal
        ? [tanggal, like, like, like, like]
        : [like, like, like, like]

    const { rows } = await db.query(
        `SELECT b.kode_brng, b.nama_brng, j.nm_jenis, b.kode_sat, b.harga, b.stok
         FROM ipsrsbarang b
         JOIN ipsrsjenisbarang j ON j.kd_jenis = b.jenis
         WHERE b.status = '1' ${filterOpname}
           AND (b.kode_brng LIKE ? OR b.nama_brng LIKE ? OR b.kode_sat LIKE ? OR j.nm_jenis LIKE ?)
         ORDER BY b.nama_brng`,
        params
    )
    return rows
}

async function listOpname({ page = 1, pageSize = 10, sortOrder = 'desc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT o.kode_brng, b.nama_brng, o.tanggal, o.h_beli, o.stok, o.\`real\`, o.selisih,
                o.nomihilang, o.lebih, o.nomilebih, o.keterangan
         FROM ipsrsopname o
         JOIN ipsrsbarang b ON b.kode_brng = o.kode_brng
         WHERE b.nama_brng LIKE ? OR o.keterangan LIKE ?
         ORDER BY o.tanggal ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM ipsrsopname o JOIN ipsrsbarang b ON b.kode_brng = o.kode_brng
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
            if (Number.isNaN(real) || real < 0) continue // replika: Double.parseDouble(...)>=0

            const { rows: [barang] } = await client.query('SELECT stok, harga FROM ipsrsbarang WHERE kode_brng=? FOR UPDATE', [item.kode_brng])
            if (!barang) throw new Error(`Barang ${item.kode_brng} tidak ditemukan`)

            const stokAwal = Number(barang.stok)
            const harga = Number(barang.harga)
            const kurang = stokAwal - real
            const selisih = kurang > 0 ? kurang : 0
            const lebih = kurang > 0 ? 0 : -kurang
            const nomihilang = kurang > 0 ? kurang * harga : 0
            const nomilebih = kurang > 0 ? 0 : -kurang * harga

            await client.query(
                `INSERT INTO ipsrsopname (kode_brng, h_beli, tanggal, stok, \`real\`, selisih, nomihilang, lebih, nomilebih, keterangan)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [item.kode_brng, harga, tanggal, stokAwal, real, selisih, nomihilang, lebih, nomilebih, keterangan]
            )
            // riwayatnonmedis.catatRiwayat(kodebarang, real, 0, "Opname", petugas, "Simpan")
            // — DIPANGGIL SEBELUM UPDATE stok ipsrsbarang, supaya stok_awal
            // riwayat kebaca nilai LAMA (replika urutan persis Java asli).
            await IpsrsRiwayatService.catatRiwayat(client, {
                kode_brng: item.kode_brng, masuk: real, keluar: 0, posisi: 'Opname', petugas, status: 'Simpan',
            })
            await client.query('UPDATE ipsrsbarang SET stok=? WHERE kode_brng=?', [real, item.kode_brng])
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

// Replika persis src/ipsrs/IPSRSStokOpname.java: hapus baris opname TIDAK
// mengembalikan stok (opname itu overwrite/snapshot, bukan pergerakan yang
// bisa "dibalik" secara aritmatik) DAN TIDAK mencatat riwayat 'Hapus' —
// KONSISTEN dengan preseden TokoOpnameService.deleteOpname() yang sudah
// diaudit & diputuskan sebagai perilaku BENAR (bukan bug), bukan diperbaiki
// beda sendiri di sini demi konsistensi lintas modul.
async function deleteOpname({ tanggal, kode_brng }) {
    const db = await DatabaseService.get()
    const { rows } = await db.query('DELETE FROM ipsrsopname WHERE tanggal=? AND kode_brng=?', [tanggal, kode_brng])
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
}

export default { listBarangUntukOpname, listOpname, createOpnameBatch, deleteOpname }
