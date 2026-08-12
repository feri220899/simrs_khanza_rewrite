// "Kelola Role" — satu-satunya cara mengatur akses akun `user` biasa
// (lihat README.md > "Login & Permission (pivot MySQL)"). Akun `admin`
// (Admin Utama) TIDAK muncul di sini sama sekali — aksesnya hardcode,
// tidak bergantung role apa pun (lihat AuthService.js).
import DatabaseService from '../DatabaseService.js'

async function listRoles() {
    const db = await DatabaseService.get()
    const { rows } = await db.query(`
        SELECT r.id, r.nama, COUNT(rp.permission_id) AS jml_permission
        FROM electron_roles r
        LEFT JOIN electron_role_permissions rp ON rp.role_id = r.id
        GROUP BY r.id, r.nama
        ORDER BY r.nama
    `)
    return rows
}

async function createRole(nama) {
    if (!nama?.trim()) return { success: false, message: 'Nama role tidak boleh kosong' }
    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query('INSERT INTO electron_roles (nama) VALUES (?)', [nama.trim()])
        return { success: true, id: rows.insertId }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: 'Nama role sudah dipakai' }
        throw e
    }
}

async function updateRole(id, nama) {
    if (!nama?.trim()) return { success: false, message: 'Nama role tidak boleh kosong' }
    const db = await DatabaseService.get()
    try {
        const { rows } = await db.query('UPDATE electron_roles SET nama = ? WHERE id = ?', [nama.trim(), id])
        if (rows.affectedRows === 0) return { success: false, message: 'Role tidak ditemukan' }
        return { success: true }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: 'Nama role sudah dipakai' }
        throw e
    }
}

async function duplicateRole(roleId, namaBaru) {
    if (!namaBaru?.trim()) return { success: false, message: 'Nama role baru tidak boleh kosong' }
    const db = await DatabaseService.get()
    const client = await db.connect()
    try {
        await client.query('START TRANSACTION')
        const { rows } = await client.query('INSERT INTO electron_roles (nama) VALUES (?)', [namaBaru.trim()])
        const newRoleId = rows.insertId
        await client.query(`
            INSERT INTO electron_role_permissions (role_id, permission_id)
            SELECT ?, permission_id FROM electron_role_permissions WHERE role_id = ?
        `, [newRoleId, roleId])
        await client.query('COMMIT')
        return { success: true, id: newRoleId }
    } catch (e) {
        await client.query('ROLLBACK')
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: 'Nama role sudah dipakai' }
        throw e
    } finally {
        client.release()
    }
}

async function deleteRole(id) {
    const db = await DatabaseService.get()
    const { rows: [{ n }] } = await db.query('SELECT COUNT(*) AS n FROM electron_user_roles WHERE role_id = ?', [id])
    if (n > 0) return { success: false, message: `Tidak bisa dihapus — masih dipakai ${n} akun. Pindahkan akun itu ke role lain dulu.` }

    const { rows } = await db.query('DELETE FROM electron_roles WHERE id = ?', [id])
    if (rows.affectedRows === 0) return { success: false, message: 'Role tidak ditemukan' }
    return { success: true }
}

async function listPermissions() {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT id, slug, label FROM electron_permissions ORDER BY slug')
    return rows
}

async function getRolePermissionIds(roleId) {
    const db = await DatabaseService.get()
    const { rows } = await db.query('SELECT permission_id FROM electron_role_permissions WHERE role_id = ?', [roleId])
    return rows.map(r => r.permission_id)
}

async function setRolePermissions(roleId, permissionIds) {
    const db = await DatabaseService.get()
    const client = await db.connect()
    try {
        await client.query('START TRANSACTION')
        await client.query('DELETE FROM electron_role_permissions WHERE role_id = ?', [roleId])
        if (permissionIds.length > 0) {
            const values = permissionIds.map(() => '(?, ?)').join(', ')
            const params = permissionIds.flatMap(pid => [roleId, pid])
            await client.query(`INSERT INTO electron_role_permissions (role_id, permission_id) VALUES ${values}`, params)
        }
        await client.query('COMMIT')
        return { success: true }
    } catch (err) {
        await client.query('ROLLBACK')
        throw err
    } finally {
        client.release()
    }
}

