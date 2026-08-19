// Penerimaan Barang Non Medis (kredit/hutang) — src/ipsrs/IPSRSPemesanan.java
// (nama class menyesatkan: ini BUKAN "pemesanan", tapi form PENERIMAAN barang
// dari suplier, dipicu dari menu "Penerimaan Barang Non Medis" ATAU dari
// Surat Pemesanan yang ditandai "Sudah Datang" — lihat IpsrsSuratPemesananService.js
// catatan header, yang menunda modul ini ke "Fase 3").
//
// Tabel ASLI sik.sql:
// - `ipsrspemesanan(no_faktur PK, no_order, kode_suplier, nip, tgl_pesan,
//   tgl_faktur, tgl_tempo, total1, potongan, total2, ppn, meterai, tagihan,
//   status enum(...))` — status HARDCODE 'Belum Dibayar' saat create (replika
//   BtnSimpanActionPerformed baris 712-716). `nip` FK ke `petugas.nip` (BEDA
//   dari `surat_pemesanan_non_medis.nip` yang FK ke `pegawai.nik`!) — jadi
//   TIDAK BOLEH pakai `authStore.user.username` (pola itu sudah terbukti
//   salah 2x sesi ini, lihat KeuanganPengeluaranHarianService.js /
//   PerpustakaanSirkulasiService.js) — WAJIB dropdown petugas eksplisit.
// - `ipsrsdetailpesan(no_faktur, kode_brng, kode_sat, jumlah, harga,
//   subtotal, dis, besardis, total)` — urutan kolom dikonfirmasi baris 718-721.
//
// No.Faktur AUTO-GENERATE (Valid.autoNomer3, baris 1384-1385): prefix
// "PNM"+yyyyMMdd(dari Tgl Pesan)+3 digit urut, reset per tanggal — BUKAN
// nomor faktur asli dari suplier walau labelnya "No.Faktur" (penamaan Java
// asli, dipertahankan apa adanya).
//
// UX grid barang: Java dump SELURUH katalog ipsrsbarang aktif ke grid
// (qty=0, user isi manual per baris yang diterima) — di sini diganti pola
// search-and-add-row yang sudah konsisten dipakai semua modul baru sesi ini
// (Surat Pemesanan, Pengeluaran Harian, dst). Deviasi UX disengaja, BUKAN
// pengurangan fitur — validasi "wajib >=1 baris qty>0" tetap direplikasi.
//
// PPN: getData() Java (dipanggil di akhir SETIAP alur, termasuk prefill PO)
// SELALU menghitung ulang ppn = ROUND(tppn% * ttl) dari field persen (default
// "11", field bebas), jadi nilai `ppn` yang sempat di-copy dari PO saat
// prefill (tampil(String noorder)) langsung TERTIMPA sebelum sempat dipakai
// — replikanya cukup 1 mode PPN persen (bukan 2 mode beda utk standalone vs
// PO-prefill). `meterai` BEDA — itu tetap field text yang benar2 di-prefill
// dari PO dan dipakai langsung (tidak dihitung ulang), jadi meterai TETAP
// diprefill dari PO sebagai nilai awal (masih bisa diedit manual).
//
// Cost-update opsional per baris (checkbox, replika baris 727-733): kalau
// checkbox true DAN user punya permission 'ipsrs_barang' (permission yang
// sama dengan CRUD Master Barang, karena efeknya menimpa ipsrsbarang.harga)
// -> harga master ditimpa dgn (total_baris/jumlah) digrossup persenPPN.
// Checkbox default true utk baris hasil prefill PO (identik Java), default
// false utk baris ditambah manual.
//
// Retur/batal: TIDAK ADA di Java (murni create-only, no delete/edit) — modul
// koreksi terpisah ada di IPSRSReturBeli.java, di luar scope sesi ini.
import DatabaseService from '../../DatabaseService.js'
import KeuanganJurnalService from '../keuangan/KeuanganJurnalService.js'
import IpsrsRiwayatService from './IpsrsRiwayatService.js'
import LogService from '../../../electron/LogService.js'

