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

async function scalar(db, sql, params = []) {
    const { rows } = await db.query(sql, params)
    return Number(rows[0]?.jumlah || 0)
}

async function rl32({ tglAwal, tglAkhir, search = '' }) {
    const db = await DatabaseService.get()
    const { rows: poli } = await db.query(
        `SELECT kd_poli, nm_poli FROM poliklinik WHERE nm_poli LIKE ? ORDER BY nm_poli`,
        [`%${search.trim()}%`]
    )
    const data = []
    for (const row of poli) {
        const base = [row.kd_poli, tglAwal, tglAkhir]
        const rujukan = await scalar(db, `SELECT COUNT(rm.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN rujuk_masuk rm ON rm.no_rawat=rp.no_rawat WHERE rp.kd_poli=? AND rp.tgl_registrasi BETWEEN ? AND ?`, base)
        const nonrujukan = await scalar(db, `SELECT COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp WHERE rp.kd_poli=? AND rp.tgl_registrasi BETWEEN ? AND ? AND rp.no_rawat NOT IN(SELECT no_rawat FROM rujuk_masuk)`, base)
        const dirawat = await scalar(db, `SELECT COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN kamar_inap ki ON rp.no_rawat=ki.no_rawat WHERE rp.kd_poli=? AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY rp.no_rawat`, base)
        const dirujuk = await scalar(db, `SELECT COUNT(r.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN rujuk r ON r.no_rawat=rp.no_rawat WHERE rp.kd_poli=? AND rp.tgl_registrasi BETWEEN ? AND ?`, base)
        const meninggal = await scalar(db, `SELECT COUNT(rp.no_rkm_medis) AS jumlah FROM pasien_mati pm INNER JOIN reg_periksa rp ON rp.no_rkm_medis=pm.no_rkm_medis WHERE rp.kd_poli=? AND rp.tgl_registrasi BETWEEN ? AND ?`, base)
        const pulang = await scalar(db, `SELECT COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN kamar_inap ki ON rp.no_rawat=ki.no_rawat WHERE rp.kd_poli=? AND rp.tgl_registrasi BETWEEN ? AND ? AND ki.stts_pulang<>('Rujuk' OR 'Meninggal' OR 'Pindah Kamar') GROUP BY rp.no_rawat`, base)
        data.push({ jenis: row.nm_poli, rujukan, nonrujukan, dirawat, dirujuk, pulang, meninggal, doa: 0 })
    }
    return data
}

async function rl33({ tglAwal, tglAkhir, search = '' }) {
    const db = await DatabaseService.get()
    const params = [tglAwal, tglAkhir]
    let filter = ''
    if (search.trim()) {
        filter = 'AND jp.nm_perawatan LIKE ?'
        params.push(`%${search.trim()}%`)
    }
    const { rows } = await db.query(
        `SELECT jp.nm_perawatan AS jenis, COUNT(jp.nm_perawatan) AS jumlah
         FROM rawat_jl_dr rj INNER JOIN reg_periksa rp ON rj.no_rawat=rp.no_rawat
         INNER JOIN jns_perawatan jp ON rj.kd_jenis_prw=jp.kd_jenis_prw
         INNER JOIN poliklinik p ON rp.kd_poli=p.kd_poli
         WHERE p.nm_poli LIKE '%gigi%' AND rp.tgl_registrasi BETWEEN ? AND ? ${filter}
         GROUP BY p.kd_poli, p.nm_poli, jp.nm_perawatan ORDER BY p.nm_poli, jp.nm_perawatan`,
        params
    )
    return rows.map(row => ({ ...row, jumlah: Number(row.jumlah) }))
}

