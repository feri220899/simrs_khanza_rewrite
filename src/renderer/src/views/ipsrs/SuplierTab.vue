<script setup>
import { ref, reactive, h, onMounted } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, Truck } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'

// src/ipsrs/IPSRSSuplier.java — 7 field, pola SEDERHANA sama seperti
// src/renderer/src/views/toko/SuplierTab.vue. BEDA PENTING: Kode Suplier
// DIKETIK MANUAL (tidak ada Valid.autoNomer di Java asli, beda dari
// TokoSuplier.java yang auto-generate) — TIDAK ADA nextKode() di sini.
// Permission slug `suplier_penunjang` DIPAKAI BERSAMA modul "penunjang"
// lain (bukan slug baru khusus IPSRS).
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can('suplier_penunjang')

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
    { accessorKey: 'kode_suplier', header: 'Kode', meta: { headerClass: 'w-28', cellClass: 'font-medium' } },
    { accessorKey: 'nama_suplier', header: 'Nama Suplier' },
    { accessorKey: 'kota', header: 'Kota', enableSorting: false },
    { accessorKey: 'no_telp', header: 'Telp', enableSorting: false },
    {
        id: 'aksi', header: 'Aksi', enableSorting: false,
        meta: { headerClass: 'text-center w-32', cellClass: 'text-center' },
        cell: info => h('div', { class: 'flex gap-1 justify-center' }, [
            h('button', { class: 'btn btn-ghost btn-sm', disabled: !bolehTulis(), onClick: () => openEdit(info.row.original) }, 'Edit'),
            h('button', { class: 'btn btn-ghost btn-sm text-error', disabled: !bolehTulis(), onClick: () => hapus(info.row.original) }, 'Hapus'),
        ]),
    },
]

const { table, loading, search, fetchData } = useServerTable({
    columns,
    fetchFn: params => window.api.ipsrs.suplier.list(params),
    pageSize: 10,
    defaultSortBy: 'kode_suplier',
})

const emptyForm = () => ({ kode_suplier: '', nama_suplier: '', alamat: '', kota: '', no_telp: '', nama_bank: '', rekening: '' })
const saving = ref(false)
const form = reactive(emptyForm())

function siapkanFormBaru() {
    Object.assign(form, emptyForm())
}

async function simpan() {
    saving.value = true
    try {
        const res = await window.api.ipsrs.suplier.create(authStore.token, { ...form })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Suplier berhasil disimpan.')
        siapkanFormBaru()
        fetchData()
        activeTab.value = 'list'
    } finally {
        saving.value = false
    }
}

const modalEdit = ref(null)
const editOldKode = ref(null)
const updating = ref(false)
const editForm = reactive(emptyForm())

function openEdit(row) {
    editOldKode.value = row.kode_suplier
    Object.assign(editForm, row)
    modalEdit.value?.showModal()
}

async function update() {
    updating.value = true
    try {
        const res = await window.api.ipsrs.suplier.update(authStore.token, editOldKode.value, { ...editForm })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Suplier berhasil diupdate.')
        modalEdit.value?.close()
        fetchData()
    } finally {
        updating.value = false
    }
}

async function hapus(row) {
    if (!confirm(`Hapus suplier "${row.nama_suplier}"?`)) return
    const res = await window.api.ipsrs.suplier.delete(authStore.token, row.kode_suplier)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Suplier berhasil dihapus.')
    fetchData()
}

onMounted(siapkanFormBaru)
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="flex bg-base-200 rounded-xl p-1 w-fit mb-2 shrink-0 gap-0.5">
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'tambah' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'tambah'">
                <Plus class="size-4" />
                Tambah Suplier
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'list'">
                <List class="size-4" />
                Daftar Suplier
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
                                    <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                                    <span v-if="header.column.getIsSorted() === 'asc'" class="text-primary">↑</span>
                                    <span v-else-if="header.column.getIsSorted() === 'desc'" class="text-primary">↓</span>
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
                                            <Truck class="size-7 text-base-content/30" />
                                        </div>
                                        <p class="font-semibold text-base-content/60">Belum ada suplier</p>
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
                    <h3 class="font-semibold text-base-content">Informasi Suplier</h3>
                </div>
                <div class="p-5">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kode <span class="text-error">*</span></label>
                            <input v-model="form.kode_suplier" type="text" maxlength="20" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Nama Suplier <span class="text-error">*</span></label>
                            <input v-model="form.nama_suplier" type="text" maxlength="150" class="input input-bordered input-sm w-full" />
                        </div>
                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Alamat <span class="text-error">*</span></label>
                            <input v-model="form.alamat" type="text" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kota <span class="text-error">*</span></label>
                            <input v-model="form.kota" type="text" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Telp <span class="text-error">*</span></label>
                            <input v-model="form.no_telp" type="text" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Nama Bank <span class="text-error">*</span></label>
                            <input v-model="form.nama_bank" type="text" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Rekening <span class="text-error">*</span></label>
                            <input v-model="form.rekening" type="text" class="input input-bordered input-sm w-full" @keyup.enter="simpan" />
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
        <div class="modal-box max-w-lg">
            <h3 class="font-bold text-base mb-4">Edit Suplier</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kode</label>
                    <input v-model="editForm.kode_suplier" type="text" maxlength="20" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Nama Suplier</label>
                    <input v-model="editForm.nama_suplier" type="text" maxlength="150" class="input input-bordered input-sm w-full" />
                </div>
                <div class="sm:col-span-2">
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Alamat</label>
                    <input v-model="editForm.alamat" type="text" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kota</label>
                    <input v-model="editForm.kota" type="text" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Telp</label>
                    <input v-model="editForm.no_telp" type="text" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Nama Bank</label>
                    <input v-model="editForm.nama_bank" type="text" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Rekening</label>
                    <input v-model="editForm.rekening" type="text" class="input input-bordered input-sm w-full" />
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
