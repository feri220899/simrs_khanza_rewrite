// Pengeluaran Barang Non Medis (stok keluar ke unit internal) — src/ipsrs/
// IPSRSPengeluaran.java. Bisa mulai dari Permintaan yang sudah "Disetujui"
// (prefill item + Keterangan) ATAU standalone langsung — sama pola dgn
// Penerimaan/Surat Pemesanan (lihat IpsrsPenerimaanService.js), TAPI di sini
// pasangannya `permintaan_non_medis`/`detail_permintaan_non_medis`
// (IpsrsPermintaanService.js, yang SUDAH menunda hand-off ke modul ini —
// lihat komentar header file itu).
//
// Tabel ASLI sik.sql:
// - `ipsrspengeluaran(no_keluar PK, tanggal, nip, keterangan)` — FK `nip`
//   ke `petugas.nip` (BEDA dari `permintaan_non_medis.nip` yang FK ke
//   `pegawai.nik`) — WAJIB dropdown petugas eksplisit, bukan authStore.user.
// - `ipsrsdetailpengeluaran(no_keluar, kode_brng, kode_sat, jumlah, harga,
//   total)` — TIDAK ADA diskon/subtotal terpisah kayak Penerimaan/Pengadaan
//   (lebih simpel, cuma jumlah*harga=total), urutan kolom dikonfirmasi baris
//   468-474 Java. `harga` per baris BOLEH DIEDIT manual (isCellEditable
//   kolom 0 dan 5) — beda dari Penerimaan yang harga ikut master barang.
//
// No.Keluar AUTO-GENERATE (Valid.autoNomer3, baris 840-842): prefix asli
// Java "SKNM"+YY(2 digit)+MM+DD (urutan digit tahun-bulan-tanggal, BUKAN
// yyyyMMdd konsisten kayak Penerimaan/Pengadaan — sepertinya quirk/bug minor
// offset substring Java). Diporting pakai format bersih SKNM+yyyyMMdd+3digit
// (technical cleanup kosmetik, bukan perubahan bisnis — counter tetap reset
// per tanggal & tetap unik).
//
// Prefill dari Permintaan (tampil(String,String), baris 845-880): SEMUA
// baris `detail_permintaan_non_medis` untuk `no_permintaan` itu ditampilkan,
// TAPI kalau `jumlah diminta > stok saat ini`, baris itu MASUK ke grid
// dengan Jml DIKOSONGKAN (bukan ditolak/dilewati) + pesan peringatan "Stok
// tidak mencukupi" — replikasi PERSIS: baris tetap ada, cuma jumlah harus
// diisi ulang manual oleh user (tidak lebih dari stok tersedia, walau tidak
// ada validasi keras yang cek ini lagi di sisi save — replika Java yang juga
// tidak validasi ulang saat simpan, cuma warning di titik prefill).
// Keterangan header di-auto-isi format
// "<no_permintaan>, Ruangan <ruang>, oleh <nama_petugas>" (replika
// ppDisetujuiActionPerformed di IPSRSCariPermintaan.java baris 804).
//
// Jurnal 2-leg (jenis 'U', no_bukti=No.Keluar, replika baris 490-498):
//   Stok_Keluar_Ipsrs (set_akun) DEBET total "PERSEDIAAN BARANG" (keterangan
//   Java asli, walau labelnya generik)
//   Kontra_Stok_Keluar_Ipsrs (set_akun) KREDIT total — LABEL JAVA "KAS DI
//   TANGAN" TAPI akun sungguhan yang dipetakan di data nyata (115020) adalah
//   akun PERSEDIAAN, bukan kas — label Java itu tampak salah copy-paste,
//   TIDAK direplikasi teksnya, dipakai keterangan yang lebih akurat
//   ("PERSEDIAAN BARANG NON MEDIS (KELUAR)").
//
// **Gap ditemukan & diperbaiki (prasyarat)**: `Kontra_Stok_Keluar_Ipsrs`
// (kolom `set_akun`, WAJIB dipakai jurnal ini) TIDAK ADA di tab "Toko/IPSRS/
// Obat" Pengaturan Rekening — cuma `Stok_Keluar_Ipsrs` yang sudah ada dari
// awal. Ditambahkan sebagai key baru (lihat KeuanganPengaturanRekeningService.js).
//
// Retur/batal: TIDAK ADA di Java (create-only, sama seperti Penerimaan/Pengadaan).
import DatabaseService from '../DatabaseService.js'
import KeuanganJurnalService from './KeuanganJurnalService.js'
import IpsrsRiwayatService from './IpsrsRiwayatService.js'
import LogService from '../../electron/LogService.js'

