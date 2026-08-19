import DatabaseService from '../../DatabaseService.js'

function toChart(obj) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))
}

async function sisaStokDapur() {
    const db = await DatabaseService.get()
    const query = await db.query(`SELECT dapurbarang.kode_brng, dapurbarang.nama_brng, dapurbarang.kode_sat, dapurbarang.jenis, dapurbarang.stok, dapurbarang.harga FROM dapurbarang WHERE dapurbarang.status='1' ORDER BY dapurbarang.kode_brng ASC`)
    let totalAset = 0
    const jenis = {}
    const items = query.rows.map(row => {
        const stok = Number(row.stok || 0)
        const harga = Number(row.harga || 0)
        const nilaiAset = stok * harga
        totalAset += nilaiAset
        if (nilaiAset > 0) jenis[row.jenis] = (jenis[row.jenis] || 0) + nilaiAset
        return { ...row, stok, harga, nilaiAset }
    })
    return { items, totalAset, charts: [{ title: 'Nilai Aset Per Jenis', data: toChart(jenis) }] }
}

async function ringkasanMutasiDapur(tgl1, tgl2, jenisMutasi) {
    const db = await DatabaseService.get()
    const params = [tgl1, tgl2]
    let sql = ''
    if (jenisMutasi === 'pengadaan') {
        sql = `SELECT db.kode_brng, b.nama_brng, b.jenis AS namajenis, s.satuan, SUM(db.jumlah) AS jumlah, SUM(db.total) AS total FROM dapurpembelian h INNER JOIN dapurdetailbeli db ON h.no_faktur=db.no_faktur INNER JOIN dapurbarang b ON db.kode_brng=b.kode_brng INNER JOIN kodesatuan s ON b.kode_sat=s.kode_sat WHERE h.tgl_beli BETWEEN ? AND ? GROUP BY db.kode_brng ORDER BY b.nama_brng ASC`
    } else if (jenisMutasi === 'penerimaan') {
        sql = `SELECT db.kode_brng, b.nama_brng, b.jenis AS namajenis, s.satuan, SUM(db.jumlah) AS jumlah, SUM(db.total) AS total FROM dapurpemesanan h INNER JOIN dapurdetailpesan db ON h.no_faktur=db.no_faktur INNER JOIN dapurbarang b ON db.kode_brng=b.kode_brng INNER JOIN kodesatuan s ON db.kode_sat=s.kode_sat WHERE h.tgl_pesan BETWEEN ? AND ? GROUP BY db.kode_brng ORDER BY b.nama_brng ASC`
    } else if (jenisMutasi === 'hibah') {
        sql = `SELECT db.kode_brng, b.nama_brng, b.jenis AS namajenis, s.satuan, SUM(db.jumlah) AS jumlah, SUM(db.subtotalhibah) AS total FROM dapur_hibah h INNER JOIN dapur_detail_hibah db ON h.no_hibah=db.no_hibah INNER JOIN dapurbarang b ON db.kode_brng=b.kode_brng INNER JOIN kodesatuan s ON db.kode_sat=s.kode_sat WHERE h.tgl_hibah BETWEEN ? AND ? GROUP BY db.kode_brng ORDER BY b.nama_brng ASC`
    } else if (jenisMutasi === 'stokkeluar') {
        sql = `SELECT db.kode_brng, b.nama_brng, b.jenis AS namajenis, s.satuan, SUM(db.jumlah) AS jumlah, SUM(db.total) AS total FROM dapurpengeluaran h INNER JOIN dapurdetailpengeluaran db ON h.no_keluar=db.no_keluar INNER JOIN dapurbarang b ON db.kode_brng=b.kode_brng INNER JOIN kodesatuan s ON b.kode_sat=s.kode_sat WHERE h.tanggal BETWEEN ? AND ? GROUP BY db.kode_brng ORDER BY b.nama_brng ASC`
    } else if (jenisMutasi === 'retursuplier') {
        sql = `SELECT db.kode_brng, b.nama_brng, b.jenis AS namajenis, s.satuan, SUM(db.jml_retur) AS jumlah, SUM(db.total) AS total FROM dapurreturbeli h INNER JOIN dapur_detail_returbeli db ON h.no_retur_beli=db.no_retur_beli INNER JOIN dapurbarang b ON db.kode_brng=b.kode_brng INNER JOIN kodesatuan s ON db.kode_sat=s.kode_sat WHERE h.tgl_retur BETWEEN ? AND ? GROUP BY db.kode_brng ORDER BY b.nama_brng ASC`
    }
    if (!sql) throw new Error('Jenis mutasi dapur tidak valid: ' + jenisMutasi)
    const result = await db.query(sql, params)
    let totalTransaksi = 0
    const jenis = {}
    const items = result.rows.map(row => {
        const total = Number(row.total || 0)
        totalTransaksi += total
        if (total > 0) jenis[row.namajenis] = (jenis[row.namajenis] || 0) + total
        return { ...row, jumlah: Number(row.jumlah || 0), total }
    })
    return { items, totalTransaksi, charts: [{ title: 'Berdasarkan Jenis', data: toChart(jenis) }], topJumlah: [...items].sort((a,b)=>b.jumlah-a.jumlah).slice(0,10).map(i => ({ label: i.nama_brng, value: i.jumlah })), topTotal: [...items].sort((a,b)=>b.total-a.total).slice(0,10).map(i => ({ label: i.nama_brng, value: i.total })) }
}

