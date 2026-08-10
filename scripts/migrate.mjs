// Jalankan migration TANPA buka Electron — buat testing di staging DB dulu
// sebelum nyoba di app beneran. Baca koneksi dari .env (lihat .env.example).
//
// Usage: npm run migrate
import 'dotenv/config'
import DatabaseService from '../src/main/db/DatabaseService.js'

try {
    await DatabaseService.get()
    console.log('Migrasi selesai / sudah up to date.')
} catch (err) {
    console.error('Migrasi gagal:', err.message)
    process.exitCode = 1
} finally {
    await DatabaseService.close()
}
