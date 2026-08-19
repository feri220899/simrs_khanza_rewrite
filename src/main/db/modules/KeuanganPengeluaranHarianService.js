import DatabaseService from '../DatabaseService.js'
import KeuanganJurnalService from './KeuanganJurnalService.js'
import LogService from '../../electron/LogService.js'

// Replika DlgPengeluaranHarian.java. Cabang "Host to Host Bank Mandiri" (bayar
// pihak ke-3 lewat rekening bank tertentu) SENGAJA TIDAK diporting — di luar
// scope awal sesuai Keuangan.md ("integrasi bank/host-to-host"). Kalau kontra
// akun kategori kebetulan diarahkan ke akun yang di Java dipakai utk itu, di
// sini tetap diperlakukan sebagai transaksi kas biasa (tidak ada penanganan
// khusus) — batasan ini dicatat di Keuangan.md, bukan cacat tersembunyi.

function generateNoKeluar(lastNo, tgl) {
    const [y, m, d] = tgl.split('-')
    const prefix = 'PH' + y + m + d
    if (!lastNo) return prefix + '001'
    const urutStr = lastNo.slice(-3)
    const nextUrut = String(Number(urutStr) + 1).padStart(3, '0')
    return prefix + nextUrut
}

async function getNextNoKeluar(tanggal) {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(
            "SELECT no_keluar FROM pengeluaran_harian WHERE tanggal LIKE ? ORDER BY no_keluar DESC LIMIT 1",
            [`${tanggal}%`]
        )
        return generateNoKeluar(res.rows[0]?.no_keluar, tanggal)
    } catch (err) {
        LogService.error('[KeuanganPengeluaranHarianService] Error getNextNoKeluar', { message: err.message, stack: err.stack })
        console.error('[KeuanganPengeluaranHarianService] Error getNextNoKeluar:', err)
        throw err
    }
}

async function list(params = {}) {
  try {
    const db = await DatabaseService.get()
    let query = `
        SELECT ph.no_keluar, ph.tanggal, ph.keterangan, ph.biaya, ph.nip, ph.kode_kategori,
               pt.nama AS nama_petugas, k.nama_kategori
        FROM pengeluaran_harian ph
        JOIN petugas pt ON ph.nip = pt.nip
        JOIN kategori_pengeluaran_harian k ON ph.kode_kategori = k.kode_kategori
        WHERE 1=1
    `
    const args = []

    if (params.tgl_awal && params.tgl_akhir) {
        query += ' AND ph.tanggal BETWEEN ? AND ?'
        args.push(`${params.tgl_awal} 00:00:00`, `${params.tgl_akhir} 23:59:59`)
    }

    if (params.keyword) {
        query += ` AND (ph.keterangan LIKE ? OR ph.nip LIKE ? OR pt.nama LIKE ? OR ph.kode_kategori LIKE ? OR k.nama_kategori LIKE ? OR ph.no_keluar LIKE ?)`
        const search = `%${params.keyword}%`
        args.push(search, search, search, search, search, search)
    }

    query += ' ORDER BY ph.tanggal DESC, ph.no_keluar DESC'

    const res = await db.query(query, args)
    const rows = res.rows.map(r => ({
        ...r,
        biaya: Number(r.biaya || 0),
        tanggal: r.tanggal instanceof Date ? r.tanggal.toISOString().slice(0, 19).replace('T', ' ') : r.tanggal
    }))
    return { rows, total: rows.reduce((sum, r) => sum + r.biaya, 0) }
  } catch (err) {
    LogService.error('[KeuanganPengeluaranHarianService] Error list', { message: err.message, stack: err.stack })
    console.error('[KeuanganPengeluaranHarianService] Error list:', err)
    throw err
  }
}

function validate(data) {
    if (!data.tanggal) return 'Tanggal tidak boleh kosong'
    if (!data.kode_kategori?.trim()) return 'Kategori tidak boleh kosong'
    if (!data.nip?.trim()) return 'Petugas tidak boleh kosong'
    if (!data.keterangan?.trim()) return 'Keterangan tidak boleh kosong'
    const biaya = Number(data.biaya)
    if (!Number.isFinite(biaya) || biaya <= 0) return 'Pengeluaran harus lebih dari 0'
    return null
}