async function rl34({ tglAwal, tglAkhir, search = '' }) {
    const db = await DatabaseService.get()
    const params = []
    let filter = ''
    if (search.trim()) {
        filter = 'AND nm_perawatan LIKE ?'
        params.push(`%${search.trim()}%`)
    }
    const { rows: paket } = await db.query(`SELECT kode_paket, nm_perawatan FROM paket_operasi WHERE kategori='Kebidanan' ${filter} ORDER BY nm_perawatan`, params)
    const data = []
    const awal = `${tglAwal} 00:00:00.0`
    const akhir = `${tglAkhir} 23:59:59.0`
    for (const row of paket) {
        const base = [row.kode_paket, awal, akhir]
        const rujukrs = await scalar(db, `SELECT COUNT(o.kode_paket) AS jumlah FROM operasi o INNER JOIN rujuk_masuk rm ON rm.no_rawat=o.no_rawat WHERE o.kode_paket=? AND o.tgl_operasi BETWEEN ? AND ? AND (rm.perujuk LIKE '%rs%' OR rm.perujuk LIKE '%rumah sakit%')`, base)
        const rujukbidan = await scalar(db, `SELECT COUNT(o.kode_paket) AS jumlah FROM operasi o INNER JOIN rujuk_masuk rm ON rm.no_rawat=o.no_rawat WHERE o.kode_paket=? AND o.tgl_operasi BETWEEN ? AND ? AND (rm.perujuk LIKE '%bidan%' OR rm.perujuk LIKE '%Amd.Keb%')`, base)
        const rujukpuskesmas = await scalar(db, `SELECT COUNT(o.kode_paket) AS jumlah FROM operasi o INNER JOIN rujuk_masuk rm ON rm.no_rawat=o.no_rawat WHERE o.kode_paket=? AND rm.perujuk LIKE '%puskesmas%' AND o.tgl_operasi BETWEEN ? AND ?`, base)
        const rujuksemua = await scalar(db, `SELECT COUNT(o.kode_paket) AS jumlah FROM operasi o INNER JOIN rujuk_masuk rm ON rm.no_rawat=o.no_rawat WHERE o.kode_paket=? AND o.tgl_operasi BETWEEN ? AND ?`, base)
        const rujukmati = await scalar(db, `SELECT COUNT(o.kode_paket) AS jumlah FROM operasi o INNER JOIN rujuk_masuk rm ON rm.no_rawat=o.no_rawat INNER JOIN reg_periksa rp ON rm.no_rawat=rp.no_rawat INNER JOIN pasien_mati pm ON rp.no_rkm_medis=pm.no_rkm_medis WHERE o.kode_paket=? AND o.tgl_operasi BETWEEN ? AND ?`, base)
        const nonrujuktotal = await scalar(db, `SELECT COUNT(o.kode_paket) AS jumlah FROM operasi o WHERE o.no_rawat NOT IN(SELECT no_rawat FROM rujuk_masuk) AND o.kode_paket=? AND o.tgl_operasi BETWEEN ? AND ?`, base)
        const nonrujukmati = await scalar(db, `SELECT COUNT(o.kode_paket) AS jumlah FROM operasi o,reg_periksa rp,pasien_mati pm WHERE o.no_rawat NOT IN(SELECT no_rawat FROM rujuk_masuk) AND rp.no_rkm_medis=pm.no_rkm_medis AND o.kode_paket=? AND o.tgl_operasi BETWEEN ? AND ?`, base)
        const dirujuk = await scalar(db, `SELECT COUNT(o.kode_paket) AS jumlah FROM operasi o INNER JOIN rujuk r ON r.no_rawat=o.no_rawat WHERE o.kode_paket=? AND o.tgl_operasi BETWEEN ? AND ?`, base)
        data.push({ jenis: row.nm_perawatan, rujukrs, rujukbidan, rujukpuskesmas, rujuklain: rujuksemua-rujukrs-rujukbidan-rujukpuskesmas, rujukhidup: rujuksemua-rujukmati, rujukmati, rujuktotal: rujuksemua, nonrujukhidup: nonrujuktotal-nonrujukmati, nonrujukmati, nonrujuktotal, dirujuk })
    }
    return data
}

async function rl36({ tglAwal, tglAkhir, search = '' }) {
    const db = await DatabaseService.get()
    const params = []
    let filter = ''
    if (search.trim()) {
        filter = 'AND nm_perawatan LIKE ?'
        params.push(`%${search.trim()}%`)
    }
    const { rows: paket } = await db.query(`SELECT kode_paket, nm_perawatan FROM paket_operasi WHERE kategori='Operasi' ${filter} ORDER BY nm_perawatan`, params)
    const data = []
    for (const row of paket) {
        const nilai = {}
        for (const kategori of ['Khusus', 'Besar', 'Sedang', 'Kecil']) {
            nilai[kategori.toLowerCase()] = await scalar(db, `SELECT COUNT(kode_paket) AS jumlah FROM operasi WHERE kode_paket=? AND tgl_operasi BETWEEN ? AND ? AND kategori=?`, [row.kode_paket, `${tglAwal} 00:00:00.0`, `${tglAkhir} 23:59:59.0`, kategori])
        }
        data.push({ jenis: row.nm_perawatan, total: nilai.khusus+nilai.besar+nilai.sedang+nilai.kecil, ...nilai })
    }
    return data
}

