import DatabaseService from '../DatabaseService.js'
import LogService from '../../electron/LogService.js'

async function accounts(tahun) {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(`
            SELECT r.kd_rek, r.nm_rek, r.tipe, r.balance, COALESCE(rt.saldo_awal, 0) AS saldo_awal
            FROM rekening r
            LEFT JOIN rekeningtahun rt ON r.kd_rek = rt.kd_rek AND rt.thn = ?
            ORDER BY r.kd_rek ASC
        `, [tahun])
        return res.rows
    } catch (err) {
        LogService.error('[KeuanganBukuBesarService] Error accounts', { message: err.message, stack: err.stack })
        console.error('[KeuanganBukuBesarService] Error accounts:', err)
        throw err
    }
}

async function list({ tgl_awal, tgl_akhir, kd_rek }) {
    if (!kd_rek || !tgl_awal || !tgl_akhir) {
        return { rows: [], mutasi_debet: 0, mutasi_kredit: 0, mutasi_sebelum_debet: 0, mutasi_sebelum_kredit: 0 }
    }

    try {
        const db = await DatabaseService.get()

        // Ambil mutasi sebelum tgl_awal (pada tahun yang sama dengan tgl_awal)
        const tahunAwal = tgl_awal.substring(0, 4)
        const awalTahun = `${tahunAwal}-01-01`

        const mutasiSebelumDb = await db.query(`
            SELECT SUM(dj.debet) AS debet, SUM(dj.kredit) AS kredit
            FROM jurnal j
            JOIN detailjurnal dj ON j.no_jurnal = dj.no_jurnal
            WHERE dj.kd_rek = ? AND j.tgl_jurnal >= ? AND j.tgl_jurnal < ?
        `, [kd_rek, awalTahun, tgl_awal])

        const mutasi_sebelum_debet = Number(mutasiSebelumDb.rows[0]?.debet || 0)
        const mutasi_sebelum_kredit = Number(mutasiSebelumDb.rows[0]?.kredit || 0)

        // Ambil mutasi dalam rentang
        const res = await db.query(`
            SELECT j.tgl_jurnal, j.jam_jurnal, j.no_jurnal, j.no_bukti, j.keterangan, dj.debet, dj.kredit
            FROM jurnal j
            JOIN detailjurnal dj ON j.no_jurnal = dj.no_jurnal
            WHERE dj.kd_rek = ? AND j.tgl_jurnal BETWEEN ? AND ?
            ORDER BY j.tgl_jurnal ASC, j.jam_jurnal ASC
        `, [kd_rek, tgl_awal, tgl_akhir])

        let mutasi_debet = 0
        let mutasi_kredit = 0

        res.rows.forEach(r => {
            mutasi_debet += Number(r.debet || 0)
            mutasi_kredit += Number(r.kredit || 0)
        })

        return {
            rows: res.rows,
            mutasi_debet,
            mutasi_kredit,
            mutasi_sebelum_debet,
            mutasi_sebelum_kredit
        }
    } catch (err) {
        LogService.error('[KeuanganBukuBesarService] Error list', { message: err.message, stack: err.stack })
        console.error('[KeuanganBukuBesarService] Error list:', err)
        throw err
    }
}

export default { accounts, list }
