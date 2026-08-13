// 3 slug BARU non-Khanza (sama pola dgn EXTRA_SLUGS di migration 006) —
// dulu SATU permission 'pengaturan-user' salah kaprah dipakai buat "boleh
// buka halaman Pengaturan" secara keseluruhan, padahal halamannya sudah jadi
// hub 4 tab (User/Database/Environment/Informasi) yang isinya beda-beda
// sensitivitasnya (Database = migrasi skema, Environment = kredensial
// MySQL/MinIO). Sekarang tiap TOP-LEVEL TAB py permission SENDIRI (lihat
// Pengaturan.vue > PENGATURAN_TABS), supaya role yang cuma dikasih akses
// 'pengaturan-user' TIDAK otomatis ikut lihat tab Database/Environment.
// 'pengaturan-user' sendiri (migration 006) TETAP DIPERTAHANKAN apa adanya,
// migration yang sudah applied tidak boleh diubah.
export const EXTRA_SLUGS_PENGATURAN_TABS = ['pengaturan-database', 'pengaturan-environment', 'pengaturan-informasi', 'pengaturan-aplikasi']

export default {
    name: '007_seed_electron_permissions_pengaturan_tabs',
    async up(client) {
        const values = EXTRA_SLUGS_PENGATURAN_TABS.map(() => '(?, ?)').join(', ')
        const params = EXTRA_SLUGS_PENGATURAN_TABS.flatMap(slug => [slug, slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())])
        await client.query(
            `INSERT IGNORE INTO electron_permissions (slug, label) VALUES ${values}`,
            params
        )

        await client.query(`
            INSERT IGNORE INTO electron_role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM electron_roles r CROSS JOIN electron_permissions p
            WHERE r.nama = 'Administrator' AND p.slug IN (?)
        `, [EXTRA_SLUGS_PENGATURAN_TABS])
    },
}