async function rl37({ tglAwal, tglAkhir, search = '' }) {
    const db = await DatabaseService.get()
    const params = [tglAwal, tglAkhir]
    let filter = ''
    if (search.trim()) {
        filter = 'AND jpr.nm_perawatan LIKE ?'
        params.push(`%${search.trim()}%`)
    }
    const { rows } = await db.query(`SELECT jpr.nm_perawatan AS jenis, COUNT(jpr.nm_perawatan) AS jumlah FROM periksa_radiologi pr INNER JOIN jns_perawatan_radiologi jpr ON pr.kd_jenis_prw=jpr.kd_jenis_prw WHERE pr.tgl_periksa BETWEEN ? AND ? ${filter} GROUP BY jpr.nm_perawatan`, params)
    return rows.map(row => ({ ...row, jumlah: Number(row.jumlah) }))
}

async function rl38({ tglAwal, tglAkhir, search = '' }) {
    const db = await DatabaseService.get()
    const params = [tglAwal, tglAkhir]
    let filter = ''
    if (search.trim()) {
        filter = 'AND jpl.nm_perawatan LIKE ?'
        params.push(`%${search.trim()}%`)
    }
    const { rows: induk } = await db.query(`SELECT jpl.nm_perawatan AS jenis, COUNT(jpl.nm_perawatan) AS jumlah, jpl.kd_jenis_prw FROM periksa_lab pl INNER JOIN jns_perawatan_lab jpl ON pl.kd_jenis_prw=jpl.kd_jenis_prw WHERE pl.tgl_periksa BETWEEN ? AND ? ${filter} GROUP BY jpl.nm_perawatan`, params)
    const data = []
    for (const [index, row] of induk.entries()) {
        data.push({ no: String(index + 1), jenis: row.jenis, jumlah: Number(row.jumlah), level: 0 })
        const detailParams = [tglAwal, tglAkhir, row.kd_jenis_prw]
        let detailFilter = ''
        if (search.trim()) {
            detailFilter = 'AND tl.Pemeriksaan LIKE ?'
            detailParams.push(`%${search.trim()}%`)
        }
        const { rows: detail } = await db.query(`SELECT tl.Pemeriksaan AS jenis, COUNT(tl.Pemeriksaan) AS jumlah FROM detail_periksa_lab dpl INNER JOIN template_laboratorium tl ON dpl.id_template=tl.id_template WHERE dpl.tgl_periksa BETWEEN ? AND ? AND tl.kd_jenis_prw=? ${detailFilter} GROUP BY tl.Pemeriksaan`, detailParams)
        data.push(...detail.map((item, detailIndex) => ({ no: `${index + 1}.${detailIndex + 1}`, jenis: item.jenis, jumlah: Number(item.jumlah), level: 1 })))
    }
    return data
}

async function rl3({ jenis, ...params }) {
    const handlers = { rl32, rl33, rl34, rl36, rl37, rl38 }
    if (!handlers[jenis]) throw new Error('Jenis laporan RL tidak valid')
    return handlers[jenis](params)
}

function hitungKelompokUmur(rows) {
    const result = {
        hr0s6l: 0, hr0s6p: 0, hr7s28l: 0, hr7s28p: 0, hr28s1thl: 0, hr28s1thp: 0,
        th1s4l: 0, th1s4p: 0, th5s14l: 0, th5s14p: 0, th15s24l: 0, th15s24p: 0,
        th25s44l: 0, th25s44p: 0, th45s64l: 0, th45s64p: 0, lbth65l: 0, lbth65p: 0,
    }
    for (const row of rows) {
        const umur = Number(row.umurdaftar)
        const suffix = row.jk === 'L' ? 'l' : 'p'
        let key
        if (row.sttsumur === 'Hr') {
            if (umur <= 6) key = 'hr0s6'
            else if (umur <= 28) key = 'hr7s28'
            else key = 'hr28s1th'
        } else if (row.sttsumur === 'Bl') {
            key = 'hr28s1th'
        } else if (row.sttsumur === 'Th') {
            if (umur <= 4) key = 'th1s4'
            else if (umur <= 14) key = 'th5s14'
            else if (umur <= 24) key = 'th15s24'
            else if (umur <= 44) key = 'th25s44'
            else if (umur <= 64) key = 'th45s64'
            else key = 'lbth65'
        }
        if (key) result[`${key}${suffix}`]++
    }
    return result
}

