// Porting langsung dari pos-desktop (src/main/electron/DeviceService.js) — device ID
// unik per komputer, dipakai untuk aktivasi lisensi (lihat LisensiService.js).
import { networkInterfaces, hostname, type, release } from 'os'
import { createHash } from 'crypto'
import machineId from 'node-machine-id'
import ConfigService from './ConfigService'

function generateFromMac() {
    const interfaces = networkInterfaces()
    let mac = ''

    for (const iface of Object.values(interfaces)) {
        for (const addr of iface) {
            if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
                mac = addr.mac
                break
            }
        }
        if (mac) break
    }

    return createHash('sha256').update(`${mac}-${hostname()}`).digest('hex')
}

function generate() {
    try {
        const id = machineId.machineIdSync(true)
        if (id) return id
    } catch {
        // machine-id OS tidak tersedia → fallback ke MAC + hostname
    }
    return generateFromMac()
}

function getId() {
    const stored = ConfigService.get('device_id')
    if (stored) return stored

    const id = generate()
    ConfigService.set('device_id', id)
    return id
}

function getInfo() {
    const host = hostname()
    return {
        nama_device: ConfigService.get('device_name') || host,
        hostname:    host,
        os:          `${type()} ${release()}`,
    }
}

export default { getId, getInfo }
