// Sirkulasi (pinjam/kembali) — src/perpustakaan/PerpustakaanSirkulasi.java.
// Transaksi inti Perpustakaan, jauh lebih kompleks dari taksonomi biasa:
//
// - Java asli 1 dialog 1 tombol Simpan dipakai dua alur (pinjam vs kembali),
//   dibedakan lewat `TNoI.isEditable()` — di sini dipecah jadi 2 fungsi
//   eksplisit (pinjam/kembali) supaya jelas & tidak bergantung state UI.
// - Jatuh tempo & preview denda dihitung ulang di setiap panggilan dari
//   `perpustakaan_set_peminjaman` TERKINI (bukan dibaca sekali lalu di-cache
//   selama dialog terbuka seperti Java asli) — perbaikan kecil, bukan
//   perubahan behavior yang terlihat user.
// - Denda keterlambatan HANYA preview saat kembali, TIDAK auto-insert ke
//   tabel denda mana pun (replikasi persis gap di Java asli — pencatatan
//   denda aktual tetap manual lewat PerpustakaanBayarDendaService).
// - Perpanjang: replika persis Java asli — cuma update tgl_pinjam+nip, TIDAK
//   mengulang validasi bisnis (masa berlaku/batas pinjam/status buku).
import DatabaseService from '../DatabaseService.js'

const SORTABLE = { tgl_pinjam: 'p.tgl_pinjam', no_anggota: 'p.no_anggota', no_inventaris: 'p.no_inventaris' }

async function getSetting() {
    const db = await DatabaseService.get()
    const { rows: [row] } = await db.query('SELECT max_pinjam, lama_pinjam, denda_perhari FROM perpustakaan_set_peminjaman WHERE id=1')
    return row || null
}

