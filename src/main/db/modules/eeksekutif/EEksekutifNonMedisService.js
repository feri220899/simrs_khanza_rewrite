import DatabaseService from '../../DatabaseService.js'

function toChart(obj) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))
}

async function sisaStokNonMedis() {
    const db = await DatabaseService.get()
    const query = await db.query(
        `SELECT b.kode_brng, b.nama_brng, b.kode_sat, b.stok, b.harga, j.nm_jenis 
         FROM ipsrsbarang b INNER JOIN ipsrsjenisbarang j ON b.jenis=j.kd_jenis 
         WHERE b.status='1' ORDER BY b.kode_brng ASC`
    )

    let totalAset = 0
    const jenisAset = {}
    
    const items = query.rows.map(row => {
        const stok = Number(row.stok || 0)
        const harga = Number(row.harga || 0)
        const nilaiAset = stok * harga
        totalAset += nilaiAset

        if (nilaiAset > 0) {
            jenisAset[row.nm_jenis] = (jenisAset[row.nm_jenis] || 0) + nilaiAset
        }

        return { ...row, stok, harga, nilaiAset }
    })

    return {
        items,
        totalAset,
        charts: [
            { title: 'Nilai Aset Per Jenis', data: toChart(jenisAset) }
        ]
    }
}

async function ringkasanMutasiNonMedis(tgl1, tgl2, jenisMutasi) {
    const db = await DatabaseService.get()
    const params = [tgl1, tgl2]
    
    let sql = ""
    if (jenisMutasi === 'pengadaan') {
        sql = `SELECT db.kode_brng, b.nama_brng, s.satuan, j.nm_jenis AS namajenis, 
               SUM(db.jumlah) AS jumlah, SUM(db.total) AS total 
               FROM ipsrspembelian h INNER JOIN ipsrsdetailbeli db ON h.no_faktur=db.no_faktur 
               INNER JOIN ipsrsbarang b ON db.kode_brng=b.kode_brng INNER JOIN kodesatuan s ON b.kode_sat=s.kode_sat 
               INNER JOIN ipsrsjenisbarang j ON b.jenis=j.kd_jenis 
               WHERE h.tgl_beli BETWEEN ? AND ? GROUP BY db.kode_brng ORDER BY b.nama_brng ASC`
    } else if (jenisMutasi === 'penerimaan') {
        sql = `SELECT db.kode_brng, b.nama_brng, s.satuan, j.nm_jenis AS namajenis, 
               SUM(db.jumlah) AS jumlah, SUM(db.total) AS total 
               FROM ipsrspemesanan h INNER JOIN ipsrsdetailpesan db ON h.no_faktur=db.no_faktur 
               INNER JOIN ipsrsbarang b ON db.kode_brng=b.kode_brng INNER JOIN kodesatuan s ON db.kode_sat=s.kode_sat 
               INNER JOIN ipsrsjenisbarang j ON b.jenis=j.kd_jenis 
               WHERE h.tgl_pesan BETWEEN ? AND ? GROUP BY db.kode_brng ORDER BY b.nama_brng ASC`
    } else if (jenisMutasi === 'hibah') {
        sql = `SELECT db.kode_brng, b.nama_brng, s.satuan, j.nm_jenis AS namajenis, 
               SUM(db.jumlah) AS jumlah, SUM(db.subtotalhibah) AS total 
                FROM ipsrs_hibah h INNER JOIN ipsrs_detail_hibah db ON h.no_hibah=db.no_hibah 
               INNER JOIN ipsrsbarang b ON db.kode_brng=b.kode_brng INNER JOIN kodesatuan s ON db.kode_sat=s.kode_sat 
               INNER JOIN ipsrsjenisbarang j ON b.jenis=j.kd_jenis 
               WHERE h.tgl_hibah BETWEEN ? AND ? GROUP BY db.kode_brng ORDER BY b.nama_brng ASC`
    } else if (jenisMutasi === 'stokkeluar') {
        sql = `SELECT db.kode_brng, b.nama_brng, s.satuan, j.nm_jenis AS namajenis, 
               SUM(db.jumlah) AS jumlah, SUM(db.total) AS total 
               FROM ipsrspengeluaran h INNER JOIN ipsrsdetailpengeluaran db ON h.no_keluar=db.no_keluar 
               INNER JOIN ipsrsbarang b ON db.kode_brng=b.kode_brng INNER JOIN kodesatuan s ON b.kode_sat=s.kode_sat 
               INNER JOIN ipsrsjenisbarang j ON b.jenis=j.kd_jenis 
               WHERE h.tanggal BETWEEN ? AND ? GROUP BY db.kode_brng ORDER BY b.nama_brng ASC`
    } else if (jenisMutasi === 'retursuplier') {
        sql = `SELECT db.kode_brng, b.nama_brng, s.satuan, j.nm_jenis AS namajenis, 
               SUM(db.jml_retur) AS jumlah, SUM(db.total) AS total 
               FROM ipsrsreturbeli h INNER JOIN ipsrs_detail_returbeli db ON h.no_retur_beli=db.no_retur_beli 
               INNER JOIN ipsrsbarang b ON db.kode_brng=b.kode_brng INNER JOIN kodesatuan s ON b.kode_sat=s.kode_sat 
               INNER JOIN ipsrsjenisbarang j ON b.jenis=j.kd_jenis 
               WHERE h.tgl_retur BETWEEN ? AND ? GROUP BY db.kode_brng ORDER BY b.nama_brng ASC`
    }

    if (!sql) throw new Error("Jenis mutasi non medis tidak valid: " + jenisMutasi)

    const result = await db.query(sql, params)
    
    let totalTransaksi = 0
    const jenis = {}

    const items = result.rows.map(row => {
        const total = Number(row.total || 0)
        totalTransaksi += total
        if (total > 0) {
            jenis[row.namajenis] = (jenis[row.namajenis] || 0) + total
        }
        return {
            ...row,
            jumlah: Number(row.jumlah || 0),
            total
        }
    })

    const byJumlahDesc = [...items].sort((a, b) => b.jumlah - a.jumlah).slice(0, 10)
    const byTotalDesc = [...items].sort((a, b) => b.total - a.total).slice(0, 10)

    return {
        items,
        totalTransaksi,
        charts: [
            { title: 'Berdasarkan Jenis', data: toChart(jenis) },
        ],
        topJumlah: byJumlahDesc.map(i => ({ label: i.nama_brng, value: i.jumlah })),
        topTotal: byTotalDesc.map(i => ({ label: i.nama_brng, value: i.total }))
    }
}

