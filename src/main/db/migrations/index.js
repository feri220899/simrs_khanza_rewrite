// Auth Electron (lihat Khanza.md > "Prinsip Migrasi Data" & README.md >
// "Login & Permission (pivot MySQL)"). Migration business-data lama
// (Postgres, Parkir/Toko/Perpustakaan/Surat/IPSRS) sudah DIHAPUS — tabelnya
// sudah ada 1:1 di `sik.sql`, tidak perlu dibuat ulang lewat migration ini.
import m001 from './001_create_electron_roles.js'
import m002 from './002_create_electron_permissions.js'
import m003 from './003_create_electron_role_permissions.js'
import m004 from './004_create_electron_user_roles.js'
import m005 from './005_seed_electron_permissions_khanza_asli.js'
import m006 from './006_seed_electron_permissions_extra.js'

export default [
    m001, m002, m003, m004, m005, m006,
]
