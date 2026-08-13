<script setup>
import { ref, onMounted } from 'vue'
import { UploadCloud, Check, RefreshCcw } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast.js'

// "Pembanding Skema" — upload sik.sql baru dari vendor, dibandingkan ke
// information_schema MySQL yang sedang berjalan (lihat SchemaCompareService.js
// di main process). TIDAK ADA auto-apply — tiap baris punya tombol Terapkan
// sendiri (kecuali kolom berubah tipe/tabel-kolom terhapus, itu info doang,
// terlalu berisiko buat auto-apply).
const authStore = useAuthStore()
const { showToast } = useToast()

const comparing = ref(false)
const fileName = ref('')
const diff = ref(null)
const appliedTables = ref(new Set())
const appliedColumns = ref(new Set()) // key = `${table}.${column}`
const applyingKey = ref(null)

// Cakupan permission (user.kolom vs electron_permissions) — BEDA dari diff
// skema di atas, independen dari file yang diupload (lihat
// SchemaCompareService.checkPermissionSync). Dicek otomatis saat halaman
// dibuka, dan bisa di-refresh manual. Dua arah:
//   - missing: kolom `user` yang belum punya slug (kolom baru belum di-apply,
//     ATAU slug-nya kehapus manual padahal kolomnya masih ada)
//   - orphan: slug yang ADA tapi kolom `user`-nya SUDAH TIDAK ADA (vendor
//     hapus/ganti nama kolom, atau slug typo ke-insert manual)
const missingPermissions = ref([])
const orphanPermissions = ref([])
const checkingPermissions = ref(false)
const addedPermissions = ref(new Set())
const removedOrphans = ref(new Set())

async function cekSinkronisasiPermission() {
    checkingPermissions.value = true
    try {
        const res = await window.api.schema.checkPermissionSync(authStore.token)
        missingPermissions.value = res.missing
        orphanPermissions.value = res.orphan
        addedPermissions.value = new Set()
        removedOrphans.value = new Set()
    } finally {
        checkingPermissions.value = false
    }
}

async function tambahkanPermission(slug) {
    applyingKey.value = `perm.${slug}`
    try {
        const res = await window.api.schema.applyPermission(authStore.token, slug)
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(`Permission "${slug}" berhasil ditambahkan.`)
        addedPermissions.value = new Set([...addedPermissions.value, slug])
    } finally {
        applyingKey.value = null
    }
}

async function hapusOrphanPermission(slug) {
    if (!confirm(`Hapus permission "${slug}"? Role yang sudah punya permission ini akan ikut kehilangan aksesnya.`)) return
    applyingKey.value = `orphan.${slug}`
    try {
        const res = await window.api.schema.removeOrphanPermission(authStore.token, slug)
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(`Permission "${slug}" berhasil dihapus.`)
        removedOrphans.value = new Set([...removedOrphans.value, slug])
    } finally {
        applyingKey.value = null
    }
}

onMounted(cekSinkronisasiPermission)

// TIDAK ADA backup otomatis dari app ini (keputusan sengaja, lihat
// SchemaCompareService.js) — tiap Terapkan WAJIB lewat konfirmasi eksplisit
// yang menegaskan backup manual, bukan langsung eksekusi begitu diklik.
const pendingAction = ref(null) // { label, run() }

async function pilihDanBandingkan() {
    comparing.value = true
    diff.value = null
    try {
        const res = await window.api.schema.compareFile(authStore.token)
        if (res.canceled) return
        if (res.error) { showToast(res.error, 'error'); return }
        fileName.value = res.fileName
        diff.value = res.diff
        appliedTables.value = new Set()
        appliedColumns.value = new Set()
        await cekSinkronisasiPermission()
    } finally {
        comparing.value = false
    }
}

function konfirmasiTerapkanTabel(table) {
    pendingAction.value = { label: `Buat tabel "${table}"`, run: () => eksekusiTerapkanTabel(table) }
}

function konfirmasiTerapkanKolom(item) {
    pendingAction.value = { label: `Tambah kolom "${item.column}" ke tabel "${item.table}"`, run: () => eksekusiTerapkanKolom(item) }
}

async function jalankanPending() {
    const action = pendingAction.value
    pendingAction.value = null
    if (action) await action.run()
}

async function eksekusiTerapkanTabel(table) {
    applyingKey.value = table
    try {
        const res = await window.api.schema.applyTable(authStore.token, table)
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(`Tabel "${table}" berhasil dibuat.`)
        appliedTables.value = new Set([...appliedTables.value, table])
    } finally {
        applyingKey.value = null
    }
}

async function eksekusiTerapkanKolom(item) {
    const key = `${item.table}.${item.column}`
    applyingKey.value = key
    try {
        const res = await window.api.schema.applyColumn(authStore.token, item.table, item.column, item.type)
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(res.permissionAdded
            ? `Kolom "${item.column}" ditambahkan + slug permission baru diusulkan.`
            : `Kolom "${item.column}" berhasil ditambahkan ke tabel "${item.table}".`)
        appliedColumns.value = new Set([...appliedColumns.value, key])
    } finally {
        applyingKey.value = null
    }
}
</script>

