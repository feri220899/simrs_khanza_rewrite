import DatabaseService from '../DatabaseService.js'

function angka(row) {
    return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, Number(value || 0)]))
}

function grafik(rows, labelKey, valueKey = 'jumlah', hanyaPositif = false) {
    return rows
        .map(row => ({ label: `${row[labelKey]} (${Number(row[valueKey] || 0)})`, value: Number(row[valueKey] || 0) }))
        .filter(row => !hanyaPositif || row.value > 0)
}

async function landing() {
    const db = await DatabaseService.get()
    const [pendaftaran, caraBayar, dokter, poli, keluarRanap, masukRanap, masihDirawat, okupansi, ranapBangsal, ranapKelas, asalPoli, asalDokter, statusBangsal, statusKelas] = await Promise.all([
        db.query(`SELECT COUNT(*) AS total,
            SUM(CASE WHEN status_lanjut='Ralan' THEN 1 ELSE 0 END) AS ralan,
            SUM(CASE WHEN status_lanjut='Ranap' THEN 1 ELSE 0 END) AS ranap,
            SUM(CASE WHEN stts='Belum' THEN 1 ELSE 0 END) AS belumlayani,
            SUM(CASE WHEN stts='Sudah' THEN 1 ELSE 0 END) AS sudahlayani,
            SUM(CASE WHEN stts='Batal' THEN 1 ELSE 0 END) AS batal,
            SUM(CASE WHEN stts='Dirujuk' THEN 1 ELSE 0 END) AS dirujuk,
            SUM(CASE WHEN stts='Pulang Paksa' THEN 1 ELSE 0 END) AS pulangpaksa,
            SUM(CASE WHEN stts_daftar='Lama' THEN 1 ELSE 0 END) AS daftarlama,
            SUM(CASE WHEN stts_daftar='Baru' THEN 1 ELSE 0 END) AS daftarbaru,
            SUM(CASE WHEN status_poli='Lama' THEN 1 ELSE 0 END) AS polilama,
            SUM(CASE WHEN status_poli='Baru' THEN 1 ELSE 0 END) AS polibaru,
            SUM(CASE WHEN status_lanjut='Ralan' AND status_bayar='Sudah Bayar' THEN 1 ELSE 0 END) AS sudahbayar,
            SUM(CASE WHEN status_lanjut='Ralan' AND status_bayar='Belum Bayar' THEN 1 ELSE 0 END) AS belumbayar
            FROM reg_periksa WHERE tgl_registrasi=CURRENT_DATE()`),
        db.query(`SELECT pj.png_jawab AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN penjab pj ON rp.kd_pj=pj.kd_pj WHERE rp.tgl_registrasi=CURRENT_DATE() GROUP BY pj.kd_pj`),
        db.query(`SELECT d.nm_dokter AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN dokter d ON rp.kd_dokter=d.kd_dokter WHERE rp.tgl_registrasi=CURRENT_DATE() GROUP BY d.kd_dokter`),
        db.query(`SELECT p.nm_poli AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN poliklinik p ON rp.kd_poli=p.kd_poli WHERE rp.tgl_registrasi=CURRENT_DATE() GROUP BY p.kd_poli`),
        db.query(`SELECT SUM(CASE WHEN stts_pulang='Pindah Kamar' THEN 1 ELSE 0 END) AS pindahkamar,
            SUM(CASE WHEN stts_pulang NOT IN ('Meninggal','Pindah Kamar','+','Rujuk','Pulang Paksa','APS','Atas Permintaan Sendiri') THEN 1 ELSE 0 END) AS pulang,
            SUM(CASE WHEN stts_pulang='Rujuk' THEN 1 ELSE 0 END) AS dirujuk,
            SUM(CASE WHEN stts_pulang IN ('Pulang Paksa','Atas Permintaan Sendiri','APS') THEN 1 ELSE 0 END) AS pulangpaksa,
            SUM(CASE WHEN stts_pulang='Meninggal' THEN 1 ELSE 0 END) AS meninggal FROM kamar_inap WHERE tgl_keluar=CURRENT_DATE()`),
        db.query(`SELECT COUNT(no_rawat) AS jumlah FROM kamar_inap WHERE tgl_masuk=CURRENT_DATE() AND stts_pulang<>'Pindah Kamar'`),
        db.query(`SELECT COUNT(no_rawat) AS jumlah FROM kamar_inap WHERE tgl_keluar='0000-00-00'`),
        db.query(`SELECT ROUND((SELECT COUNT(kd_kamar) FROM kamar WHERE status='ISI' AND statusdata='1') / NULLIF((SELECT COUNT(kd_kamar) FROM kamar WHERE statusdata='1'),0) * 100,2) AS jumlah`),
        db.query(`SELECT b.nm_bangsal AS label, COUNT(ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN kamar k ON ki.kd_kamar=k.kd_kamar INNER JOIN bangsal b ON k.kd_bangsal=b.kd_bangsal WHERE ki.tgl_keluar='0000-00-00' AND k.statusdata='1' AND b.status='1' GROUP BY b.kd_bangsal`),
        db.query(`SELECT k.kelas AS label, COUNT(ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN kamar k ON ki.kd_kamar=k.kd_kamar WHERE ki.tgl_keluar='0000-00-00' AND k.statusdata='1' GROUP BY k.kelas`),
        db.query(`SELECT p.nm_poli AS label, COUNT(ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat INNER JOIN poliklinik p ON rp.kd_poli=p.kd_poli WHERE ki.tgl_keluar='0000-00-00' GROUP BY p.kd_poli`),
        db.query(`SELECT d.nm_dokter AS label, COUNT(ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat INNER JOIN dokter d ON rp.kd_dokter=d.kd_dokter WHERE ki.tgl_keluar='0000-00-00' GROUP BY d.kd_dokter`),
        db.query(`SELECT b.nm_bangsal AS label, SUM(CASE WHEN k.status='KOSONG' THEN 1 ELSE 0 END) AS kosong, SUM(CASE WHEN k.status='ISI' THEN 1 ELSE 0 END) AS isi, SUM(CASE WHEN k.status='DIBERSIHKAN' THEN 1 ELSE 0 END) AS dibersihkan, SUM(CASE WHEN k.status='DIBOOKING' THEN 1 ELSE 0 END) AS dibooking, SUM(CASE WHEN k.status='PERBAIKAN' THEN 1 ELSE 0 END) AS perbaikan FROM kamar k INNER JOIN bangsal b ON k.kd_bangsal=b.kd_bangsal WHERE k.statusdata='1' AND b.status='1' GROUP BY b.kd_bangsal`),
        db.query(`SELECT kelas AS label, SUM(CASE WHEN status='KOSONG' THEN 1 ELSE 0 END) AS kosong, SUM(CASE WHEN status='ISI' THEN 1 ELSE 0 END) AS isi, SUM(CASE WHEN status='DIBERSIHKAN' THEN 1 ELSE 0 END) AS dibersihkan, SUM(CASE WHEN status='DIBOOKING' THEN 1 ELSE 0 END) AS dibooking, SUM(CASE WHEN status='PERBAIKAN' THEN 1 ELSE 0 END) AS perbaikan FROM kamar WHERE statusdata='1' GROUP BY kelas`),
    ])

    const ranap = angka(keluarRanap.rows[0])
    ranap.masuk = Number(masukRanap.rows[0]?.jumlah || 0)
    ranap.masihdirawat = Number(masihDirawat.rows[0]?.jumlah || 0)
    ranap.okupansi = Number(okupansi.rows[0]?.jumlah || 0)
    const statusCharts = (rows, suffix) => ['kosong','isi','dibersihkan','dibooking','perbaikan'].map(status => ({
        title: `Kamar ${status.charAt(0).toUpperCase() + status.slice(1)} Per ${suffix}`,
        data: grafik(rows, 'label', status, true),
    }))

    return {
        pendaftaran: angka(pendaftaran.rows[0]),
        grafikPendaftaran: [
            { title: 'Per Cara Bayar', data: grafik(caraBayar.rows, 'label') },
            { title: 'Per Dokter', data: grafik(dokter.rows, 'label') },
            { title: 'Per Poli', data: grafik(poli.rows, 'label') },
        ],
        ranap,
        grafikRanap: [
            { title: 'Per Bangsal', data: grafik(ranapBangsal.rows, 'label') },
            { title: 'Per Kelas Kamar', data: grafik(ranapKelas.rows, 'label') },
            { title: 'Asal Poli Pasien', data: grafik(asalPoli.rows, 'label') },
            { title: 'Asal Dokter Pasien', data: grafik(asalDokter.rows, 'label') },
        ],
        grafikBangsal: statusCharts(statusBangsal.rows, 'Bangsal'),
        grafikKelas: statusCharts(statusKelas.rows, 'Kelas'),
    }
}

