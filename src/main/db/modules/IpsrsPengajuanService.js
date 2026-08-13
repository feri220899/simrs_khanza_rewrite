// Pengajuan Barang Non Medis — src/ipsrs/IPSRSPengajuanBarangNonMedis.java
// (buat+simpan) & src/ipsrs/DlgCariPengajuanBarangNonMedis.java
// (list+approve+tolak+hapus+proses). TIDAK ADA efek stok/jurnal (murni
// proposal). Approve = UPDATE status SAJA — Java asli LANGSUNG buka
// IPSRSSuratPemesanan buat prefill (lihat `prefillForSuratPemesanan()` di
// bawah, dipanggil terpisah dari Vue setelah approve sukses, BUKAN atomic
// spt Java krn di sini navigasi ke form lain itu keputusan UI, bukan DB).
//
// Tabel ASLI sik.sql:
// - `pengajuan_barang_nonmedis(no_pengajuan, nip, tanggal,
//   status enum('Proses Pengajuan','Disetujui','Ditolak'), keterangan)`.
// - `detail_pengajuan_barang_nonmedis(no_pengajuan, kode_brng, kode_sat,
//   jumlah, h_pengajuan, total)` — urutan kolom dikonfirmasi baris 520.
//
// PERMISSION SILANG (dikonfirmasi dari DlgCariPengajuanBarangNonMedis.isCek()
// baris 1079-1086): Hapus/Proses/Tolak digate slug modul INI SENDIRI
// (`pengajuan_barang_nonmedis`), TAPI Setujui digate slug modul SURAT
// PEMESANAN (`surat_pemesanan_non_medis`) — BUKAN role-based spt Permintaan.
import DatabaseService from '../DatabaseService.js'

async function list({ page = 1, pageSize = 10, sortOrder = 'desc', search = '', status = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const like = `%${search}%`
    const where = ['(p.no_pengajuan LIKE ? OR p.keterangan LIKE ? OR peg.nama LIKE ?)']
    const params = [like, like, like]
    if (status) { where.push('p.status = ?'); params.push(status) }

    const { rows } = await db.query(
        `SELECT p.no_pengajuan, p.nip, peg.nama AS nama_petugas, p.tanggal, p.status, p.keterangan
         FROM pengajuan_barang_nonmedis p
         LEFT JOIN pegawai peg ON peg.nik = p.nip
         WHERE ${where.join(' AND ')}
         ORDER BY p.tanggal ${dir}, p.no_pengajuan ${dir}
         LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM pengajuan_barang_nonmedis p LEFT JOIN pegawai peg ON peg.nik = p.nip WHERE ${where.join(' AND ')}`,
        params
    )
    return { data: rows, total: count }
}

async function detail(noPengajuan) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(
        `SELECT d.kode_brng, b.nama_brng, d.kode_sat, s.satuan AS nama_satuan, d.jumlah, d.h_pengajuan, d.total
         FROM detail_pengajuan_barang_nonmedis d
         JOIN ipsrsbarang b ON b.kode_brng = d.kode_brng
         JOIN kodesatuan s ON s.kode_sat = d.kode_sat
         WHERE d.no_pengajuan = ?`,
        [noPengajuan]
    )
    return rows
}