function generateNoKeluar(lastNo, tgl) {
    const [y, m, d] = tgl.split('-')
    const prefix = 'SKNM' + y + m + d
    if (!lastNo) return prefix + '001'
    const urutStr = lastNo.slice(-3)
    const nextUrut = String(Number(urutStr) + 1).padStart(3, '0')
    return prefix + nextUrut
}

async function getNextNoKeluar(tanggal) {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(
            'SELECT no_keluar FROM ipsrspengeluaran WHERE tanggal = ? ORDER BY no_keluar DESC LIMIT 1',
            [tanggal]
        )
        return generateNoKeluar(res.rows[0]?.no_keluar, tanggal)
    } catch (err) {
        LogService.error('[IpsrsPengeluaranService] Error getNextNoKeluar', { message: err.message, stack: err.stack })
        console.error('[IpsrsPengeluaranService] Error getNextNoKeluar:', err)
        throw err
    }
}

async function listPetugas() {
    try {
        const db = await DatabaseService.get()
        const { rows } = await db.query(`SELECT nip, nama FROM petugas WHERE status='1' ORDER BY nip`)
        return rows
    } catch (err) {
        LogService.error('[IpsrsPengeluaranService] Error listPetugas', { message: err.message, stack: err.stack })
        console.error('[IpsrsPengeluaranService] Error listPetugas:', err)
        throw err
    }
}

// Replika tampil(String nopermintaan, String keterangan) — cek stok per
// baris, prefix keterangan header sesuai format Java.
async function getFromPermintaan(noPermintaan) {
    try {
        const db = await DatabaseService.get()
        const { rows: [permintaan] } = await db.query(
            `SELECT p.no_permintaan, p.ruang, p.status, peg.nama AS nama_petugas
             FROM permintaan_non_medis p
             LEFT JOIN pegawai peg ON peg.nik = p.nip
             WHERE p.no_permintaan = ?`,
            [noPermintaan]
        )
        if (!permintaan) return { success: false, message: 'Permintaan tidak ditemukan' }
        if (permintaan.status !== 'Disetujui') {
            return { success: false, message: 'Permintaan ini belum berstatus "Disetujui" — setujui dulu di halaman Permintaan Barang Non Medis' }
        }

        const { rows: items } = await db.query(
            `SELECT b.kode_brng, CONCAT(b.nama_brng, ' (', b.jenis, ')') AS nama_brng, b.kode_sat, s.satuan AS nama_satuan,
                    b.stok, b.harga, d.jumlah AS jumlah_diminta
             FROM detail_permintaan_non_medis d
             JOIN ipsrsbarang b ON b.kode_brng = d.kode_brng
             JOIN kodesatuan s ON s.kode_sat = b.kode_sat
             WHERE d.no_permintaan = ?
             ORDER BY b.nama_brng`,
            [noPermintaan]
        )

        const kurang = items.filter(it => Number(it.jumlah_diminta) > Number(it.stok))
        return {
            success: true,
            keterangan: `${permintaan.no_permintaan}, Ruangan ${permintaan.ruang}, oleh ${permintaan.nama_petugas || '-'}`,
            items: items.map(it => ({
                kode_brng: it.kode_brng, nama_brng: it.nama_brng, kode_sat: it.kode_sat, nama_satuan: it.nama_satuan,
                stok: it.stok, harga: it.harga,
                // Stok tidak cukup -> jumlah dikosongkan, user isi ulang manual (replika persis Java).
                jumlah: Number(it.jumlah_diminta) > Number(it.stok) ? '' : it.jumlah_diminta,
            })),
            peringatanStokKurang: kurang.length > 0 ? kurang.map(it => it.nama_brng) : null,
        }
    } catch (err) {
        LogService.error('[IpsrsPengeluaranService] Error getFromPermintaan', { message: err.message, stack: err.stack })
        console.error('[IpsrsPengeluaranService] Error getFromPermintaan:', err)
        throw err
    }
}

function validate(data) {
    if (!data.keterangan?.trim()) return 'Keterangan tidak boleh kosong'
    if (!data.nip?.trim()) return 'Petugas tidak boleh kosong'
    if (!data.items || data.items.length === 0) return 'Maaf, data sudah habis'
    const terisi = data.items.filter(it => Number(it.jumlah) > 0)
    if (terisi.length === 0) return 'Maaf, Silahkan masukkan pengeluaran'
    return null
}

