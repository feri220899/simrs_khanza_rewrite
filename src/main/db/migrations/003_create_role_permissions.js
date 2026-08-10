export default {
    name: '003_create_role_permissions',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
                PRIMARY KEY (role_id, permission_id)
            )
        `)
    },
}
