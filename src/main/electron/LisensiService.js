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
ASHMIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf9Cnzj4p4WGeKLs1Pt8Qu
KUpRKfFLfRYC9AIKjbJTWit+CqvjWYzvQwECAwEAAQJAIJLixBy2qpFoS4DSmoEm
o3qGy0t6z09AIJtH+5OeRV1be+N4cDYJKffGzDa88vQENZiRm0GRq6a+HPGQMd2k
TQIhAKMSvzIBnni7ot/OSie2TmJLY4SwTQAevXysE2RbFDYdAiEBCUEaRQnMnbp7
9mxDXDf6AU0cN/RPBjb9qSHDcWZHGzUCIG2Es59z8ugGrDY+pxLQnwfotadxd+Uy
v/Ow5T0q5gIJAiEAyS4RaI9YG8EWx/2w0T67ZUVAw8eOMB6BIUg0Xcu+3okCIBOs
/5OiPgoTdSy7bcF9IGpSE8ZgGKzgYQVZeN97YE00
-----END PUBLIC KEY-----`

const client = axios.create({
    baseURL: 'https://yolosimrs.lisensi/api',
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
