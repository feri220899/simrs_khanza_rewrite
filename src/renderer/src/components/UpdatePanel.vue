<script setup>
import { ref, onMounted } from 'vue'
import { Info, RefreshCcw, Check, X } from 'lucide-vue-next'
import { useToast } from '../composables/useToast.js'

// Cek pembaruan MANUAL (tombol ini) — pemicu otomatis saat app start ada di
// UpdaterService.init() (main process), cuma CEK & KASIH TAHU (lewat notif
// mengambang AppUpdater.vue di pojok kanan-bawah), TIDAK auto-download/
// install. Sumber rilis: GitHub Releases repo ini sendiri (lihat `publish`
// di package.json + .github/workflows/rilis.yml).
const { showToast } = useToast()

const appVersion = ref('')
const checking = ref(false)
const result = ref(null) // { ok, available?, version?, current?, reason?, error? }

onMounted(async () => {
    appVersion.value = await window.api.app.getVersion()
})

async function cekUpdate() {
    checking.value = true
    result.value = null
    try {
        result.value = await window.api.updater.check()
        if (result.value?.available) {
            showToast(`Versi baru (v${result.value.version}) tersedia — lihat kotak pembaruan di pojok kanan bawah`)
        }
    } finally {
        checking.value = false
    }
}
</script>

<template>
    <div class="max-w-xl">
        <div class="bg-base-100 rounded-2xl border border-base-200 p-4">
            <h3 class="font-semibold text-sm flex items-center gap-2 mb-1">
                <Info class="size-4 text-primary" /> Khanza Desktop
            </h3>
            <p class="text-xs text-base-content/50 mb-3">
                Versi yang terpasang di komputer ini saat ini.
            </p>

            <p class="text-2xl font-bold tabular-nums mb-3">v{{ appVersion || '...' }}</p>

            <button class="btn btn-sm gap-2" :disabled="checking" @click="cekUpdate">
                <span v-if="checking" class="loading loading-spinner loading-xs"></span>
                <RefreshCcw v-else class="size-3.5" /> Cek Pembaruan
            </button>

            <div v-if="result" class="mt-3 text-sm">
                <div v-if="!result.ok" class="text-warning">
                    <span class="flex items-center gap-1">
                        <X class="size-3.5" />
                        {{ result.reason === 'dev' ? 'Cek pembaruan cuma tersedia di aplikasi yang sudah di-install' : 'Gagal memeriksa pembaruan' }}
                    </span>
                    <!-- Pesan asli dari electron-updater — WAJIB ditampilkan, jangan cuma
                         "gagal" generik, biar penyebabnya (draft release/repo private/
                         tidak ada internet) langsung ketahuan tanpa nebak. -->
                    <p v-if="result.error" class="text-xs font-mono text-base-content/50 mt-1 break-all">{{ result.error }}</p>
                </div>
                <span v-else-if="result.available" class="text-success flex items-center gap-1">
                    <Check class="size-3.5" /> Versi baru v{{ result.version }} tersedia — lihat kotak pembaruan di pojok kanan bawah
                </span>
                <span v-else class="text-base-content/60 flex items-center gap-1">
                    <Check class="size-3.5" /> Sudah pakai versi terbaru
                </span>
            </div>

            <p class="text-[11px] text-base-content/40 mt-3">
                Unduh &amp; pasang pembaruan selalu manual (tombol di kotak notifikasi) — tidak ada yang
                terpasang otomatis diam-diam saat aplikasi masih dipakai.
            </p>
        </div>
    </div>
</template>