async function rawatJalan(tgl1, tgl2) {
    const db = await DatabaseService.get()
    const params = [tgl1, tgl2]
    const [caraBayar, dokter, poli, perujuk, tanggal, bulan, dokterPoli, poliLama, poliBaru, poliLaki, poliPerempuan, caraBayarPoli, status] = await Promise.all([
        db.query(`SELECT pj.png_jawab AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN penjab pj ON rp.kd_pj=pj.kd_pj WHERE rp.kd_poli<>'IGDK' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY pj.kd_pj ORDER BY jumlah DESC`, params),
        db.query(`SELECT d.nm_dokter AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN dokter d ON rp.kd_dokter=d.kd_dokter WHERE rp.kd_poli<>'IGDK' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY d.kd_dokter ORDER BY jumlah DESC`, params),
        db.query(`SELECT p.kd_poli, p.nm_poli AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN poliklinik p ON rp.kd_poli=p.kd_poli WHERE rp.kd_poli<>'IGDK' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY p.kd_poli ORDER BY jumlah DESC`, params),
        db.query(`SELECT IFNULL(rm.perujuk,'-') AS label, COUNT(rm.no_rawat) AS jumlah FROM rujuk_masuk rm INNER JOIN reg_periksa rp ON rm.no_rawat=rp.no_rawat WHERE rp.kd_poli<>'IGDK' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY rm.perujuk ORDER BY jumlah DESC`, params),
        db.query(`SELECT DATE_FORMAT(rp.tgl_registrasi,'%d-%m-%Y') AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp WHERE rp.kd_poli<>'IGDK' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY rp.tgl_registrasi ORDER BY rp.tgl_registrasi ASC`, params),
        db.query(`SELECT DATE_FORMAT(rp.tgl_registrasi,'%m-%Y') AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp WHERE rp.kd_poli<>'IGDK' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY DATE_FORMAT(rp.tgl_registrasi,'%Y-%m') ORDER BY DATE_FORMAT(rp.tgl_registrasi,'%Y-%m') ASC`, params),
        
        db.query(`SELECT p.kd_poli, p.nm_poli AS label, d.nm_dokter AS sublabel, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN poliklinik p ON rp.kd_poli=p.kd_poli INNER JOIN dokter d ON rp.kd_dokter=d.kd_dokter WHERE rp.kd_poli<>'IGDK' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY p.kd_poli, d.kd_dokter ORDER BY p.nm_poli, jumlah DESC`, params),
        db.query(`SELECT p.kd_poli, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN poliklinik p ON rp.kd_poli=p.kd_poli WHERE rp.kd_poli<>'IGDK' AND rp.status_poli='Lama' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY p.kd_poli`, params),
        db.query(`SELECT p.kd_poli, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN poliklinik p ON rp.kd_poli=p.kd_poli WHERE rp.kd_poli<>'IGDK' AND rp.status_poli='Baru' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY p.kd_poli`, params),
        db.query(`SELECT rp.kd_poli, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN pasien ps ON rp.no_rkm_medis=ps.no_rkm_medis WHERE rp.kd_poli<>'IGDK' AND ps.jk='L' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY rp.kd_poli`, params),
        db.query(`SELECT rp.kd_poli, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN pasien ps ON rp.no_rkm_medis=ps.no_rkm_medis WHERE rp.kd_poli<>'IGDK' AND ps.jk='P' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY rp.kd_poli`, params),
        
        db.query(`SELECT pj.kd_pj, pj.png_jawab AS label, p.nm_poli AS sublabel, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN penjab pj ON rp.kd_pj=pj.kd_pj INNER JOIN poliklinik p ON rp.kd_poli=p.kd_poli WHERE rp.kd_poli<>'IGDK' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY pj.kd_pj, p.kd_poli ORDER BY pj.png_jawab, jumlah DESC`, params),
        db.query(`SELECT CASE WHEN stts='Batal' THEN 'Batal' WHEN stts='Dirujuk' THEN 'Dirujuk' WHEN stts='Meninggal' THEN 'Meninggal' WHEN stts='Pulang Paksa' THEN 'Pulang Paksa' WHEN stts IN ('Belum','Sudah','Berkas Diterima','Dirawat') THEN 'Terlayani' END AS label, COUNT(no_rawat) AS jumlah FROM reg_periksa WHERE kd_poli<>'IGDK' AND tgl_registrasi BETWEEN ? AND ? GROUP BY label ORDER BY FIELD(label,'Batal','Dirujuk','Meninggal','Pulang Paksa','Terlayani')`, params)
    ])
    
    return {
        charts: [
            { title: 'Pelayanan Per Cara Bayar', type: 'pie', data: grafik(caraBayar.rows, 'label') },
            { title: 'Pelayanan Per Dokter', type: 'pie', data: grafik(dokter.rows, 'label') },
            { title: 'Pelayanan Per Poli', type: 'pie', data: grafik(poli.rows, 'label') },
            { title: 'Pelayanan Per Perujuk', type: 'pie', data: grafik(perujuk.rows, 'label') },
            { title: 'Pelayanan Per Tanggal', type: 'line', data: grafik(tanggal.rows, 'label') },
            { title: 'Pelayanan Per Bulan', type: 'line', data: grafik(bulan.rows, 'label') },
        ],
        tables: [
            { title: 'Pelayanan Per Dokter Poli', grouped: true, headers: ['Poli & Dokter', 'Jumlah'], data: groupRows(dokterPoli.rows) },
            { title: 'Pelayanan Pasien Baru & Lama Per Poli', stat: true, headers: ['Poli / Status', 'Jumlah'], data: mergeStats(poli.rows, 'Lama', poliLama.rows, 'Baru', poliBaru.rows) },
            { title: 'Pelayanan Pasien Laki & Perempuan Per Poli', stat: true, headers: ['Poli / Jenis Kelamin', 'Jumlah'], data: mergeStats(poli.rows, 'Laki-laki', poliLaki.rows, 'Perempuan', poliPerempuan.rows) },
            { title: 'Pelayanan Per Cara Bayar Per Poli', grouped: true, headers: ['Cara Bayar & Poli', 'Jumlah'], data: groupRows(caraBayarPoli.rows) }
        ],
        statusChart: { title: 'Status Pelayanan Pasien', type: 'pie', data: grafik(status.rows, 'label') }
    }
}

