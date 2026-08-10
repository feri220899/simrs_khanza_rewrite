// Auth Electron baru — TERPISAH dari tabel `user`/`petugas` milik app Java
// (MySQL). Keputusan Postgres-untuk-semua-modul (lihat Khanza.md) berarti tidak
// ada cara native buat share tabel user real-time dgn app Java lama; kalau nanti
// dibutuhkan SSO/sinkron akun, itu didesain sebagai job ETL terpisah, BUKAN baca
// langsung ke MySQL dari sini.
export default {
    name: '001_create_roles',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id         SERIAL PRIMARY KEY,
                nama       VARCHAR(100) NOT NULL UNIQUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `)
    },
}
