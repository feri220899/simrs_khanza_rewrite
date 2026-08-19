// Retur Beli Barang Non Medis (retur ke suplier) — src/ipsrs/IPSRSReturBeli.java.
// Kebalikan akuntansi dari Penerimaan (IpsrsPenerimaanService.js): mengurangi
// Persediaan (kredit) DAN mengurangi Hutang ke suplier (debet) — persis
// jurnal pembalik sebagian dari transaksi Penerimaan asalnya.
//
// Tabel ASLI sik.sql:
// - `ipsrsreturbeli(no_retur_beli PK, tgl_retur, nip, kode_suplier, catatan,
//   total)` — FK `nip`→`petugas.nip` (sama keluarga dgn Penerimaan/Pengadaan/
//   Pengeluaran) — WAJIB dropdown petugas eksplisit, bukan authStore.user.
// - `ipsrs_detail_returbeli(no_retur_beli, no_faktur, kode_brng, kode_sat,
//   h_beli, h_retur, jml_retur, total)` — urutan kolom dikonfirmasi baris
//   744-749 Java. **`no_faktur` di sini TIDAK ADA FK sama sekali ke
//   `ipsrspemesanan`/`ipsrspembelian`** (dikonfirmasi baca skema) — murni
//   teks bebas per baris (referensi/catatan manual mana faktur pembelian
//   asalnya), TIDAK divalidasi silang ke transaksi pembelian sungguhan.
//   Diporting apa adanya (field teks opsional per baris, bukan dropdown
//   pencarian faktur — replika 1:1, bukan penambahan validasi yang Java
//   sendiri tidak punya).
// - `h_beli` ("Dasar" di grid Java, TIDAK BISA diedit) vs `h_retur`
//   ("Harga(Rp)", BISA diedit) — dua-duanya default ke `ipsrsbarang.harga`
//   (harga master SAAT baris ditambahkan), TIDAK ADA lookup ke harga beli
//   sungguhan dari faktur manapun (quirk Java, bukan bug — direplikasi apa
//   adanya: `h_beli` disimpan sebagai snapshot harga master, `h_retur` bisa
//   beda kalau user edit manual).
//
// No.Retur auto-generate (Valid.autoNomer3, baris 971-972): prefix
// "TRB"+yyyyMMdd+3digit, reset per tanggal — beda dari Pengeluaran yang
// offset substring-nya salah urut, di sini urutannya justru sudah benar
// (yyyyMMdd konsisten), jadi diporting apa adanya tanpa perlu cleanup.
//
// **Validasi stok**: Java cek `stok saat ini < jumlah retur` SEBELUM baris
// bisa diisi di grid (getData(), client-side) — "Maaf stok tidak
// mencukupi..!!". Direplikasi di SERVER (lebih aman dari validasi
// client-side doang) sebagai pengecekan dalam transaksi sebelum stok
// dikurangi — retur TIDAK BOLEH melebihi stok fisik yang ada.
//
// Jurnal 2-leg (jenis 'U', no_bukti=No.Retur, replika baris 764-772):
//   Retur_Beli_Non_Medis (set_akun) KREDIT total ("RETUR PEMBELIAN") — kurangi Persediaan
//   Kontra_Retur_Beli_Non_Medis (set_akun) DEBET total ("KONTRA RETUR PEMBELIAN") — kurangi Hutang
// Data nyata: kedua key ini sama persis dgn akun Penerimaan (115020 Persediaan,
// 211210 Hutang) — retur memang jurnal pembalik SEBAGIAN dari Penerimaan.
//
// **Gap ditemukan & diperbaiki (prasyarat)**: `Retur_Beli_Non_Medis` dan
// `Kontra_Retur_Beli_Non_Medis` TIDAK ADA di tab "Toko/IPSRS/Obat"
// Pengaturan Rekening — gap ke-4 dengan pola yang sama (Penerimaan,
// Pengeluaran, sekarang Retur Beli). Ditambahkan sebagai key baru.
//
// Batal/hapus retur: TIDAK ADA di Java (create-only, sama seperti flow IPSRS lain).
import DatabaseService from '../../DatabaseService.js'
import KeuanganJurnalService from '../keuangan/KeuanganJurnalService.js'
import IpsrsRiwayatService from './IpsrsRiwayatService.js'
import LogService from '../../../electron/LogService.js'

