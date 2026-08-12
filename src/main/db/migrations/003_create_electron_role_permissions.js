export default {
    name: '003_create_electron_role_permissions',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS electron_role_permissions (
                role_id       INT NOT NULL,
                permission_id INT NOT NULL,
                PRIMARY KEY (role_id, permission_id),
                FOREIGN KEY (role_id) REFERENCES electron_roles(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES electron_permissions(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `)
    },
}