function generateNoFaktur(lastNo, tgl) {
    const [y, m, d] = tgl.split('-')
    const prefix = 'PNM' + y + m + d
    if (!lastNo) return prefix + '001'
    const urutStr = lastNo.slice(-3)
    const nextUrut = String(Number(urutStr) + 1).padStart(3, '0')
    return prefix + nextUrut
}

async function getNextNoFaktur(tglPesan) {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(
            'SELECT no_faktur FROM ipsrspemesanan WHERE tgl_pesan = ? ORDER BY no_faktur DESC LIMIT 1',
            [tglPesan]
        )
        return generateNoFaktur(res.rows[0]?.no_faktur, tglPesan)
    } catch (err) {
        LogService.error('[IpsrsPenerimaanService] Error getNextNoFaktur', { message: err.message, stack: err.stack })
        console.error('[IpsrsPenerimaanService] Error getNextNoFaktur:', err)
        throw err
    }
}

// Replika src/ipsrs/riwayatnonmedis.java lewat DlgCariPetugas — dipilih
// eksplisit, BUKAN otomatis dari akun login (lihat catatan header).
async function listPetugas() {
    try {
        const db = await DatabaseService.get()
        const { rows } = await db.query(`SELECT nip, nama FROM petugas WHERE status='1' ORDER BY nip`)
        return rows
    } catch (err) {
        LogService.error('[IpsrsPenerimaanService] Error listPetugas', { message: err.message, stack: err.stack })
        console.error('[IpsrsPenerimaanService] Error listPetugas:', err)
        throw err
    }
}

// Replika tampil(String noorder): prefill No.Order, Supplier, Meterai (nilai
// awal, bukan hasil hitung), dan baris detail dari PO (checkbox default true).
// Cuma boleh dari PO berstatus 'Sudah Datang' (replika guard ppDatangActionPerformed
// di IPSRSCariSuratPemesanan.java — status ini WAJIB sudah ditandai lebih dulu
// lewat IpsrsSuratPemesananService.tandaiSudahDatang()).
async function getFromPO(noPemesanan) {
    try {
        const db = await DatabaseService.get()
        const { rows: [po] } = await db.query(
            `SELECT p.no_pemesanan, p.kode_suplier, sup.nama_suplier, p.meterai, p.status
             FROM surat_pemesanan_non_medis p
             LEFT JOIN ipsrssuplier sup ON sup.kode_suplier = p.kode_suplier
             WHERE p.no_pemesanan = ?`,
            [noPemesanan]
        )
        if (!po) return { success: false, message: 'Surat Pemesanan tidak ditemukan' }
        if (po.status !== 'Sudah Datang') {
            return { success: false, message: 'Surat Pemesanan ini belum ditandai "Sudah Datang" — tandai dulu di halaman Surat Pemesanan' }
        }

        const { rows: items } = await db.query(
            `SELECT d.kode_brng, CONCAT(b.nama_brng, ' (', b.jenis, ')') AS nama_brng, d.kode_sat, s.satuan AS nama_satuan,
                    d.jumlah, d.h_pesan, d.subtotal, d.dis, d.besardis, d.total
             FROM detail_surat_pemesanan_non_medis d
             JOIN ipsrsbarang b ON b.kode_brng = d.kode_brng
             JOIN kodesatuan s ON s.kode_sat = d.kode_sat
             WHERE d.no_pemesanan = ?
             ORDER BY b.nama_brng`,
            [noPemesanan]
        )
        return {
            success: true,
            no_order: po.no_pemesanan,
            kode_suplier: po.kode_suplier,
            nama_suplier: po.nama_suplier,
            meterai: po.meterai,
            items: items.map(it => ({ ...it, updateHarga: true })),
        }
    } catch (err) {
        LogService.error('[IpsrsPenerimaanService] Error getFromPO', { message: err.message, stack: err.stack })
        console.error('[IpsrsPenerimaanService] Error getFromPO:', err)
        throw err
    }
}

