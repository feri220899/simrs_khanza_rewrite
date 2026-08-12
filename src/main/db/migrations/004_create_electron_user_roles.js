// Pengganti `electron_users` (yang TIDAK dibuat, lihat README.md > "Login &
// Permission (pivot MySQL)") — tabel penghubung id_user (akun ASLI di tabel
// `user` milik Khanza) ke role Electron. Login tetap ke tabel `admin`/`user`
// asli; tabel ini cuma jawab "user ini dapat role apa".
//
// `id_user` SENGAJA tanpa FOREIGN KEY ke `user.id_user` — tabel `user` asli
// bermesin MyISAM (lihat CREATE TABLE `user` di sik.sql), MyISAM TIDAK
// MENDUKUNG FOREIGN KEY sama sekali. Validitas id_user (harus benar-benar ada
// row-nya di tabel `user`) dicek di level aplikasi (RoleService), bukan
// constraint DB. Charset/collation kolom ini SENGAJA disamakan persis dengan
// `user.id_user` (latin1_swedish_ci) supaya perbandingan/JOIN antar tabel
// tidak kena error "Illegal mix of collations".
export default {
    name: '004_create_electron_user_roles',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS electron_user_roles (
                id_user    VARCHAR(700) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL PRIMARY KEY,
                role_id    INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (role_id) REFERENCES electron_roles(id)
            ) ENGINE=InnoDB
        `)
    },
}
