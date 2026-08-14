import DatabaseService from '../DatabaseService.js'

async function rekapPermintaan({ page = 1, pageSize = 50, sortBy = 'kode_brng', sortOrder = 'asc', tglAwal, tglAkhir, search = '', jenis = '', barang = '' }) {
    const db = await DatabaseService.get()
    const params = [tglAwal, tglAkhir]
    let where = 'p.tanggal BETWEEN ? AND ?'
    
    if (jenis) {
        where += ' AND j.nm_jenis LIKE ?'
        params.push(`%${jenis}%`)
    }
    
    if (barang) {
        where += ' AND b.kode_brng = ?'
        params.push(barang)
    }
    
    if (search) {
        const like = `%${search}%`
        where += ' AND (b.kode_brng LIKE ? OR b.nama_brng LIKE ? OR j.nm_jenis LIKE ?)'
        params.push(like, like, like)
    }

    const whitelist = {
        'kode_brng': 'b.kode_brng',
        'nama_brng': 'b.nama_brng',
        'satuan': 's.satuan',
        'jenis': 'j.nm_jenis',
        'jumlah': 'jumlah'
    }
    const orderCol = whitelist[sortBy] || 'b.kode_brng'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'

    const { rows } = await db.query(
        `SELECT b.kode_brng, b.nama_brng, s.satuan, j.nm_jenis AS jenis,
                SUM(d.jumlah) AS jumlah, b.kode_sat
         FROM ipsrsbarang b
         INNER JOIN kodesatuan s ON b.kode_sat = s.kode_sat
         INNER JOIN ipsrsjenisbarang j ON b.jenis = j.kd_jenis
         INNER JOIN detail_permintaan_non_medis d ON b.kode_brng = d.kode_brng
         INNER JOIN permintaan_non_medis p ON d.no_permintaan = p.no_permintaan
         WHERE ${where}
         GROUP BY b.kode_brng
         ORDER BY ${orderCol} ${dir}
         LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
    )
    
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(DISTINCT b.kode_brng) AS count
         FROM ipsrsbarang b
         INNER JOIN kodesatuan s ON b.kode_sat = s.kode_sat
         INNER JOIN ipsrsjenisbarang j ON b.jenis = j.kd_jenis
         INNER JOIN detail_permintaan_non_medis d ON b.kode_brng = d.kode_brng
         INNER JOIN permintaan_non_medis p ON d.no_permintaan = p.no_permintaan
         WHERE ${where}`,
        params
    )
    
    return { data: rows, total: count }
}

async function ringkasanPengajuan({ page = 1, pageSize = 50, sortBy = 'kode_brng', sortOrder = 'asc', tglAwal, tglAkhir, status = '', petugas = '', jenis = '', barang = '', search = '' }) {
    const db = await DatabaseService.get()
    const params = [tglAwal, tglAkhir]
    let where = 'p.tanggal BETWEEN ? AND ?'
    
    if (status) { where += ' AND p.status LIKE ?'; params.push(`%${status === 'Semua' ? '' : status}%`) }
    if (petugas) { where += ' AND peg.nama LIKE ?'; params.push(`%${petugas}%`) }
    if (jenis) { where += ' AND j.nm_jenis LIKE ?'; params.push(`%${jenis}%`) }
    if (barang) { where += ' AND b.nama_brng LIKE ?'; params.push(`%${barang}%`) }
    if (search) {
        const like = `%${search}%`
        where += ' AND (p.no_pengajuan LIKE ? OR p.nip LIKE ? OR peg.nama LIKE ? OR d.kode_brng LIKE ? OR d.kode_sat LIKE ? OR s.satuan LIKE ?)'
        params.push(like, like, like, like, like, like)
    }

    const whitelist = {
        'kode_brng': 'd.kode_brng',
        'nama_brng': 'b.nama_brng',
        'kode_sat': 'd.kode_sat',
        'satuan': 's.satuan',
        'namajenis': 'j.nm_jenis',
        'jumlah': 'jumlah',
        'total': 'total'
    }
    const orderCol = whitelist[sortBy] || 'd.kode_brng'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'

    const { rows } = await db.query(
        `SELECT d.kode_brng, b.nama_brng, d.kode_sat, s.satuan, j.nm_jenis AS namajenis,
                SUM(d.jumlah) AS jumlah, SUM(d.total) AS total
         FROM pengajuan_barang_nonmedis p
         INNER JOIN pegawai peg ON p.nip = peg.nik
         INNER JOIN detail_pengajuan_barang_nonmedis d ON p.no_pengajuan = d.no_pengajuan
         INNER JOIN ipsrsbarang b ON d.kode_brng = b.kode_brng
         INNER JOIN kodesatuan s ON b.kode_sat = s.kode_sat
         INNER JOIN ipsrsjenisbarang j ON b.jenis = j.kd_jenis
         WHERE ${where}
         GROUP BY d.kode_brng
         ORDER BY ${orderCol} ${dir}
         LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
    )
    
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(DISTINCT d.kode_brng) AS count
         FROM pengajuan_barang_nonmedis p
         INNER JOIN pegawai peg ON p.nip = peg.nik
         INNER JOIN detail_pengajuan_barang_nonmedis d ON p.no_pengajuan = d.no_pengajuan
         INNER JOIN ipsrsbarang b ON d.kode_brng = b.kode_brng
         INNER JOIN kodesatuan s ON b.kode_sat = s.kode_sat
         INNER JOIN ipsrsjenisbarang j ON b.jenis = j.kd_jenis
         WHERE ${where}`,
        params
    )
    
    const { rows: [sumResult] } = await db.query(
        `SELECT SUM(d.jumlah) AS jumlah, SUM(d.total) AS total
         FROM pengajuan_barang_nonmedis p
         INNER JOIN pegawai peg ON p.nip = peg.nik
         INNER JOIN detail_pengajuan_barang_nonmedis d ON p.no_pengajuan = d.no_pengajuan
         INNER JOIN ipsrsbarang b ON d.kode_brng = b.kode_brng
         INNER JOIN kodesatuan s ON b.kode_sat = s.kode_sat
         INNER JOIN ipsrsjenisbarang j ON b.jenis = j.kd_jenis
         WHERE ${where}`,
        params
    )
    
    const summary = { jumlah: Number(sumResult?.jumlah) || 0, total: Number(sumResult?.total) || 0 }
    
    return { data: rows, total: count, summary }
}

