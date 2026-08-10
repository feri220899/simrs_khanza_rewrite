// Porting pola dari pos-desktop (src/main/electron/LisensiService.js), dengan 2 perbedaan:
// 1. baseURL diarahkan ke server lisensi Khanza sendiri (LISENSI_BASE_URL di .env),
//    BUKAN poswarung.my.id — itu punya pos-desktop.
// 2. PUBLIC_KEY di bawah masih PLACEHOLDER — ganti dengan public key asli begitu
//    backend lisensi Khanza sudah menerbitkan keypair RS256-nya sendiri.
//    Jangan pernah taruh PRIVATE key di sini (di kode client) — itu cuma boleh
//    ada di server lisensi.
import axios from 'axios'
import jwt from 'jsonwebtoken'
import DeviceService from './DeviceService'

const PUBLIC_KEY = process.env.LISENSI_PUBLIC_KEY || `-----BEGIN PUBLIC KEY-----
GANTI_DENGAN_PUBLIC_KEY_ASLI_DARI_SERVER_LISENSI_KHANZA
-----END PUBLIC KEY-----`

const client = axios.create({
    baseURL: process.env.LISENSI_BASE_URL || 'https://lisensi.khanza.example/api',
    timeout: 10000,
})

async function request(endpoint, body) {
    const { data } = await client.post(endpoint, body)
    return data
}

function verifyToken(token) {
    try {
        const payload  = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] })
        const daysLeft = (payload.exp * 1000 - Date.now()) / 86400000

        if (payload.device_id !== DeviceService.getId()) {
            return { valid: false, expired: false, daysLeft: 0 }
        }

        if (payload.expired_at && Date.now() / 1000 > payload.expired_at) {
            return { valid: false, expired: true, daysLeft: 0 }
        }

        return { valid: true, expired: false, daysLeft, payload }
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return { valid: false, expired: true, daysLeft: 0 }
        }
        return { valid: false, expired: false, daysLeft: 0 }
    }
}

export default {
    aktivasi:   (key, deviceId) => request('/lisensi/aktivasi',   { license_key: key, device_id: deviceId }),
    validasi:   (key, deviceId) => request('/lisensi/validasi',   { license_key: key, device_id: deviceId }),
    deaktivasi: (key, deviceId) => request('/lisensi/deaktivasi', { license_key: key, device_id: deviceId }),
    verifyToken,
}
