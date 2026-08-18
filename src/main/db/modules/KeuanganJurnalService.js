import DatabaseService from '../DatabaseService.js'

function generateNoJurnal(lastNo, tgl) {
    const prefix = 'JR' + tgl.replace(/-/g, '')
    if (!lastNo) return prefix + '000001'
    
    const urutStr = lastNo.slice(-6)
    const nextUrut = String(Number(urutStr) + 1).padStart(6, '0')
    return prefix + nextUrut
}

async function getNextNoJurnal(tanggal) {
    const db = await DatabaseService.get()
    const res = await db.query(
        "SELECT MAX(no_jurnal) as last_no FROM jurnal WHERE tgl_jurnal = ?",
        [tanggal]
    )
    return generateNoJurnal(res.rows[0]?.last_no, tanggal)
}

async function list(params = {}) {
    const db = await DatabaseService.get()
    let query = `
        SELECT j.no_jurnal, j.no_bukti, j.tgl_jurnal, j.jam_jurnal, j.jenis, j.keterangan,
               d.kd_rek, r.nm_rek, d.debet, d.kredit
        FROM jurnal j
        JOIN detailjurnal d ON j.no_jurnal = d.no_jurnal
        LEFT JOIN rekening r ON d.kd_rek = r.kd_rek
        WHERE 1=1
    `
    const args = []

    if (params.tgl_awal && params.tgl_akhir) {
        query += " AND j.tgl_jurnal BETWEEN ? AND ?"
        args.push(params.tgl_awal, params.tgl_akhir)
    } else if (params.tgl_awal) {
        query += " AND j.tgl_jurnal >= ?"
        args.push(params.tgl_awal)
    } else if (params.tgl_akhir) {
        query += " AND j.tgl_jurnal <= ?"
        args.push(params.tgl_akhir)
    }

    if (params.keyword) {
        query += ` AND (j.no_jurnal LIKE ? OR j.no_bukti LIKE ? OR j.keterangan LIKE ? OR r.nm_rek LIKE ? OR d.kd_rek LIKE ?)`
        const search = `%${params.keyword}%`
        args.push(search, search, search, search, search)
    }

    query += " ORDER BY j.tgl_jurnal DESC, j.jam_jurnal DESC, j.no_jurnal DESC"

    const res = await db.query(query, args)
    
    const grouped = []
    let currentJurnal = null

    for (const row of res.rows) {
        if (!currentJurnal || currentJurnal.no_jurnal !== row.no_jurnal) {
            if (currentJurnal) grouped.push(currentJurnal)
            currentJurnal = {
                no_jurnal: row.no_jurnal,
                no_bukti: row.no_bukti,
                tgl_jurnal: row.tgl_jurnal instanceof Date ? row.tgl_jurnal.toISOString().split('T')[0] : row.tgl_jurnal,
                jam_jurnal: row.jam_jurnal,
                jenis: row.jenis,
                keterangan: row.keterangan,
                details: []
            }
        }
        currentJurnal.details.push({
            kd_rek: row.kd_rek,
            nm_rek: row.nm_rek,
            debet: Number(row.debet),
            kredit: Number(row.kredit)
        })
    }
    if (currentJurnal) grouped.push(currentJurnal)

    for (const j of grouped) {
        j.total_debet = j.details.reduce((sum, d) => sum + d.debet, 0)
        j.total_kredit = j.details.reduce((sum, d) => sum + d.kredit, 0)
    }

    return grouped
}