function validate(data) {
    if (!data.no_order?.trim()) return 'No. Order tidak boleh kosong'
    if (!data.kode_suplier?.trim()) return 'Supplier tidak boleh kosong'
    if (!data.nip?.trim()) return 'Petugas tidak boleh kosong'
    if (data.meterai === undefined || data.meterai === null || String(data.meterai).trim() === '') return 'Meterai tidak boleh kosong'
    if (!data.items || data.items.length === 0) return 'Maaf, data sudah habis'
    const terisi = data.items.filter(it => Number(it.jumlah) > 0)
    if (terisi.length === 0) return 'Maaf, Silahkan masukkan pembelian'
    return null
}

async function create(data, username) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const terisi = data.items.filter(it => Number(it.jumlah) > 0)
    const subtotal = terisi.reduce((s, it) => s + Number(it.subtotal), 0)
    const potongan = terisi.reduce((s, it) => s + Number(it.besardis || 0), 0)
    const total = subtotal - potongan
    const ppn = Number(data.ppn || 0)
    const meterai = Number(data.meterai)
    const tagihan = total + ppn + meterai
    const ppnPercent = Number(data.ppnPercent || 0)

    const jam = new Date().toTimeString().split(' ')[0]
    const db = await DatabaseService.get()
    const MAX_RETRY = 5

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        const client = await db.connect()
        try {
            await client.query('START TRANSACTION')

            const resNo = await client.query(
                'SELECT no_faktur FROM ipsrspemesanan WHERE tgl_pesan = ? ORDER BY no_faktur DESC LIMIT 1 FOR UPDATE',
                [data.tgl_pesan]
            )
            const no_faktur = generateNoFaktur(resNo.rows[0]?.no_faktur, data.tgl_pesan)

            await client.query(
                `INSERT INTO ipsrspemesanan (no_faktur, no_order, kode_suplier, nip, tgl_pesan, tgl_faktur, tgl_tempo, total1, potongan, total2, ppn, meterai, tagihan, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum Dibayar')`,
                [no_faktur, data.no_order.trim(), data.kode_suplier, data.nip, data.tgl_pesan, data.tgl_faktur || data.tgl_pesan, data.tgl_tempo || data.tgl_pesan, subtotal, potongan, total, ppn, meterai, tagihan]
            )

            for (const item of terisi) {
                await client.query(
                    `INSERT INTO ipsrsdetailpesan (no_faktur, kode_brng, kode_sat, jumlah, harga, subtotal, dis, besardis, total)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [no_faktur, item.kode_brng, item.kode_sat, item.jumlah, item.h_pesan, item.subtotal, item.dis || 0, item.besardis || 0, item.total]
                )

                await IpsrsRiwayatService.catatRiwayat(client, {
                    kode_brng: item.kode_brng, masuk: Number(item.jumlah), posisi: 'Penerimaan', petugas: username, status: 'Simpan'
                })
                await client.query('UPDATE ipsrsbarang SET stok = stok + ? WHERE kode_brng = ?', [item.jumlah, item.kode_brng])

                if (item.updateHarga && ppnPercent >= 0) {
                    const hargaDiskon = Number(item.total) / Number(item.jumlah)
                    const hargaBaru = hargaDiskon + (ppnPercent / 100) * hargaDiskon
                    await client.query('UPDATE ipsrsbarang SET harga = ? WHERE kode_brng = ?', [hargaBaru, item.kode_brng])
                }
            }

            const kodeAkun = await client.query(
                'SELECT Penerimaan_NonMedis, PPN_Masukan, Kontra_Penerimaan_NonMedis FROM set_akun LIMIT 1'
            )
            const akun = kodeAkun.rows[0]
            if (!akun?.Penerimaan_NonMedis || !akun?.Kontra_Penerimaan_NonMedis || (ppn > 0 && !akun?.PPN_Masukan)) {
                throw new Error('Mapping akun Penerimaan Non Medis / PPN Masukan belum diatur, hubungi administrator (menu Pengaturan Rekening)')
            }

            const details = [
                { kd_rek: akun.Penerimaan_NonMedis, debet: total + meterai, kredit: 0 },
            ]
            if (ppn > 0) details.push({ kd_rek: akun.PPN_Masukan, debet: ppn, kredit: 0 })
            details.push({ kd_rek: akun.Kontra_Penerimaan_NonMedis, debet: 0, kredit: tagihan })

            await KeuanganJurnalService.postJurnalOnClient(client, {
                no_bukti: no_faktur,
                tgl_jurnal: data.tgl_pesan,
                jam_jurnal: jam,
                jenis: 'U',
                keterangan: 'PENERIMAAN BARANG NON MEDIS/PENUNJANG',
                details,
            }, username)

            await client.query('COMMIT')
            return { success: true, no_faktur }
        } catch (err) {
            await client.query('ROLLBACK')
            if (err.code === 'ER_DUP_ENTRY' && attempt < MAX_RETRY) continue
            if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
                return { success: false, message: 'Petugas (nip), Supplier, atau salah satu barang tidak valid' }
            }
            LogService.error('[IpsrsPenerimaanService] Error create', { message: err.message, stack: err.stack, code: err.code })
            console.error('[IpsrsPenerimaanService] Error create:', err)
            return { success: false, message: err.code === 'ER_DUP_ENTRY' ? 'Nomor bentrok, silakan coba lagi' : err.message }
        } finally {
            client.release()
        }
    }
}

async function list({ page = 1, pageSize = 10, sortOrder = 'desc', search = '' } = {}) {
    try {
        const db = await DatabaseService.get()
        const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
        const like = `%${search}%`
        const where = '(p.no_faktur LIKE ? OR p.no_order LIKE ? OR sup.nama_suplier LIKE ? OR pt.nama LIKE ?)'
        const params = [like, like, like, like]

        const { rows } = await db.query(
            `SELECT p.no_faktur, p.no_order, p.kode_suplier, sup.nama_suplier, p.nip, pt.nama AS nama_petugas,
                    p.tgl_pesan, p.tgl_faktur, p.tgl_tempo, p.total1, p.potongan, p.total2, p.ppn, p.meterai, p.tagihan, p.status
             FROM ipsrspemesanan p
             LEFT JOIN ipsrssuplier sup ON sup.kode_suplier = p.kode_suplier
             LEFT JOIN petugas pt ON pt.nip = p.nip
             WHERE ${where}
             ORDER BY p.tgl_pesan ${dir}, p.no_faktur ${dir}
             LIMIT ? OFFSET ?`,
            [...params, pageSize, (page - 1) * pageSize]
        )
        const { rows: [{ count }] } = await db.query(
            `SELECT COUNT(*) AS count FROM ipsrspemesanan p
             LEFT JOIN ipsrssuplier sup ON sup.kode_suplier = p.kode_suplier
             LEFT JOIN petugas pt ON pt.nip = p.nip WHERE ${where}`,
            params
        )
        return { data: rows, total: count }
    } catch (err) {
        LogService.error('[IpsrsPenerimaanService] Error list', { message: err.message, stack: err.stack })
        console.error('[IpsrsPenerimaanService] Error list:', err)
        throw err
    }
}

async function detail(noFaktur) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(
        `SELECT d.kode_brng, b.nama_brng, d.kode_sat, s.satuan AS nama_satuan,
                d.jumlah, d.harga, d.subtotal, d.dis, d.besardis, d.total
         FROM ipsrsdetailpesan d
         JOIN ipsrsbarang b ON b.kode_brng = d.kode_brng
         JOIN kodesatuan s ON s.kode_sat = d.kode_sat
         WHERE d.no_faktur = ?`,
        [noFaktur]
    )
    return rows
}

export default { listPetugas, getFromPO, getNextNoFaktur, create, list, detail }
