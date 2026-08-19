import DatabaseService from '../DatabaseService.js'
import LogService from '../../electron/LogService.js'

async function list(params = {}) {
    try {
        const db = await DatabaseService.get()
        let query = `SELECT j.no_jurnal, j.no_bukti, j.tgl_jurnal, j.jam_jurnal, j.keterangan, d.kd_rek, r.nm_rek, d.debet, d.kredit
            FROM jurnal j JOIN detailjurnal d ON j.no_jurnal = d.no_jurnal LEFT JOIN rekening r ON d.kd_rek = r.kd_rek WHERE 1=1`
        const args = []
        if (params.tgl_awal) { query += ' AND j.tgl_jurnal >= ?'; args.push(params.tgl_awal) }
        if (params.tgl_akhir) { query += ' AND j.tgl_jurnal <= ?'; args.push(params.tgl_akhir) }
        if (params.no_jurnal) { query += ' AND j.no_jurnal LIKE ?'; args.push(`%${params.no_jurnal}%`) }
        if (params.kd_rek) { query += ' AND d.kd_rek = ?'; args.push(params.kd_rek) }
        if (params.keyword) {
            query += ' AND (j.no_jurnal LIKE ? OR j.no_bukti LIKE ? OR d.kd_rek LIKE ? OR r.nm_rek LIKE ? OR j.keterangan LIKE ?)'
            const value = `%${params.keyword}%`
            args.push(value, value, value, value, value)
        }
        query += ' ORDER BY j.tgl_jurnal ASC, j.jam_jurnal ASC, j.no_jurnal ASC, d.debet DESC'
        const res = await db.query(query, args)
        const rows = res.rows.map(row => ({
            ...row,
            debet: Number(row.debet || 0),
            kredit: Number(row.kredit || 0),
            tgl_jurnal: row.tgl_jurnal instanceof Date ? row.tgl_jurnal.toISOString().slice(0, 10) : row.tgl_jurnal
        }))
        return {
            rows,
            total_debet: rows.reduce((sum, row) => sum + row.debet, 0),
            total_kredit: rows.reduce((sum, row) => sum + row.kredit, 0)
        }
    } catch (err) {
        LogService.error('[KeuanganJurnalHarianService] Error list', { message: err.message, stack: err.stack })
        console.error('[KeuanganJurnalHarianService] Error list:', err)
        throw err
    }
}

async function accounts(tahun) {
    try {
        const db = await DatabaseService.get()
        const res = await db.query('SELECT r.kd_rek, r.nm_rek, r.tipe, r.balance, COALESCE(rt.saldo_awal, 0) AS saldo_awal FROM rekening r LEFT JOIN rekeningtahun rt ON rt.kd_rek = r.kd_rek AND rt.thn = ? ORDER BY r.kd_rek', [tahun])
        return res.rows
    } catch (err) {
        LogService.error('[KeuanganJurnalHarianService] Error accounts', { message: err.message, stack: err.stack })
        console.error('[KeuanganJurnalHarianService] Error accounts:', err)
        throw err
    }
}

export default { list, accounts }