async function create(data, username) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const biaya = Number(data.biaya)
    const jam = new Date().toTimeString().split(' ')[0]
    const db = await DatabaseService.get()
    const MAX_RETRY = 5

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        const client = await db.connect()
        try {
            await client.query('START TRANSACTION')

            const kategoriRes = await client.query(
                'SELECT kd_rek, kd_rek2, nama_kategori FROM kategori_pengeluaran_harian WHERE kode_kategori = ?',
                [data.kode_kategori]
            )
            const kategori = kategoriRes.rows[0]
            if (!kategori) throw new Error('Kategori pengeluaran tidak ditemukan')
            if (!kategori.kd_rek || !kategori.kd_rek2) throw new Error('Kategori ini belum diatur akun/kontra akunnya, hubungi administrator')

            const resNo = await client.query(
                "SELECT no_keluar FROM pengeluaran_harian WHERE tanggal LIKE ? ORDER BY no_keluar DESC LIMIT 1 FOR UPDATE",
                [`${data.tanggal}%`]
            )
            const no_keluar = generateNoKeluar(resNo.rows[0]?.no_keluar, data.tanggal)

            await client.query(
                'INSERT INTO pengeluaran_harian (no_keluar, tanggal, kode_kategori, biaya, nip, keterangan) VALUES (?, ?, ?, ?, ?, ?)',
                [no_keluar, `${data.tanggal} ${jam}`, data.kode_kategori, biaya, data.nip.trim(), data.keterangan.trim()]
            )

            await KeuanganJurnalService.postJurnalOnClient(client, {
                no_bukti: no_keluar,
                tgl_jurnal: data.tanggal,
                jam_jurnal: jam,
                jenis: 'U',
                keterangan: 'PENGELUARAN HARIAN',
                details: [
                    { kd_rek: kategori.kd_rek, debet: biaya, kredit: 0 },
                    { kd_rek: kategori.kd_rek2, debet: 0, kredit: biaya }
                ]
            }, username)

            await client.query('COMMIT')
            return { success: true, no_keluar }
        } catch (err) {
            await client.query('ROLLBACK')
            if (err.code === 'ER_DUP_ENTRY' && attempt < MAX_RETRY) continue
            if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
                return { success: false, message: 'Petugas (nip) atau kategori tidak valid' }
            }
            LogService.error('[KeuanganPengeluaranHarianService] Error create', { message: err.message, stack: err.stack, code: err.code })
            console.error('[KeuanganPengeluaranHarianService] Error create:', err)
            return { success: false, message: err.code === 'ER_DUP_ENTRY' ? 'Nomor bentrok, silakan coba lagi' : err.message }
        } finally {
            client.release()
        }
    }
}

// Replika BtnHapusActionPerformed: BUKAN edit/hapus jurnal yang sudah
// diposting (dilarang §4.3 poin 7) — baris pengeluaran_harian dihapus, lalu
// diposting JURNAL PEMBALIK (debet/kredit persis dibalik dari entry asli,
// keterangan "PEMBATALAN PENGELUARAN HARIAN") memakai no_bukti yang sama
// dengan transaksi asli. Jurnal asli tetap utuh di riwayat sebagai jejak audit.
async function deleteOne(no_keluar, username) {
    const db = await DatabaseService.get()
    const MAX_RETRY = 5

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        const client = await db.connect()
        try {
            await client.query('START TRANSACTION')

            const rowRes = await client.query(
                'SELECT tanggal, kode_kategori, biaya FROM pengeluaran_harian WHERE no_keluar = ?',
                [no_keluar]
            )
            const row = rowRes.rows[0]
            if (!row) throw new Error('Data pengeluaran tidak ditemukan')

            const kategoriRes = await client.query(
                'SELECT kd_rek, kd_rek2 FROM kategori_pengeluaran_harian WHERE kode_kategori = ?',
                [row.kode_kategori]
            )
            const kategori = kategoriRes.rows[0]
            if (!kategori) throw new Error('Kategori pengeluaran tidak ditemukan')

            await client.query('DELETE FROM pengeluaran_harian WHERE no_keluar = ?', [no_keluar])

            const tglJurnal = row.tanggal instanceof Date ? row.tanggal.toISOString().slice(0, 10) : String(row.tanggal).slice(0, 10)
            const jam = new Date().toTimeString().split(' ')[0]
            const biaya = Number(row.biaya)

            await KeuanganJurnalService.postJurnalOnClient(client, {
                no_bukti: no_keluar,
                tgl_jurnal: tglJurnal,
                jam_jurnal: jam,
                jenis: 'U',
                keterangan: 'PEMBATALAN PENGELUARAN HARIAN',
                details: [
                    { kd_rek: kategori.kd_rek, debet: 0, kredit: biaya },
                    { kd_rek: kategori.kd_rek2, debet: biaya, kredit: 0 }
                ]
            }, username)

            await client.query('COMMIT')
            return { success: true }
        } catch (err) {
            await client.query('ROLLBACK')
            if (err.code === 'ER_DUP_ENTRY' && attempt < MAX_RETRY) continue
            LogService.error('[KeuanganPengeluaranHarianService] Error deleteOne', { message: err.message, stack: err.stack, code: err.code })
            console.error('[KeuanganPengeluaranHarianService] Error deleteOne:', err)
            return { success: false, message: err.code === 'ER_DUP_ENTRY' ? 'Nomor jurnal bentrok, silakan coba lagi' : err.message }
        } finally {
            client.release()
        }
    }
}

export default { list, create, deleteOne, getNextNoKeluar }