// Replika Valid.autoNomer3(...) baris 946-947: prefix "PBNM"+yyyy+MM+dd (4
// digit tahun — BEDA dari Permintaan yang cuma 2 digit), counter 3 digit
// reset per tanggal.
async function nextNomor(tanggal) {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT IFNULL(MAX(CONVERT(RIGHT(no_pengajuan, 3), SIGNED)), 0) AS mx
         FROM pengajuan_barang_nonmedis WHERE tanggal = ?`,
        [tanggal]
    )
    const [y, m, d] = tanggal.split('-')
    return 'PBNM' + y + m + d + String(Number(mx) + 1).padStart(3, '0')
}

function validate({ no_pengajuan, keterangan, nip, items }) {
    if (!no_pengajuan?.trim()) return 'No. Pengajuan tidak boleh kosong'
    if (!keterangan?.trim()) return 'Keterangan tidak boleh kosong'
    if (!nip?.trim()) return 'Petugas tidak boleh kosong'
    if (!items || items.length === 0) return 'Maaf, data sudah habis'
    const terisi = items.filter(it => Number(it.jumlah) > 0)
    if (terisi.length === 0) return 'Maaf, Silahkan masukkan permintaan'
    return null
}

// Replika getData(): total per baris = jumlah * h_pengajuan.
async function create({ no_pengajuan, nip, tanggal, keterangan, items }) {
    const err = validate({ no_pengajuan, keterangan, nip, items })
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    const client = await db.connect()
    try {
        await client.query('START TRANSACTION')
        await client.query(
            `INSERT INTO pengajuan_barang_nonmedis (no_pengajuan, nip, tanggal, status, keterangan)
             VALUES (?, ?, ?, 'Proses Pengajuan', ?)`,
            [no_pengajuan, nip, tanggal, keterangan]
        )
        for (const item of items) {
            const jumlah = Number(item.jumlah)
            if (!(jumlah > 0)) continue
            const hPengajuan = Number(item.h_pengajuan)
            await client.query(
                `INSERT INTO detail_pengajuan_barang_nonmedis (no_pengajuan, kode_brng, kode_sat, jumlah, h_pengajuan, total)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [no_pengajuan, item.kode_brng, item.kode_sat, jumlah, hPengajuan, jumlah * hPengajuan]
            )
        }
        await client.query('COMMIT')
        return { success: true }
    } catch (e) {
        await client.query('ROLLBACK')
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `No. Pengajuan "${no_pengajuan}" sudah dipakai` }
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Petugas (nip) tidak ditemukan di data pegawai — akun Admin Utama tidak bisa mengajukan Pengajuan atas nama dirinya sendiri, harus login sebagai pegawai/staff.' }
        }
        return { success: false, message: 'Terjadi kesalahan saat pemrosesan data, transaksi dibatalkan. Periksa kembali data sebelum melanjutkan menyimpan.' }
    } finally {
        client.release()
    }
}

// Replika ppProsesPengajuanActionPerformed/ppDitolakActionPerformed.
async function setStatus(noPengajuan, status) {
    if (!['Proses Pengajuan', 'Ditolak'].includes(status)) return { success: false, message: 'Status tidak valid' }
    const db = await DatabaseService.get()
    const { rows } = await db.query('UPDATE pengajuan_barang_nonmedis SET status=? WHERE no_pengajuan=?', [status, noPengajuan])
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
}

// Replika ppDisetujuiActionPerformed — guard "sudah tervalidasi" identik,
// bagian buka IPSRSSuratPemesanan dipisah ke prefillForSuratPemesanan().
async function approve(noPengajuan) {
    const db = await DatabaseService.get()
    const { rows: [row] } = await db.query('SELECT status FROM pengajuan_barang_nonmedis WHERE no_pengajuan=?', [noPengajuan])
    if (!row) return { success: false, message: 'Data tidak ditemukan' }
    if (row.status === 'Disetujui') return { success: false, message: 'Data pengajuan sudah tervalidasi' }
    await db.query(`UPDATE pengajuan_barang_nonmedis SET status='Disetujui' WHERE no_pengajuan=?`, [noPengajuan])
    return { success: true }
}

// Replika IPSRSSuratPemesanan.panggilgetData(String) — dipanggil Vue
// SETELAH approve() sukses, buat prefill baris detail form Surat Pemesanan.
async function prefillForSuratPemesanan(noPengajuan) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(
        `SELECT b.kode_brng, b.nama_brng, d.kode_sat, d.jumlah, d.h_pengajuan, d.total
         FROM ipsrsbarang b
         JOIN ipsrsjenisbarang j ON b.jenis = j.kd_jenis
         JOIN detail_pengajuan_barang_nonmedis d ON b.kode_brng = d.kode_brng
         WHERE d.no_pengajuan = ?`,
        [noPengajuan]
    )
    return rows
}

// Replika ppHapusActionPerformed — gate permission `pengajuan_barang_nonmedis`
// biasa (BUKAN role-based spt Permintaan).
async function deleteOne(noPengajuan) {
    const db = await DatabaseService.get()
    const { rows } = await db.query('DELETE FROM pengajuan_barang_nonmedis WHERE no_pengajuan=?', [noPengajuan])
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
}

export default { list, detail, nextNomor, create, setStatus, approve, prefillForSuratPemesanan, deleteOne }