async function igd(tgl1, tgl2) {
    const db = await DatabaseService.get()
    const params = [tgl1, tgl2]
    const [caraBayar, dokter, perujuk, tanggal, bulan, tanggalBaru, bulanBaru, tanggalLama, bulanLama, status] = await Promise.all([
        db.query(`SELECT pj.png_jawab AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN penjab pj ON rp.kd_pj=pj.kd_pj WHERE rp.kd_poli='IGDK' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY pj.kd_pj ORDER BY jumlah DESC`, params),
        db.query(`SELECT d.nm_dokter AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp INNER JOIN dokter d ON rp.kd_dokter=d.kd_dokter WHERE rp.kd_poli='IGDK' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY d.kd_dokter ORDER BY jumlah DESC`, params),
        db.query(`SELECT IFNULL(rm.perujuk,'-') AS label, COUNT(rm.no_rawat) AS jumlah FROM rujuk_masuk rm INNER JOIN reg_periksa rp ON rm.no_rawat=rp.no_rawat WHERE rp.kd_poli='IGDK' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY rm.perujuk ORDER BY jumlah DESC`, params),
        db.query(`SELECT DATE_FORMAT(rp.tgl_registrasi,'%d-%m-%Y') AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp WHERE rp.kd_poli='IGDK' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY rp.tgl_registrasi ORDER BY rp.tgl_registrasi ASC`, params),
        db.query(`SELECT DATE_FORMAT(rp.tgl_registrasi,'%m-%Y') AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp WHERE rp.kd_poli='IGDK' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY DATE_FORMAT(rp.tgl_registrasi,'%Y-%m') ORDER BY DATE_FORMAT(rp.tgl_registrasi,'%Y-%m') ASC`, params),
        
        db.query(`SELECT DATE_FORMAT(rp.tgl_registrasi,'%d-%m-%Y') AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp WHERE rp.kd_poli='IGDK' AND rp.stts_daftar='Baru' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY rp.tgl_registrasi ORDER BY rp.tgl_registrasi ASC`, params),
        db.query(`SELECT DATE_FORMAT(rp.tgl_registrasi,'%m-%Y') AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp WHERE rp.kd_poli='IGDK' AND rp.stts_daftar='Baru' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY DATE_FORMAT(rp.tgl_registrasi,'%Y-%m') ORDER BY DATE_FORMAT(rp.tgl_registrasi,'%Y-%m') ASC`, params),
        db.query(`SELECT DATE_FORMAT(rp.tgl_registrasi,'%d-%m-%Y') AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp WHERE rp.kd_poli='IGDK' AND rp.stts_daftar='Lama' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY rp.tgl_registrasi ORDER BY rp.tgl_registrasi ASC`, params),
        db.query(`SELECT DATE_FORMAT(rp.tgl_registrasi,'%m-%Y') AS label, COUNT(rp.no_rawat) AS jumlah FROM reg_periksa rp WHERE rp.kd_poli='IGDK' AND rp.stts_daftar='Lama' AND rp.tgl_registrasi BETWEEN ? AND ? GROUP BY DATE_FORMAT(rp.tgl_registrasi,'%Y-%m') ORDER BY DATE_FORMAT(rp.tgl_registrasi,'%Y-%m') ASC`, params),
        
        db.query(`SELECT CASE WHEN stts='Batal' THEN 'Batal' WHEN stts='Dirujuk' THEN 'Dirujuk' WHEN stts='Meninggal' THEN 'Meninggal' WHEN stts='Pulang Paksa' THEN 'Pulang Paksa' WHEN stts IN ('Belum','Sudah','Berkas Diterima','Dirawat') THEN 'Terlayani' END AS label, COUNT(no_rawat) AS jumlah FROM reg_periksa WHERE kd_poli='IGDK' AND tgl_registrasi BETWEEN ? AND ? GROUP BY label ORDER BY FIELD(label,'Batal','Dirujuk','Meninggal','Pulang Paksa','Terlayani')`, params)
    ])
    
    return {
        charts: [
            { title: 'Pelayanan Per Cara Bayar', type: 'pie', data: grafik(caraBayar.rows, 'label') },
            { title: 'Pelayanan Per Dokter', type: 'pie', data: grafik(dokter.rows, 'label') },
            { title: 'Pelayanan Per Perujuk', type: 'pie', data: grafik(perujuk.rows, 'label') },
            { title: 'Pelayanan Per Tanggal', type: 'line', data: grafik(tanggal.rows, 'label') },
            { title: 'Pelayanan Per Bulan', type: 'line', data: grafik(bulan.rows, 'label') },
            { title: 'Pasien Baru Per Tanggal', type: 'line', data: grafik(tanggalBaru.rows, 'label') },
            { title: 'Pasien Baru Per Bulan', type: 'line', data: grafik(bulanBaru.rows, 'label') },
            { title: 'Pasien Lama Per Tanggal', type: 'line', data: grafik(tanggalLama.rows, 'label') },
            { title: 'Pasien Lama Per Bulan', type: 'line', data: grafik(bulanLama.rows, 'label') },
        ],
        statusChart: { title: 'Status Pelayanan Pasien', type: 'pie', data: grafik(status.rows, 'label') }
    }
}

