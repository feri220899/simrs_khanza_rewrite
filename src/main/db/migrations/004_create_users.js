export default {
    name: '004_create_users',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id                   SERIAL PRIMARY KEY,
                username             VARCHAR(100) NOT NULL UNIQUE,
                password             TEXT NOT NULL,
                role_id              INTEGER NOT NULL REFERENCES roles(id),
                active               BOOLEAN NOT NULL DEFAULT true,
                must_change_password BOOLEAN NOT NULL DEFAULT false,
                created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `)
    },
}