async function create(data, username) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const terisi = data.items.filter(it => Number(it.jumlah) > 0)
    const total = terisi.reduce((s, it) => s + Number(it.jumlah) * Number(it.harga), 0)

    const jam = new Date().toTimeString().split(' ')[0]
    const db = await DatabaseService.get()
    const MAX_RETRY = 5

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        const client = await db.connect()
        try {
            await client.query('START TRANSACTION')

            const resNo = await client.query(
                'SELECT no_keluar FROM ipsrspengeluaran WHERE tanggal = ? ORDER BY no_keluar DESC LIMIT 1 FOR UPDATE',
                [data.tanggal]
            )
            const no_keluar = generateNoKeluar(resNo.rows[0]?.no_keluar, data.tanggal)

            await client.query(
                'INSERT INTO ipsrspengeluaran (no_keluar, tanggal, nip, keterangan) VALUES (?, ?, ?, ?)',
                [no_keluar, data.tanggal, data.nip, data.keterangan.trim()]
            )

            for (const item of terisi) {
                const itemTotal = Number(item.jumlah) * Number(item.harga)
                await client.query(
                    'INSERT INTO ipsrsdetailpengeluaran (no_keluar, kode_brng, kode_sat, jumlah, harga, total) VALUES (?, ?, ?, ?, ?, ?)',
                    [no_keluar, item.kode_brng, item.kode_sat, item.jumlah, item.harga, itemTotal]
                )

                await IpsrsRiwayatService.catatRiwayat(client, {
                    kode_brng: item.kode_brng, keluar: Number(item.jumlah), posisi: 'Stok Keluar', petugas: username, status: 'Simpan'
                })
                await client.query('UPDATE ipsrsbarang SET stok = stok - ? WHERE kode_brng = ?', [item.jumlah, item.kode_brng])
            }

            const kodeAkun = await client.query('SELECT Stok_Keluar_Ipsrs, Kontra_Stok_Keluar_Ipsrs FROM set_akun LIMIT 1')
            const akun = kodeAkun.rows[0]
            if (!akun?.Stok_Keluar_Ipsrs || !akun?.Kontra_Stok_Keluar_Ipsrs) {
                throw new Error('Mapping akun Stok Keluar IPSRS belum diatur, hubungi administrator (menu Pengaturan Rekening)')
            }

            await KeuanganJurnalService.postJurnalOnClient(client, {
                no_bukti: no_keluar,
                tgl_jurnal: data.tanggal,
                jam_jurnal: jam,
                jenis: 'U',
                keterangan: 'PENGGUNAAN BARANG NON MEDIS DAN PENUNJANG (LAB & RAD)',
                details: [
                    { kd_rek: akun.Stok_Keluar_Ipsrs, debet: total, kredit: 0 },
                    { kd_rek: akun.Kontra_Stok_Keluar_Ipsrs, debet: 0, kredit: total },
                ],
            }, username)

            await client.query('COMMIT')
            return { success: true, no_keluar }
        } catch (err) {
            await client.query('ROLLBACK')
            if (err.code === 'ER_DUP_ENTRY' && attempt < MAX_RETRY) continue
            if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
                return { success: false, message: 'Petugas (nip) atau salah satu barang tidak valid' }
            }
            LogService.error('[IpsrsPengeluaranService] Error create', { message: err.message, stack: err.stack, code: err.code })
            console.error('[IpsrsPengeluaranService] Error create:', err)
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
        const where = '(p.no_keluar LIKE ? OR p.keterangan LIKE ? OR pt.nama LIKE ?)'
        const params = [like, like, like]

        const { rows } = await db.query(
            `SELECT p.no_keluar, p.tanggal, p.nip, pt.nama AS nama_petugas, p.keterangan,
                    COALESCE((SELECT SUM(total) FROM ipsrsdetailpengeluaran WHERE no_keluar = p.no_keluar), 0) AS total
             FROM ipsrspengeluaran p
             LEFT JOIN petugas pt ON pt.nip = p.nip
             WHERE ${where}
             ORDER BY p.tanggal ${dir}, p.no_keluar ${dir}
             LIMIT ? OFFSET ?`,
            [...params, pageSize, (page - 1) * pageSize]
        )
        const { rows: [{ count }] } = await db.query(
            `SELECT COUNT(*) AS count FROM ipsrspengeluaran p LEFT JOIN petugas pt ON pt.nip = p.nip WHERE ${where}`,
            params
        )
        return { data: rows, total: count }
    } catch (err) {
        LogService.error('[IpsrsPengeluaranService] Error list', { message: err.message, stack: err.stack })
        console.error('[IpsrsPengeluaranService] Error list:', err)
        throw err
    }
}

async function detail(noKeluar) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(
        `SELECT d.kode_brng, b.nama_brng, d.kode_sat, s.satuan AS nama_satuan, d.jumlah, d.harga, d.total
         FROM ipsrsdetailpengeluaran d
         JOIN ipsrsbarang b ON b.kode_brng = d.kode_brng
         JOIN kodesatuan s ON s.kode_sat = d.kode_sat
         WHERE d.no_keluar = ?`,
        [noKeluar]
    )
    return rows
}

export default { listPetugas, getFromPermintaan, getNextNoKeluar, create, list, detail }