async function rawatInap(tgl1, tgl2) {
    const db = await DatabaseService.get()
    const params = [tgl1, tgl2]
    
    const [caraBayar, bangsal, kelas, poli, dokter, statusPulang, tanggal, bulan, tanggalBaru, bulanBaru, tanggalLama, bulanLama] = await Promise.all([
        db.query(`SELECT pj.png_jawab AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat INNER JOIN penjab pj ON rp.kd_pj=pj.kd_pj WHERE ki.stts_pulang<>'Pindah Kamar' AND DATE(ki.tgl_masuk) BETWEEN ? AND ? GROUP BY pj.kd_pj ORDER BY jumlah DESC`, params),
        db.query(`SELECT b.nm_bangsal AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN kamar k ON ki.kd_kamar=k.kd_kamar INNER JOIN bangsal b ON k.kd_bangsal=b.kd_bangsal WHERE ki.stts_pulang<>'Pindah Kamar' AND DATE(ki.tgl_masuk) BETWEEN ? AND ? GROUP BY b.kd_bangsal ORDER BY jumlah DESC`, params),
        db.query(`SELECT k.kelas AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN kamar k ON ki.kd_kamar=k.kd_kamar WHERE ki.stts_pulang<>'Pindah Kamar' AND DATE(ki.tgl_masuk) BETWEEN ? AND ? GROUP BY k.kelas ORDER BY jumlah DESC`, params),
        db.query(`SELECT p.nm_poli AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat INNER JOIN poliklinik p ON rp.kd_poli=p.kd_poli WHERE ki.stts_pulang<>'Pindah Kamar' AND DATE(ki.tgl_masuk) BETWEEN ? AND ? GROUP BY p.kd_poli ORDER BY jumlah DESC`, params),
        db.query(`SELECT d.nm_dokter AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat INNER JOIN dokter d ON rp.kd_dokter=d.kd_dokter WHERE ki.stts_pulang<>'Pindah Kamar' AND DATE(ki.tgl_masuk) BETWEEN ? AND ? GROUP BY d.kd_dokter ORDER BY jumlah DESC`, params),
        db.query(`SELECT stts_pulang AS label, COUNT(DISTINCT no_rawat) AS jumlah FROM kamar_inap WHERE stts_pulang<>'Pindah Kamar' AND tgl_keluar<>'0000-00-00' AND DATE(tgl_masuk) BETWEEN ? AND ? GROUP BY stts_pulang ORDER BY jumlah DESC`, params),
        
        db.query(`SELECT DATE_FORMAT(ki.tgl_masuk,'%d-%m-%Y') AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki WHERE ki.stts_pulang<>'Pindah Kamar' AND DATE(ki.tgl_masuk) BETWEEN ? AND ? GROUP BY DATE(ki.tgl_masuk) ORDER BY DATE(ki.tgl_masuk) ASC`, params),
        db.query(`SELECT DATE_FORMAT(ki.tgl_masuk,'%m-%Y') AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki WHERE ki.stts_pulang<>'Pindah Kamar' AND DATE(ki.tgl_masuk) BETWEEN ? AND ? GROUP BY DATE_FORMAT(ki.tgl_masuk,'%Y-%m') ORDER BY DATE_FORMAT(ki.tgl_masuk,'%Y-%m') ASC`, params),
        
        db.query(`SELECT DATE_FORMAT(ki.tgl_masuk,'%d-%m-%Y') AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat WHERE ki.stts_pulang<>'Pindah Kamar' AND rp.stts_daftar='Baru' AND DATE(ki.tgl_masuk) BETWEEN ? AND ? GROUP BY DATE(ki.tgl_masuk) ORDER BY DATE(ki.tgl_masuk) ASC`, params),
        db.query(`SELECT DATE_FORMAT(ki.tgl_masuk,'%m-%Y') AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat WHERE ki.stts_pulang<>'Pindah Kamar' AND rp.stts_daftar='Baru' AND DATE(ki.tgl_masuk) BETWEEN ? AND ? GROUP BY DATE_FORMAT(ki.tgl_masuk,'%Y-%m') ORDER BY DATE_FORMAT(ki.tgl_masuk,'%Y-%m') ASC`, params),
        db.query(`SELECT DATE_FORMAT(ki.tgl_masuk,'%d-%m-%Y') AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat WHERE ki.stts_pulang<>'Pindah Kamar' AND rp.stts_daftar='Lama' AND DATE(ki.tgl_masuk) BETWEEN ? AND ? GROUP BY DATE(ki.tgl_masuk) ORDER BY DATE(ki.tgl_masuk) ASC`, params),
        db.query(`SELECT DATE_FORMAT(ki.tgl_masuk,'%m-%Y') AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat WHERE ki.stts_pulang<>'Pindah Kamar' AND rp.stts_daftar='Lama' AND DATE(ki.tgl_masuk) BETWEEN ? AND ? GROUP BY DATE_FORMAT(ki.tgl_masuk,'%Y-%m') ORDER BY DATE_FORMAT(ki.tgl_masuk,'%Y-%m') ASC`, params),
    ])
    
    const [caraBayarOut, bangsalOut, kelasOut, poliOut, dokterOut, statusPulangOut, tanggalOut, bulanOut, tanggalBaruOut, bulanBaruOut, tanggalLamaOut, bulanLamaOut] = await Promise.all([
        db.query(`SELECT pj.png_jawab AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat INNER JOIN penjab pj ON rp.kd_pj=pj.kd_pj WHERE ki.stts_pulang<>'Pindah Kamar' AND ki.tgl_keluar<>'0000-00-00' AND DATE(ki.tgl_keluar) BETWEEN ? AND ? GROUP BY pj.kd_pj ORDER BY jumlah DESC`, params),
        db.query(`SELECT b.nm_bangsal AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN kamar k ON ki.kd_kamar=k.kd_kamar INNER JOIN bangsal b ON k.kd_bangsal=b.kd_bangsal WHERE ki.stts_pulang<>'Pindah Kamar' AND ki.tgl_keluar<>'0000-00-00' AND DATE(ki.tgl_keluar) BETWEEN ? AND ? GROUP BY b.kd_bangsal ORDER BY jumlah DESC`, params),
        db.query(`SELECT k.kelas AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN kamar k ON ki.kd_kamar=k.kd_kamar WHERE ki.stts_pulang<>'Pindah Kamar' AND ki.tgl_keluar<>'0000-00-00' AND DATE(ki.tgl_keluar) BETWEEN ? AND ? GROUP BY k.kelas ORDER BY jumlah DESC`, params),
        db.query(`SELECT p.nm_poli AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat INNER JOIN poliklinik p ON rp.kd_poli=p.kd_poli WHERE ki.stts_pulang<>'Pindah Kamar' AND ki.tgl_keluar<>'0000-00-00' AND DATE(ki.tgl_keluar) BETWEEN ? AND ? GROUP BY p.kd_poli ORDER BY jumlah DESC`, params),
        db.query(`SELECT d.nm_dokter AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat INNER JOIN dokter d ON rp.kd_dokter=d.kd_dokter WHERE ki.stts_pulang<>'Pindah Kamar' AND ki.tgl_keluar<>'0000-00-00' AND DATE(ki.tgl_keluar) BETWEEN ? AND ? GROUP BY d.kd_dokter ORDER BY jumlah DESC`, params),
        db.query(`SELECT stts_pulang AS label, COUNT(DISTINCT no_rawat) AS jumlah FROM kamar_inap WHERE stts_pulang<>'Pindah Kamar' AND tgl_keluar<>'0000-00-00' AND DATE(tgl_keluar) BETWEEN ? AND ? GROUP BY stts_pulang ORDER BY jumlah DESC`, params),
        
        db.query(`SELECT DATE_FORMAT(ki.tgl_keluar,'%d-%m-%Y') AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki WHERE ki.stts_pulang<>'Pindah Kamar' AND ki.tgl_keluar<>'0000-00-00' AND DATE(ki.tgl_keluar) BETWEEN ? AND ? GROUP BY DATE(ki.tgl_keluar) ORDER BY DATE(ki.tgl_keluar) ASC`, params),
        db.query(`SELECT DATE_FORMAT(ki.tgl_keluar,'%m-%Y') AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki WHERE ki.stts_pulang<>'Pindah Kamar' AND ki.tgl_keluar<>'0000-00-00' AND DATE(ki.tgl_keluar) BETWEEN ? AND ? GROUP BY DATE_FORMAT(ki.tgl_keluar,'%Y-%m') ORDER BY DATE_FORMAT(ki.tgl_keluar,'%Y-%m') ASC`, params),
        
        db.query(`SELECT DATE_FORMAT(ki.tgl_keluar,'%d-%m-%Y') AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat WHERE ki.stts_pulang<>'Pindah Kamar' AND ki.tgl_keluar<>'0000-00-00' AND rp.stts_daftar='Baru' AND DATE(ki.tgl_keluar) BETWEEN ? AND ? GROUP BY DATE(ki.tgl_keluar) ORDER BY DATE(ki.tgl_keluar) ASC`, params),
        db.query(`SELECT DATE_FORMAT(ki.tgl_keluar,'%m-%Y') AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat WHERE ki.stts_pulang<>'Pindah Kamar' AND ki.tgl_keluar<>'0000-00-00' AND rp.stts_daftar='Baru' AND DATE(ki.tgl_keluar) BETWEEN ? AND ? GROUP BY DATE_FORMAT(ki.tgl_keluar,'%Y-%m') ORDER BY DATE_FORMAT(ki.tgl_keluar,'%Y-%m') ASC`, params),
        db.query(`SELECT DATE_FORMAT(ki.tgl_keluar,'%d-%m-%Y') AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat WHERE ki.stts_pulang<>'Pindah Kamar' AND ki.tgl_keluar<>'0000-00-00' AND rp.stts_daftar='Lama' AND DATE(ki.tgl_keluar) BETWEEN ? AND ? GROUP BY DATE(ki.tgl_keluar) ORDER BY DATE(ki.tgl_keluar) ASC`, params),
        db.query(`SELECT DATE_FORMAT(ki.tgl_keluar,'%m-%Y') AS label, COUNT(DISTINCT ki.no_rawat) AS jumlah FROM kamar_inap ki INNER JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat WHERE ki.stts_pulang<>'Pindah Kamar' AND ki.tgl_keluar<>'0000-00-00' AND rp.stts_daftar='Lama' AND DATE(ki.tgl_keluar) BETWEEN ? AND ? GROUP BY DATE_FORMAT(ki.tgl_keluar,'%Y-%m') ORDER BY DATE_FORMAT(ki.tgl_keluar,'%Y-%m') ASC`, params),
    ])

    return {
        masuk: [
            { title: 'Pelayanan Per Cara Bayar', type: 'pie', data: grafik(caraBayar.rows, 'label') },
            { title: 'Pelayanan Per Bangsal', type: 'pie', data: grafik(bangsal.rows, 'label') },
            { title: 'Pelayanan Per Kelas', type: 'pie', data: grafik(kelas.rows, 'label') },
            { title: 'Asal Poli Pasien', type: 'pie', data: grafik(poli.rows, 'label') },
            { title: 'Asal Dokter Pasien', type: 'pie', data: grafik(dokter.rows, 'label') },
            { title: 'Status Pulang Pasien', type: 'pie', data: grafik(statusPulang.rows, 'label') },
            { title: 'Pelayanan Per Tanggal', type: 'line', data: grafik(tanggal.rows, 'label') },
            { title: 'Pelayanan Per Bulan', type: 'line', data: grafik(bulan.rows, 'label') },
            { title: 'Pasien Baru Per Tanggal', type: 'line', data: grafik(tanggalBaru.rows, 'label') },
            { title: 'Pasien Baru Per Bulan', type: 'line', data: grafik(bulanBaru.rows, 'label') },
            { title: 'Pasien Lama Per Tanggal', type: 'line', data: grafik(tanggalLama.rows, 'label') },
            { title: 'Pasien Lama Per Bulan', type: 'line', data: grafik(bulanLama.rows, 'label') },
        ],
        pulang: [
            { title: 'Pelayanan Per Cara Bayar', type: 'pie', data: grafik(caraBayarOut.rows, 'label') },
            { title: 'Pelayanan Per Bangsal', type: 'pie', data: grafik(bangsalOut.rows, 'label') },
            { title: 'Pelayanan Per Kelas', type: 'pie', data: grafik(kelasOut.rows, 'label') },
            { title: 'Asal Poli Pasien', type: 'pie', data: grafik(poliOut.rows, 'label') },
            { title: 'Asal Dokter Pasien', type: 'pie', data: grafik(dokterOut.rows, 'label') },
            { title: 'Status Pulang Pasien', type: 'pie', data: grafik(statusPulangOut.rows, 'label') },
            { title: 'Pelayanan Per Tanggal', type: 'line', data: grafik(tanggalOut.rows, 'label') },
            { title: 'Pelayanan Per Bulan', type: 'line', data: grafik(bulanOut.rows, 'label') },
            { title: 'Pasien Baru Per Tanggal', type: 'line', data: grafik(tanggalBaruOut.rows, 'label') },
            { title: 'Pasien Baru Per Bulan', type: 'line', data: grafik(bulanBaruOut.rows, 'label') },
            { title: 'Pasien Lama Per Tanggal', type: 'line', data: grafik(tanggalLamaOut.rows, 'label') },
            { title: 'Pasien Lama Per Bulan', type: 'line', data: grafik(bulanLamaOut.rows, 'label') },
        ]
    }
}

