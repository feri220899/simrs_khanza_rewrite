import { defineStore } from 'pinia'

// Pola sama seperti auth store referensi (permission berjenjang, semantik OR).
// Bedanya: login() manggil IPC (window.api.auth.login) yang query MySQL
// langsung di main process — bukan axios ke Express.
export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('auth_token') || null,
        user: JSON.parse(localStorage.getItem('auth_user') || 'null'),
    }),
    getters: {
        isAuthenticated: (state) => !!state.token,
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

            return res
        },
        logout() {
            this.token = null
            this.user = null
            localStorage.removeItem('auth_token')
            localStorage.removeItem('auth_user')
        },
    },
})
