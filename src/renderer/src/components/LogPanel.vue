<script setup>
import { ref, computed, onMounted } from 'vue'
import { FileText, RefreshCcw, Trash2, ChevronDown, ChevronRight, AlertCircle, AlertTriangle } from 'lucide-vue-next'

// Log ERROR/CRASH LOKAL komputer ini (lihat LogService.js, main process) —
// BEDA dari log server terpusat (mis. Laravel storage/logs) yang bisa dilihat
// semua admin dari 1 tempat. Ini cuma buat IT cek "apa yang error di PC ini
// hari ini" — retensi SENGAJA cuma hari ini, log kemarin otomatis terhapus.
const path = ref('')
const content = ref('')
const loading = ref(true)
const clearing = ref(false)
const expanded = ref(new Set())

// Format baris mentah LogService.js: "[ISO] [LEVEL] pesan {json meta opsional}"
// — meta SELALU di posisi paling akhir baris (lihat LogService.write()), jadi
// cari " {" TERAKHIR lalu coba parse; kalau bukan JSON valid ya berarti
// memang bagian dari pesannya sendiri, bukan meta.
function parseLine(line) {
    const m = line.match(/^\[([^\]]+)\]\s\[(\w+)\]\s(.*)$/s)
    if (!m) return { raw: line }
    const [, timestamp, level, rest] = m
    const idx = rest.lastIndexOf(' {')
    let message = rest
    let meta = null
    if (idx !== -1) {
        try {
            meta = JSON.parse(rest.slice(idx + 1))
            message = rest.slice(0, idx)
        } catch { /* bukan JSON valid, biarkan jadi bagian pesan */ }
    }
    return { timestamp, level, message, meta }
}

// Terbaru di atas — lebih natural buat log (kejadian paling baru yang paling
// relevan dicek duluan), dan reset status buka/tutup detail tiap muat ulang.
const entries = computed(() =>
    content.value.split('\n').filter(l => l.trim()).map(parseLine).reverse()
)

function waktu(iso) {
    try {
        return new Date(iso).toLocaleString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        })
    } catch { return iso }
}

function toggle(i) {
    const s = new Set(expanded.value)
    s.has(i) ? s.delete(i) : s.add(i)
    expanded.value = s
}

async function muat() {
    loading.value = true
    expanded.value = new Set()
    try {
        const res = await window.api.log.getToday()
        path.value = res.path
        content.value = res.content
    } finally {
        loading.value = false
    }
}

async function hapus() {
    if (!confirm('Hapus isi log hari ini di komputer ini? Tindakan ini tidak bisa dibatalkan.')) return
    clearing.value = true
    try {
        await window.api.log.clearToday()
        await muat()
    } finally {
        clearing.value = false
    }
}

onMounted(muat)
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="flex items-start justify-between gap-4 mb-3 shrink-0">
            <div>
                <h3 class="font-semibold text-sm flex items-center gap-2">
                    <FileText class="size-4 text-primary" /> Log Error/Crash Hari Ini
                    <span v-if="entries.length" class="badge badge-neutral badge-sm">{{ entries.length }}</span>
                </h3>
                <p class="text-xs text-base-content/50 mt-1">
                    Log lokal komputer ini saja (bukan gabungan semua PC) — cuma mencatat
                    error/crash aplikasi, bukan seluruh aktivitas. Otomatis terhapus tiap ganti
                    hari, cuma menyimpan hari ini.
                </p>
                <p v-if="path" class="text-[11px] font-mono text-base-content/40 mt-1 break-all">{{ path }}</p>
            </div>
            <div class="flex gap-2 shrink-0">
                <button class="btn btn-sm gap-2" :disabled="loading" @click="muat">
                    <span v-if="loading" class="loading loading-spinner loading-xs"></span>
                    <RefreshCcw v-else class="size-3.5" /> Muat Ulang
                </button>
                <button class="btn btn-sm btn-ghost text-error gap-2" :disabled="clearing || !content" @click="hapus">
                    <span v-if="clearing" class="loading loading-spinner loading-xs"></span>
                    <Trash2 v-else class="size-3.5" /> Hapus
                </button>
            </div>
        </div>

        <div class="flex-1 min-h-0 overflow-auto space-y-2">
            <p v-if="loading" class="text-sm text-base-content/50">Memuat...</p>
            <p v-else-if="entries.length === 0" class="text-sm text-base-content/50">
                Belum ada error yang tercatat hari ini.
            </p>

            <div v-else v-for="(e, i) in entries" :key="i"
                class="bg-base-100 rounded-xl border border-base-200 overflow-hidden">
                <button class="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-base-200/50"
                    @click="toggle(i)">
                    <component :is="e.level === 'WARN' ? AlertTriangle : AlertCircle"
                        :class="['size-4 shrink-0', e.level === 'WARN' ? 'text-warning' : 'text-error']" />
                    <span :class="['badge badge-sm shrink-0', e.level === 'WARN' ? 'badge-warning' : 'badge-error']">
                        {{ e.level || '?' }}
                    </span>
                    <span class="text-xs text-base-content/40 font-mono shrink-0 tabular-nums">{{ waktu(e.timestamp) }}</span>
                    <span class="text-sm truncate flex-1">{{ e.message || e.raw }}</span>
                    <component :is="expanded.has(i) ? ChevronDown : ChevronRight" class="size-4 shrink-0 text-base-content/40" />
                </button>
                <div v-if="expanded.has(i) && e.meta" class="px-3 pb-3 border-t border-base-200 pt-2">
                    <p v-if="e.meta.message" class="text-xs font-mono text-error mb-1">{{ e.meta.message }}</p>
                    <pre v-if="e.meta.stack" class="text-[11px] font-mono text-base-content/50 whitespace-pre-wrap break-all">{{ e.meta.stack }}</pre>
                    <pre v-if="!e.meta.message && !e.meta.stack" class="text-[11px] font-mono text-base-content/50 whitespace-pre-wrap break-all">{{ JSON.stringify(e.meta, null, 2) }}</pre>
                </div>
            </div>
        </div>
    </div>
</template>