async function create(data) {
    if (!data.tgl_jurnal) return { success: false, message: 'Tanggal jurnal tidak boleh kosong' }
    if (!data.details || !Array.isArray(data.details) || data.details.length === 0) {
        return { success: false, message: 'Detail jurnal tidak boleh kosong' }
    }

    const tgl = data.tgl_jurnal
    const jam = data.jam_jurnal || new Date().toTimeString().split(' ')[0]
    
    // Validasi balance
    let totalDebet = 0
    let totalKredit = 0
    for (const d of data.details) {
        if (!d.kd_rek) return { success: false, message: 'Ada detail jurnal tanpa kode rekening' }
        totalDebet += Number(d.debet || 0)
        totalKredit += Number(d.kredit || 0)
    }

    if (Math.abs(totalDebet - totalKredit) > 0.01) {
         return { success: false, message: 'Total debet dan kredit tidak seimbang (balance)' }
    }
    if (totalDebet <= 0 && totalKredit <= 0) {
         return { success: false, message: 'Total jurnal tidak boleh nol' }
    }

    const db = await DatabaseService.get()
    const client = await db.connect()

    try {
        await client.query('START TRANSACTION')

        const resNo = await client.query("SELECT MAX(no_jurnal) as last_no FROM jurnal WHERE tgl_jurnal = ?", [tgl])
        const no_jurnal = generateNoJurnal(resNo.rows[0]?.last_no, tgl)

        await client.query(
            "INSERT INTO jurnal (no_jurnal, no_bukti, tgl_jurnal, jam_jurnal, jenis, keterangan) VALUES (?, ?, ?, ?, ?, ?)",
            [no_jurnal, data.no_bukti || '', tgl, jam, data.jenis || 'U', data.keterangan || '']
        )

        for (const d of data.details) {
            await client.query(
                "INSERT INTO detailjurnal (no_jurnal, kd_rek, debet, kredit) VALUES (?, ?, ?, ?)",
                [no_jurnal, d.kd_rek, Number(d.debet || 0), Number(d.kredit || 0)]
            )
        }

        await client.query('COMMIT')
        return { success: true, no_jurnal }
    } catch (err) {
        await client.query('ROLLBACK')
        console.error('[KeuanganJurnalService] Error create:', err)
        return { success: false, message: err.message }
    } finally {
        client.release()
    }
}

async function update(no_jurnal, data) {
    if (!no_jurnal) return { success: false, message: 'Nomor jurnal tidak valid' }
    if (!data.tgl_jurnal) return { success: false, message: 'Tanggal jurnal tidak boleh kosong' }
    if (!data.details || !Array.isArray(data.details) || data.details.length === 0) {
        return { success: false, message: 'Detail jurnal tidak boleh kosong' }
    }

    const tgl = data.tgl_jurnal
    const jam = data.jam_jurnal || new Date().toTimeString().split(' ')[0]

    let totalDebet = 0
    let totalKredit = 0
    for (const d of data.details) {
        if (!d.kd_rek) return { success: false, message: 'Ada detail jurnal tanpa kode rekening' }
        totalDebet += Number(d.debet || 0)
        totalKredit += Number(d.kredit || 0)
    }

    if (Math.abs(totalDebet - totalKredit) > 0.01) {
        return { success: false, message: 'Total debet dan kredit tidak seimbang (balance)' }
    }
    if (totalDebet <= 0 && totalKredit <= 0) {
        return { success: false, message: 'Total jurnal tidak boleh nol' }
    }

    const db = await DatabaseService.get()
    const client = await db.connect()

    try {
        await client.query('START TRANSACTION')

        const resCheck = await client.query("SELECT no_jurnal FROM jurnal WHERE no_jurnal = ?", [no_jurnal])
        if (resCheck.rows.length === 0) {
            await client.query('ROLLBACK')
            return { success: false, message: 'Jurnal tidak ditemukan' }
        }

        await client.query(
            "UPDATE jurnal SET no_bukti = ?, tgl_jurnal = ?, jam_jurnal = ?, jenis = ?, keterangan = ? WHERE no_jurnal = ?",
            [data.no_bukti || '', tgl, jam, data.jenis || 'U', data.keterangan || '', no_jurnal]
        )

        await client.query("DELETE FROM detailjurnal WHERE no_jurnal = ?", [no_jurnal])

        for (const d of data.details) {
            await client.query(
                "INSERT INTO detailjurnal (no_jurnal, kd_rek, debet, kredit) VALUES (?, ?, ?, ?)",
                [no_jurnal, d.kd_rek, Number(d.debet || 0), Number(d.kredit || 0)]
            )
        }

        await client.query('COMMIT')
        return { success: true, no_jurnal }
    } catch (err) {
        await client.query('ROLLBACK')
        console.error('[KeuanganJurnalService] Error update:', err)
        return { success: false, message: err.message }
    } finally {
        client.release()
    }
}

async function deleteOne(no_jurnal) {
    const db = await DatabaseService.get()
    try {
        await db.query("DELETE FROM jurnal WHERE no_jurnal = ?", [no_jurnal])
        return { success: true }
    } catch (err) {
        console.error('[KeuanganJurnalService] Error delete:', err)
        return { success: false, message: err.message }
    }
}

export default { list, create, update, deleteOne, getNextNoJurnal }
