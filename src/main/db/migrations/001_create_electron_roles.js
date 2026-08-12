// Auth Electron — TERPISAH dari tabel `admin`/`user` milik app Java (lihat
// README.md > "Login & Permission (pivot MySQL)"). Tabel ini masuk ke
// database `sik` yang SAMA dengan app Java, prefix `electron_` biar jelas
// bukan tabel asli Khanza.
//
// Role 'Administrator' diseed langsung di sini (bukan migration terpisah)
// supaya ada 1 role siap-pakai dengan akses penuh (dapat SEMUA permission,
// lihat 005_seed_electron_permissions_khanza_asli.js) — dipakai buat staff
// yang perlu akses penuh TAPI login lewat tabel `user` biasa (beda dari
// "Admin Utama" yang login lewat tabel `admin` terpisah & hardcode akses
// penuh tanpa peduli role sama sekali).
export default {
    name: '001_create_electron_roles',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS electron_roles (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                nama       VARCHAR(100) NOT NULL UNIQUE,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `)
        await client.query(`INSERT IGNORE INTO electron_roles (nama) VALUES ('Administrator')`)
    },
}
