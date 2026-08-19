import DatabaseService from '../DatabaseService.js'
import KeuanganJurnalService from './KeuanganJurnalService.js'
import LogService from '../../electron/LogService.js'

// Replika DlgPemasukanLain.java. Arah jurnal KEBALIKAN dari Pengeluaran Harian
// (dikonfirmasi dari BtnSimpanActionPerformed + data sample kategori_pemasukan_lain
// di sik.sql — kd_rek selalu akun 4xxxxx PENDAPATAN, kd_rek2 selalu akun kas/bank):
//   kategori.kd_rek  (akun pendapatan) → DIKREDIT sebesar nominal
//   kategori.kd_rek2 (akun kas/bank kontra) → DIDEBET sebesar nominal
// Persis kebalikan Pengeluaran Harian (akun beban didebet, kas dikredit).
//
// Side-effect `tagihan_sadewa` di Java (insert/delete baris resi generik) SENGAJA
// TIDAK diporting: tabel itu berdiri sendiri tanpa FK ke tabel manapun (dicek di
// sik.sql), tidak ada fitur lain yang audited sesi ini membacanya, dan logika
// pengisian `jumlah_tagihan`-nya sendiri di Java memakai variabel `total` (total
// tampilan tabel SEBELUM baris baru ditambahkan, bukan nominal transaksi ini) —
// tampak seperti bug/artefak copy-paste di Java asli, bukan perilaku bisnis yang
// jelas untuk direplikasi. Dicatat di Keuangan.md sebagai batasan, bukan gap diam-diam.

function generateNoMasuk(lastNo, tgl) {
    const [y, m, d] = tgl.split('-')
    const prefix = 'PL' + y + m + d
    if (!lastNo) return prefix + '001'
    const urutStr = lastNo.slice(-3)
    const nextUrut = String(Number(urutStr) + 1).padStart(3, '0')
    return prefix + nextUrut
}

// "Petugas" (nip) — dipilih eksplisit dari daftar petugas AKTIF, BUKAN
// otomatis dari akun yang login (pola sama dgn koreksi di
// PerpustakaanSirkulasiService.listPetugas() / KeuanganPengeluaranHarianService.js —
// Admin Utama login pakai username bebas yang bukan nip asli di tabel `petugas`).
async function listPetugas() {
    try {
        const db = await DatabaseService.get()
        const { rows } = await db.query(`SELECT nip, nama FROM petugas WHERE status='1' ORDER BY nip`)
        return rows
    } catch (err) {
        LogService.error('[KeuanganPemasukanLainService] Error listPetugas', { message: err.message, stack: err.stack })
        console.error('[KeuanganPemasukanLainService] Error listPetugas:', err)
        throw err
    }
}

async function getNextNoMasuk(tanggal) {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(
            "SELECT no_masuk FROM pemasukan_lain WHERE tanggal LIKE ? ORDER BY no_masuk DESC LIMIT 1",
            [`${tanggal}%`]
        )
        return generateNoMasuk(res.rows[0]?.no_masuk, tanggal)
    } catch (err) {
        LogService.error('[KeuanganPemasukanLainService] Error getNextNoMasuk', { message: err.message, stack: err.stack })
        console.error('[KeuanganPemasukanLainService] Error getNextNoMasuk:', err)
        throw err
    }
}

async function list(params = {}) {
  try {
    const db = await DatabaseService.get()
    let query = `
        SELECT pl.no_masuk, pl.tanggal, pl.keterangan, pl.keperluan, pl.besar, pl.nip, pl.kode_kategori,
               pt.nama AS nama_petugas, k.nama_kategori
        FROM pemasukan_lain pl
        JOIN petugas pt ON pl.nip = pt.nip
        JOIN kategori_pemasukan_lain k ON pl.kode_kategori = k.kode_kategori
        WHERE 1=1
    `
    const args = []

    if (params.tgl_awal && params.tgl_akhir) {
        query += ' AND pl.tanggal BETWEEN ? AND ?'
        args.push(`${params.tgl_awal} 00:00:00`, `${params.tgl_akhir} 23:59:59`)
    }

    if (params.keyword) {
        query += ` AND (pl.keterangan LIKE ? OR pl.nip LIKE ? OR pt.nama LIKE ? OR pl.kode_kategori LIKE ? OR k.nama_kategori LIKE ? OR pl.no_masuk LIKE ?)`
        const search = `%${params.keyword}%`
        args.push(search, search, search, search, search, search)
    }

    query += ' ORDER BY pl.tanggal DESC, pl.no_masuk DESC'

    const res = await db.query(query, args)
    const rows = res.rows.map(r => ({
        ...r,
        besar: Number(r.besar || 0),
        tanggal: r.tanggal instanceof Date ? r.tanggal.toISOString().slice(0, 19).replace('T', ' ') : r.tanggal
    }))
    return { rows, total: rows.reduce((sum, r) => sum + r.besar, 0) }
  } catch (err) {
    LogService.error('[KeuanganPemasukanLainService] Error list', { message: err.message, stack: err.stack })
    console.error('[KeuanganPemasukanLainService] Error list:', err)
    throw err
  }
}

function validate(data) {
    if (!data.tanggal) return 'Tanggal tidak boleh kosong'
    if (!data.kode_kategori?.trim()) return 'Kategori tidak boleh kosong'
    if (!data.nip?.trim()) return 'Petugas tidak boleh kosong'
    if (!data.keterangan?.trim()) return 'Keterangan tidak boleh kosong'
    if (!data.keperluan?.trim()) return 'Keperluan tidak boleh kosong'
    const besar = Number(data.besar)
    if (!Number.isFinite(besar) || besar <= 0) return 'Pemasukan harus lebih dari 0'
    return null
}

