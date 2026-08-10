import bcrypt from 'bcryptjs'

// Password default WAJIB diganti — must_change_password dipaksa true. Ganti
// 'admin123' ini sebelum instalasi nyata mana pun; ini cuma supaya app bisa
// login pertama kali.
export default {
    name: '005_seed_default_admin',
    async up(client) {
        const { rows: [role] } = await client.query(
            `INSERT INTO roles (nama) VALUES ('Administrator') RETURNING id`
        )

        const hash = bcrypt.hashSync('admin123', 10)

        await client.query(
            `INSERT INTO users (username, password, role_id, must_change_password)
             VALUES ($1, $2, $3, true)`,
            ['admin', hash, role.id]
        )
    },
}
