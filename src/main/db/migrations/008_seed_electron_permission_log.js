// Slug BARU non-Khanza buat tab "Log" (lihat LogPanel.vue) — dibuat migration
// TERPISAH dari 007, bukan nambah ke array 007 langsung, karena 007 SUDAH
// PERNAH applied di instalasi lain: migration yang sudah applied harus
// dianggap final, penambahan berikutnya wajib migration baru biar konsisten
// di semua instalasi (bukan cuma yang migrate ulang dari nol).
export const EXTRA_SLUGS_LOG = ['pengaturan-log']

export default {
    name: '008_seed_electron_permission_log',
    async up(client) {
        const values = EXTRA_SLUGS_LOG.map(() => '(?, ?)').join(', ')
        const params = EXTRA_SLUGS_LOG.flatMap(slug => [slug, slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())])
        await client.query(
            `INSERT IGNORE INTO electron_permissions (slug, label) VALUES ${values}`,
            params
        )

        await client.query(`
            INSERT IGNORE INTO electron_role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM electron_roles r CROSS JOIN electron_permissions p
            WHERE r.nama = 'Administrator' AND p.slug IN (?)
        `, [EXTRA_SLUGS_LOG])
    },
}