<template>
    <div>
        <p class="text-sm text-base-content/60 mb-3">
            Upload <code>sik.sql</code> versi terbaru dari vendor Khanza untuk dibandingkan dengan
            skema database yang sedang berjalan. Tidak ada yang diterapkan otomatis — tiap perubahan
            punya tombol "Terapkan" sendiri, dan Anda akan diminta konfirmasi bahwa backup manual
            sudah dilakukan sebelum menerapkan apa pun.
        </p>

        <button class="btn btn-primary btn-sm gap-2" :disabled="comparing" @click="pilihDanBandingkan">
            <span v-if="comparing" class="loading loading-spinner loading-xs"></span>
            <UploadCloud v-else class="size-4" />
            {{ comparing ? 'Membandingkan...' : 'Upload & Bandingkan sik.sql Baru' }}
        </button>

        <!-- Cakupan permission — independen dari upload file, dicek otomatis
             saat halaman dibuka. Nangkep kasus slug kehapus manual dari
             electron_permissions meski kolom `user`-nya masih ada (bukan
             cuma kolom yang genuinely baru). -->
        <div class="mt-5 bg-base-100 rounded-2xl border border-base-200 p-4">
            <div class="flex items-center justify-between mb-2">
                <h3 class="font-semibold text-sm">Sinkronisasi Permission (kolom `user` vs `electron_permissions`)</h3>
                <button class="btn btn-ghost btn-xs gap-1" :disabled="checkingPermissions" @click="cekSinkronisasiPermission">
                    <RefreshCcw class="size-3.5" :class="{ 'animate-spin': checkingPermissions }" /> Cek Ulang
                </button>
            </div>
            <div v-if="checkingPermissions" class="text-sm text-base-content/50">Memeriksa...</div>
            <template v-else>
                <div v-if="missingPermissions.length === 0 && orphanPermissions.length === 0" class="alert alert-success text-sm py-2">
                    Sinkron — semua kolom `user` punya permission, tidak ada slug yatim.
                </div>

                <div v-else class="grid grid-cols-2 gap-4">
                    <div v-if="missingPermissions.length">
                        <p class="text-xs text-base-content/50 mb-2">
                            <span class="font-medium">{{ missingPermissions.length }} kolom `user` belum punya permission</span> —
                            entah kolom baru yang belum di-apply, atau slug-nya kehapus manual dari `electron_permissions`.
                        </p>
                        <div v-for="slug in missingPermissions" :key="slug" class="flex items-center justify-between py-1 border-b border-base-200 last:border-0">
                            <span class="text-sm font-mono">{{ slug }}</span>
                            <button v-if="!addedPermissions.has(slug)" class="btn btn-primary btn-xs" :disabled="applyingKey === `perm.${slug}`" @click="tambahkanPermission(slug)">
                                {{ applyingKey === `perm.${slug}` ? 'Menambahkan...' : 'Tambahkan' }}
                            </button>
                            <span v-else class="badge badge-success badge-sm gap-1"><Check class="size-3" /> Ditambahkan</span>
                        </div>
                    </div>

                    <!-- Arah sebaliknya: slug ADA tapi kolom `user`-nya sudah tidak ada -->
                    <div v-if="orphanPermissions.length">
                        <p class="text-xs text-base-content/50 mb-2">
                            <span class="font-medium">{{ orphanPermissions.length }} permission "yatim"</span> — slug ini ada di
                            `electron_permissions` tapi kolom `user`-nya sudah tidak ada (kolom dihapus/ganti nama, atau slug typo).
                        </p>
                        <div v-for="slug in orphanPermissions" :key="slug" class="flex items-center justify-between py-1 border-b border-base-200 last:border-0">
                            <span class="text-sm font-mono">{{ slug }}</span>
                            <button v-if="!removedOrphans.has(slug)" class="btn btn-error btn-outline btn-xs" :disabled="applyingKey === `orphan.${slug}`" @click="hapusOrphanPermission(slug)">
                                {{ applyingKey === `orphan.${slug}` ? 'Menghapus...' : 'Hapus' }}
                            </button>
                            <span v-else class="badge badge-ghost badge-sm gap-1"><Check class="size-3" /> Dihapus</span>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <div v-if="diff" class="mt-5 space-y-5">
            <p class="text-xs text-base-content/50">Hasil pembanding: <span class="font-medium">{{ fileName }}</span></p>

            <div v-if="diff.newTables.length === 0 && diff.newColumns.length === 0 && diff.changedColumns.length === 0
                    && diff.removedTables.length === 0 && diff.removedColumns.length === 0"
                class="alert alert-success text-sm py-2">
                Tidak ada perbedaan — skema database sudah sama persis dengan file ini.
            </div>

            <!-- Grid 2 kolom — tiap kartu tampil kalau ada isinya (v-if), CSS
                 grid otomatis susun 2 per baris, sisa ganjil jadi 1 di baris
                 terakhir, tidak perlu logic tambahan. -->
            <div class="grid grid-cols-2 gap-4">
            <!-- Tabel Baru -->
            <div v-if="diff.newTables.length" class="bg-base-100 rounded-2xl border border-base-200 p-4">
                <h3 class="font-semibold text-sm mb-2">Tabel Baru ({{ diff.newTables.length }})</h3>
                <div v-for="t in diff.newTables" :key="t.table" class="flex items-center justify-between py-1.5 border-b border-base-200 last:border-0">
                    <span class="text-sm font-mono">{{ t.table }} <span class="text-base-content/40">({{ t.jmlKolom }} kolom)</span></span>
                    <button v-if="!appliedTables.has(t.table)" class="btn btn-primary btn-xs" :disabled="applyingKey === t.table" @click="konfirmasiTerapkanTabel(t.table)">
                        {{ applyingKey === t.table ? 'Menerapkan...' : 'Terapkan' }}
                    </button>
                    <span v-else class="badge badge-success badge-sm gap-1"><Check class="size-3" /> Diterapkan</span>
                </div>
            </div>

            <!-- Kolom Baru -->
            <div v-if="diff.newColumns.length" class="bg-base-100 rounded-2xl border border-base-200 p-4">
                <h3 class="font-semibold text-sm mb-2">Kolom Baru ({{ diff.newColumns.length }})</h3>
                <div v-for="c in diff.newColumns" :key="`${c.table}.${c.column}`" class="flex items-center justify-between py-1.5 border-b border-base-200 last:border-0">
                    <span class="text-sm font-mono">{{ c.table }}.{{ c.column }} <span class="text-base-content/40">{{ c.type }}</span></span>
                    <button v-if="!appliedColumns.has(`${c.table}.${c.column}`)" class="btn btn-primary btn-xs"
                        :disabled="applyingKey === `${c.table}.${c.column}`" @click="konfirmasiTerapkanKolom(c)">
                        {{ applyingKey === `${c.table}.${c.column}` ? 'Menerapkan...' : 'Terapkan' }}
                    </button>
                    <span v-else class="badge badge-success badge-sm gap-1"><Check class="size-3" /> Diterapkan</span>
                </div>
            </div>

            <!-- Kolom Berubah Tipe — info doang, tidak ada tombol apply -->
            <div v-if="diff.changedColumns.length" class="bg-base-100 rounded-2xl border border-warning/30 p-4">
                <h3 class="font-semibold text-sm mb-1">Kolom Berubah Tipe ({{ diff.changedColumns.length }})</h3>
                <p class="text-xs text-base-content/50 mb-2">Perlu direview manual — berisiko data loss kalau diterapkan otomatis.</p>
                <div v-for="c in diff.changedColumns" :key="`${c.table}.${c.column}`" class="text-sm font-mono py-1">
                    {{ c.table }}.{{ c.column }}: <span class="text-error">{{ c.live }}</span> → <span class="text-success">{{ c.file }}</span>
                </div>
            </div>

            <!-- Tabel/Kolom Terhapus — info doang -->
            <div v-if="diff.removedTables.length || diff.removedColumns.length" class="bg-base-100 rounded-2xl border border-base-200 p-4">
                <h3 class="font-semibold text-sm mb-1">Ada di Database, Tidak Ada di File Baru</h3>
                <p class="text-xs text-base-content/50 mb-2">Tidak pernah dihapus otomatis — cuma info.</p>
                <p v-for="t in diff.removedTables" :key="t" class="text-sm font-mono py-0.5">Tabel: {{ t }}</p>
                <p v-for="c in diff.removedColumns" :key="`${c.table}.${c.column}`" class="text-sm font-mono py-0.5">Kolom: {{ c.table }}.{{ c.column }}</p>
            </div>
            </div>
        </div>
    </div>

    <!-- Konfirmasi sebelum eksekusi — sama seperti MigrationPanel.vue: TIDAK
         ADA backup otomatis dari app ini, jadi WAJIB ditegaskan eksplisit
         di sini, bukan langsung eksekusi begitu tombol Terapkan diklik. -->
    <div v-if="pendingAction" class="modal modal-open">
        <div class="modal-box">
            <h3 class="font-bold text-lg">Terapkan perubahan skema?</h3>
            <p class="py-2 text-sm">{{ pendingAction.label }} — ini mengubah skema database yang dipakai
                BERSAMA oleh semua komputer di RS (Electron & Java).</p>
            <p class="py-1 text-sm font-semibold text-warning">
                Aplikasi ini TIDAK membuat backup otomatis. Pastikan backup database sudah
                dilakukan secara manual di sisi server sebelum melanjutkan.
            </p>
            <div class="modal-action">
                <button class="btn btn-ghost btn-sm" @click="pendingAction = null">Batal</button>
                <button class="btn btn-warning btn-sm" @click="jalankanPending">Ya, Backup Sudah Dilakukan — Terapkan</button>
            </div>
        </div>
    </div>
</template>