function generateNoRetur(lastNo, tgl) {
    const [y, m, d] = tgl.split('-')
    const prefix = 'TRB' + y + m + d
    if (!lastNo) return prefix + '001'
    const urutStr = lastNo.slice(-3)
    const nextUrut = String(Number(urutStr) + 1).padStart(3, '0')
    return prefix + nextUrut
}

async function getNextNoRetur(tanggal) {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(
            'SELECT no_retur_beli FROM ipsrsreturbeli WHERE tgl_retur = ? ORDER BY no_retur_beli DESC LIMIT 1',
            [tanggal]
        )
        return generateNoRetur(res.rows[0]?.no_retur_beli, tanggal)
    } catch (err) {
        LogService.error('[IpsrsReturBeliService] Error getNextNoRetur', { message: err.message, stack: err.stack })
        console.error('[IpsrsReturBeliService] Error getNextNoRetur:', err)
        throw err
    }
}

async function listPetugas() {
    try {
        const db = await DatabaseService.get()
        const { rows } = await db.query(`SELECT nip, nama FROM petugas WHERE status='1' ORDER BY nip`)
        return rows
    } catch (err) {
        LogService.error('[IpsrsReturBeliService] Error listPetugas', { message: err.message, stack: err.stack })
        console.error('[IpsrsReturBeliService] Error listPetugas:', err)
        throw err
    }
}

function validate(data) {
    if (!data.kode_suplier?.trim()) return 'Supplier tidak boleh kosong'
    if (!data.nip?.trim()) return 'Petugas tidak boleh kosong'
    if (!data.catatan?.trim()) return 'Catatan tidak boleh kosong'
    if (!data.items || data.items.length === 0) return 'Maaf, data sudah habis'
    const terisi = data.items.filter(it => Number(it.jumlah) > 0)
    if (terisi.length === 0) return 'Maaf, Silahkan masukkan retur'
    return null
}

