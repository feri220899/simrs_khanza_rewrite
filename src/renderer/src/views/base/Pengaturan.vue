<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const status = ref(null) // { applied, pending, upToDate }
const loading = ref(true)
const running = ref(false)
const result = ref(null) // { success, message?, ranCount?, names? }
const showConfirm = ref(false)

const isAdmin = authStore.user?.role === 'Administrator'

async function loadStatus() {
    loading.value = true
    status.value = await window.api.db.migrationStatus()
    loading.value = false
}

async function runMigrations() {
    showConfirm.value = false
    running.value = true
    result.value = null
    try {
        result.value = await window.api.db.runMigrations(authStore.token)
    } finally {
        running.value = false
        await loadStatus()
    }
}

onMounted(loadStatus)
</script>

<template>
    <div>
        <h1 class="text-xl font-bold mb-1">Pengaturan</h1>
        <p class="text-sm text-base-content/60 mb-6">
            Manajemen user, konfigurasi aplikasi, audit login — TODO, ikuti SOP di Khanza.md (section 28, Setting/Keamanan).
        </p>

        <div class="card bg-base-100 border border-base-300 max-w-2xl">
            <div class="card-body">
                <h2 class="card-title text-base">Migrasi Database</h2>
                <p class="text-xs text-base-content/50 mb-2">
                    Migrasi skema TIDAK jalan otomatis saat app dibuka — app ini di-install di banyak
                    komputer RS sekaligus, jadi migrasi cuma boleh dipicu manual sekali oleh Administrator
                    di sini (atau lewat <code>npm run migrate</code> dari CLI untuk cek ke staging dulu).
                </p>

                <p v-if="loading" class="text-sm text-base-content/50">Memeriksa status...</p>

                <template v-else-if="status">
                    <div v-if="status.upToDate" class="alert alert-success text-sm py-2">
                        Sudah up to date — semua {{ status.applied.length }} migrasi sudah diterapkan.
                    </div>
                    <div v-else class="alert alert-warning text-sm py-2 flex-col items-start gap-1">
                        <p class="font-medium">{{ status.pending.length }} migrasi tertunda:</p>
                        <ul class="list-disc list-inside text-xs opacity-80">
                            <li v-for="name in status.pending" :key="name">{{ name }}</li>
                        </ul>
                    </div>

                    <div class="mt-3">
                        <button v-if="isAdmin && !status.upToDate" class="btn btn-warning btn-sm"
                            :disabled="running" @click="showConfirm = true">
                            {{ running ? 'Menjalankan...' : 'Jalankan Migration Sekarang' }}
                        </button>
                        <p v-else-if="!isAdmin && !status.upToDate" class="text-xs text-error">
                            Cuma Administrator yang bisa menjalankan migration. Hubungi admin RS.
                        </p>
                    </div>

                    <div v-if="result" class="mt-3 alert text-sm py-2"
                        :class="result.success ? 'alert-success' : 'alert-error'">
                        <span v-if="result.success && result.ranCount > 0">
                            Berhasil: {{ result.ranCount }} migrasi dijalankan ({{ result.names.join(', ') }}).
                        </span>
                        <span v-else-if="result.success">Tidak ada yang perlu dijalankan.</span>
                        <span v-else>Gagal: {{ result.message }}</span>
                    </div>
                </template>
            </div>
        </div>

        <!-- Konfirmasi sebelum eksekusi — migrasi mengubah skema, jangan sampai kepencet tidak sengaja -->
        <div v-if="showConfirm" class="modal modal-open">
            <div class="modal-box">
                <h3 class="font-bold text-lg">Jalankan migration?</h3>
                <p class="py-2 text-sm">
                    Ini akan mengubah skema database yang dipakai BERSAMA oleh semua komputer di RS.
                    Pastikan tidak ada komputer lain yang sedang aktif dipakai transaksi penting saat ini.
                </p>
                <div class="modal-action">
                    <button class="btn btn-ghost btn-sm" @click="showConfirm = false">Batal</button>
                    <button class="btn btn-warning btn-sm" @click="runMigrations">Ya, Jalankan</button>
                </div>
            </div>
        </div>
    </div>
</template>
