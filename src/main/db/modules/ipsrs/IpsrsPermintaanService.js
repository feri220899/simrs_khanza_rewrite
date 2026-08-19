// Permintaan Barang Non Medis — src/ipsrs/IPSRSPermintaan.java (buat+simpan)
// & src/ipsrs/IPSRSCariPermintaan.java (list+approve+hapus). TIDAK ADA efek
// stok/jurnal SAMA SEKALI (dikonfirmasi dari investigasi) — approve cuma
// UPDATE status, lalu Java asli LANGSUNG buka IPSRSPengeluaran (form
// Pengeluaran, DITUNDA Fase 3 krn posting jurnal) buat prefill. Di sini
// approve/tolak CUMA update status — TIDAK auto-buka Pengeluaran (modulnya
// belum ada), beda dari alur atomic Java asli.
//
// Tabel ASLI sik.sql:
// - `permintaan_non_medis(no_permintaan, ruang, nip, tanggal,
//   status enum('Baru','Disetujui','Tidak Disetujui'))`.
// - `detail_permintaan_non_medis(no_permintaan, kode_brng, kode_sat, jumlah,
//   keterangan)` — urutan kolom dikonfirmasi IPSRSPermintaan.java baris 492.
import DatabaseService from '../../DatabaseService.js'

async function list({ page = 1, pageSize = 10, sortOrder = 'desc', search = '', status = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const like = `%${search}%`
    const where = ['(p.no_permintaan LIKE ? OR p.ruang LIKE ? OR peg.nama LIKE ?)']
    const params = [like, like, like]
    if (status) { where.push('p.status = ?'); params.push(status) }

    const { rows } = await db.query(
        `SELECT p.no_permintaan, p.ruang, p.nip, peg.nama AS nama_petugas, p.tanggal, p.status
         FROM permintaan_non_medis p
         LEFT JOIN pegawai peg ON peg.nik = p.nip
         WHERE ${where.join(' AND ')}
         ORDER BY p.tanggal ${dir}, p.no_permintaan ${dir}
         LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM permintaan_non_medis p LEFT JOIN pegawai peg ON peg.nik = p.nip WHERE ${where.join(' AND ')}`,
        params
    )
    return { data: rows, total: count }
}

async function detail(noPermintaan) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(
        `SELECT d.kode_brng, b.nama_brng, d.kode_sat, s.satuan AS nama_satuan, d.jumlah, d.keterangan
         FROM detail_permintaan_non_medis d
         JOIN ipsrsbarang b ON b.kode_brng = d.kode_brng
         JOIN kodesatuan s ON s.kode_sat = d.kode_sat
         WHERE d.no_permintaan = ?`,
        [noPermintaan]
    )
    return rows
}

// Replika Valid.autoNomer3(...) IPSRSPermintaan.java baris 899-901: prefix
// "PN"+yy+MM+dd DARI TANGGAL YANG DIPILIH (bukan tanggal hari ini), counter
// 3 digit RESET PER TANGGAL (bukan global).
async function nextNomor(tanggal) {
    const db = await DatabaseService.get()
    const { rows: [{ mx }] } = await db.query(
        `SELECT IFNULL(MAX(CONVERT(RIGHT(no_permintaan, 3), SIGNED)), 0) AS mx
         FROM permintaan_non_medis WHERE tanggal = ?`,
        [tanggal]
    )
    const prefix = 'PN' + DateFormatYYMMDD(tanggal)
    return prefix + String(Number(mx) + 1).padStart(3, '0')
}

function DateFormatYYMMDD(tanggal) {
    const [y, m, d] = tanggal.split('-')
    return y.slice(2) + m + d
}

function validate({ no_permintaan, ruang, nip, items }) {
    if (!no_permintaan?.trim()) return 'No. Permintaan tidak boleh kosong'
    if (!ruang?.trim()) return 'Ruangan tidak boleh kosong'
    if (!nip?.trim()) return 'Petugas tidak boleh kosong'
    if (!items || items.length === 0) return 'Maaf, data sudah habis'
    const terisi = items.filter(it => Number(it.jumlah) > 0)
    if (terisi.length === 0) return 'Maaf, Silahkan masukkan permintaan'
    return null
}

async function create({ no_permintaan, ruang, nip, tanggal, items }) {
    const err = validate({ no_permintaan, ruang, nip, items })
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    const client = await db.connect()
    try {
        await client.query('START TRANSACTION')
        await client.query(
            `INSERT INTO permintaan_non_medis (no_permintaan, ruang, nip, tanggal, status) VALUES (?, ?, ?, ?, 'Baru')`,
            [no_permintaan, ruang, nip, tanggal]
        )
        for (const item of items) {
            if (!(Number(item.jumlah) > 0)) continue
            await client.query(
                `INSERT INTO detail_permintaan_non_medis (no_permintaan, kode_brng, kode_sat, jumlah, keterangan)
                 VALUES (?, ?, ?, ?, ?)`,
                [no_permintaan, item.kode_brng, item.kode_sat, item.jumlah, (item.keterangan || '').replace(/['"]/g, '')]
            )
        }
        await client.query('COMMIT')
        return { success: true }
    } catch (e) {
        await client.query('ROLLBACK')
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: `No. Permintaan "${no_permintaan}" sudah dipakai` }
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
            // Replika akses.getkode() — petugas HARUS punya baris di `pegawai`
            // (login Admin Utama tidak, krn dia dari tabel `admin` terpisah).
            return { success: false, message: 'Petugas (nip) tidak ditemukan di data pegawai — akun Admin Utama tidak bisa mengajukan Permintaan atas nama dirinya sendiri, harus login sebagai pegawai/staff.' }
        }
        return { success: false, message: 'Terjadi kesalahan saat pemrosesan data, transaksi dibatalkan. Periksa kembali data sebelum melanjutkan menyimpan.' }
    } finally {
        client.release()
    }
}

// Replika ppDisetujuiActionPerformed/ppTidakDisetujuiActionPerformed —
// CUMA update status (bagian buka IPSRSPengeluaran DITUNDA Fase 3).
async function setStatus(noPermintaan, status) {
    if (!['Disetujui', 'Tidak Disetujui'].includes(status)) return { success: false, message: 'Status tidak valid' }
    const db = await DatabaseService.get()
    const { rows } = await db.query('UPDATE permintaan_non_medis SET status=? WHERE no_permintaan=?', [status, noPermintaan])
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
}

// Replika ppHapusActionPerformed — DELETE beneran (bukan soft-delete), gate
// "Admin Utama" PERSIS (dicek exact-role di IPC, bukan permission slug).
async function deleteOne(noPermintaan) {
    const db = await DatabaseService.get()
    const { rows } = await db.query('DELETE FROM permintaan_non_medis WHERE no_permintaan=?', [noPermintaan])
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
}

export default { list, detail, nextNomor, create, setStatus, deleteOne }
