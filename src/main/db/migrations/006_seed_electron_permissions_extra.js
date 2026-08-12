// 'dashboard' & 'pengaturan-user' BUKAN nama kolom dari sik.sql (lihat catatan
// TODO-permission di menu.js) — dua ini konsep baru khusus Electron:
//   - 'dashboard': Khanza asli tidak punya landing page ringkasan sama sekali.
//   - 'pengaturan-user': di Khanza asli, kelola user cuma bisa Admin Utama
//     (login lewat tabel `admin` terpisah, dicek via jumlah baris cocok saat
//     login — lihat AuthService.js). Sekarang (pivot MySQL) itu direplikasi
//     BENERAN: login `admin` → role hardcode "Admin Utama", bypass slug
//     permission manapun. Slug 'pengaturan-user' di sini tetap dipertahankan
//     buat akun `user` biasa yang di-assign role dengan akses kelola-role
//     (lihat Khanza.md section 28 & README.md > "Login & Permission").
// Tanpa migration ini, DUA slug ini tidak pernah ada baris di tabel
// `electron_permissions`, sehingga role manapun (termasuk 'Administrator')
// tidak akan lolos pengecekan authStore.can('dashboard') /
// can('pengaturan-user') — menu Dashboard & Manajemen User akan hilang dari
// sidebar meski role-nya sudah diberi akses penuh.
// Diekspor (bukan cuma const lokal) — dipakai lagi oleh
// SchemaCompareService.getOrphanPermissions() supaya dua slug non-Khanza ini
// tidak salah dilaporkan sebagai "permission tidak punya kolom `user`" (satu
// sumber kebenaran, bukan daftar duplikat yang bisa drift)
export const EXTRA_SLUGS = ['dashboard', 'pengaturan-user']

export default {
    name: '006_seed_electron_permissions_extra',
    async up(client) {
        const values = EXTRA_SLUGS.map(() => '(?, ?)').join(', ')
        const params = EXTRA_SLUGS.flatMap(slug => [slug, slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())])
        await client.query(
            `INSERT IGNORE INTO electron_permissions (slug, label) VALUES ${values}`,
            params
        )

        await client.query(`
            INSERT IGNORE INTO electron_role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM electron_roles r CROSS JOIN electron_permissions p
            WHERE r.nama = 'Administrator' AND p.slug IN (?)
        `, [EXTRA_SLUGS])
    },
}
