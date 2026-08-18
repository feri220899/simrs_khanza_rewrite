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

    if (params.jenis) {
        query += " AND j.jenis = ?"
        args.push(params.jenis)
    }

    if (params.kd_rek) {
        query += " AND j.no_jurnal IN (SELECT no_jurnal FROM detailjurnal WHERE kd_rek = ?)"
        args.push(params.kd_rek)
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

function validateDetails(details) {
    let totalDebet = 0
    let totalKredit = 0
    for (const d of details) {
        if (!d.kd_rek) return { error: 'Ada detail jurnal tanpa kode rekening' }
        const debet = Number(d.debet || 0)
        const kredit = Number(d.kredit || 0)
        if (!Number.isFinite(debet) || !Number.isFinite(kredit) || debet < 0 || kredit < 0) {
            return { error: `Nilai debet/kredit tidak valid pada rekening ${d.kd_rek}` }
        }
        if (debet > 0 && kredit > 0) {
            return { error: `Satu baris hanya boleh memiliki nilai Debet atau Kredit (rekening ${d.kd_rek})` }
        }
        if (debet === 0 && kredit === 0) {
            return { error: `Baris rekening ${d.kd_rek} tidak boleh kosong` }
        }
        totalDebet += debet
        totalKredit += kredit
    }
    if (Math.abs(totalDebet - totalKredit) > 0.01) {
        return { error: 'Total debet dan kredit tidak seimbang (balance)' }
    }
    if (totalDebet <= 0) {
        return { error: 'Total jurnal tidak boleh nol' }
    }
    return { totalDebet, totalKredit }
}

// Replika validasi arah saldo di DlgJurnal.java BtnTambahActionPerformed: untuk jurnal
// jenis Umum, rekening Rugi-Laba (tipe R) tidak boleh diisi berlawanan arah dari saldo
// normalnya (balance). Jenis Penyesuaian dikecualikan karena memang dipakai buat koreksi.
async function validateArahSaldo(details, jenis, db) {
    if (jenis === 'P') return null
    const kodeList = [...new Set(details.map(d => d.kd_rek))]
    if (kodeList.length === 0) return null
    const placeholders = kodeList.map(() => '?').join(',')
    const res = await db.query(`SELECT kd_rek, tipe, balance FROM rekening WHERE kd_rek IN (${placeholders})`, kodeList)
    const map = new Map(res.rows.map(r => [r.kd_rek, r]))
    for (const d of details) {
        const rek = map.get(d.kd_rek)
        if (!rek || rek.tipe !== 'R') continue
        if (rek.balance === 'K' && Number(d.debet || 0) > 0) {
            return `Rekening ${d.kd_rek} bertipe Rugi Laba dengan balance Kredit — Debet harus 0 untuk jurnal Umum`
        }
        if (rek.balance === 'D' && Number(d.kredit || 0) > 0) {
            return `Rekening ${d.kd_rek} bertipe Rugi Laba dengan balance Debet — Kredit harus 0 untuk jurnal Umum`
        }
    }
    return null
}

// Jurnal yang sudah tersimpan bersifat final (selaras dengan DlgCariJurnal.java yang
// hanya punya Cari/Print, tanpa Hapus/Edit) — koreksi wajib lewat jurnal baru jenis
// Penyesuaian ('P'), bukan mengubah/menghapus baris yang sudah diposting.
async function create(data, username) {
    if (!data.tgl_jurnal) return { success: false, message: 'Tanggal jurnal tidak boleh kosong' }
    if (!data.no_bukti?.trim()) return { success: false, message: 'No. Bukti tidak boleh kosong' }
    if (!data.keterangan?.trim()) return { success: false, message: 'Keterangan tidak boleh kosong' }
    if (!data.details || !Array.isArray(data.details) || data.details.length === 0) {
        return { success: false, message: 'Detail jurnal tidak boleh kosong' }
    }

    const validated = validateDetails(data.details)
    if (validated.error) return { success: false, message: validated.error }

    const jenis = data.jenis || 'U'
    const tgl = data.tgl_jurnal
    const jam = data.jam_jurnal || new Date().toTimeString().split(' ')[0]
    const keterangan = `${data.keterangan.trim()}, OLEH ${username || '-'}`

    const db = await DatabaseService.get()

    const arahError = await validateArahSaldo(data.details, jenis, db)
    if (arahError) return { success: false, message: arahError }

    const MAX_RETRY = 5

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        const client = await db.connect()
        try {
            await client.query('START TRANSACTION')

            // Kunci baris terakhir tanggal ini supaya insert paralel tidak dapat nomor sama.
            const resNo = await client.query(
                "SELECT no_jurnal FROM jurnal WHERE tgl_jurnal = ? ORDER BY no_jurnal DESC LIMIT 1 FOR UPDATE",
                [tgl]
            )
            const no_jurnal = generateNoJurnal(resNo.rows[0]?.no_jurnal, tgl)

            await client.query(
                "INSERT INTO jurnal (no_jurnal, no_bukti, tgl_jurnal, jam_jurnal, jenis, keterangan) VALUES (?, ?, ?, ?, ?, ?)",
                [no_jurnal, data.no_bukti.trim(), tgl, jam, jenis, keterangan]
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
            if (err.code === 'ER_DUP_ENTRY' && attempt < MAX_RETRY) continue
            if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
                return { success: false, message: 'Ada kode rekening yang tidak ditemukan di Master COA' }
            }
            console.error('[KeuanganJurnalService] Error create:', err)
            return { success: false, message: err.code === 'ER_DUP_ENTRY' ? 'Nomor jurnal bentrok, silakan coba lagi' : err.message }
        } finally {
            client.release()
        }
    }
}

export default { list, create, getNextNoJurnal }
