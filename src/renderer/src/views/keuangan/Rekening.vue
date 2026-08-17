<script setup>
import { computed, onMounted, ref } from 'vue'
import { Plus, Pencil, Trash2, RotateCcw, Save, X, Search, Landmark, Layers, FileText, GitFork } from 'lucide-vue-next'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'

const authStore = useAuthStore()
const { showToast } = useToast()

const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const editing = ref(null)
const search = ref('')
const showModal = ref(false)


const form = ref({
    kd_rek: '',
    nm_rek: '',
    tipe: 'N',
    balance: 'D',
    level: '0',
    parent: ''
})

const parents = computed(() => {
    return rows.value
        .filter(row => row.kd_rek !== editing.value)
        .map(row => ({
            kd_rek: row.kd_rek,
            nm_rek: `${row.kd_rek} — ${row.nm_rek}`
        }))
})


function flattenAccounts(source) {
    const byParent = new Map()
    for (const row of source) {
        const key = row.parent || ''
        if (!byParent.has(key)) byParent.set(key, [])
        byParent.get(key).push(row)
    }

    for (const items of byParent.values()) {
        items.sort((a, b) => String(a.kd_rek).localeCompare(String(b.kd_rek), undefined, { numeric: true }))
    }

    const result = []
    function visit(parent, depth = 0) {
        for (const row of byParent.get(parent) || []) {
            result.push({ ...row, displayLevel: depth })
            visit(row.kd_rek, depth + 1)
        }
    }
    visit('')

    for (const row of source) {
        if (!result.some(item => item.kd_rek === row.kd_rek)) result.push({ ...row, displayLevel: Number(row.level || 0) })
    }
    return result
}

const filteredRows = computed(() => {
    const q = search.value.trim().toLowerCase()
    const source = !q ? rows.value : rows.value.filter(row =>
        `${row.kd_rek} ${row.nm_rek} ${row.parent || ''}`.toLowerCase().includes(q)
    )
    return flattenAccounts(source)
})

const page = ref(1)
const pageSize = ref(20)

const paginatedRows = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return filteredRows.value.slice(start, start + pageSize.value)
})

function openNew() {
    editing.value = null
    form.value = { kd_rek: '', nm_rek: '', tipe: 'N', balance: 'D', level: '0', parent: '' }
    showModal.value = true
}

function openEdit(row) {
    editing.value = row.kd_rek
    form.value = {
        kd_rek: row.kd_rek,
        nm_rek: row.nm_rek,
        tipe: row.tipe,
        balance: row.balance,
        level: String(row.level),
        parent: row.parent || ''
    }
    showModal.value = true
}

function closeModal() {
    showModal.value = false
    editing.value = null
}

async function load() {
    loading.value = true
    try {
        rows.value = await window.api.keuangan.rekening.list()
    } catch (err) {
        showToast(err?.message || 'Gagal memuat rekening', 'error')
    } finally {
        loading.value = false
    }
}

async function save() {
    saving.value = true
    try {
        const parent = typeof form.value.parent === 'object'
            ? form.value.parent?.kd_rek || ''
            : form.value.parent || ''
        const payload = {
            kd_rek: String(form.value.kd_rek || ''),
            nm_rek: String(form.value.nm_rek || ''),
            tipe: String(form.value.tipe || ''),
            balance: String(form.value.balance || ''),
            level: String(form.value.level || ''),
            parent: String(parent)
        }
        const result = editing.value
            ? await window.api.keuangan.rekening.update(authStore.token, editing.value, payload)
            : await window.api.keuangan.rekening.create(authStore.token, payload)
        if (!result.success) return showToast(result.message || 'Gagal menyimpan rekening', 'error')
        
        showToast(editing.value ? 'Rekening berhasil diperbarui' : 'Rekening berhasil ditambahkan')
        closeModal()
        await load()
    } catch (err) {
        showToast(err?.message || 'Gagal menyimpan rekening', 'error')
    } finally {
        saving.value = false
    }
}

async function remove(row) {
    if (!confirm(`Hapus rekening ${row.kd_rek} - ${row.nm_rek}?`)) return
    const result = await window.api.keuangan.rekening.delete(authStore.token, row.kd_rek)
    if (!result.success) return showToast(result.message || 'Gagal menghapus rekening', 'error')
    showToast('Rekening berhasil dihapus')
    await load()
}

