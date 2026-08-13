// Surat Pemesanan (PO) Barang Non Medis — src/ipsrs/IPSRSSuratPemesanan.java
// (buat+simpan, prefill dari Pengajuan disetujui) & src/ipsrs/
// IPSRSCariSuratPemesanan.java (list+ubah status). INI ADALAH PO ASLI (nulis
// ke DB beneran), BUKAN sekadar cetak — dikonfirmasi dari investigasi.
//
// TIDAK ADA efek stok/jurnal di modul INI SENDIRI (dikonfirmasi) — status
// 'Sudah Datang' di Java asli LANGSUNG buka IPSRSPemesanan (form Penerimaan,
// DITUNDA Fase 3 krn situ yang posting jurnal+nambah stok). Di sini
// `tandaiSudahDatang()` CUMA update kolom status — TIDAK auto-buka
// Penerimaan (modulnya belum ada). PO yang sudah 'Sudah Datang' menunggu
// diproses manual begitu modul Penerimaan digarap di Fase 3.
//
// Tabel ASLI sik.sql:
// - `surat_pemesanan_non_medis(no_pemesanan, kode_suplier, nip, tanggal,
//   subtotal, potongan, total, ppn, meterai, tagihan,
//   status enum('Proses Pesan','Sudah Datang'))`.
// - `detail_surat_pemesanan_non_medis(no_pemesanan, kode_brng, kode_sat,
//   jumlah, h_pesan, subtotal, dis, besardis, total)` — urutan kolom
//   dikonfirmasi baris 1125-1134.
//
// Formula per baris (replika getData()/tbDokterMouseClicked, DIHITUNG DI
// SISI KLIEN/Vue, backend cuma nyimpan apa adanya — sama prinsipnya dgn
// TokoBarangService.calcHarga()):
//   subtotal   = jumlah * h_pesan
//   besardis   = ROUND(subtotal * dis% / 100)
//   total      = subtotal - besardis
// Header: subtotal(sbttl) = SUM(subtotal baris), potongan(ttldisk) =
// SUM(besardis baris), total(ttl) = sbttl-ttldisk, ppn = ROUND(tppn%*ttl),
// tagihan = ttl+ppn+meterai.
import DatabaseService from '../DatabaseService.js'

async function list({ page = 1, pageSize = 10, sortOrder = 'desc', search = '', status = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const like = `%${search}%`
    const where = ['(p.no_pemesanan LIKE ? OR sup.nama_suplier LIKE ? OR peg.nama LIKE ?)']
    const params = [like, like, like]
    if (status) { where.push('p.status = ?'); params.push(status) }

    const { rows } = await db.query(
        `SELECT p.no_pemesanan, p.kode_suplier, sup.nama_suplier, p.nip, peg.nama AS nama_petugas,
                p.tanggal, p.subtotal, p.potongan, p.total, p.ppn, p.meterai, p.tagihan, p.status
         FROM surat_pemesanan_non_medis p
         LEFT JOIN ipsrssuplier sup ON sup.kode_suplier = p.kode_suplier
         LEFT JOIN pegawai peg ON peg.nik = p.nip
         WHERE ${where.join(' AND ')}
         ORDER BY p.tanggal ${dir}, p.no_pemesanan ${dir}
         LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM surat_pemesanan_non_medis p
         LEFT JOIN ipsrssuplier sup ON sup.kode_suplier = p.kode_suplier
         LEFT JOIN pegawai peg ON peg.nik = p.nip WHERE ${where.join(' AND ')}`,
        params
    )
    return { data: rows, total: count }
}

async function detail(noPemesanan) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(
        `SELECT d.kode_brng, b.nama_brng, d.kode_sat, s.satuan AS nama_satuan,
                d.jumlah, d.h_pesan, d.subtotal, d.dis, d.besardis, d.total
         FROM detail_surat_pemesanan_non_medis d
         JOIN ipsrsbarang b ON b.kode_brng = d.kode_brng
         JOIN kodesatuan s ON s.kode_sat = d.kode_sat
         WHERE d.no_pemesanan = ?`,
        [noPemesanan]
    )
    return rows
}

