import DatabaseService from '../DatabaseService.js'
import LogService from '../../electron/LogService.js'

async function list(tahun) {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(`
            SELECT r.kd_rek, r.nm_rek, r.tipe, r.balance, COALESCE(rt.saldo_awal, 0) AS saldo_awal
            FROM rekening r
            LEFT JOIN rekeningtahun rt ON r.kd_rek = rt.kd_rek AND rt.thn = ?
            ORDER BY r.kd_rek ASC
        `, [tahun])
        return res.rows
    } catch (error) {
        LogService.error('[KeuanganRekeningTahunService] Error list', { message: error.message, stack: error.stack })
        console.error('[KeuanganRekeningTahunService] Error list:', error)
        throw error
    }
}

async function save(tahun, data) {
    const db = await DatabaseService.get()
    const client = await db.connect()

    try {
        await client.query('START TRANSACTION')

        // Insert data baru batch pakai ON DUPLICATE KEY UPDATE untuk menghindari delete semua
        if (data && data.length > 0) {
            for (const item of data) {
                if (!item.kd_rek || item.saldo_awal === undefined || item.saldo_awal === null) continue;

                await client.query(
                    'INSERT INTO rekeningtahun (thn, kd_rek, saldo_awal) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE saldo_awal = VALUES(saldo_awal)',
                    [tahun, item.kd_rek, item.saldo_awal]
                )
            }
        }

        await client.query('COMMIT')
        return { success: true }
    } catch (error) {
        await client.query('ROLLBACK')
        LogService.error('[KeuanganRekeningTahunService] Error save', { message: error.message, stack: error.stack })
        console.error('[KeuanganRekeningTahunService] Error save:', error)
        return { success: false, message: error.message }
    } finally {
        client.release()
    }
}

export default { list, save }
