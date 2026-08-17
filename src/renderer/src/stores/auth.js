import { defineStore } from 'pinia'
import router from '../router'

// Pola sama seperti auth store referensi (permission berjenjang, semantik OR).
// Bedanya: login() manggil IPC (window.api.auth.login) yang query MySQL
// langsung di main process — bukan axios ke Express.

// exp JWT (detik epoch) -> ms epoch. Decode manual (base64url), tanpa lib
// tambahan, karena cuma butuh claim exp untuk auto-logout.
function getTokenExpiryMs(token) {
    if (!token) return null
    try {
        const payload = token.split('.')[1]
        const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
        return typeof json.exp === 'number' ? json.exp * 1000 : null
    } catch {
        return null
    }
}

// Timer id auto-logout — di luar state Pinia karena bukan data reaktif.
let logoutTimer = null

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('auth_token') || null,
        user: JSON.parse(localStorage.getItem('auth_user') || 'null'),
    }),
    getters: {
        isAuthenticated: (state) => {
            if (!state.token) return false
            const expMs = getTokenExpiryMs(state.token)
            if (expMs && Date.now() >= expMs) return false
            return true
        },
        permissions: (state) => state.user?.permissions || [],
        // 'Admin Utama' (tabel `admin`) & 'Administrator' (electron_roles)
        // sama-sama akses penuh (lihat AuthService.isFullAdmin di main
        // process). PENTING: kalau migration electron_* belum pernah jalan
        // (instalasi baru/tabel kosong), array `permissions` Admin Utama
        // BISA KOSONG (lihat AuthService.login, fallback saat electron_permissions
        // belum ada) — tanpa bypass ini, SELURUH menu termasuk Pengaturan bakal
        // hilang dari sidebar dan Admin Utama tidak bisa buka halaman migrasi
        // sama sekali (deadlock). Jangan hapus bypass ini.
        isFullAdmin: (state) => state.user?.role === 'Admin Utama' || state.user?.role === 'Administrator',
    },
    actions: {
        can(permission) {
            if (this.isFullAdmin) return true
            if (!permission) return false
            const list = Array.isArray(permission) ? permission : [permission]
            return list.some(p => this.permissions.includes(p))
        },
        async login(username, password) {
            const res = await window.api.auth.login(username, password)
            if (!res.success) return res

            this.token = res.token
            this.user = res.user
            localStorage.setItem('auth_token', res.token)
            localStorage.setItem('auth_user', JSON.stringify(res.user))
            this.scheduleAutoLogout()

            return res
        },
        logout() {
            clearTimeout(logoutTimer)
            logoutTimer = null
            this.token = null
            this.user = null
            localStorage.removeItem('auth_token')
            localStorage.removeItem('auth_user')
        },
        // Jadwalkan logout otomatis tepat saat JWT expired (12h, lihat
        // AuthService.js). Dipanggil setelah login() dan sekali saat app
        // dibuka (App.vue onMounted) untuk token lama dari localStorage.
        scheduleAutoLogout() {
            clearTimeout(logoutTimer)
            logoutTimer = null
            if (!this.token) return

            const expMs = getTokenExpiryMs(this.token)
            if (!expMs) return

            const msRemaining = expMs - Date.now()
            if (msRemaining <= 0) {
                this.logout()
                if (router.currentRoute.value.path !== '/login') router.push('/login')
                return
            }

            logoutTimer = setTimeout(() => {
                this.logout()
                if (router.currentRoute.value.path !== '/login') router.push('/login')
            }, msRemaining)
        },
    },
})