// Replika Valid.autoNomer3(...) baris 1629-1630: prefix "SPM"+yyyy+MM+dd,
// counter 3 digit reset per tanggal.
async function nextNomor(tanggal) {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT IFNULL(MAX(CONVERT(RIGHT(no_pemesanan, 3), SIGNED)), 0) AS mx
         FROM surat_pemesanan_non_medis WHERE tanggal = ?`,
        [tanggal]
    )
    const [y, m, d] = tanggal.split('-')
    return 'SPM' + y + m + d + String(Number(mx) + 1).padStart(3, '0')
}

function validate({ no_pemesanan, kode_suplier, nip, meterai, items }) {
    if (!no_pemesanan?.trim()) return 'No. Pemesanan tidak boleh kosong'
    if (!kode_suplier?.trim()) return 'Supplier tidak boleh kosong'
    if (!nip?.trim()) return 'Petugas tidak boleh kosong'
    if (meterai === undefined || meterai === null || String(meterai).trim() === '') return 'Meterai tidak boleh kosong'
    if (!items || items.length === 0) return 'Maaf, data sudah habis'
    const terisi = items.filter(it => Number(it.jumlah) > 0)
    if (terisi.length === 0) return 'Maaf, Silahkan masukkan pemesanan'
    return null
}

async function create(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const { no_pemesanan, kode_suplier, nip, tanggal, meterai, ppn = 0, items } = data
    const terisi = items.filter(it => Number(it.jumlah) > 0)
    const subtotal = terisi.reduce((s, it) => s + Number(it.subtotal), 0)
    const potongan = terisi.reduce((s, it) => s + Number(it.besardis || 0), 0)
    const total = subtotal - potongan
    const tagihan = total + Number(ppn) + Number(meterai)

    const db = await DatabaseService.get()
    const client = await db.connect()
    try {
        await client.query('START TRANSACTION')
        await client.query(
            `INSERT INTO surat_pemesanan_non_medis
                (no_pemesanan, kode_suplier, nip, tanggal, subtotal, potongan, total, ppn, meterai, tagihan, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Proses Pesan')`,
            [no_pemesanan, kode_suplier, nip, tanggal, subtotal, potongan, total, ppn, meterai, tagihan]
        )
        for (const item of terisi) {
            await client.query(
                `INSERT INTO detail_surat_pemesanan_non_medis
                    (no_pemesanan, kode_brng, kode_sat, jumlah, h_pesan, subtotal, dis, besardis, total)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [no_pemesanan, item.kode_brng, item.kode_sat, item.jumlah, item.h_pesan,
                 item.subtotal, item.dis || 0, item.besardis || 0, item.total]
            )
        }
        await client.query('COMMIT')
        return { success: true }
    } catch (e) {
        await client.query('ROLLBACK')
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `No. Pemesanan "${no_pemesanan}" sudah dipakai` }
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Petugas (nip) tidak ditemukan di data pegawai, atau Supplier tidak valid — akun Admin Utama tidak bisa membuat Surat Pemesanan atas nama dirinya sendiri, harus login sebagai pegawai/staff.' }
        }
        return { success: false, message: 'Terjadi kesalahan saat pemrosesan data, transaksi dibatalkan. Periksa kembali data sebelum melanjutkan menyimpan.' }
    } finally {
        client.release()
    }
}

// Replika ppProsesActionPerformed — kembalikan status ke 'Proses Pesan'
// (mis. salah tandai "Sudah Datang"), TANPA efek lain.
async function tandaiProsesPesan(noPemesanan) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(`UPDATE surat_pemesanan_non_medis SET status='Proses Pesan' WHERE no_pemesanan=?`, [noPemesanan])
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
}

// Replika ppDatangActionPerformed — guard "sudah tervalidasi" identik,
// bagian buka IPSRSPemesanan (Penerimaan) DITUNDA Fase 3 (lihat catatan
// header file).
async function tandaiSudahDatang(noPemesanan) {
    const db = await DatabaseService.get()
    const { rows: [row] } = await db.query('SELECT status FROM surat_pemesanan_non_medis WHERE no_pemesanan=?', [noPemesanan])
    if (!row) return { success: false, message: 'Data tidak ditemukan' }
    if (row.status === 'Sudah Datang') return { success: false, message: 'Data pemesanan sudah tervalidasi' }
    await db.query(`UPDATE surat_pemesanan_non_medis SET status='Sudah Datang' WHERE no_pemesanan=?`, [noPemesanan])
    return { success: true }
}

async function deleteOne(noPemesanan) {
    const db = await DatabaseService.get()
    const { rows } = await db.query('DELETE FROM surat_pemesanan_non_medis WHERE no_pemesanan=?', [noPemesanan])
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
}

export default { list, detail, nextNomor, create, tandaiProsesPesan, tandaiSudahDatang, deleteOne }
