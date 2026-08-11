<script setup>
import { ref, reactive, h, onMounted } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, ParkingSquare } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'

// CRUD ini mengikuti PERSIS alur src/parkir/DlgParkirJenis.java (lihat SOP di
// Khanza.md). Pola tampilan (tab Tambah/Daftar + modal Edit + AppPagination)
// mengikuti konvensi UI pos-desktop untuk entity SEDERHANA — lihat
// Khanza.md > "Konvensi UI".
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can('parkir_jenis')

// ── Tab ────────────────────────────────────────────────────
const activeTab = ref('list')

// ── Tabel ──────────────────────────────────────────────────
const columns = [
    {
        id: 'index', header: 'No', enableSorting: false,
        meta: { headerClass: 'w-10 text-center', cellClass: 'text-center text-sm text-base-content/40 tabular-nums' },
        cell: info => {
            const { pageIndex, pageSize } = info.table.getState().pagination
            return pageIndex * pageSize + info.row.index + 1
        },
    },
    { accessorKey: 'kd_parkir', header: 'Kode', meta: { cellClass: 'font-medium' } },
    { accessorKey: 'jns_parkir', header: 'Jenis Parkir' },
    {
        accessorKey: 'biaya', header: 'Tarif', meta: { headerClass: 'text-right', cellClass: 'text-right tabular-nums' },
        cell: info => 'Rp ' + Number(info.getValue()).toLocaleString('id-ID'),
    },
    { accessorKey: 'jenis', header: 'Sistem', enableSorting: false },
    {
        id: 'aksi', header: 'Aksi', enableSorting: false,
        meta: { headerClass: 'text-center', cellClass: 'text-center' },
        cell: info => h('div', { class: 'flex gap-1 justify-center' }, [
            h('button', { class: 'btn btn-ghost btn-sm', onClick: () => openEdit(info.row.original) }, 'Edit'),
            h('button', { class: 'btn btn-ghost btn-sm text-error', onClick: () => hapus(info.row.original) }, 'Hapus'),
        ]),
    },
]

const { table, loading, search, fetchData } = useServerTable({
    columns,
    fetchFn: params => window.api.parkir.listJenis(params),
    pageSize: 10,
    defaultSortBy: 'kd_parkir',
})

// ── Form Tambah ────────────────────────────────────────────
const saving = ref(false)
const form   = reactive({ kd_parkir: '', jns_parkir: '', biaya: '', jenis: 'Harian' })
const formErr = reactive({})

async function siapkanFormBaru() {
    form.kd_parkir  = await window.api.parkir.nextJenisKode() // saran kode, tetap bisa diubah manual
    form.jns_parkir = ''
    form.biaya      = ''
    form.jenis      = 'Harian'
}

async function simpan() {
    Object.keys(formErr).forEach(k => delete formErr[k])
    saving.value = true
    try {
        const res = await window.api.parkir.createJenis(authStore.token, { ...form })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Jenis parkir berhasil disimpan.')
        await siapkanFormBaru()
        fetchData()
        activeTab.value = 'list'
    } finally {
        saving.value = false
    }
}

// ── Edit (modal) ─────────────────────────────────────────────
const modalEdit  = ref(null)
const editOldKode = ref(null)
const updating   = ref(false)
const editForm   = reactive({ kd_parkir: '', jns_parkir: '', biaya: '', jenis: 'Harian' })

function openEdit(row) {
    editOldKode.value = row.kd_parkir
    editForm.kd_parkir  = row.kd_parkir
    editForm.jns_parkir = row.jns_parkir
    editForm.biaya      = row.biaya
    editForm.jenis      = row.jenis
    modalEdit.value?.showModal()
}

async function update() {
    updating.value = true
    try {
        const res = await window.api.parkir.updateJenis(authStore.token, editOldKode.value, { ...editForm })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Jenis parkir berhasil diupdate.')
        modalEdit.value?.close()
        fetchData()
    } finally {
        updating.value = false
    }
}

// ── Hapus ──────────────────────────────────────────────────
async function hapus(row) {
    if (!confirm(`Hapus jenis parkir "${row.jns_parkir}"?`)) return
    const res = await window.api.parkir.deleteJenis(authStore.token, row.kd_parkir)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Jenis parkir berhasil dihapus.')
    fetchData()
}