async function lab(tgl1, tgl2) {
    const db = await DatabaseService.get()
    const params = [tgl1, tgl2]
    
    const [pemeriksaan, pemeriksaanRalan, pemeriksaanRanap, perujuk, perujukRanap, perujukRalan, caraBayar, caraBayarRanap, caraBayarRalan] = await Promise.all([
        db.query(`SELECT j.nm_perawatan AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_lab p INNER JOIN jns_perawatan_lab j ON p.kd_jenis_prw=j.kd_jenis_prw WHERE p.tgl_periksa BETWEEN ? AND ? GROUP BY j.nm_perawatan ORDER BY jumlah DESC`, params),
        db.query(`SELECT j.nm_perawatan AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_lab p INNER JOIN jns_perawatan_lab j ON p.kd_jenis_prw=j.kd_jenis_prw WHERE p.status='Ralan' AND p.tgl_periksa BETWEEN ? AND ? GROUP BY j.nm_perawatan ORDER BY jumlah DESC`, params),
        db.query(`SELECT j.nm_perawatan AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_lab p INNER JOIN jns_perawatan_lab j ON p.kd_jenis_prw=j.kd_jenis_prw WHERE p.status='Ranap' AND p.tgl_periksa BETWEEN ? AND ? GROUP BY j.nm_perawatan ORDER BY jumlah DESC`, params),
        
        db.query(`SELECT d.nm_dokter AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_lab p INNER JOIN dokter d ON p.dokter_perujuk=d.kd_dokter WHERE p.tgl_periksa BETWEEN ? AND ? GROUP BY d.kd_dokter ORDER BY jumlah DESC`, params),
        db.query(`SELECT d.nm_dokter AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_lab p INNER JOIN dokter d ON p.dokter_perujuk=d.kd_dokter WHERE p.status='Ranap' AND p.tgl_periksa BETWEEN ? AND ? GROUP BY d.kd_dokter ORDER BY jumlah DESC`, params),
        db.query(`SELECT d.nm_dokter AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_lab p INNER JOIN dokter d ON p.dokter_perujuk=d.kd_dokter WHERE p.status='Ralan' AND p.tgl_periksa BETWEEN ? AND ? GROUP BY d.kd_dokter ORDER BY jumlah DESC`, params),
        
        db.query(`SELECT pj.png_jawab AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_lab p INNER JOIN reg_periksa rp ON p.no_rawat=rp.no_rawat INNER JOIN penjab pj ON rp.kd_pj=pj.kd_pj WHERE p.tgl_periksa BETWEEN ? AND ? GROUP BY pj.kd_pj ORDER BY jumlah DESC`, params),
        db.query(`SELECT pj.png_jawab AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_lab p INNER JOIN reg_periksa rp ON p.no_rawat=rp.no_rawat INNER JOIN penjab pj ON rp.kd_pj=pj.kd_pj WHERE p.status='Ranap' AND p.tgl_periksa BETWEEN ? AND ? GROUP BY pj.kd_pj ORDER BY jumlah DESC`, params),
        db.query(`SELECT pj.png_jawab AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_lab p INNER JOIN reg_periksa rp ON p.no_rawat=rp.no_rawat INNER JOIN penjab pj ON rp.kd_pj=pj.kd_pj WHERE p.status='Ralan' AND p.tgl_periksa BETWEEN ? AND ? GROUP BY pj.kd_pj ORDER BY jumlah DESC`, params),
    ])
    
    return {
        charts: [
            { title: 'Pelayanan Per Pemeriksaan', type: 'pie', data: grafik(pemeriksaan.rows, 'label') },
            { title: 'Pelayanan Per Pemeriksaan Rawat Jalan', type: 'pie', data: grafik(pemeriksaanRalan.rows, 'label') },
            { title: 'Pelayanan Per Pemeriksaan Rawat Inap', type: 'pie', data: grafik(pemeriksaanRanap.rows, 'label') },
            { title: 'Pelayanan Per Dokter Perujuk', type: 'pie', data: grafik(perujuk.rows, 'label') },
            { title: 'Pelayanan Per Dokter Perujuk Rawat Inap', type: 'pie', data: grafik(perujukRanap.rows, 'label') },
            { title: 'Pelayanan Per Dokter Perujuk Rawat Jalan', type: 'pie', data: grafik(perujukRalan.rows, 'label') },
            { title: 'Pelayanan Per Cara Bayar', type: 'pie', data: grafik(caraBayar.rows, 'label') },
            { title: 'Pelayanan Per Cara Bayar Rawat Inap', type: 'pie', data: grafik(caraBayarRanap.rows, 'label') },
            { title: 'Pelayanan Per Cara Bayar Rawat Jalan', type: 'pie', data: grafik(caraBayarRalan.rows, 'label') },
        ]
    }
}

