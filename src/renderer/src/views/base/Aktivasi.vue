<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const licenseKey = ref('')
const deviceId = ref('')
const loading = ref(false)
const error = ref('')

onMounted(async () => {
    deviceId.value = await window.api.device.getId()

    // BYPASS SEMENTARA — cuma aktif di `npm run dev` (import.meta.env.DEV),
    // TIDAK PERNAH aktif di build production. Server lisensi Khanza asli
    // belum ada (LisensiService.js masih placeholder), jadi tanpa ini
    // aktivasi asli akan selalu gagal dan tidak bisa lanjut testing modul
    // lain sama sekali. HAPUS blok ini begitu server lisensi sungguhan siap
    // — lihat Khanza.md > "Aktivasi Lisensi".
    if (import.meta.env.DEV) {
        await window.api.config.set('lisensi_token', 'DEV_BYPASS')
        return router.push('/login')
    }

    // Kalau sudah ada token lisensi tersimpan & masih valid, langsung lewati
    // layar ini (lihat Khanza.md > "Aktivasi Lisensi").
    const savedToken = await window.api.config.get('lisensi_token')
    if (savedToken) {
        const check = await window.api.lisensi.verifyToken(savedToken)
        if (check.valid) return router.push('/login')
    }
})

async function aktivasi() {
    error.value = ''
    loading.value = true
    try {
        const res = await window.api.lisensi.aktivasi(licenseKey.value)
        if (!res?.token) {
            error.value = res?.message || 'Aktivasi gagal — periksa license key.'
            return
        }
        await window.api.config.set('lisensi_token', res.token)
        await window.api.config.set('license_key', licenseKey.value)
        router.push('/login')
    } catch (err) {
        error.value = 'Tidak bisa menghubungi server lisensi.'
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div class="h-screen flex items-center justify-center bg-base-200">
        <div class="card w-96 bg-base-100 shadow-xl">
            <div class="card-body">
                <h2 class="card-title">Aktivasi Lisensi</h2>
                <p class="text-sm text-base-content/60">Khanza Desktop perlu diaktivasi sebelum bisa dipakai.</p>

                <label class="label text-xs">License Key</label>
                <input v-model="licenseKey" type="text" class="input input-bordered w-full" placeholder="XXXX-XXXX-XXXX" />

                <label class="label text-xs">Device ID (otomatis)</label>
                <input :value="deviceId" type="text" readonly class="input input-bordered w-full text-xs opacity-60" />

                <p v-if="error" class="text-error text-sm mt-2">{{ error }}</p>

                <button class="btn btn-primary mt-4" :disabled="loading || !licenseKey" @click="aktivasi">
                    {{ loading ? 'Memproses...' : 'Aktivasi' }}
                </button>
            </div>
        </div>
    </div>
</template>
