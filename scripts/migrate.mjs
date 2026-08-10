// Jalankan migration TANPA buka Electron — buat testing di staging DB dulu
// sebelum nyoba di app beneran. Baca koneksi dari .env (lihat .env.example).
//
// Usage: npm run migrate
import 'dotenv/config'
import DatabaseService from '../src/main/db/DatabaseService.js'

// DatabaseService.get() SENGAJA tidak lagi menjalankan migration otomatis
// (lihat catatan di DatabaseService.js) — jadi di sini panggil runMigrations()
// eksplisit. Ini tetap satu-satunya jalur "manual" yang benar: jalankan dari
// SATU komputer/staging oleh Administrator, bukan otomatis di tiap PC.
try {
    const result = await DatabaseService.runMigrations()
    console.log(result.ranCount === 0
        ? 'Sudah up to date, tidak ada migrasi tertunda.'
        : `Migrasi selesai: ${result.ranCount} dijalankan (${result.names.join(', ')})`)
} catch (err) {
    console.error('Migrasi gagal:', err.message)
    process.exitCode = 1
} finally {
    await DatabaseService.close()
}