async function penerimaanVendorNonMedisPerBulan(tahun) {
    const db = await DatabaseService.get()
    const query = await db.query(`
        SELECT datasuplier.nama_suplier, 
            IFNULL(SUM(CASE WHEN LEFT(pemesanan.tgl_pesan, 7) = '${tahun}-01' THEN detailpesan.total ELSE 0 END),0) as bln1,
            IFNULL(SUM(CASE WHEN LEFT(pemesanan.tgl_pesan, 7) = '${tahun}-02' THEN detailpesan.total ELSE 0 END),0) as bln2,
            IFNULL(SUM(CASE WHEN LEFT(pemesanan.tgl_pesan, 7) = '${tahun}-03' THEN detailpesan.total ELSE 0 END),0) as bln3,
            IFNULL(SUM(CASE WHEN LEFT(pemesanan.tgl_pesan, 7) = '${tahun}-04' THEN detailpesan.total ELSE 0 END),0) as bln4,
            IFNULL(SUM(CASE WHEN LEFT(pemesanan.tgl_pesan, 7) = '${tahun}-05' THEN detailpesan.total ELSE 0 END),0) as bln5,
            IFNULL(SUM(CASE WHEN LEFT(pemesanan.tgl_pesan, 7) = '${tahun}-06' THEN detailpesan.total ELSE 0 END),0) as bln6,
            IFNULL(SUM(CASE WHEN LEFT(pemesanan.tgl_pesan, 7) = '${tahun}-07' THEN detailpesan.total ELSE 0 END),0) as bln7,
            IFNULL(SUM(CASE WHEN LEFT(pemesanan.tgl_pesan, 7) = '${tahun}-08' THEN detailpesan.total ELSE 0 END),0) as bln8,
            IFNULL(SUM(CASE WHEN LEFT(pemesanan.tgl_pesan, 7) = '${tahun}-09' THEN detailpesan.total ELSE 0 END),0) as bln9,
            IFNULL(SUM(CASE WHEN LEFT(pemesanan.tgl_pesan, 7) = '${tahun}-10' THEN detailpesan.total ELSE 0 END),0) as bln10,
            IFNULL(SUM(CASE WHEN LEFT(pemesanan.tgl_pesan, 7) = '${tahun}-11' THEN detailpesan.total ELSE 0 END),0) as bln11,
            IFNULL(SUM(CASE WHEN LEFT(pemesanan.tgl_pesan, 7) = '${tahun}-12' THEN detailpesan.total ELSE 0 END),0) as bln12 
        FROM ipsrspemesanan pemesanan INNER JOIN ipsrsdetailpesan detailpesan ON pemesanan.no_faktur = detailpesan.no_faktur 
        INNER JOIN ipsrssuplier datasuplier ON pemesanan.kode_suplier = datasuplier.kode_suplier 
        WHERE LEFT(pemesanan.tgl_pesan, 4) = ? 
        GROUP BY datasuplier.kode_suplier ORDER BY datasuplier.nama_suplier ASC`, [tahun])
    
    let totalAll = 0
    const perBulan = Array(12).fill(0)
    const items = query.rows.map(row => {
        let sumVendor = 0
        for (let i = 1; i <= 12; i++) {
            const v = Number(row[`bln${i}`] || 0)
            sumVendor += v
            perBulan[i-1] += v
        }
        totalAll += sumVendor
        return { nama_suplier: row.nama_suplier, bulan: Array.from({length: 12}, (_, i) => Number(row[`bln${i+1}`] || 0)), total: sumVendor }
    })
    
    return {
        items,
        totalAll,
        chartVendor: items.map(i => ({ label: i.nama_suplier, value: i.total })).sort((a,b)=>b.value-a.value),
        chartBulan: perBulan.map((val, i) => ({ label: `Bulan ${i+1}`, value: val }))
    }
}

export default { sisaStokNonMedis, ringkasanMutasiNonMedis, penerimaanVendorNonMedisPerBulan }