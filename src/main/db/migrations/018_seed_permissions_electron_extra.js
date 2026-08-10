// 'dashboard' & 'pengaturan-user' BUKAN nama kolom dari sik.sql (lihat catatan
// TODO-permission di menu.js) — dua ini konsep baru khusus Electron:
//   - 'dashboard': Khanza asli tidak punya landing page ringkasan sama sekali.
//   - 'pengaturan-user': di Khanza asli, kelola user cuma bisa Admin Utama
//     (dicek via akses.getjml1()>=1 saat login, BUKAN lewat flag permission).
//     Ditaruh sebagai permission biasa di sini demi kesederhanaan MVP —
//     pertimbangkan ganti ke role-check khusus ("role === 'Administrator'")
//     kalau modul user management digarap serius, lihat Khanza.md section 28.
// Tanpa migration ini, DUA slug ini tidak pernah ada baris di tabel
// `permissions`, sehingga BAHKAN ADMIN tidak akan lolos pengecekan
// authStore.can('dashboard') / can('pengaturan-user') — menu Dashboard &
// Manajemen User akan hilang dari sidebar meski sudah login sebagai admin.
const EXTRA_SLUGS = ['dashboard', 'pengaturan-user']

export default {
    name: '018_seed_permissions_electron_extra',
    async up(client) {
        const values = EXTRA_SLUGS.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')
        const params = EXTRA_SLUGS.flatMap(slug => [slug, slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())])
        await client.query(
            `INSERT INTO permissions (slug, label) VALUES ${values} ON CONFLICT (slug) DO NOTHING`,
            params
        )

        await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
            WHERE r.nama = 'Administrator' AND p.slug = ANY($1)
            ON CONFLICT DO NOTHING
        `, [EXTRA_SLUGS])
    },
}