async function penerimaanVendorDapurPerBulan(tahun) {
    const db = await DatabaseService.get()
    const query = await db.query(`SELECT dapursuplier.nama_suplier, IFNULL(SUM(CASE WHEN LEFT(dapurpemesanan.tgl_pesan, 7)='${tahun}-01' THEN dapurdetailpesan.total ELSE 0 END),0) as bln1, IFNULL(SUM(CASE WHEN LEFT(dapurpemesanan.tgl_pesan, 7)='${tahun}-02' THEN dapurdetailpesan.total ELSE 0 END),0) as bln2, IFNULL(SUM(CASE WHEN LEFT(dapurpemesanan.tgl_pesan, 7)='${tahun}-03' THEN dapurdetailpesan.total ELSE 0 END),0) as bln3, IFNULL(SUM(CASE WHEN LEFT(dapurpemesanan.tgl_pesan, 7)='${tahun}-04' THEN dapurdetailpesan.total ELSE 0 END),0) as bln4, IFNULL(SUM(CASE WHEN LEFT(dapurpemesanan.tgl_pesan, 7)='${tahun}-05' THEN dapurdetailpesan.total ELSE 0 END),0) as bln5, IFNULL(SUM(CASE WHEN LEFT(dapurpemesanan.tgl_pesan, 7)='${tahun}-06' THEN dapurdetailpesan.total ELSE 0 END),0) as bln6, IFNULL(SUM(CASE WHEN LEFT(dapurpemesanan.tgl_pesan, 7)='${tahun}-07' THEN dapurdetailpesan.total ELSE 0 END),0) as bln7, IFNULL(SUM(CASE WHEN LEFT(dapurpemesanan.tgl_pesan, 7)='${tahun}-08' THEN dapurdetailpesan.total ELSE 0 END),0) as bln8, IFNULL(SUM(CASE WHEN LEFT(dapurpemesanan.tgl_pesan, 7)='${tahun}-09' THEN dapurdetailpesan.total ELSE 0 END),0) as bln9, IFNULL(SUM(CASE WHEN LEFT(dapurpemesanan.tgl_pesan, 7)='${tahun}-10' THEN dapurdetailpesan.total ELSE 0 END),0) as bln10, IFNULL(SUM(CASE WHEN LEFT(dapurpemesanan.tgl_pesan, 7)='${tahun}-11' THEN dapurdetailpesan.total ELSE 0 END),0) as bln11, IFNULL(SUM(CASE WHEN LEFT(dapurpemesanan.tgl_pesan, 7)='${tahun}-12' THEN dapurdetailpesan.total ELSE 0 END),0) as bln12 FROM dapurpemesanan INNER JOIN dapurdetailpesan ON dapurpemesanan.no_faktur=dapurdetailpesan.no_faktur INNER JOIN dapursuplier ON dapurpemesanan.kode_suplier=dapursuplier.kode_suplier WHERE LEFT(dapurpemesanan.tgl_pesan,4)=? GROUP BY dapursuplier.kode_suplier ORDER BY dapursuplier.nama_suplier ASC`, [tahun])
    let totalAll = 0
    const perBulan = Array(12).fill(0)
    const items = query.rows.map(row => {
        let sumVendor = 0
        for (let i = 1; i <= 12; i++) { const v = Number(row[`bln${i}`] || 0); sumVendor += v; perBulan[i-1] += v }
        totalAll += sumVendor
        return { nama_suplier: row.nama_suplier, bulan: Array.from({length: 12}, (_, i) => Number(row[`bln${i+1}`] || 0)), total: sumVendor }
    })
    return { items, totalAll, chartVendor: items.map(i => ({ label: i.nama_suplier, value: i.total })).sort((a,b)=>b.value-a.value), chartBulan: perBulan.map((val, i) => ({ label: `Bulan ${i+1}`, value: val })) }
}

export default { sisaStokDapur, ringkasanMutasiDapur, penerimaanVendorDapurPerBulan }