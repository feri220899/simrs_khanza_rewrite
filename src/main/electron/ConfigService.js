// Porting langsung dari pos-desktop (src/main/electron/ConfigService.js) — tidak ada
// perubahan logic, cuma dipindah ke project ini. Simpan config lokal per-komputer
// (device_id, token lisensi, dsb) di file JSON di folder data user OS.
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'

const configPath = join(app.getPath('userData'), 'config.json')

function load() {
    try { return JSON.parse(readFileSync(configPath, 'utf8')) }
    catch { return {} }
}

function save(data) {
    writeFileSync(configPath, JSON.stringify(data, null, 2))
}

export default {
    get: (key)        => load()[key] ?? null,
    set: (key, value) => { const d = load(); d[key] = value; save(d) },
}