async function create(data, username) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const terisi = data.items.filter(it => Number(it.jumlah) > 0)
    const total = terisi.reduce((s, it) => s + Number(it.jumlah) * Number(it.h_retur), 0)

    const jam = new Date().toTimeString().split(' ')[0]
    const db = await DatabaseService.get()
    const MAX_RETRY = 5

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        const client = await db.connect()
        try {
            await client.query('START TRANSACTION')

            const resNo = await client.query(
                'SELECT no_retur_beli FROM ipsrsreturbeli WHERE tgl_retur = ? ORDER BY no_retur_beli DESC LIMIT 1 FOR UPDATE',
                [data.tgl_retur]
            )
            const no_retur_beli = generateNoRetur(resNo.rows[0]?.no_retur_beli, data.tgl_retur)

            await client.query(
                'INSERT INTO ipsrsreturbeli (no_retur_beli, tgl_retur, nip, kode_suplier, catatan, total) VALUES (?, ?, ?, ?, ?, ?)',
                [no_retur_beli, data.tgl_retur, data.nip, data.kode_suplier, data.catatan.trim(), total]
            )

            for (const item of terisi) {
                const stokRes = await client.query('SELECT stok FROM ipsrsbarang WHERE kode_brng = ? FOR UPDATE', [item.kode_brng])
                const stokSaatIni = Number(stokRes.rows[0]?.stok || 0)
                if (stokSaatIni < Number(item.jumlah)) {
                    throw new Error(`Stok tidak mencukupi untuk barang ${item.kode_brng} (stok: ${stokSaatIni}, diminta: ${item.jumlah})`)
                }

                const itemTotal = Number(item.jumlah) * Number(item.h_retur)
                await client.query(
                    `INSERT INTO ipsrs_detail_returbeli (no_retur_beli, no_faktur, kode_brng, kode_sat, h_beli, h_retur, jml_retur, total)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [no_retur_beli, item.no_faktur || '', item.kode_brng, item.kode_sat, item.h_beli, item.h_retur, item.jumlah, itemTotal]
                )

                await IpsrsRiwayatService.catatRiwayat(client, {
                    kode_brng: item.kode_brng, keluar: Number(item.jumlah), posisi: 'Retur Beli', petugas: username, status: 'Simpan'
                })
                await client.query('UPDATE ipsrsbarang SET stok = stok - ? WHERE kode_brng = ?', [item.jumlah, item.kode_brng])
            }

            const kodeAkun = await client.query('SELECT Retur_Beli_Non_Medis, Kontra_Retur_Beli_Non_Medis FROM set_akun LIMIT 1')
            const akun = kodeAkun.rows[0]
            if (!akun?.Retur_Beli_Non_Medis || !akun?.Kontra_Retur_Beli_Non_Medis) {
                throw new Error('Mapping akun Retur Beli Non Medis belum diatur, hubungi administrator (menu Pengaturan Rekening)')
            }

            await KeuanganJurnalService.postJurnalOnClient(client, {
                no_bukti: no_retur_beli,
                tgl_jurnal: data.tgl_retur,
                jam_jurnal: jam,
                jenis: 'U',
                keterangan: 'RETUR PEMBELIAN BARANG PENUNJANG/NON MEDIS',
                details: [
                    { kd_rek: akun.Kontra_Retur_Beli_Non_Medis, debet: total, kredit: 0 },
                    { kd_rek: akun.Retur_Beli_Non_Medis, debet: 0, kredit: total },
                ],
            }, username)

            await client.query('COMMIT')
            return { success: true, no_retur_beli }
        } catch (err) {
            await client.query('ROLLBACK')
            if (err.code === 'ER_DUP_ENTRY' && attempt < MAX_RETRY) continue
            if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
                return { success: false, message: 'Petugas (nip), Supplier, atau salah satu barang tidak valid' }
            }
            if (err.message?.startsWith('Stok tidak mencukupi')) {
                return { success: false, message: err.message }
            }
            LogService.error('[IpsrsReturBeliService] Error create', { message: err.message, stack: err.stack, code: err.code })
            console.error('[IpsrsReturBeliService] Error create:', err)
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
        const where = '(p.no_retur_beli LIKE ? OR p.catatan LIKE ? OR sup.nama_suplier LIKE ? OR pt.nama LIKE ?)'
        const params = [like, like, like, like]

        const { rows } = await db.query(
            `SELECT p.no_retur_beli, p.tgl_retur, p.kode_suplier, sup.nama_suplier, p.nip, pt.nama AS nama_petugas, p.catatan, p.total
             FROM ipsrsreturbeli p
             LEFT JOIN ipsrssuplier sup ON sup.kode_suplier = p.kode_suplier
             LEFT JOIN petugas pt ON pt.nip = p.nip
             WHERE ${where}
             ORDER BY p.tgl_retur ${dir}, p.no_retur_beli ${dir}
             LIMIT ? OFFSET ?`,
            [...params, pageSize, (page - 1) * pageSize]
        )
        const { rows: [{ count }] } = await db.query(
            `SELECT COUNT(*) AS count FROM ipsrsreturbeli p
             LEFT JOIN ipsrssuplier sup ON sup.kode_suplier = p.kode_suplier
             LEFT JOIN petugas pt ON pt.nip = p.nip WHERE ${where}`,
            params
        )
        return { data: rows, total: count }
    } catch (err) {
        LogService.error('[IpsrsReturBeliService] Error list', { message: err.message, stack: err.stack })
        console.error('[IpsrsReturBeliService] Error list:', err)
        throw err
    }
}

async function detail(noReturBeli) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(
        `SELECT d.no_faktur, d.kode_brng, b.nama_brng, d.kode_sat, s.satuan AS nama_satuan,
                d.h_beli, d.h_retur, d.jml_retur, d.total
         FROM ipsrs_detail_returbeli d
         JOIN ipsrsbarang b ON b.kode_brng = d.kode_brng
         JOIN kodesatuan s ON s.kode_sat = d.kode_sat
         WHERE d.no_retur_beli = ?`,
        [noReturBeli]
    )
    return rows
}

export default { listPetugas, getNextNoRetur, create, list, detail }
