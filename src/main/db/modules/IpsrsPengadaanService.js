// Pengadaan Barang Non Medis (kas/bank langsung) — src/ipsrs/IPSRSPembelian.java.
// Flow SAUDARA dari Penerimaan Barang Non Medis (IpsrsPenerimaanService.js /
// IPSRSPemesanan.java) — BUKAN pipeline sequential, cuma dibedakan metode
// bayar (Pengadaan ini = cash/bank langsung lewat "Akun Bayar" pilihan user,
// Penerimaan = hutang/kredit ke suplier). Tabel, akun, dan No.Faktur beda
// sendiri-sendiri, TIDAK ADA hubungan/prefill antar keduanya (dikonfirmasi
// baca IPSRSPembelian.java penuh, tidak ada referensi ke surat_pemesanan
// atau ipsrspemesanan sama sekali).
//
// Tabel ASLI sik.sql:
// - `ipsrspembelian(no_faktur PK, kode_suplier, nip, tgl_beli, subtotal,
//   potongan, total, ppn, meterai, tagihan, kd_rek)` — `kd_rek` = akun
//   bayar (kas/bank) yang dipilih user, FK `nip`->`petugas.nip` (SAMA
//   keluarga dgn Penerimaan, BUKAN `pegawai` seperti Surat Pemesanan).
// - `ipsrsdetailbeli(no_faktur, kode_brng, kode_sat, jumlah, harga,
//   subtotal, dis, besardis, total)` — bentuk identik ipsrsdetailpesan,
//   urutan kolom dikonfirmasi baris 673-682 Java.
//
// No.Faktur AUTO-GENERATE (Valid.autoNomer3, baris 1294-1296): prefix
// "PI"+yyyyMMdd(dari Tgl Beli)+3 digit, reset per tanggal.
//
// Akun Bayar: dropdown "Akun Bayar" (kas/bank) di Java diisi dari cache
// akun_bayar (nama->kd_rek). Di sini REUSE LANGSUNG
// KeuanganMasterAkunService.listBayar() yang sudah ada (grup "Akun Bayar"
// di Master Akun, dipakai lintas 20+ modul lain) — tidak bikin service baru.
//
// Jurnal 3-leg (jenis 'U', no_bukti=No.Faktur, replika baris 700-719):
//   akunpembelian (=set_akun.Pengadaan_Ipsrs) DEBET (total+meterai) "PEMBELIAN"
//   PPN_Masukan (key SAMA dgn Penerimaan) DEBET ppn kalau >0 "PPN Masukan IPSRS"
//   akunbayar (kas/bank pilihan user) KREDIT tagihan "KAS KELUAR"
// Kedua key set_akun ini SUDAH lengkap tersedia di Pengaturan Rekening
// (tokoIpsrs.Pengadaan_Ipsrs sudah ada dari awal, PPN_Masukan baru
// ditambahkan bareng fix Penerimaan) — TIDAK ADA gap tambahan yang perlu
// diperbaiki utk flow ini.
//
// Cost-update opsional per baris & UX search-and-add-row: pola identik
// Penerimaan, lihat IpsrsPenerimaanService.js utk penjelasan detail.
//
// Retur/batal: TIDAK ADA (create-only, sama seperti Penerimaan).
import DatabaseService from '../DatabaseService.js'
import KeuanganJurnalService from './KeuanganJurnalService.js'
import IpsrsRiwayatService from './IpsrsRiwayatService.js'
import LogService from '../../electron/LogService.js'

function generateNoFaktur(lastNo, tgl) {
    const [y, m, d] = tgl.split('-')
    const prefix = 'PI' + y + m + d
    if (!lastNo) return prefix + '001'
    const urutStr = lastNo.slice(-3)
    const nextUrut = String(Number(urutStr) + 1).padStart(3, '0')
    return prefix + nextUrut
}

async function getNextNoFaktur(tglBeli) {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(
            'SELECT no_faktur FROM ipsrspembelian WHERE tgl_beli = ? ORDER BY no_faktur DESC LIMIT 1',
            [tglBeli]
        )
        return generateNoFaktur(res.rows[0]?.no_faktur, tglBeli)
    } catch (err) {
        LogService.error('[IpsrsPengadaanService] Error getNextNoFaktur', { message: err.message, stack: err.stack })
        console.error('[IpsrsPengadaanService] Error getNextNoFaktur:', err)
        throw err
    }
}

async function listPetugas() {
    try {
        const db = await DatabaseService.get()
        const { rows } = await db.query(`SELECT nip, nama FROM petugas WHERE status='1' ORDER BY nip`)
        return rows
    } catch (err) {
        LogService.error('[IpsrsPengadaanService] Error listPetugas', { message: err.message, stack: err.stack })
        console.error('[IpsrsPengadaanService] Error listPetugas:', err)
        throw err
    }
}

