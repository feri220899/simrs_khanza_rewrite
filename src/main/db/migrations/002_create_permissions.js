// Struktur tabel: normalized (permissions terpisah + role_permissions pivot),
// LEBIH BAIK dari Khanza asli yang taruh 1211 kolom boolean langsung di tabel
// `user` (lihat sik.sql baris 42130+, CREATE TABLE `user`). TAPI isi/slug-nya
// WAJIB sama persis dengan nama kolom asli itu (bukan bikin nama baru) —
// lihat 017_seed_permissions_khanza_asli.js yang seed 1211 nama itu apa
// adanya, dan src/main/db/reference/khanza-permissions-asli.txt sebagai
// daftar master. Ini supaya permission tetap bisa ditelusuri balik ke fitur
// aslinya, dan kalau nanti perlu migrasi data hak-akses user lama → role baru,
// pemetaannya jelas 1:1.
export default {
    name: '002_create_permissions',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS permissions (
                id         SERIAL PRIMARY KEY,
                slug       VARCHAR(100) NOT NULL UNIQUE,
                label      VARCHAR(150) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `)
    },
}