function rl4FilterSebab(sebab, alias = 'dp') {
    return sebab
        ? `(LEFT(${alias}.kd_penyakit,1)='V' OR LEFT(${alias}.kd_penyakit,1)='W' OR LEFT(${alias}.kd_penyakit,1)='X' OR LEFT(${alias}.kd_penyakit,1)='Y')`
        : `(LEFT(${alias}.kd_penyakit,1)<>'V' OR LEFT(${alias}.kd_penyakit,1)<>'W' OR LEFT(${alias}.kd_penyakit,1)<>'X' OR LEFT(${alias}.kd_penyakit,1)<>'Y')`
}

function bentukRl4Row(penyakit, kelompok, mati) {
    const totalL = kelompok.hr0s6l + kelompok.hr7s28l + kelompok.hr28s1thl + kelompok.th1s4l + kelompok.th5s14l + kelompok.th15s24l + kelompok.th25s44l + kelompok.th45s64l + kelompok.lbth65l
    const totalP = kelompok.hr0s6p + kelompok.hr7s28p + kelompok.hr28s1thp + kelompok.th1s4p + kelompok.th5s14p + kelompok.th15s24p + kelompok.th25s44p + kelompok.th45s64p + kelompok.lbth65p
    return { kode: penyakit.kd_penyakit, penyakit: penyakit.nm_penyakit, ...kelompok, totalL, totalP, hidup: totalL + totalP - mati, mati }
}

async function rl4a({ tglAwal, tglAkhir, sebab = false, dasarTanggal = 'masuk' }) {
    const db = await DatabaseService.get()
    const keluar = dasarTanggal === 'keluar'
    const joinKamar = keluar ? 'INNER JOIN kamar_inap ki ON ki.no_rawat=rp.no_rawat' : ''
    const tanggal = keluar ? 'ki.tgl_keluar' : 'rp.tgl_registrasi'
    const prioritas = keluar ? "AND dp.prioritas='1'" : ''
    const kondisiSebab = rl4FilterSebab(sebab)
    const { rows: penyakit } = await db.query(
        `SELECT dp.kd_penyakit, SUBSTRING(p.nm_penyakit,1,80) AS nm_penyakit
         FROM diagnosa_pasien dp INNER JOIN penyakit p ON dp.kd_penyakit=p.kd_penyakit
         INNER JOIN reg_periksa rp ON rp.no_rawat=dp.no_rawat ${joinKamar}
         WHERE dp.status='Ranap' ${prioritas} AND ${tanggal} BETWEEN ? AND ? AND ${kondisiSebab}
         GROUP BY dp.kd_penyakit ORDER BY dp.kd_penyakit`,
        [tglAwal, tglAkhir]
    )
    const data = []
    for (const item of penyakit) {
        const { rows: pasien } = await db.query(
            `SELECT rp.umurdaftar, rp.sttsumur, p.jk FROM diagnosa_pasien dp
             INNER JOIN reg_periksa rp ON rp.no_rawat=dp.no_rawat INNER JOIN pasien p ON rp.no_rkm_medis=p.no_rkm_medis
             ${joinKamar} WHERE dp.status='Ranap' AND ${tanggal} BETWEEN ? AND ? AND dp.kd_penyakit=?`,
            [tglAwal, tglAkhir, item.kd_penyakit]
        )
        const mati = await scalar(db,
            `SELECT COUNT(pm.no_rkm_medis) AS jumlah FROM diagnosa_pasien dp
             INNER JOIN reg_periksa rp ON rp.no_rawat=dp.no_rawat INNER JOIN pasien p ON rp.no_rkm_medis=p.no_rkm_medis
             INNER JOIN pasien_mati pm ON pm.no_rkm_medis=p.no_rkm_medis ${joinKamar}
             WHERE dp.status='Ranap' AND ${tanggal} BETWEEN ? AND ? AND dp.kd_penyakit=? GROUP BY dp.kd_penyakit`,
            [tglAwal, tglAkhir, item.kd_penyakit]
        )
        data.push(bentukRl4Row(item, hitungKelompokUmur(pasien), mati))
    }
    return data
}

