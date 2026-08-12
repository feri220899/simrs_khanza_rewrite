<script setup>
import { ref, computed } from 'vue'
import { Users, DatabaseZap, Server } from 'lucide-vue-next'
import ManajemenUser from './ManajemenUser.vue'
import MigrationPanel from '../../components/MigrationPanel.vue'
import SchemaComparePanel from '../../components/SchemaComparePanel.vue'
import EnvironmentPanel from '../../components/EnvironmentPanel.vue'

// Hub Pengaturan — tab BERJENJANG (top-level -> children), disengaja
// terstruktur sebagai array supaya penambahan section baru ke depan (bakal
// banyak: Konfigurasi Aplikasi, Audit Login, dst — lihat config/menu.js
// bottomMenu) tinggal nambah entry di sini, bukan restructure ulang
// template. Tiap top-level minimal 1 child; child nampilin 1 komponen.
const PENGATURAN_TABS = [
    {
        key: 'user', label: 'User', icon: Users,
        children: [
            { key: 'pengaturan-user', label: 'Pengaturan User', component: ManajemenUser },
        ],
    },
    {
        key: 'database', label: 'Database', icon: DatabaseZap,
        children: [
            { key: 'migrasi', label: 'Migrasi', component: MigrationPanel },
            { key: 'pembanding-skema', label: 'Pembanding Skema', component: SchemaComparePanel },
        ],
    },
    {
        // Config service pihak ke-3/infra OPSIONAL (MinIO sekarang, nanti bisa
        // nambah Redis dst) — dipisah dari tab "Database" karena beda sifat:
        // ini bukan urusan skema/migrasi `sik`, dan sengaja TIDAK wajib diisi
        // di "Pengaturan Awal" (beda dari MySQL) supaya RS yang belum siapkan
        // MinIO tetap bisa lanjut pakai app, diisi belakangan di sini.
        key: 'environment', label: 'Environment', icon: Server,
        children: [
            { key: 'environment', label: 'Environment', component: EnvironmentPanel },
        ],
    },
]

const activeTop = ref(PENGATURAN_TABS[0].key)
const activeChildByTop = ref(Object.fromEntries(PENGATURAN_TABS.map(t => [t.key, t.children[0].key])))
const manajemenUserRef = ref(null)

const currentTop = computed(() => PENGATURAN_TABS.find(t => t.key === activeTop.value))
const currentChild = computed(() => currentTop.value.children.find(c => c.key === activeChildByTop.value[activeTop.value]))

function pilihTop(key) {
    activeTop.value = key
}

function pilihChild(key) {
    activeChildByTop.value[activeTop.value] = key
}

// Kalau migration baru saja dijalankan dari tab Database > Migrasi, tab
// User > Pengaturan User (kalau tadinya gagal fetch krn tabel belum ada)
// perlu dicoba muat ulang — tanpa ini admin harus pindah tab manual/reload.
function onMigrated() {
    manajemenUserRef.value?.fetchSemua?.()
}
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <h1 class="text-xl font-bold mb-1">Pengaturan</h1>
        <p class="text-sm text-base-content/60 mb-4">
            Konfigurasi aplikasi, audit login, dst — TODO, ikuti SOP di Khanza.md (section 28, Setting/Keamanan).
        </p>

        <!-- Top-level tab -->
        <div class="flex gap-1 border-b border-base-300 mb-3 shrink-0">
            <button v-for="t in PENGATURAN_TABS" :key="t.key"
                :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors',
                    activeTop === t.key ? 'border-primary text-primary' : 'border-transparent text-base-content/50 hover:text-base-content']"
                @click="pilihTop(t.key)">
                <component :is="t.icon" class="size-4" /> {{ t.label }}
            </button>
        </div>

        <!-- Child tab (disembunyikan kalau cuma 1 anak, biar tidak berisik) -->
        <div v-if="currentTop.children.length > 1" class="flex bg-base-200 rounded-lg p-1 w-fit mb-4 shrink-0 gap-0.5">
            <button v-for="c in currentTop.children" :key="c.key"
                :class="['px-4 py-1.5 rounded text-xs font-medium transition-colors',
                    activeChildByTop[activeTop] === c.key ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="pilihChild(c.key)">
                {{ c.label }}
            </button>
        </div>

        <div class="flex-1 min-h-0 flex flex-col overflow-y-auto">
            <!-- :is dari config PENGATURAN_TABS — nambah child baru ke depan
                 (banyak, lihat komentar di atas) cukup nambah entry di array,
                 TIDAK perlu sentuh template ini lagi. -->
            <component :is="currentChild.component" ref="manajemenUserRef" @migrated="onMigrated" />
        </div>
    </div>
</template>
