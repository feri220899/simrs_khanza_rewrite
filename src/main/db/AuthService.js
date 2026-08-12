// PIVOT (lihat README.md > "Login & Permission (pivot MySQL)"): login TIDAK
// LAGI ke tabel `electron_users` (dihapus) — akun tetap satu sumber, tabel
// ASLI Khanza:
//   1. Tabel `admin` (`usere`/`passworde`, AES_ENCRYPT key 'nur'/'windi' —
//      persis src/fungsi/akses.java) — cocok = "Admin Utama", akses penuh
//      HARDCODE (semua slug permission, gak peduli tabel role), gak beda
//      dari kelakuan Java yang set SEMUA 1211 flag akses.xxx=true.
//   2. Tabel `user` (`id_user`/`password`, AES_ENCRYPT sama) — cocok =
//      role-nya dicari di `electron_user_roles` (map id_user -> role_id),
//      lalu permission dari `electron_role_permissions`. Belum ada baris di
//      `electron_user_roles` = ditolak (belum di-assign role oleh Admin
//      Utama), bukan diloloskan dengan nol akses (UX lebih jelas).
//
// bcrypt/JWT tetap dipakai buat SESI Electron (token setelah login sukses) —
// bukan buat verifikasi password ke MySQL (itu AES_ENCRYPT native MySQL).
import jwt from 'jsonwebtoken'
import DatabaseService from './DatabaseService.js'

const JWT_SECRET = process.env.JWT_SECRET || 'ubah-di-.env'

// Role string yang dianggap "akses penuh" buat gate kasar (mis. jalankan
// migration, hard-delete data) di IPC handler yang cek role langsung
// (bukan lewat requirePermission slug). "Admin Utama" (tabel `admin`) WAJIB
// selalu lolos gate ini — dia yang jadi jalur bootstrap satu-satunya kalau
// migration electron_* belum pernah jalan sama sekali.
function isFullAdmin(role) {
    return role === 'Administrator' || role === 'Admin Utama'
}

async function login(username, password) {
    const db = await DatabaseService.get()

    // 1) Coba tabel `admin` dulu — persis urutan Java (`akses.java`, ps lalu ps2).
    const { rows: adminRows } = await db.query(
        `SELECT 1 FROM admin WHERE usere = AES_ENCRYPT(?, 'nur') AND passworde = AES_ENCRYPT(?, 'windi')`,
        [username, password]
    )

    if (adminRows.length > 0) {
        // Semua slug permission yang terdaftar — mencerminkan Java yang
        // hardcode SEMUA akses.xxx = true buat Admin Utama. Kalau migration
        // electron_* belum pernah jalan (tabel belum ada), tetap lolos
        // login dengan permission kosong — supaya Admin Utama SELALU bisa
        // masuk buat menjalankan migration itu sendiri (lihat isFullAdmin(),
        // dipakai di IPC gate db:runMigrations dkk, bukan cuma slug).
        let permissions = []
        try {
            const { rows } = await db.query('SELECT slug FROM electron_permissions')
            permissions = rows.map(r => r.slug)
        } catch (err) {
            if (!isTableMissing(err)) throw err
        }

        const payload = { username, role: 'Admin Utama', permissions }
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' })
        return { success: true, token, user: payload }
    }

    // 2) Tabel `user` biasa.
    let userRows
    try {
        ;({ rows: userRows } = await db.query(
            `SELECT id_user FROM user WHERE id_user = AES_ENCRYPT(?, 'nur') AND password = AES_ENCRYPT(?, 'windi')`,
            [username, password]
        ))
    } catch (err) {
        throw err
    }

    if (userRows.length === 0) return { success: false, message: 'Username atau password salah' }

    let roleRow
    try {
        ;({ rows: [roleRow] } = await db.query(
            `SELECT r.id AS role_id, r.nama AS role_name
             FROM electron_user_roles ur
             JOIN electron_roles r ON r.id = ur.role_id
             WHERE ur.id_user = ?`,
            [username]
        ))
    } catch (err) {
        // electron_user_roles/electron_roles belum ada (migration belum
        // jalan) — akun `user` biasa TIDAK bisa dipakai sebelum migration
        // electron_* jalan (cuma Admin Utama yang bisa lewat kondisi ini,
        // lihat cabang di atas).
        if (isTableMissing(err)) {
            return { success: false, message: 'Database belum disiapkan — login sebagai Admin Utama dulu untuk menjalankan migration awal.' }
        }
        throw err
    }

    if (!roleRow) {
        return { success: false, message: 'Akun ini belum diberi role — hubungi Admin Utama untuk mengatur akses di menu Kelola Role.' }
    }

    const { rows: permRows } = await db.query(
        `SELECT p.slug FROM electron_role_permissions rp
         JOIN electron_permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = ?`,
        [roleRow.role_id]
    )

    const payload = { username, role: roleRow.role_name, permissions: permRows.map(r => r.slug) }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' })
    return { success: true, token, user: payload }
}

function isTableMissing(err) {
    // mysql2: kode error tabel tidak ada = 'ER_NO_SUCH_TABLE' (errno 1146).
    return err?.code === 'ER_NO_SUCH_TABLE'
}

function verifySession(token) {
    try {
        return { success: true, user: jwt.verify(token, JWT_SECRET) }
    } catch {
        return { success: false }
    }
}

// Helper generik buat IPC handler modul lain (mis. Parkir) yang mau gate
// aksi tulis (create/update/delete) ke permission tertentu — sama prinsipnya
// dengan db:runMigrations: dicek DI SINI (server-side), bukan cuma
// disembunyikan tombolnya di UI. Ini setara `akses.getparkir_jenis()` dkk di
// Java asli, tapi divalidasi ulang tiap request (JWT bisa kadaluarsa/dicabut),
// bukan cuma di-cache sekali saat login seperti `akses` di Java.
function requirePermission(token, slug) {
    const session = verifySession(token)
    if (!session.success) return { ok: false, message: 'Sesi tidak valid, silakan login ulang' }
    if (!session.user.permissions.includes(slug)) {
        return { ok: false, message: `Anda tidak punya akses '${slug}' untuk aksi ini` }
    }
    return { ok: true, user: session.user }
}

export default { login, verifySession, requirePermission, isFullAdmin }
