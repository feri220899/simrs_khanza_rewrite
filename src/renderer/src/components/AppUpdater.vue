<!-- Porting dari pos-desktop (src/renderer/src/components/AppUpdater.vue) —
     tidak ada perubahan logic/tampilan. Dipasang global di App.vue supaya
     muncul di atas halaman mana pun. -->
<template>
    <div v-if="visible" class="fixed bottom-4 right-4 z-[999] w-80 max-w-[calc(100vw-2rem)]">
        <div class="bg-base-100 border border-base-300 rounded-2xl shadow-lg p-4">

            <!-- Versi baru tersedia (belum diunduh) -->
            <template v-if="state === 'available'">
                <div class="flex items-center gap-2 mb-1">
                    <ArrowUpCircle class="size-4 text-primary shrink-0" />
                    <span class="text-sm font-semibold">Pembaruan tersedia</span>
                </div>
                <p class="text-xs text-base-content/60 mb-3">
                    Versi {{ version || 'baru' }} tersedia. Unduh sekarang?
                </p>
                <div class="flex gap-2">
                    <button class="btn btn-primary btn-sm flex-1" @click="unduh">Unduh &amp; Pasang</button>
                    <button class="btn btn-ghost btn-sm" @click="visible = false">Nanti</button>
                </div>
            </template>

            <!-- Sedang download -->
            <template v-else-if="state === 'progress'">
                <div class="flex items-center gap-2 mb-2">
                    <Download class="size-4 text-primary shrink-0" />
                    <span class="text-sm font-semibold">Mengunduh pembaruan…</span>
                </div>
                <progress class="progress progress-primary w-full" :value="percent" max="100"></progress>
                <p class="text-xs text-base-content/50 mt-1">{{ percent }}%</p>
            </template>

            <!-- Siap dipasang -->
            <template v-else-if="state === 'downloaded'">
                <div class="flex items-center gap-2 mb-1">
                    <Sparkles class="size-4 text-success shrink-0" />
                    <span class="text-sm font-semibold">Pembaruan siap</span>
                </div>
                <p class="text-xs text-base-content/60 mb-3">
                    Versi {{ version || 'baru' }} sudah diunduh. Pasang sekarang untuk memakainya.
                </p>
                <div class="flex gap-2">
                    <button class="btn btn-primary btn-sm flex-1" @click="install">Pasang &amp; Restart</button>
                    <button class="btn btn-ghost btn-sm" @click="visible = false">Nanti</button>
                </div>
                <p class="text-[11px] text-base-content/40 mt-2">Jika ditunda, pembaruan terpasang otomatis saat aplikasi ditutup.</p>
            </template>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Download, Sparkles, ArrowUpCircle } from 'lucide-vue-next'

const visible = ref(false)
const state   = ref('')      // 'available' | 'progress' | 'downloaded'
const percent = ref(0)
const version = ref('')

function handle({ type, data }) {
    if (type === 'available') {
        state.value = 'available'
        version.value = data?.version ?? ''
        visible.value = true
    } else if (type === 'progress') {
        state.value = 'progress'
        percent.value = data?.percent ?? 0
        visible.value = true
    } else if (type === 'downloaded') {
        state.value = 'downloaded'
        version.value = data?.version ?? ''
        visible.value = true
    }
    // 'checking' / 'not-available' / 'error' sengaja tidak mengganggu user
}

function unduh() {
    state.value = 'progress'
    percent.value = 0
    window.api?.updater?.download()
}

function install() {
    window.api?.updater?.install()
}

onMounted(() => {
    window.api?.updater?.onEvent(handle)
})

onUnmounted(() => {
    window.api?.updater?.offEvent()
})
</script>
