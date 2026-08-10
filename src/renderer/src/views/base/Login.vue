<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

// Cek dulu apakah database sudah pernah di-migration SEBELUM nampilin form
// login. Kalau belum (fresh install, tabel users/roles belum ada), tidak ada
// gunanya nampilin form — tidak akan pernah ada yang bisa login. Panel di
// bawah kasih tombol setup langsung (lewat db:runInitialMigration, yang
// server-side cuma boleh jalan kalau database benar-benar virgin — lihat
// main/index.js) supaya tidak wajib buka terminal, tapi tetap kasih opsi
// CLI (`npm run migrate`) buat yang lebih nyaman lewat situ / automasi.
const checkingSetup = ref(true)
const notMigrated = ref(false)
const setupRunning = ref(false)
const setupResult = ref(null) // { success, message? }

async function checkSetupStatus() {
    checkingSetup.value = true
    try {
        const status = await window.api.db.migrationStatus()
        notMigrated.value = status.pending.includes('004_create_users')
    } catch {
        // migrationStatus sendiri gagal (mis. tidak bisa konek DB sama sekali)
        // — biarkan lanjut ke form biasa, errornya akan muncul natural saat submit.
    } finally {
        checkingSetup.value = false
    }
}

async function runInitialSetup() {
    setupRunning.value = true
    setupResult.value = null
    try {
        setupResult.value = await window.api.db.runInitialMigration()
        if (setupResult.value.success) {
            await checkSetupStatus() // sukses -> notMigrated jadi false, form login muncul
        }
    } finally {
        setupRunning.value = false
    }
}

onMounted(checkSetupStatus)

async function login() {
    error.value = ''
    loading.value = true
    try {
        const res = await authStore.login(username.value, password.value)
        if (!res.success) {
            error.value = res.message
            return
        }
        router.push('/dashboard')
    } catch {
        error.value = 'Tidak bisa menghubungi database. Coba lagi atau hubungi administrator.'
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div class="h-screen flex items-center justify-center bg-base-200">
        <p v-if="checkingSetup" class="text-sm text-base-content/50">Memeriksa status sistem...</p>

        <!-- Database belum pernah di-migration — tidak ada gunanya nampilin form login -->
        <div v-else-if="notMigrated" class="card w-[26rem] bg-base-100 shadow-xl">
            <div class="card-body">
                <h2 class="card-title text-warning">Database Belum Disiapkan</h2>
                <p class="text-sm text-base-content/70">
                    Ini instalasi pertama — belum ada akun yang bisa dipakai login. Klik tombol di
                    bawah untuk setup awal (bikin skema database + akun admin default).
                </p>

                <button class="btn btn-warning btn-sm mt-3" :disabled="setupRunning" @click="runInitialSetup">
                    {{ setupRunning ? 'Menyiapkan...' : 'Siapkan Database Sekarang' }}
                </button>

                <div v-if="setupResult" class="alert text-sm py-2 mt-2"
                    :class="setupResult.success ? 'alert-success' : 'alert-error'">
                    <span v-if="setupResult.success">
                        Berhasil! {{ setupResult.ranCount }} langkah setup selesai. Silakan login dengan akun default.
                    </span>
                    <span v-else>{{ setupResult.message }}</span>
                </div>

                <div class="collapse collapse-arrow bg-base-200 mt-3">
                    <input type="checkbox" />
                    <div class="collapse-title text-xs font-medium text-base-content/60 min-h-0 py-2">
                        Atau lewat terminal (buat IT/automasi)
                    </div>
                    <div class="collapse-content">
                        <code class="text-xs bg-base-300 rounded px-2 py-1.5 block">npm run migrate</code>
                        <p class="text-xs text-base-content/40 mt-2">
                            Jalankan dari terminal di komputer ini, lalu klik "Coba Lagi" di bawah.
                        </p>
                        <button class="btn btn-ghost btn-xs mt-2" @click="checkSetupStatus">Coba Lagi</button>
                    </div>
                </div>
            </div>
        </div>

        <form v-else class="card w-96 bg-base-100 shadow-xl" @submit.prevent="login">
            <div class="card-body">
                <h2 class="card-title">Khanza Desktop</h2>

                <label class="label text-xs">Username</label>
                <input v-model="username" type="text" class="input input-bordered w-full" autofocus />

                <label class="label text-xs">Password</label>
                <input v-model="password" type="password" class="input input-bordered w-full" />

                <p v-if="error" class="text-error text-sm mt-2">{{ error }}</p>

                <button type="submit" class="btn btn-primary mt-4" :disabled="loading">
                    {{ loading ? 'Masuk...' : 'Masuk' }}
                </button>

                <p class="text-xs text-base-content/50 mt-2">
                    Default: admin / admin123 (wajib ganti password setelah login pertama)
                </p>
            </div>
        </form>
    </div>
</template>