onMounted(load)
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
            <div>
                <h1 class="text-xl font-bold flex items-center gap-2">
                    <Landmark class="size-6 text-primary" /> Master Rekening / COA
                </h1>
                <p class="text-sm text-base-content/60">Pengelolaan Bagan Akun Standar (Chart of Accounts)</p>
            </div>
            <div class="flex items-center gap-2">
                <button class="btn btn-ghost btn-sm gap-2" :disabled="loading" @click="load">
                    <RotateCcw class="size-4" /> Refresh
                </button>
                <button class="btn btn-primary btn-sm gap-2" @click="openNew">
                    <Plus class="size-4" /> Tambah Rekening
                </button>
            </div>
        </div>

        <!-- Search, Pagination & Table -->
        <AppPagination v-model:search="search" v-model:page="page" v-model:page-size="pageSize" :total="filteredRows.length" :page-sizes="[10, 20, 50, 100]">
            <div class="overflow-x-auto border border-base-200 rounded-lg relative min-h-[300px] max-h-[70vh] overflow-y-auto">
                <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center bg-base-100/80 z-10">
                    <span class="loading loading-spinner loading-md text-primary"></span>
                    <p class="mt-2 text-sm text-base-content/60">Memuat data rekening...</p>
                </div>
                <table class="table table-sm w-full table-fixed">
                    <thead class="sticky top-0 z-20 bg-base-200 text-base-content font-semibold shadow-sm">
                        <tr>
                            <th class="w-28">Kode</th>
                            <th>Nama Rekening</th>
                            <th class="w-40">Tipe</th>
                            <th class="w-32">Balance</th>
                            <th class="w-20">Level</th>
                            <th class="w-40">Induk Rekening</th>
                            <th class="w-24 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in paginatedRows" :key="row.kd_rek" class="hover">
                            <td class="font-mono font-semibold text-primary truncate">{{ row.kd_rek }}</td>
                            <td class="truncate">
                                <span class="inline-flex items-center" :style="{ paddingLeft: `${Math.min(row.displayLevel, 6) * 1.25}rem` }">
                                    <span v-if="row.displayLevel > 0" class="text-base-content/30 mr-2">↳</span>
                                    <span :class="row.displayLevel === 0 ? 'font-semibold' : ''">{{ row.nm_rek }}</span>
                                </span>
                            </td>
                            <td>
                                <span class="badge badge-sm badge-outline font-medium" 
                                      :class="{
                                          'badge-info': row.tipe === 'N', 
                                          'badge-warning': row.tipe === 'R',
                                          'badge-secondary': row.tipe === 'M'
                                      }">
                                    {{ row.tipe === 'N' ? 'Neraca (N)' : row.tipe === 'R' ? 'Rugi Laba (R)' : 'Modal (M)' }}
                                </span>
                            </td>
                            <td>
                                <span class="badge badge-sm font-semibold" :class="row.balance === 'D' ? 'badge-success badge-soft' : 'badge-error badge-soft'">
                                    {{ row.balance === 'D' ? 'Debet (D)' : 'Kredit (K)' }}
                                </span>
                            </td>
                            <td>
                                <span class="badge badge-ghost badge-sm font-mono">L{{ row.level }}</span>
                            </td>
                            <td class="truncate">
                                <span v-if="row.parent" class="font-mono text-xs bg-base-200 px-2 py-0.5 rounded inline-block max-w-full truncate">
                                    {{ row.parent }}
                                </span>
                                <span v-else class="text-base-content/30 text-xs">-</span>
                            </td>
                            <td class="text-right">
                                <div class="flex items-center justify-end gap-1">
                                    <button class="btn btn-ghost btn-xs text-info" title="Edit" @click="openEdit(row)">
                                        <Pencil class="size-3.5" />
                                    </button>
                                    <button class="btn btn-ghost btn-xs text-error" title="Hapus" @click="remove(row)">
                                        <Trash2 class="size-3.5" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="!paginatedRows.length && !loading">
                            <td colspan="7" class="text-center text-base-content/50 py-12">
                                Tidak ada data rekening yang cocok.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </AppPagination>

        <!-- Modal Dialog Form -->
        <dialog class="modal" :class="{ 'modal-open': showModal }">
            <div class="modal-box w-11/12 max-w-2xl p-0 rounded-2xl border border-base-200 shadow-2xl overflow-hidden bg-base-100">
                <!-- Modal Header -->
                <div class="bg-base-200/50 px-6 py-4 flex items-center justify-between border-b border-base-200">
                    <div class="flex items-center gap-3">
                        <div class="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Landmark class="size-5" />
                        </div>
                        <div>
                            <h3 class="font-bold text-lg leading-tight">{{ editing ? 'Edit Rekening' : 'Tambah Rekening Baru' }}</h3>
                            <p class="text-xs text-base-content/60">Lengkapi atribut Bagan Akun Standar (COA)</p>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-circle btn-ghost" type="button" @click="closeModal">
                        <X class="size-4" />
                    </button>
                </div>

                <!-- Modal Body Form -->
                <form @submit.prevent="save">
                    <div class="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                        <!-- Section 1: Informasi Dasar -->
                        <div class="bg-base-200/30 border border-base-200/60 rounded-xl p-4 space-y-3">
                            <div class="text-xs font-bold text-base-content/70 flex items-center gap-1.5 uppercase tracking-wider">
                                <FileText class="size-3.5 text-primary" /> Identitas Akun
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div class="form-control gap-1">
                                    <span class="label-text font-semibold text-xs text-base-content/70">Kode Rekening</span>
                                    <input
                                        v-model="form.kd_rek"
                                        type="text"
                                        class="input input-bordered input-sm font-mono"
                                        placeholder="Misal: 111010"
                                        :disabled="!!editing"
                                        required
                                    />
                                </div>
                                <div class="form-control gap-1 md:col-span-2">
                                    <span class="label-text font-semibold text-xs text-base-content/70">Nama Rekening</span>
                                    <input
                                        v-model="form.nm_rek"
                                        type="text"
                                        class="input input-bordered input-sm"
                                        placeholder="Misal: Kas Besar / Pendapatan Ralan"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Section 2: Klasifikasi Akun -->
                        <div class="bg-base-200/30 border border-base-200/60 rounded-xl p-4 space-y-3">
                            <div class="text-xs font-bold text-base-content/70 flex items-center gap-1.5 uppercase tracking-wider">
                                <Layers class="size-3.5 text-primary" /> Sifat & Klasifikasi
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div class="form-control gap-1">
                                    <span class="label-text font-semibold text-xs text-base-content/70">Tipe Laporan</span>
                                    <select v-model="form.tipe" class="select select-bordered select-sm">
                                        <option value="N">N — Neraca</option>
                                        <option value="R">R — Rugi Laba</option>
                                        <option value="M">M — Perubahan Modal</option>
                                    </select>
                                </div>
                                <div class="form-control gap-1">
                                    <span class="label-text font-semibold text-xs text-base-content/70">Normal Balance</span>
                                    <select v-model="form.balance" class="select select-bordered select-sm">
                                        <option value="D">D — Debet</option>
                                        <option value="K">K — Kredit</option>
                                    </select>
                                </div>
                                <div class="form-control gap-1">
                                    <span class="label-text font-semibold text-xs text-base-content/70">Level Akun</span>
                                    <select v-model="form.level" class="select select-bordered select-sm">
                                        <option value="0">0 (Header)</option>
                                        <option value="1">1 (Detail)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Section 3: Hirarki Induk -->
                        <div class="bg-base-200/30 border border-base-200/60 rounded-xl p-4 space-y-3">
                            <div class="text-xs font-bold text-base-content/70 flex items-center gap-1.5 uppercase tracking-wider">
                                <GitFork class="size-3.5 text-primary" /> Struktur Relasi (Induk)
                            </div>
                            <div class="flex flex-col items-stretch w-full gap-2">
                                <label for="rekening-parent" class="block w-full text-xs font-semibold text-base-content/70">
                                    Induk Rekening (Subrekening Parent)
                                </label>
                                <AppSelect
                                    id="rekening-parent"
                                    v-model="form.parent"
                                    :options="parents"
                                    value-prop="kd_rek"
                                    label="nm_rek"
                                    placeholder="Cari induk rekening..."
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Modal Footer -->
                    <div class="bg-base-200/40 px-6 py-3.5 border-t border-base-200 flex items-center justify-end gap-2">
                        <button type="button" class="btn btn-ghost btn-sm" @click="closeModal">Batal</button>
                        <button type="submit" class="btn btn-primary btn-sm gap-2 min-w-36" :disabled="saving">
                            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                            <Save v-else class="size-4" />
                            {{ editing ? 'Simpan' : 'Tambah Rekening' }}
                        </button>
                    </div>
                </form>
            </div>
            <div class="modal-backdrop bg-black/40" @click="closeModal"></div>
        </dialog>
    </div>
</template>