async function list({ page = 1, pageSize = 10, sortBy = 'tgl_pinjam', sortOrder = 'desc', search = '', status = '' } = {}) {
    const db = await DatabaseService.get()
    const col = SORTABLE[sortBy] || 'p.tgl_pinjam'
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const like = `%${search}%`
    const statusFilter = ['Masih Dipinjam', 'Sudah Kembali'].includes(status) ? status : null

    const { rows } = await db.query(
        `SELECT p.no_anggota, a.nama_anggota, p.no_inventaris, b.judul_buku,
                p.tgl_pinjam, p.tgl_kembali, p.nip, p.status_pinjam
         FROM perpustakaan_peminjaman p
         JOIN perpustakaan_anggota a    ON a.no_anggota    = p.no_anggota
         JOIN perpustakaan_inventaris i ON i.no_inventaris = p.no_inventaris
         JOIN perpustakaan_buku b       ON b.kode_buku     = i.kode_buku
         WHERE (a.nama_anggota ILIKE $1 OR b.judul_buku ILIKE $1 OR p.no_anggota ILIKE $1)
           AND ($4::text IS NULL OR p.status_pinjam = $4)
         ORDER BY ${col} ${dir}
         LIMIT $2 OFFSET $3`,
        [like, pageSize, (page - 1) * pageSize, statusFilter]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT count(*)::int AS count
         FROM perpustakaan_peminjaman p
         JOIN perpustakaan_anggota a    ON a.no_anggota    = p.no_anggota
         JOIN perpustakaan_inventaris i ON i.no_inventaris = p.no_inventaris
         JOIN perpustakaan_buku b       ON b.kode_buku     = i.kode_buku
         WHERE (a.nama_anggota ILIKE $1 OR b.judul_buku ILIKE $1 OR p.no_anggota ILIKE $1)
           AND ($2::text IS NULL OR p.status_pinjam = $2)`,
        [like, statusFilter]
    )
    return { data: rows, total: count }
}

function addDays(dateStr, days) {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + Number(days))
    return d.toISOString().slice(0, 10)
}

function diffDays(a, b) {
    return Math.round((new Date(a) - new Date(b)) / 86400000)
}

// Cek isSetPinjam + 3 kondisi bisnis Java asli. `db` dioper supaya bisa
// dipanggil ulang dari dalam transaksi (pinjam()) tanpa connection terpisah.
async function cekBisaPinjam(db, { no_anggota, no_inventaris, tgl_pinjam }, setting) {
    const { rows: [anggota] } = await db.query('SELECT masa_berlaku FROM perpustakaan_anggota WHERE no_anggota=$1', [no_anggota])
    if (!anggota) return 'Anggota tidak ditemukan'
    if (anggota.masa_berlaku && diffDays(anggota.masa_berlaku, tgl_pinjam) < 0) {
        return 'Masa keanggotaan sudah habis'
    }

    const { rows: [{ n }] } = await db.query(
        `SELECT count(*)::int AS n FROM perpustakaan_peminjaman WHERE no_anggota=$1 AND status_pinjam='Masih Dipinjam'`,
        [no_anggota]
    )
    if (n >= setting.max_pinjam) return 'Sudah mencapai batas maksimal peminjaman'

    const { rows: [inv] } = await db.query('SELECT status_buku FROM perpustakaan_inventaris WHERE no_inventaris=$1', [no_inventaris])
    if (!inv) return 'Buku (inventaris) tidak ditemukan'
    if (inv.status_buku !== 'Ada') return 'Buku sedang tidak tersedia (dipinjam/rusak/hilang)'

    return null
}

function validateWajib({ no_anggota, no_inventaris, tgl_pinjam, nip }) {
    if (!no_inventaris?.trim()) return 'Buku (Inventaris) tidak boleh kosong'
    if (!no_anggota?.trim()) return 'Peminjam (Anggota) tidak boleh kosong'
    if (!tgl_pinjam?.trim?.() && !tgl_pinjam) return 'Tanggal Pinjam tidak boleh kosong'
    if (!nip?.trim()) return 'Petugas tidak boleh kosong'
    return null
}

// Preview jatuh tempo SEBELUM disimpan (dipanggil tiap ganti buku/anggota di
// form pinjam) — tidak menulis apa pun ke DB.
async function previewPinjam(data) {
    const err = validateWajib(data)
    if (err) return { success: false, message: err }

    const setting = await getSetting()
    if (!setting || !setting.max_pinjam || !setting.lama_pinjam) {
        return { success: false, message: 'Pengaturan Peminjaman belum diatur — hubungi Administrator' }
    }

    const db = await DatabaseService.get()
    const cekErr = await cekBisaPinjam(db, data, setting)
    if (cekErr) return { success: false, message: cekErr }

    return { success: true, jatuhTempo: addDays(data.tgl_pinjam, setting.lama_pinjam) }
}

async function pinjam(data) {
    const err = validateWajib(data)
    if (err) return { success: false, message: err }

    const setting = await getSetting()
    if (!setting || !setting.max_pinjam || !setting.lama_pinjam) {
        return { success: false, message: 'Pengaturan Peminjaman belum diatur — hubungi Administrator' }
    }

    const db = await DatabaseService.get()
    const cekErr = await cekBisaPinjam(db, data, setting)
    if (cekErr) return { success: false, message: cekErr }

    try {
        await db.query(
            `INSERT INTO perpustakaan_peminjaman (no_anggota, no_inventaris, tgl_pinjam, nip, status_pinjam)
             VALUES ($1,$2,$3,$4,'Masih Dipinjam')`,
            [data.no_anggota, data.no_inventaris, data.tgl_pinjam, data.nip]
        )
        await db.query(`UPDATE perpustakaan_inventaris SET status_buku='Dipinjam' WHERE no_inventaris=$1`, [data.no_inventaris])
        return { success: true, jatuhTempo: addDays(data.tgl_pinjam, setting.lama_pinjam) }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: 'Peminjaman dengan kombinasi anggota/buku/tanggal ini sudah tercatat' }
        throw e
    }
}

// Preview keterlambatan & denda SAAT mode kembali — tidak menulis apa pun.
async function previewKembali({ no_anggota, no_inventaris, tgl_pinjam, tgl_kembali }) {
    const setting = await getSetting()
    if (!setting) return { success: false, message: 'Pengaturan Peminjaman belum diatur — hubungi Administrator' }

    const db = await DatabaseService.get()
    const { rows: [pinjaman] } = await db.query(
        `SELECT tgl_kembali FROM perpustakaan_peminjaman WHERE no_anggota=$1 AND no_inventaris=$2 AND tgl_pinjam=$3`,
        [no_anggota, no_inventaris, tgl_pinjam]
    )
    if (!pinjaman) return { success: false, message: 'Data peminjaman tidak ditemukan' }
    if (pinjaman.tgl_kembali) return { success: false, message: 'Peminjaman ini sudah pernah dikembalikan' }

    const jatuhTempo = addDays(tgl_pinjam, setting.lama_pinjam)
    const hariTelat = Math.max(0, diffDays(tgl_kembali, jatuhTempo))
    const besarDenda = hariTelat * Number(setting.denda_perhari)
    return { success: true, jatuhTempo, hariTelat, besarDenda }
}

async function kembali(data) {
    if (!data.nip?.trim()) return { success: false, message: 'Petugas tidak boleh kosong' }

    const preview = await previewKembali(data)
    if (!preview.success) return preview

    const db = await DatabaseService.get()
    await db.query(
        `UPDATE perpustakaan_peminjaman SET tgl_kembali=$1, status_pinjam='Sudah Kembali', nip=$2
         WHERE no_anggota=$3 AND no_inventaris=$4 AND tgl_pinjam=$5`,
        [data.tgl_kembali, data.nip, data.no_anggota, data.no_inventaris, data.tgl_pinjam]
    )
    await db.query(`UPDATE perpustakaan_inventaris SET status_buku='Ada' WHERE no_inventaris=$1`, [data.no_inventaris])
    return { success: true, ...preview }
}

// Replika persis BtnPerpanjang Java: cuma update tgl_pinjam+nip, TIDAK
// mengulang cek isSetPinjam/status buku (memang begitu di aslinya).
async function perpanjang({ no_anggota, no_inventaris, tgl_pinjam_lama, tgl_pinjam_baru, nip }) {
    if (!no_inventaris?.trim()) return { success: false, message: 'Buku (Inventaris) tidak boleh kosong' }
    if (!no_anggota?.trim()) return { success: false, message: 'Peminjam (Anggota) tidak boleh kosong' }
    if (!nip?.trim()) return { success: false, message: 'Petugas tidak boleh kosong' }

    const db = await DatabaseService.get()
    try {
        const { rowCount } = await db.query(
            `UPDATE perpustakaan_peminjaman SET tgl_pinjam=$1, nip=$2
             WHERE no_anggota=$3 AND no_inventaris=$4 AND tgl_pinjam=$5 AND status_pinjam='Masih Dipinjam'`,
            [tgl_pinjam_baru, nip, no_anggota, no_inventaris, tgl_pinjam_lama]
        )
        if (rowCount === 0) return { success: false, message: 'Data tidak ditemukan / sudah dikembalikan' }
        return { success: true }
    } catch (e) {
        if (e.code === '23505') return { success: false, message: 'Sudah ada peminjaman lain dengan kombinasi anggota/buku/tanggal ini' }
        throw e
    }
}

// Replika persis Java: hapus HANYA boleh untuk record yang SUDAH kembali.
async function deleteOne({ no_anggota, no_inventaris, tgl_pinjam }) {
    const db = await DatabaseService.get()
    const { rows: [row] } = await db.query(
        `SELECT tgl_kembali FROM perpustakaan_peminjaman WHERE no_anggota=$1 AND no_inventaris=$2 AND tgl_pinjam=$3`,
        [no_anggota, no_inventaris, tgl_pinjam]
    )
    if (!row) return { success: false, message: 'Data tidak ditemukan' }
    if (!row.tgl_kembali) return { success: false, message: 'Peminjaman yang masih aktif tidak bisa dihapus — kembalikan dulu' }

    await db.query(
        `DELETE FROM perpustakaan_peminjaman WHERE no_anggota=$1 AND no_inventaris=$2 AND tgl_pinjam=$3`,
        [no_anggota, no_inventaris, tgl_pinjam]
    )
    return { success: true }
}

export default { getSetting, list, previewPinjam, pinjam, previewKembali, kembali, perpanjang, deleteOne }
