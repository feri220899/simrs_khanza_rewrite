import DatabaseService from '../../DatabaseService.js'

function kategoriDurasi(durasi) {
    if (durasi <= 15) return 'limabelas'
    if (durasi <= 30) return 'tigapuluh'
    if (durasi <= 60) return 'satujam'
    return 'lebihsatujam'
}

function kategoriDurasiLab(durasi) {
    if (durasi <= 15) return 'limabelas'
    if (durasi <= 30) return 'tigapuluh'
    if (durasi <= 60) return 'satujam'
    if (durasi <= 120) return 'duajam'
    return 'lebihduajam'
}

function rekapRows(rows) {
    const global = { totaljam: 0, jumlah: 0, limabelas: 0, tigapuluh: 0, satujam: 0, lebihsatujam: 0 }
    const dokter = {}
    const poli = {}

    for (const row of rows) {
        const durasi = Number(row.durasi || 0)
        const kategori = kategoriDurasi(durasi)
        global.totaljam += durasi
        global.jumlah++
        global[kategori]++

        if (!dokter[row.nm_dokter]) dokter[row.nm_dokter] = { totaljam: 0, jumlah: 0, limabelas: 0, tigapuluh: 0, satujam: 0, lebihsatujam: 0 }
        dokter[row.nm_dokter].totaljam += durasi
        dokter[row.nm_dokter].jumlah++
        dokter[row.nm_dokter][kategori]++

        if (!poli[row.nm_poli]) poli[row.nm_poli] = { totaljam: 0, jumlah: 0, limabelas: 0, tigapuluh: 0, satujam: 0, lebihsatujam: 0 }
        poli[row.nm_poli].totaljam += durasi
        poli[row.nm_poli].jumlah++
        poli[row.nm_poli][kategori]++
    }

    const mapRekap = obj => Object.entries(obj)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, rata: value.jumlah ? value.totaljam / value.jumlah : 0, ...value }))

    return {
        global: { rata: global.jumlah ? global.totaljam / global.jumlah : 0, ...global },
        dokter: mapRekap(dokter),
        poli: mapRekap(poli),
        chart: [
            { label: '0 - 15 Menit', value: global.limabelas },
            { label: '>15 - <=30 Menit', value: global.tigapuluh },
            { label: '>30 - <=60 Menit', value: global.satujam },
            { label: '>60 Menit', value: global.lebihsatujam },
        ],
    }
}

function rekapIntervalLab(rows) {
    // 3 interval mutu (apotek, lab, radiologi)
    const i1 = { label: '', totaljam: 0, jumlah: 0, limabelas: 0, tigapuluh: 0, satujam: 0, duajam: 0, lebihduajam: 0 }
    const i2 = { label: '', totaljam: 0, jumlah: 0, limabelas: 0, tigapuluh: 0, satujam: 0, duajam: 0, lebihduajam: 0 }
    const i3 = { label: '', totaljam: 0, jumlah: 0, limabelas: 0, tigapuluh: 0, satujam: 0, duajam: 0, lebihduajam: 0 }

    for (const row of rows) {
        const d1 = Number(row.durasi1 || 0)
        const d2 = Number(row.durasi2 || 0)
        const d3 = Number(row.durasi3 || 0)
        
        i1.totaljam += d1; i1.jumlah++; i1[kategoriDurasiLab(d1)]++
        i2.totaljam += d2; i2.jumlah++; i2[kategoriDurasiLab(d2)]++
        i3.totaljam += d3; i3.jumlah++; i3[kategoriDurasiLab(d3)]++
    }

    const hitung = obj => ({ rata: obj.jumlah ? obj.totaljam / obj.jumlah : 0, ...obj })
    return [hitung(i1), hitung(i2), hitung(i3)]
}