async function ringkasanPemesanan({ page = 1, pageSize = 50, sortBy = 'kode_brng', sortOrder = 'asc', tglAwal, tglAkhir, noFaktur = '', status = '', suplier = '', petugas = '', jenis = '', barang = '', search = '' }) {
    const db = await DatabaseService.get()
    const params = [tglAwal, tglAkhir]
    let where = 'p.tanggal BETWEEN ? AND ?'
    
    if (noFaktur) { where += ' AND p.no_pemesanan LIKE ?'; params.push(`%${noFaktur}%`) }
    if (status) { where += ' AND p.status LIKE ?'; params.push(`%${status === 'Semua' ? '' : status}%`) }
    if (suplier) { where += ' AND sup.nama_suplier LIKE ?'; params.push(`%${suplier}%`) }
    if (petugas) { where += ' AND peg.nama LIKE ?'; params.push(`%${petugas}%`) }
    if (jenis) { where += ' AND j.nm_jenis LIKE ?'; params.push(`%${jenis}%`) }
    if (barang) { where += ' AND b.nama_brng LIKE ?'; params.push(`%${barang}%`) }
    if (search) {
        const like = `%${search}%`
        where += ' AND (p.no_pemesanan LIKE ? OR p.kode_suplier LIKE ? OR p.nip LIKE ? OR d.kode_brng LIKE ? OR d.kode_sat LIKE ?)'
        params.push(like, like, like, like, like)
    }

    const whitelist = {
        'kode_brng': 'd.kode_brng',
        'nama_brng': 'b.nama_brng',
        'namajenis': 'j.nm_jenis',
        'kode_sat': 'd.kode_sat',
        'satuan': 's.satuan',
        'jumlah': 'jumlah',
        'total': 'total'
    }
    const orderCol = whitelist[sortBy] || 'd.kode_brng'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'

    const { rows } = await db.query(
        `SELECT d.kode_brng, b.nama_brng, j.nm_jenis AS namajenis, d.kode_sat, s.satuan,
                SUM(d.jumlah) AS jumlah, SUM(d.total) AS total
         FROM surat_pemesanan_non_medis p
         INNER JOIN ipsrssuplier sup ON p.kode_suplier = sup.kode_suplier
         INNER JOIN pegawai peg ON p.nip = peg.nik
         INNER JOIN detail_surat_pemesanan_non_medis d ON p.no_pemesanan = d.no_pemesanan
         INNER JOIN ipsrsbarang b ON d.kode_brng = b.kode_brng
         INNER JOIN kodesatuan s ON d.kode_sat = s.kode_sat
         INNER JOIN ipsrsjenisbarang j ON b.jenis = j.kd_jenis
         WHERE ${where}
         GROUP BY d.kode_brng
         ORDER BY ${orderCol} ${dir}
         LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
    )
    
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(DISTINCT d.kode_brng) AS count
         FROM surat_pemesanan_non_medis p
         INNER JOIN ipsrssuplier sup ON p.kode_suplier = sup.kode_suplier
         INNER JOIN pegawai peg ON p.nip = peg.nik
         INNER JOIN detail_surat_pemesanan_non_medis d ON p.no_pemesanan = d.no_pemesanan
         INNER JOIN ipsrsbarang b ON d.kode_brng = b.kode_brng
         INNER JOIN kodesatuan s ON d.kode_sat = s.kode_sat
         INNER JOIN ipsrsjenisbarang j ON b.jenis = j.kd_jenis
         WHERE ${where}`,
        params
    )
    
    const { rows: [sumResult] } = await db.query(
        `SELECT SUM(d.jumlah) AS jumlah, SUM(d.total) AS total
         FROM surat_pemesanan_non_medis p
         INNER JOIN ipsrssuplier sup ON p.kode_suplier = sup.kode_suplier
         INNER JOIN pegawai peg ON p.nip = peg.nik
         INNER JOIN detail_surat_pemesanan_non_medis d ON p.no_pemesanan = d.no_pemesanan
         INNER JOIN ipsrsbarang b ON d.kode_brng = b.kode_brng
         INNER JOIN kodesatuan s ON d.kode_sat = s.kode_sat
         INNER JOIN ipsrsjenisbarang j ON b.jenis = j.kd_jenis
         WHERE ${where}`,
        params
    )
    
    const summary = { jumlah: Number(sumResult?.jumlah) || 0, total: Number(sumResult?.total) || 0 }
    
    return { data: rows, total: count, summary }
}

export default { rekapPermintaan, ringkasanPengajuan, ringkasanPemesanan }