async function create(data, username) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const besar = Number(data.besar)
    const jam = new Date().toTimeString().split(' ')[0]
    const db = await DatabaseService.get()
    const MAX_RETRY = 5

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        const client = await db.connect()
        try {
            await client.query('START TRANSACTION')

            const kategoriRes = await client.query(
                'SELECT kd_rek, kd_rek2, nama_kategori FROM kategori_pemasukan_lain WHERE kode_kategori = ?',
                [data.kode_kategori]
            )
            const kategori = kategoriRes.rows[0]
            if (!kategori) throw new Error('Kategori pemasukan tidak ditemukan')
            if (!kategori.kd_rek || !kategori.kd_rek2) throw new Error('Kategori ini belum diatur akun/kontra akunnya, hubungi administrator')

            const resNo = await client.query(
                "SELECT no_masuk FROM pemasukan_lain WHERE tanggal LIKE ? ORDER BY no_masuk DESC LIMIT 1 FOR UPDATE",
                [`${data.tanggal}%`]
            )
            const no_masuk = generateNoMasuk(resNo.rows[0]?.no_masuk, data.tanggal)

            await client.query(
                'INSERT INTO pemasukan_lain (no_masuk, tanggal, kode_kategori, besar, nip, keterangan, keperluan) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [no_masuk, `${data.tanggal} ${jam}`, data.kode_kategori, besar, data.nip.trim(), data.keterangan.trim(), data.keperluan.trim()]
            )

            await KeuanganJurnalService.postJurnalOnClient(client, {
                no_bukti: no_masuk,
                tgl_jurnal: data.tanggal,
                jam_jurnal: jam,
                jenis: 'U',
                keterangan: 'PEMASUKAN LAIN-LAIN',
                details: [
                    { kd_rek: kategori.kd_rek, debet: 0, kredit: besar },
                    { kd_rek: kategori.kd_rek2, debet: besar, kredit: 0 }
                ]
            }, username)

            await client.query('COMMIT')
            return { success: true, no_masuk }
        } catch (err) {
            await client.query('ROLLBACK')
            if (err.code === 'ER_DUP_ENTRY' && attempt < MAX_RETRY) continue
            if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
                return { success: false, message: 'Petugas (nip) atau kategori tidak valid' }
            }
            LogService.error('[KeuanganPemasukanLainService] Error create', { message: err.message, stack: err.stack, code: err.code })
            console.error('[KeuanganPemasukanLainService] Error create:', err)
            return { success: false, message: err.code === 'ER_DUP_ENTRY' ? 'Nomor bentrok, silakan coba lagi' : err.message }
        } finally {
            client.release()
        }
    }
}

// Replika BtnHapusActionPerformed: sama seperti Pengeluaran Harian, koreksi
// lewat JURNAL PEMBALIK (arah dibalik dari entry asli), bukan edit/hapus
// jurnal yang sudah diposting. Jurnal asli tetap utuh sebagai jejak audit.
async function deleteOne(no_masuk, username) {
    const db = await DatabaseService.get()
    const MAX_RETRY = 5

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        const client = await db.connect()
        try {
            await client.query('START TRANSACTION')

            const rowRes = await client.query(
                'SELECT tanggal, kode_kategori, besar FROM pemasukan_lain WHERE no_masuk = ?',
                [no_masuk]
            )
            const row = rowRes.rows[0]
            if (!row) throw new Error('Data pemasukan tidak ditemukan')

            const kategoriRes = await client.query(
                'SELECT kd_rek, kd_rek2 FROM kategori_pemasukan_lain WHERE kode_kategori = ?',
                [row.kode_kategori]
            )
            const kategori = kategoriRes.rows[0]
            if (!kategori) throw new Error('Kategori pemasukan tidak ditemukan')

            await client.query('DELETE FROM pemasukan_lain WHERE no_masuk = ?', [no_masuk])

            const tglJurnal = row.tanggal instanceof Date ? row.tanggal.toISOString().slice(0, 10) : String(row.tanggal).slice(0, 10)
            const jam = new Date().toTimeString().split(' ')[0]
            const besar = Number(row.besar)

            await KeuanganJurnalService.postJurnalOnClient(client, {
                no_bukti: no_masuk,
                tgl_jurnal: tglJurnal,
                jam_jurnal: jam,
                jenis: 'U',
                keterangan: 'PEMBATALAN PEMASUKAN LAIN-LAIN',
                details: [
                    { kd_rek: kategori.kd_rek, debet: besar, kredit: 0 },
                    { kd_rek: kategori.kd_rek2, debet: 0, kredit: besar }
                ]
            }, username)

            await client.query('COMMIT')
            return { success: true }
        } catch (err) {
            await client.query('ROLLBACK')
            if (err.code === 'ER_DUP_ENTRY' && attempt < MAX_RETRY) continue
            LogService.error('[KeuanganPemasukanLainService] Error deleteOne', { message: err.message, stack: err.stack, code: err.code })
            console.error('[KeuanganPemasukanLainService] Error deleteOne:', err)
            return { success: false, message: err.code === 'ER_DUP_ENTRY' ? 'Nomor jurnal bentrok, silakan coba lagi' : err.message }
        } finally {
            client.release()
        }
    }
}

export default { list, create, deleteOne, getNextNoMasuk, listPetugas }