onMounted(siapkanFormBaru)
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">

        <!-- Header -->
        <div class="flex items-center justify-between mb-4 shrink-0">
            <div>
                <h1 class="text-2xl font-bold tracking-tight">Parkir — Jenis & Tarif</h1>
                <p class="text-sm text-base-content/60 mt-0.5">Master jenis kendaraan & tarif parkir (src/parkir/DlgParkirJenis.java)</p>
            </div>
        </div>

        <!-- Tab Navigation -->
        <div class="flex bg-base-200 rounded-xl p-1 w-fit mb-2 shrink-0 gap-0.5">
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2',
                    activeTab === 'tambah' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'tambah'">
                <Plus class="size-4" />
                Tambah Jenis
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2',
                    activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'list'">
                <List class="size-4" />
                Daftar Jenis
                <span :class="['badge badge-xs p-2 pb-1.5 mb-0.5', activeTab === 'list' ? 'badge-primary' : 'badge-neutral']">
                    {{ table.getRowCount() }}
                </span>
            </button>
        </div>

        <!-- Tab: Daftar -->
        <div v-show="activeTab === 'list'" class="flex-1 min-h-0 overflow-hidden">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm h-full flex flex-col overflow-hidden px-4 py-3">
                <AppPagination :table="table" v-model:search="search" class="flex-1 min-h-0">
                    <table class="table">
                        <thead class="sticky top-0 z-10">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th v-for="header in table.getFlatHeaders()" :key="header.id"
                                    :class="['text-sm font-medium py-2', header.column.columnDef.meta?.headerClass,
                                             header.column.getCanSort() ? 'cursor-pointer select-none hover:text-primary transition-colors' : '']"
                                    @click="header.column.getToggleSortingHandler()?.($event)">
                                    <div :class="['flex items-center gap-1', header.column.columnDef.meta?.headerClass?.includes('text-center') ? 'justify-center' : header.column.columnDef.meta?.headerClass?.includes('text-right') ? 'justify-end' : '']">
                                        <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                                        <span v-if="header.column.getIsSorted() === 'asc'" class="text-primary">↑</span>
                                        <span v-else-if="header.column.getIsSorted() === 'desc'" class="text-primary">↓</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading">
                                <td colspan="6" class="py-16 text-center">
                                    <span class="loading loading-spinner loading-md text-primary"></span>
                                </td>
                            </tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="6" class="py-16 text-center">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
                                            <ParkingSquare class="size-7 text-base-content/30" />
                                        </div>
                                        <div>
                                            <p class="font-semibold text-base-content/60">Belum ada jenis parkir</p>
                                            <p class="text-sm text-base-content/40 mt-0.5">
                                                Klik tab
                                                <button class="text-primary font-semibold hover:underline"
                                                    @click="activeTab = 'tambah'">Tambah Jenis</button>
                                                untuk menambahkan
                                            </p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                            <tr v-else v-for="row in table.getRowModel().rows" :key="row.id"
                                class="border-b border-base-200 hover:bg-primary/5 transition-colors duration-100">
                                <td v-for="cell in row.getVisibleCells()" :key="cell.id"
                                    :class="['py-2', cell.column.columnDef.meta?.cellClass]">
                                    <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </AppPagination>
            </div>
        </div>

        <!-- Tab: Tambah -->
        <div v-show="activeTab === 'tambah'" class="flex-1 overflow-y-auto pb-6">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden">
                <div class="px-5 py-3.5 border-b border-base-200 flex items-center gap-3">
                    <div class="w-1 h-5 bg-primary rounded-full"></div>
                    <h3 class="font-semibold text-base-content">Informasi Jenis Parkir</h3>
                </div>
                <div class="p-5">
                    <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 max-w-3xl">
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kode</label>
                            <input v-model="form.kd_parkir" type="text" maxlength="5" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">
                                Jenis Parkir <span class="text-error">*</span>
                            </label>
                            <input v-model="form.jns_parkir" type="text" maxlength="50"
                                   placeholder="Contoh: Motor, Mobil"
                                   class="input input-bordered w-full" @keyup.enter="simpan" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">
                                Tarif (Rp) <span class="text-error">*</span>
                            </label>
                            <input v-model="form.biaya" type="number" min="0" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Sistem</label>
                            <select v-model="form.jenis" class="select select-bordered w-full">
                                <option value="Harian">Harian</option>
                                <option value="Jam">Jam</option>
                            </select>
                        </div>
                    </div>
                    <p v-if="!bolehTulis()" class="text-warning text-sm mt-3">Anda tidak punya akses menambah data ini.</p>
                    <div class="mt-4">
                        <button class="btn btn-primary gap-2" :disabled="saving || !bolehTulis()" @click="simpan">
                            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                            Simpan
                        </button>
                    </div>
                </div>
            </div>
        </div>

    </div>

    <!-- Modal Edit -->
    <dialog ref="modalEdit" class="modal">
        <div class="modal-box max-w-sm">
            <h3 class="font-bold text-base mb-4">Edit Jenis Parkir</h3>
            <div class="space-y-3">
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kode</label>
                    <input v-model="editForm.kd_parkir" type="text" maxlength="5" class="input input-bordered w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Jenis Parkir</label>
                    <input v-model="editForm.jns_parkir" type="text" maxlength="50" class="input input-bordered w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tarif (Rp)</label>
                    <input v-model="editForm.biaya" type="number" min="0" class="input input-bordered w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Sistem</label>
                    <select v-model="editForm.jenis" class="select select-bordered w-full">
                        <option value="Harian">Harian</option>
                        <option value="Jam">Jam</option>
                    </select>
                </div>
            </div>
            <div class="modal-action mt-4">
                <button class="btn btn-ghost btn-sm" @click="modalEdit?.close()">Batal</button>
                <button class="btn btn-primary btn-sm gap-2" :disabled="updating" @click="update">
                    <span v-if="updating" class="loading loading-spinner loading-xs"></span>
                    Update
                </button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>
</template>