function validate(data) {
    if (!data.kode_suplier?.trim()) return 'Supplier tidak boleh kosong'
    if (!data.nip?.trim()) return 'Petugas tidak boleh kosong'
    if (!data.kd_rek?.trim()) return 'Akun Bayar tidak boleh kosong'
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
                'SELECT no_faktur FROM ipsrspembelian WHERE tgl_beli = ? ORDER BY no_faktur DESC LIMIT 1 FOR UPDATE',
                [data.tgl_beli]
            )
            const no_faktur = generateNoFaktur(resNo.rows[0]?.no_faktur, data.tgl_beli)

            await client.query(
                `INSERT INTO ipsrspembelian (no_faktur, kode_suplier, nip, tgl_beli, subtotal, potongan, total, ppn, meterai, tagihan, kd_rek)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [no_faktur, data.kode_suplier, data.nip, data.tgl_beli, subtotal, potongan, total, ppn, meterai, tagihan, data.kd_rek]
            )

            for (const item of terisi) {
                await client.query(
                    `INSERT INTO ipsrsdetailbeli (no_faktur, kode_brng, kode_sat, jumlah, harga, subtotal, dis, besardis, total)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [no_faktur, item.kode_brng, item.kode_sat, item.jumlah, item.h_pesan, item.subtotal, item.dis || 0, item.besardis || 0, item.total]
                )

                await IpsrsRiwayatService.catatRiwayat(client, {
                    kode_brng: item.kode_brng, masuk: Number(item.jumlah), posisi: 'Pengadaan', petugas: username, status: 'Simpan'
                })
                await client.query('UPDATE ipsrsbarang SET stok = stok + ? WHERE kode_brng = ?', [item.jumlah, item.kode_brng])

                if (item.updateHarga && ppnPercent >= 0) {
                    const hargaDiskon = Number(item.total) / Number(item.jumlah)
                    const hargaBaru = hargaDiskon + (ppnPercent / 100) * hargaDiskon
                    await client.query('UPDATE ipsrsbarang SET harga = ? WHERE kode_brng = ?', [hargaBaru, item.kode_brng])
                }
            }

            const kodeAkun = await client.query(
                'SELECT Pengadaan_Ipsrs, PPN_Masukan FROM set_akun LIMIT 1'
            )
            const akun = kodeAkun.rows[0]
            if (!akun?.Pengadaan_Ipsrs || (ppn > 0 && !akun?.PPN_Masukan)) {
                throw new Error('Mapping akun Pengadaan IPSRS / PPN Masukan belum diatur, hubungi administrator (menu Pengaturan Rekening)')
            }

            const details = [
                { kd_rek: akun.Pengadaan_Ipsrs, debet: total + meterai, kredit: 0 },
            ]
            if (ppn > 0) details.push({ kd_rek: akun.PPN_Masukan, debet: ppn, kredit: 0 })
            details.push({ kd_rek: data.kd_rek, debet: 0, kredit: tagihan })

            await KeuanganJurnalService.postJurnalOnClient(client, {
                no_bukti: no_faktur,
                tgl_jurnal: data.tgl_beli,
                jam_jurnal: jam,
                jenis: 'U',
                keterangan: 'PEMBELIAN BARANG NON MEDIS DAN PENUNJANG(LAB & RAD)',
                details,
            }, username)

            await client.query('COMMIT')
            return { success: true, no_faktur }
        } catch (err) {
            await client.query('ROLLBACK')
            if (err.code === 'ER_DUP_ENTRY' && attempt < MAX_RETRY) continue
            if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
                return { success: false, message: 'Petugas (nip), Supplier, Akun Bayar, atau salah satu barang tidak valid' }
            }
            LogService.error('[IpsrsPengadaanService] Error create', { message: err.message, stack: err.stack, code: err.code })
            console.error('[IpsrsPengadaanService] Error create:', err)
            return { success: false, message: err.code === 'ER_DUP_ENTRY' ? 'Gagal Menyimpan, kemungkinan No.Faktur sudah ada sebelumnya' : err.message }
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
        const where = '(p.no_faktur LIKE ? OR sup.nama_suplier LIKE ? OR pt.nama LIKE ?)'
        const params = [like, like, like]

        const { rows } = await db.query(
            `SELECT p.no_faktur, p.kode_suplier, sup.nama_suplier, p.nip, pt.nama AS nama_petugas,
                    p.tgl_beli, p.subtotal, p.potongan, p.total, p.ppn, p.meterai, p.tagihan, p.kd_rek, r.nm_rek AS nama_akun_bayar
             FROM ipsrspembelian p
             LEFT JOIN ipsrssuplier sup ON sup.kode_suplier = p.kode_suplier
             LEFT JOIN petugas pt ON pt.nip = p.nip
             LEFT JOIN rekening r ON r.kd_rek = p.kd_rek
             WHERE ${where}
             ORDER BY p.tgl_beli ${dir}, p.no_faktur ${dir}
             LIMIT ? OFFSET ?`,
            [...params, pageSize, (page - 1) * pageSize]
        )
        const { rows: [{ count }] } = await db.query(
            `SELECT COUNT(*) AS count FROM ipsrspembelian p
             LEFT JOIN ipsrssuplier sup ON sup.kode_suplier = p.kode_suplier
             LEFT JOIN petugas pt ON pt.nip = p.nip WHERE ${where}`,
            params
        )
        return { data: rows, total: count }
    } catch (err) {
        LogService.error('[IpsrsPengadaanService] Error list', { message: err.message, stack: err.stack })
        console.error('[IpsrsPengadaanService] Error list:', err)
        throw err
    }
}

async function detail(noFaktur) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(
        `SELECT d.kode_brng, b.nama_brng, d.kode_sat, s.satuan AS nama_satuan,
                d.jumlah, d.harga, d.subtotal, d.dis, d.besardis, d.total
         FROM ipsrsdetailbeli d
         JOIN ipsrsbarang b ON b.kode_brng = d.kode_brng
         JOIN kodesatuan s ON s.kode_sat = d.kode_sat
         WHERE d.no_faktur = ?`,
        [noFaktur]
    )
    return rows
}

export default { listPetugas, getNextNoFaktur, create, list, detail }
