// Menggantikan peran AuthController.js + User model milik referensi
// (Express + better-sqlite3) — logic login/ganti-password sama persis, tapi
// query langsung ke Postgres lewat pool dari DatabaseService, dipanggil dari
// IPC handler di main/index.js (bukan route Express).
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import DatabaseService from './DatabaseService.js'

const JWT_SECRET = process.env.JWT_SECRET || 'ubah-di-.env'

async function login(username, password) {
    const db = await DatabaseService.get()

    const { rows: [user] } = await db.query(
        `SELECT u.id, u.username, u.password, u.active, u.must_change_password,
                r.nama AS role_name,
                COALESCE(array_agg(p.slug) FILTER (WHERE p.slug IS NOT NULL), '{}') AS permissions
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN role_permissions rp ON rp.role_id = r.id
         LEFT JOIN permissions p ON p.id = rp.permission_id
         WHERE u.username = $1
         GROUP BY u.id, r.nama`,
        [username]
    )

    if (!user || !user.active) return { success: false, message: 'Username atau password salah' }
    if (!bcrypt.compareSync(password, user.password)) return { success: false, message: 'Username atau password salah' }

    const payload = {
        id: user.id,
        username: user.username,
        role: user.role_name,
        permissions: user.permissions,
    }

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' })

    return { success: true, token, user: payload, must_change_password: !!user.must_change_password }
}

function verifySession(token) {
    try {
        return { success: true, user: jwt.verify(token, JWT_SECRET) }
    } catch {
        return { success: false }
    }
}

async function changePassword(token, currentPassword, newPassword) {
    const session = verifySession(token)
    if (!session.success) return { success: false, message: 'Sesi tidak valid, silakan login ulang' }

    if (newPassword.length < 6) return { success: false, message: 'Password baru minimal 6 karakter' }

    const db = await DatabaseService.get()
    const { rows: [user] } = await db.query('SELECT password FROM users WHERE id = $1', [session.user.id])

    if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
        return { success: false, message: 'Password lama salah' }
    }
    if (bcrypt.compareSync(newPassword, user.password)) {
        return { success: false, message: 'Password baru tidak boleh sama dengan password lama' }
    }

    const hash = bcrypt.hashSync(newPassword, 10)
    await db.query(
        'UPDATE users SET password = $1, must_change_password = false, updated_at = now() WHERE id = $2',
        [hash, session.user.id]
    )

    return { success: true }
}

export default { login, verifySession, changePassword }