// Kolom flag akses Java lama di tabel `user` (1211, semua `enum('true','false')`
// — diverifikasi via information_schema, bukan di-hardcode/di-asumsikan) di
// luar id_user/password. Dibaca dinamis dari information_schema (bukan
// daftar manual) — kalau vendor Khanza nambah kolom baru lewat update
// sik.sql, INSERT baru ini otomatis ikut kolom terbaru tanpa perlu disentuh.
async function getUserFlagColumns() {
    const db = await DatabaseService.get()
    const { rows } = await db.query(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME NOT IN ('id_user', 'password')
    `)
    return rows.map(r => r.COLUMN_NAME)
}

// Daftar dokter+petugas buat prefill form "Tambah User Baru" (satu dropdown
// Select2-style, client-side search — pola sama seperti AppSelect di
// Perpustakaan, bukan search-as-you-type server-side) — REPLIKA
// src/setting/DlgUser.java (BtnSeek/BtnSeek1, buka DlgCariDokter/
// DlgCariPetugas). Di Java, `id_user` diisi dari kd_dokter/nip, `password`
// DIISI SAMA PERSIS DENGAN kd_dokter/nip (bukan random — WEAK by design tapi
// itu perilaku asli, tetap editable sebelum simpan). "Jabatan"/spesialis
// cuma ditampilkan di layar, TIDAK PERNAH disimpan ke tabel `user` (tidak
// ada kolom buat itu) — dan TIDAK ADA FK sungguhan antara `user` dan
// `dokter`/`petugas`, id_user cuma KEBETULAN sama nilai dengan kd_dokter/nip
// di titik pembuatan (lihat catatan di README.md).
async function listOrangUntukUser() {
    const db = await DatabaseService.get()
    const [{ rows: dokter }, { rows: petugas }] = await Promise.all([
        db.query(`
            SELECT dokter.kd_dokter AS kode, dokter.nm_dokter AS nama, spesialis.nm_sps AS jabatan
            FROM dokter LEFT JOIN spesialis ON spesialis.kd_sps = dokter.kd_sps
            ORDER BY dokter.nm_dokter
        `),
        db.query(`
            SELECT petugas.nip AS kode, petugas.nama AS nama, jabatan.nm_jbtn AS jabatan
            FROM petugas LEFT JOIN jabatan ON jabatan.kd_jbtn = petugas.kd_jbtn
            ORDER BY petugas.nama
        `),
    ])
    return [
        ...dokter.map(r => ({ kode: r.kode, nama: r.nama, jabatan: r.jabatan || '-', tipe: 'Dokter' })),
        ...petugas.map(r => ({ kode: r.kode, nama: r.nama, jabatan: r.jabatan || '-', tipe: 'Petugas' })),
    ]
}

// Bikin akun `user` BENERAN BARU di tabel asli Khanza (bukan cuma assign
// role) — dipakai buat staff yang belum punya akun sama sekali. Semua 1211
// flag akses Java lama diisi 'false' (deny-by-default) — KEPUTUSAN SENGAJA
// user: Electron tidak pernah baca kolom ini, cuma disediakan supaya INSERT
// valid (kolom NOT NULL) dan akun ini konsisten kalau suatu saat dibuka
// lewat app Java juga. Kalau staff ini perlu akses Java, atur manual lewat
// menu user management Java sendiri — bukan tanggung jawab Electron.
async function createUserAccount({ id_user, password, roleId }) {
    if (!id_user?.trim()) return { success: false, message: 'Username tidak boleh kosong' }
    if (!password || password.length < 4) return { success: false, message: 'Password minimal 4 karakter' }

    const db = await DatabaseService.get()
    const { rows: exists } = await db.query(`SELECT 1 FROM user WHERE id_user = AES_ENCRYPT(?, 'nur')`, [id_user])
    if (exists.length > 0) return { success: false, message: 'Username sudah dipakai' }

    const flagCols = await getUserFlagColumns()
    const colList = ['id_user', 'password', ...flagCols].map(c => `\`${c}\``).join(', ')
    const valueSql = [`AES_ENCRYPT(?, 'nur')`, `AES_ENCRYPT(?, 'windi')`, ...flagCols.map(() => `'false'`)].join(', ')
    await db.query(`INSERT INTO user (${colList}) VALUES (${valueSql})`, [id_user.trim(), password])

    if (roleId) {
        const assignRes = await assignUserRole(id_user.trim(), roleId)
        if (!assignRes.success) return { success: true, warning: `Akun dibuat, tapi gagal assign role: ${assignRes.message}` }
    }
    return { success: true }
}