function rekapIntervalApotek(rows) {
    const i1 = { label: '', totaljam: 0, jumlah: 0, limabelas: 0, tigapuluh: 0, satujam: 0, lebihsatujam: 0 }
    const i2 = { label: '', totaljam: 0, jumlah: 0, limabelas: 0, tigapuluh: 0, satujam: 0, lebihsatujam: 0 }
    const i3 = { label: '', totaljam: 0, jumlah: 0, limabelas: 0, tigapuluh: 0, satujam: 0, lebihsatujam: 0 }

    for (const row of rows) {
        const d1 = Number(row.durasi1 || 0)
        const d2 = Number(row.durasi2 || 0)
        const d3 = Number(row.durasi3 || 0)
        
        i1.totaljam += d1; i1.jumlah++; i1[kategoriDurasi(d1)]++
        i2.totaljam += d2; i2.jumlah++; i2[kategoriDurasi(d2)]++
        i3.totaljam += d3; i3.jumlah++; i3[kategoriDurasi(d3)]++
    }

    const hitung = obj => ({ rata: obj.jumlah ? obj.totaljam / obj.jumlah : 0, ...obj })
    return [hitung(i1), hitung(i2), hitung(i3)]
}

async function lamaPelayanan(tgl1, tgl2, jenis) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (!datePattern.test(tgl1) || !datePattern.test(tgl2)) throw new Error('Format tanggal harus YYYY-MM-DD')
    if (tgl1 > tgl2) throw new Error('Tanggal awal tidak boleh melebihi tanggal akhir')

    const db = await DatabaseService.get()
    let query

    if (jenis === 'poli') {
        query = await db.query(`SELECT rp.no_rkm_medis, d.nm_dokter, p.nm_poli,
            ROUND((TIME_TO_SEC(MIN(CONCAT(pr.tgl_perawatan,' ',pr.jam_rawat)))-TIME_TO_SEC(CONCAT(rp.tgl_registrasi,' ',rp.jam_reg)))/60,2) AS durasi
            FROM reg_periksa rp INNER JOIN dokter d ON rp.kd_dokter=d.kd_dokter
            INNER JOIN pasien ps ON rp.no_rkm_medis=ps.no_rkm_medis
            INNER JOIN poliklinik p ON rp.kd_poli=p.kd_poli
            INNER JOIN pemeriksaan_ralan pr ON rp.no_rawat=pr.no_rawat
            WHERE rp.tgl_registrasi BETWEEN ? AND ?
            GROUP BY rp.no_rawat, rp.no_rkm_medis, d.nm_dokter, p.nm_poli, rp.tgl_registrasi, rp.jam_reg`, [tgl1, tgl2])
        return { type: 'single', filter: { tgl1, tgl2, jenis }, ...rekapRows(query.rows) }
    } else if (jenis === 'rawatJalan') {
        query = await db.query(`SELECT rp.no_rkm_medis, d.nm_dokter, p.nm_poli,
            ROUND((TIME_TO_SEC(CONCAT(nj.tanggal,' ',nj.jam))-TIME_TO_SEC(CONCAT(rp.tgl_registrasi,' ',rp.jam_reg)))/60,2) AS durasi
            FROM reg_periksa rp INNER JOIN dokter d ON rp.kd_dokter=d.kd_dokter
            INNER JOIN pasien ps ON rp.no_rkm_medis=ps.no_rkm_medis
            INNER JOIN poliklinik p ON rp.kd_poli=p.kd_poli
            INNER JOIN nota_jalan nj ON rp.no_rawat=nj.no_rawat
            WHERE rp.tgl_registrasi BETWEEN ? AND ? ORDER BY rp.tgl_registrasi,rp.jam_reg`, [tgl1, tgl2])
        return { type: 'single', filter: { tgl1, tgl2, jenis }, ...rekapRows(query.rows) }
    } else if (jenis === 'apotek') {
        query = await db.query(`SELECT rp.no_rkm_medis, d.nm_dokter, p.nm_poli,
            ROUND((TIME_TO_SEC(CONCAT(ro.tgl_perawatan,' ',ro.jam))-TIME_TO_SEC(CONCAT(ro.tgl_peresepan,' ',ro.jam_peresepan)))/60,2) AS durasi1,
            ROUND((TIME_TO_SEC(CONCAT(ro.tgl_penyerahan,' ',ro.jam_penyerahan))-TIME_TO_SEC(CONCAT(ro.tgl_perawatan,' ',ro.jam)))/60,2) AS durasi2,
            ROUND((TIME_TO_SEC(CONCAT(ro.tgl_penyerahan,' ',ro.jam_penyerahan))-TIME_TO_SEC(CONCAT(ro.tgl_peresepan,' ',ro.jam_peresepan)))/60,2) AS durasi3
            FROM reg_periksa rp INNER JOIN dokter d ON rp.kd_dokter=d.kd_dokter
            INNER JOIN pasien ps ON rp.no_rkm_medis=ps.no_rkm_medis
            INNER JOIN poliklinik p ON rp.kd_poli=p.kd_poli
            INNER JOIN resep_obat ro ON rp.no_rawat=ro.no_rawat
            WHERE ro.tgl_peresepan <> '0000-00-00' AND ro.tgl_penyerahan <> '0000-00-00' AND ro.tgl_perawatan <> '0000-00-00'
            AND ro.tgl_peresepan BETWEEN ? AND ? ORDER BY ro.tgl_peresepan,ro.jam_peresepan`, [tgl1, tgl2])
        const rekap = rekapIntervalApotek(query.rows)
        rekap[0].label = 'Peresepan-Validasi'
        rekap[1].label = 'Validasi-Penyerahan'
        rekap[2].label = 'Peresepan-Penyerahan'
        return { type: 'intervalApotek', filter: { tgl1, tgl2, jenis }, rekap }
    } else if (['labpk', 'labpa', 'labmb', 'radiologi'].includes(jenis)) {
        let table = ''
        if (jenis === 'labpk') table = 'permintaan_lab'
        else if (jenis === 'labpa') table = 'permintaan_labpa'
        else if (jenis === 'labmb') table = 'permintaan_labmb'
        else if (jenis === 'radiologi') table = 'permintaan_radiologi'

        query = await db.query(`SELECT rp.no_rkm_medis, d.nm_dokter,
            ROUND((TIME_TO_SEC(CONCAT(t.tgl_sampel,' ',t.jam_sampel))-TIME_TO_SEC(CONCAT(t.tgl_permintaan,' ',t.jam_permintaan)))/60,2) AS durasi1,
            ROUND((TIME_TO_SEC(CONCAT(t.tgl_hasil,' ',t.jam_hasil))-TIME_TO_SEC(CONCAT(t.tgl_sampel,' ',t.jam_sampel)))/60,2) AS durasi2,
            ROUND((TIME_TO_SEC(CONCAT(t.tgl_hasil,' ',t.jam_hasil))-TIME_TO_SEC(CONCAT(t.tgl_permintaan,' ',t.jam_permintaan)))/60,2) AS durasi3
            FROM reg_periksa rp INNER JOIN dokter d ON rp.kd_dokter=d.kd_dokter
            INNER JOIN pasien ps ON rp.no_rkm_medis=ps.no_rkm_medis
            INNER JOIN ${table} t ON rp.no_rawat=t.no_rawat
            WHERE t.tgl_sampel <> '0000-00-00' AND t.tgl_hasil <> '0000-00-00'
            AND t.tgl_permintaan BETWEEN ? AND ? ORDER BY t.tgl_permintaan,t.jam_permintaan`, [tgl1, tgl2])
        const rekap = rekapIntervalLab(query.rows)
        rekap[0].label = 'Permintaan-Sampel'
        rekap[1].label = 'Sampel-Hasil'
        rekap[2].label = 'Permintaan-Hasil'
        return { type: 'intervalLab', filter: { tgl1, tgl2, jenis }, rekap }
    } else {
        throw new Error(`Jenis kendali mutu tidak valid: ${jenis}`)
    }
}

export default { lamaPelayanan }