async function radiologi(tgl1, tgl2) {
    const db = await DatabaseService.get()
    const params = [tgl1, tgl2]
    
    const [pemeriksaan, pemeriksaanRalan, pemeriksaanRanap, perujuk, perujukRanap, perujukRalan, caraBayar, caraBayarRanap, caraBayarRalan] = await Promise.all([
        db.query(`SELECT j.nm_perawatan AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_radiologi p INNER JOIN jns_perawatan_radiologi j ON p.kd_jenis_prw=j.kd_jenis_prw WHERE p.tgl_periksa BETWEEN ? AND ? GROUP BY j.nm_perawatan ORDER BY jumlah DESC`, params),
        db.query(`SELECT j.nm_perawatan AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_radiologi p INNER JOIN jns_perawatan_radiologi j ON p.kd_jenis_prw=j.kd_jenis_prw WHERE p.status='Ralan' AND p.tgl_periksa BETWEEN ? AND ? GROUP BY j.nm_perawatan ORDER BY jumlah DESC`, params),
        db.query(`SELECT j.nm_perawatan AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_radiologi p INNER JOIN jns_perawatan_radiologi j ON p.kd_jenis_prw=j.kd_jenis_prw WHERE p.status='Ranap' AND p.tgl_periksa BETWEEN ? AND ? GROUP BY j.nm_perawatan ORDER BY jumlah DESC`, params),
        
        db.query(`SELECT d.nm_dokter AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_radiologi p INNER JOIN dokter d ON p.dokter_perujuk=d.kd_dokter WHERE p.tgl_periksa BETWEEN ? AND ? GROUP BY d.kd_dokter ORDER BY jumlah DESC`, params),
        db.query(`SELECT d.nm_dokter AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_radiologi p INNER JOIN dokter d ON p.dokter_perujuk=d.kd_dokter WHERE p.status='Ranap' AND p.tgl_periksa BETWEEN ? AND ? GROUP BY d.kd_dokter ORDER BY jumlah DESC`, params),
        db.query(`SELECT d.nm_dokter AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_radiologi p INNER JOIN dokter d ON p.dokter_perujuk=d.kd_dokter WHERE p.status='Ralan' AND p.tgl_periksa BETWEEN ? AND ? GROUP BY d.kd_dokter ORDER BY jumlah DESC`, params),
        
        db.query(`SELECT pj.png_jawab AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_radiologi p INNER JOIN reg_periksa rp ON p.no_rawat=rp.no_rawat INNER JOIN penjab pj ON rp.kd_pj=pj.kd_pj WHERE p.tgl_periksa BETWEEN ? AND ? GROUP BY pj.kd_pj ORDER BY jumlah DESC`, params),
        db.query(`SELECT pj.png_jawab AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_radiologi p INNER JOIN reg_periksa rp ON p.no_rawat=rp.no_rawat INNER JOIN penjab pj ON rp.kd_pj=pj.kd_pj WHERE p.status='Ranap' AND p.tgl_periksa BETWEEN ? AND ? GROUP BY pj.kd_pj ORDER BY jumlah DESC`, params),
        db.query(`SELECT pj.png_jawab AS label, COUNT(p.no_rawat) AS jumlah FROM periksa_radiologi p INNER JOIN reg_periksa rp ON p.no_rawat=rp.no_rawat INNER JOIN penjab pj ON rp.kd_pj=pj.kd_pj WHERE p.status='Ralan' AND p.tgl_periksa BETWEEN ? AND ? GROUP BY pj.kd_pj ORDER BY jumlah DESC`, params),
    ])
    
    return {
        charts: [
            { title: 'Pelayanan Per Pemeriksaan', type: 'pie', data: grafik(pemeriksaan.rows, 'label') },
            { title: 'Pelayanan Per Pemeriksaan Rawat Jalan', type: 'pie', data: grafik(pemeriksaanRalan.rows, 'label') },
            { title: 'Pelayanan Per Pemeriksaan Rawat Inap', type: 'pie', data: grafik(pemeriksaanRanap.rows, 'label') },
            { title: 'Pelayanan Per Dokter Perujuk', type: 'pie', data: grafik(perujuk.rows, 'label') },
            { title: 'Pelayanan Per Dokter Perujuk Rawat Inap', type: 'pie', data: grafik(perujukRanap.rows, 'label') },
            { title: 'Pelayanan Per Dokter Perujuk Rawat Jalan', type: 'pie', data: grafik(perujukRalan.rows, 'label') },
            { title: 'Pelayanan Per Cara Bayar', type: 'pie', data: grafik(caraBayar.rows, 'label') },
            { title: 'Pelayanan Per Cara Bayar Rawat Inap', type: 'pie', data: grafik(caraBayarRanap.rows, 'label') },
            { title: 'Pelayanan Per Cara Bayar Rawat Jalan', type: 'pie', data: grafik(caraBayarRalan.rows, 'label') },
        ]
    }
}

function groupRows(rows) {
    const result = []
    let currentLabel = null
    let header = null
    for (const row of rows) {
        if (row.label !== currentLabel) {
            header = { label: row.label, jumlah: 0, isHeader: true }
            result.push(header)
            currentLabel = row.label
        }
        const jumlah = Number(row.jumlah || 0)
        header.jumlah += jumlah
        result.push({ label: row.sublabel, jumlah, isHeader: false })
    }
    return result
}

function mergeStats(bases, label1, rows1, label2, rows2) {
    const result = []
    const map1 = Object.fromEntries(rows1.map(r => [r.kd_poli, r.jumlah]))
    const map2 = Object.fromEntries(rows2.map(r => [r.kd_poli, r.jumlah]))
    
    for (const base of bases) {
        result.push({ label: base.label, jumlah: base.jumlah, isHeader: true })
        result.push({ label: label1, jumlah: map1[base.kd_poli] || 0, isHeader: false })
        result.push({ label: label2, jumlah: map2[base.kd_poli] || 0, isHeader: false })
    }
    return result
}

export default { landing, rawatJalan, igd, rawatInap, lab, radiologi }