// Daftar SEMUA akun `user` asli (didekripsi via AES_DECRYPT MySQL, bukan
// dibaca mentah — id_user di tabel `user` tersimpan terenkripsi). Dipakai
// buat dropdown pilih akun di UI "Assign Role" — jumlah staff RS biasanya
// ratusan-ribuan, aman didekripsi sekaligus (bukan tabel jutaan baris).
async function listUserAccounts() {
    const db = await DatabaseService.get()
    const { rows } = await db.query(
        `SELECT CAST(AES_DECRYPT(id_user, 'nur') AS CHAR) AS id_user FROM user ORDER BY id_user`
    )
    return rows.map(r => r.id_user).filter(Boolean)
}

// Gabungan akun asli + role yang sudah di-assign (kalau ada) — buat tabel
// utama di UI Kelola Role/User.
async function listUserRoleAssignments() {
    const [accounts, db] = await Promise.all([listUserAccounts(), DatabaseService.get()])
    const { rows: assigned } = await db.query(`
        SELECT ur.id_user, ur.role_id, r.nama AS role_nama
        FROM electron_user_roles ur
        JOIN electron_roles r ON r.id = ur.role_id
    `)
    const byIdUser = Object.fromEntries(assigned.map(a => [a.id_user, a]))
    return accounts.map(id_user => ({
        id_user,
        role_id: byIdUser[id_user]?.role_id ?? null,
        role_nama: byIdUser[id_user]?.role_nama ?? null,
    }))
}

async function assignUserRole(idUser, roleId) {
    if (!idUser?.trim()) return { success: false, message: 'Akun tidak boleh kosong' }
    const db = await DatabaseService.get()

    // Validasi akun beneran ada di tabel `user` asli — id_user tidak bisa
    // diberi FK formal (tabel `user` bermesin MyISAM), jadi dicek manual di
    // sini (lihat 004_create_electron_user_roles.js).
    const { rows: exists } = await db.query(
        `SELECT 1 FROM user WHERE id_user = AES_ENCRYPT(?, 'nur')`,
        [idUser]
    )
    if (exists.length === 0) return { success: false, message: 'Akun tidak ditemukan di tabel user Khanza' }

    await db.query(
        `INSERT INTO electron_user_roles (id_user, role_id) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)`,
        [idUser, roleId]
    )
    return { success: true }
}

async function removeUserRole(idUser) {
    const db = await DatabaseService.get()
    await db.query('DELETE FROM electron_user_roles WHERE id_user = ?', [idUser])
    return { success: true }
}

export default {
    listRoles, createRole, updateRole, deleteRole, duplicateRole,
    listPermissions, getRolePermissionIds, setRolePermissions,
    listUserAccounts, listUserRoleAssignments, assignUserRole, removeUserRole, createUserAccount,
    listOrangUntukUser,
}
