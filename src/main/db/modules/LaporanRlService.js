import DatabaseService from '../DatabaseService.js'

async function rl13() {
    const db = await DatabaseService.get()
    const { rows } = await db.query(`
        SELECT 
            b.kd_bangsal, 
            b.nm_bangsal,
            COUNT(k.kd_kamar) AS tersedia,
            SUM(CASE WHEN k.status = 'ISI' THEN 1 ELSE 0 END) AS terpakai,
            SUM(CASE WHEN k.kelas = 'Kelas 1' THEN 1 ELSE 0 END) AS k1_tersedia,
            SUM(CASE WHEN k.kelas = 'Kelas 1' AND k.status = 'ISI' THEN 1 ELSE 0 END) AS k1_terpakai,
            SUM(CASE WHEN k.kelas = 'Kelas 2' THEN 1 ELSE 0 END) AS k2_tersedia,
            SUM(CASE WHEN k.kelas = 'Kelas 2' AND k.status = 'ISI' THEN 1 ELSE 0 END) AS k2_terpakai,
            SUM(CASE WHEN k.kelas = 'Kelas 3' THEN 1 ELSE 0 END) AS k3_tersedia,
            SUM(CASE WHEN k.kelas = 'Kelas 3' AND k.status = 'ISI' THEN 1 ELSE 0 END) AS k3_terpakai,
            SUM(CASE WHEN k.kelas = 'Kelas Utama' THEN 1 ELSE 0 END) AS ku_tersedia,
            SUM(CASE WHEN k.kelas = 'Kelas Utama' AND k.status = 'ISI' THEN 1 ELSE 0 END) AS ku_terpakai,
            SUM(CASE WHEN k.kelas = 'Kelas VIP' THEN 1 ELSE 0 END) AS kvip_tersedia,
            SUM(CASE WHEN k.kelas = 'Kelas VIP' AND k.status = 'ISI' THEN 1 ELSE 0 END) AS kvip_terpakai,
            SUM(CASE WHEN k.kelas = 'Kelas VVIP' THEN 1 ELSE 0 END) AS kvvip_tersedia,
            SUM(CASE WHEN k.kelas = 'Kelas VVIP' AND k.status = 'ISI' THEN 1 ELSE 0 END) AS kvvip_terpakai
        FROM bangsal b
        INNER JOIN kamar k ON k.kd_bangsal = b.kd_bangsal
        WHERE b.status = '1' AND k.statusdata = '1'
        GROUP BY b.kd_bangsal, b.nm_bangsal
        ORDER BY b.nm_bangsal
    `)
    return rows
}

async function borAlos({ tglAwal, tglAkhir, kdBangsal = '', filterTgl = 'masuk' }) {
    const db = await DatabaseService.get()
    
    const tglField = filterTgl === 'keluar' ? 'ki.tgl_keluar' : 'ki.tgl_masuk'
    
    const filters = [`${tglField} BETWEEN ? AND ?`]
    const params = [tglAwal, tglAkhir]
    const kamarFilters = ["k.statusdata = '1'"]
    const kamarParams = []

    if (kdBangsal) {
        filters.push('k.kd_bangsal = ?')
        params.push(kdBangsal)
        kamarFilters.push('k.kd_bangsal = ?')
        kamarParams.push(kdBangsal)
    }

    const { rows: detail } = await db.query(
        `SELECT ki.no_rawat, rp.no_rkm_medis, p.nm_pasien,
                CONCAT(ki.kd_kamar, ' ', b.nm_bangsal) AS kamar,
                ki.tgl_masuk,
                IF(ki.tgl_keluar = '0000-00-00', CURRENT_DATE(), ki.tgl_keluar) AS tgl_keluar,
                ki.lama, ki.stts_pulang
         FROM kamar_inap ki
         INNER JOIN reg_periksa rp ON rp.no_rawat = ki.no_rawat
         INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
         INNER JOIN kamar k ON k.kd_kamar = ki.kd_kamar
         INNER JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal
         WHERE ${filters.join(' AND ')}
         ORDER BY ${tglField}`,
        params
    )

    const { rows: [{ jumlahKamar }] } = await db.query(
        `SELECT COUNT(*) AS jumlahKamar FROM kamar k WHERE ${kamarFilters.join(' AND ')}`,
        kamarParams
    )

    const { rows: pasiens } = await db.query(
        `SELECT COUNT(ki.no_rawat) AS c
         FROM kamar_inap ki
         INNER JOIN kamar k ON k.kd_kamar = ki.kd_kamar
         WHERE ${filters.join(' AND ')}
         GROUP BY ki.no_rawat`,
        params
    )
    
    const jumlahPasien = pasiens.reduce((total, row) => total + Number(row.c || 0), 0)

    const hariPerawatan = detail.reduce((total, row) => total + Number(row.lama || 0), 0)
    const jumlahPasienAman = jumlahPasien || 0
    const jumlahHari = Math.floor((new Date(`${tglAkhir}T00:00:00`) - new Date(`${tglAwal}T00:00:00`)) / 86400000) + 1
    const bor = Number(jumlahKamar) > 0 && jumlahHari > 0 ? (hariPerawatan / (Number(jumlahKamar) * jumlahHari)) * 100 : 0
    const alos = jumlahPasienAman > 0 ? hariPerawatan / jumlahPasienAman : 0

    return {
        detail,
        summary: {
            hariPerawatan,
            jumlahKamar: Number(jumlahKamar),
            jumlahHari,
            jumlahPasien: jumlahPasienAman,
            bor,
            alos,
        },
    }
}

export default { rl13, borAlos }