function rl4bFilter(params) {
    const values = []
    let sql = ''
    const fields = [
        ['poli', 'pol.nm_poli'], ['dokter', 'd.nm_dokter'], ['penjab', 'pj.png_jawab'],
        ['kabupaten', 'kab.nm_kab'], ['kecamatan', 'kec.nm_kec'], ['kelurahan', 'kel.nm_kel'],
    ]
    for (const [key, column] of fields) {
        if (params[key]?.trim()) {
            sql += ` AND ${column} LIKE ?`
            values.push(`%${params[key].trim()}%`)
        }
    }
    return { sql, values }
}

function rl4bJoins() {
    return `INNER JOIN reg_periksa rp ON rp.no_rawat=dp.no_rawat INNER JOIN pasien p ON rp.no_rkm_medis=p.no_rkm_medis
        INNER JOIN dokter d ON rp.kd_dokter=d.kd_dokter INNER JOIN poliklinik pol ON rp.kd_poli=pol.kd_poli
        INNER JOIN penjab pj ON rp.kd_pj=pj.kd_pj INNER JOIN kabupaten kab ON p.kd_kab=kab.kd_kab
        INNER JOIN kecamatan kec ON p.kd_kec=kec.kd_kec INNER JOIN kelurahan kel ON p.kd_kel=kel.kd_kel`
}

async function rl4b({ tglAwal, tglAkhir, sebab = false, ...params }) {
    const db = await DatabaseService.get()
    const filter = rl4bFilter(params)
    const joins = rl4bJoins()
    const kondisiSebab = rl4FilterSebab(sebab)
    const { rows: penyakit } = await db.query(
        `SELECT dp.kd_penyakit, SUBSTRING(py.nm_penyakit,1,80) AS nm_penyakit FROM diagnosa_pasien dp
         INNER JOIN penyakit py ON dp.kd_penyakit=py.kd_penyakit ${joins}
         WHERE dp.status='Ralan' AND dp.status_penyakit='Baru' AND rp.tgl_registrasi BETWEEN ? AND ? ${filter.sql}
         AND ${kondisiSebab} GROUP BY dp.kd_penyakit ORDER BY dp.kd_penyakit`,
        [tglAwal, tglAkhir, ...filter.values]
    )
    const data = []
    for (const item of penyakit) {
        const base = [tglAwal, tglAkhir, item.kd_penyakit, ...filter.values]
        const { rows: pasien } = await db.query(
            `SELECT rp.umurdaftar, rp.sttsumur, p.jk FROM diagnosa_pasien dp ${joins}
             WHERE dp.status='Ralan' AND dp.status_penyakit='Baru' AND rp.tgl_registrasi BETWEEN ? AND ? AND dp.kd_penyakit=? ${filter.sql}`,
            base
        )
        const mati = await scalar(db,
            `SELECT COUNT(pm.no_rkm_medis) AS jumlah FROM diagnosa_pasien dp ${joins}
             INNER JOIN pasien_mati pm ON pm.no_rkm_medis=p.no_rkm_medis
             WHERE dp.status='Ralan' AND dp.status_penyakit='Baru' AND rp.tgl_registrasi BETWEEN ? AND ? AND dp.kd_penyakit=? ${filter.sql}
             GROUP BY dp.kd_penyakit`,
            base
        )
        data.push(bentukRl4Row(item, hitungKelompokUmur(pasien), mati))
    }
    return data
}

async function rl4({ jenis, ...params }) {
    if (jenis === 'rl4a') return rl4a({ ...params, sebab: false })
    if (jenis === 'rl4asebab') return rl4a({ ...params, sebab: true })
    if (jenis === 'rl4b') return rl4b({ ...params, sebab: false })
    if (jenis === 'rl4bsebab') return rl4b({ ...params, sebab: true })
    throw new Error('Jenis laporan RL 4 tidak valid')
}

export default { rl13, borAlos, rl3, rl4 }
