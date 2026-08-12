// Struktur tabel: normalized (permissions terpisah + role_permissions pivot),
// LEBIH BAIK dari Khanza asli yang taruh 1211 kolom boolean langsung di tabel
// `user` (lihat sik.sql, CREATE TABLE `user`). TAPI isi/slug-nya WAJIB sama
// persis dengan nama kolom asli itu (bukan bikin nama baru) — lihat
// 005_seed_electron_permissions_khanza_asli.js yang seed 1211 nama itu apa
// adanya, dan src/main/db/reference/khanza-permissions-asli.txt sebagai
// daftar master. Ini supaya permission tetap bisa ditelusuri balik ke fitur
// aslinya, dan kalau nanti perlu migrasi data hak-akses user lama → role baru,
// pemetaannya jelas 1:1.
//
// PENTING (lihat README.md > "Login & Permission"): nilai TRUE/FALSE di 1211
// kolom individual tabel `user` asli TIDAK PERNAH dibaca sebagai sumber
// otorisasi Electron — tabel ini cuma dipakai sebagai DAFTAR NAMA slug.
// Otorisasi 100% role-based lewat electron_role_permissions.
export default {
    name: '002_create_electron_permissions',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS electron_permissions (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                slug       VARCHAR(100) NOT NULL UNIQUE,
                label      VARCHAR(150) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `)
    },
}
