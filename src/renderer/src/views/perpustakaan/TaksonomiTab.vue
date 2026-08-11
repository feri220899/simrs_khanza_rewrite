<script setup>
import { ref, reactive, h, onMounted } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, FolderOpen } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'

// Komponen generik dipakai buat 4 taksonomi Perpustakaan (Jenis/Ruang/
// Pengarang/Kategori) — pola sama TaksonomiTab.vue milik Surat, cuma beda
// service (PerpustakaanTaksonomiService, nama kolom PK/nilai berbeda per
// tabel, lihat komentarnya).
const props = defineProps({
    jenis:      { type: String, required: true },
    label:      { type: String, required: true },
    permission: { type: String, required: true },
})

const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can(props.permission)

const activeTab = ref('list')

const columns = [
    {
        id: 'index', header: 'No', enableSorting: false,
        meta: { headerClass: 'w-10 text-center', cellClass: 'text-center text-sm text-base-content/40 tabular-nums' },
        cell: info => {
            const { pageIndex, pageSize } = info.table.getState().pagination
            return pageIndex * pageSize + info.row.index + 1
        },
    },
    { accessorKey: 'kd', header: 'Kode', meta: { headerClass: 'w-32', cellClass: 'font-medium' } },
    { accessorKey: 'nama', header: props.label },
    {
        id: 'aksi', header: 'Aksi', enableSorting: false,
        meta: { headerClass: 'text-center w-32', cellClass: 'text-center' },
        cell: info => h('div', { class: 'flex gap-1 justify-center' }, [
            h('button', { class: 'btn btn-ghost btn-sm', onClick: () => openEdit(info.row.original) }, 'Edit'),
            h('button', { class: 'btn btn-ghost btn-sm text-error', onClick: () => hapus(info.row.original) }, 'Hapus'),
        ]),
    },
]

const { table, loading, search, fetchData } = useServerTable({
    columns,
    fetchFn: params => window.api.perpustakaan.taksonomi.list(props.jenis, params),
    pageSize: 10,
    defaultSortBy: 'kd',
})

const saving = ref(false)
const form = reactive({ kd: '', nama: '' })

async function siapkanFormBaru() {
    form.kd   = await window.api.perpustakaan.taksonomi.nextKode(props.jenis)
    form.nama = ''
}

async function simpan() {
    saving.value = true
    try {
        const res = await window.api.perpustakaan.taksonomi.create(authStore.token, props.jenis, { ...form })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(`${props.label} berhasil disimpan.`)
        await siapkanFormBaru()
        fetchData()
        activeTab.value = 'list'
    } finally {
        saving.value = false
    }
}

const modalEdit = ref(null)
const editOldKode = ref(null)
const updating = ref(false)
const editForm = reactive({ kd: '', nama: '' })

function openEdit(row) {
    editOldKode.value = row.kd
    editForm.kd = row.kd
    editForm.nama = row.nama
    modalEdit.value?.showModal()
}

async function update() {
    updating.value = true
    try {
        const res = await window.api.perpustakaan.taksonomi.update(authStore.token, props.jenis, editOldKode.value, { ...editForm })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(`${props.label} berhasil diupdate.`)
        modalEdit.value?.close()
        fetchData()
    } finally {
        updating.value = false
    }
}

async function hapus(row) {
    if (!confirm(`Hapus "${row.nama}"?`)) return
    const res = await window.api.perpustakaan.taksonomi.delete(authStore.token, props.jenis, row.kd)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast(`${props.label} berhasil dihapus.`)
    fetchData()
}

onMounted(siapkanFormBaru)
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="flex bg-base-200 rounded-xl p-1 w-fit mb-2 shrink-0 gap-0.5">
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2',
                    activeTab === 'tambah' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'tambah'">
                <Plus class="size-4" />
                Tambah {{ label }}
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2',
                    activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'list'">
                <List class="size-4" />
                Daftar {{ label }}
                <span :class="['badge badge-xs p-2 pb-1.5 mb-0.5', activeTab === 'list' ? 'badge-primary' : 'badge-neutral']">
                    {{ table.getRowCount() }}
                </span>
            </button>
        </div>

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
                                    <div :class="['flex items-center gap-1', header.column.columnDef.meta?.headerClass?.includes('text-center') ? 'justify-center' : '']">
                                        <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                                        <span v-if="header.column.getIsSorted() === 'asc'" class="text-primary">↑</span>
                                        <span v-else-if="header.column.getIsSorted() === 'desc'" class="text-primary">↓</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading">
                                <td colspan="4" class="py-16 text-center">
                                    <span class="loading loading-spinner loading-md text-primary"></span>
                                </td>
                            </tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="4" class="py-16 text-center">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
                                            <FolderOpen class="size-7 text-base-content/30" />
                                        </div>
                                        <div>
                                            <p class="font-semibold text-base-content/60">Belum ada data {{ label }}</p>
                                            <p class="text-sm text-base-content/40 mt-0.5">
                                                Klik tab
                                                <button class="text-primary font-semibold hover:underline"
                                                    @click="activeTab = 'tambah'">Tambah {{ label }}</button>
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

        <div v-show="activeTab === 'tambah'" class="flex-1 overflow-y-auto pb-6">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden">
                <div class="px-5 py-3.5 border-b border-base-200 flex items-center gap-3">
                    <div class="w-1 h-5 bg-primary rounded-full"></div>
                    <h3 class="font-semibold text-base-content">Informasi {{ label }}</h3>
                </div>
                <div class="p-5">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl">
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kode</label>
                            <input v-model="form.kd" type="text" maxlength="20" class="input input-bordered w-full" />
                        </div>
                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">
                                {{ label }} <span class="text-error">*</span>
                            </label>
                            <input v-model="form.nama" type="text" maxlength="150"
                                   class="input input-bordered w-full" @keyup.enter="simpan" />
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

    <dialog ref="modalEdit" class="modal">
        <div class="modal-box max-w-sm">
            <h3 class="font-bold text-base mb-4">Edit {{ label }}</h3>
            <div class="space-y-3">
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kode</label>
                    <input v-model="editForm.kd" type="text" maxlength="20" class="input input-bordered w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">{{ label }}</label>
                    <input v-model="editForm.nama" type="text" maxlength="150" class="input input-bordered w-full" />
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
