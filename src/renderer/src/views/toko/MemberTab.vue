<script setup>
import { ref, reactive, h, onMounted } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, Users } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'

// src/toko/TokoMember.java — 8 field, jk/tmp_lahir/tgl_lahir/email TIDAK wajib
// (sesuai investigasi Java asli).
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can('toko_member')

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
    { accessorKey: 'no_member', header: 'No. Member', meta: { headerClass: 'w-32', cellClass: 'font-medium' } },
    { accessorKey: 'nama', header: 'Nama' },
    { accessorKey: 'no_telp', header: 'Telp', enableSorting: false },
    { accessorKey: 'alamat', header: 'Alamat', enableSorting: false },
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
    fetchFn: params => window.api.toko.member.list(params),
    pageSize: 10,
    defaultSortBy: 'no_member',
})

const emptyForm = () => ({ no_member: '', nama: '', jk: 'L', tmp_lahir: '', tgl_lahir: '', alamat: '', no_telp: '', email: '' })
const saving = ref(false)
const form = reactive(emptyForm())

async function siapkanFormBaru() {
    const next = await window.api.toko.member.nextKode()
    Object.assign(form, emptyForm())
    form.no_member = next
}

async function simpan() {
    saving.value = true
    try {
        const res = await window.api.toko.member.create(authStore.token, { ...form })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Member berhasil disimpan.')
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
const editForm = reactive(emptyForm())

function openEdit(row) {
    editOldKode.value = row.no_member
    Object.assign(editForm, { ...row, tgl_lahir: row.tgl_lahir?.slice?.(0, 10) || row.tgl_lahir || '' })
    modalEdit.value?.showModal()
}

async function update() {
    updating.value = true
    try {
        const res = await window.api.toko.member.update(authStore.token, editOldKode.value, { ...editForm })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Member berhasil diupdate.')
        modalEdit.value?.close()
        fetchData()
    } finally {
        updating.value = false
    }
}

async function hapus(row) {
    if (!confirm(`Hapus member "${row.nama}"?`)) return
    const res = await window.api.toko.member.delete(authStore.token, row.no_member)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Member berhasil dihapus.')
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
                Tambah Member
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'list'">
                <List class="size-4" />
                Daftar Member
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
                                            <Users class="size-7 text-base-content/30" />
                                        </div>
                                        <p class="font-semibold text-base-content/60">Belum ada member</p>
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
                    <h3 class="font-semibold text-base-content">Informasi Member</h3>
                </div>
                <div class="p-5">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Member</label>
                            <input v-model="form.no_member" type="text" maxlength="20" class="input input-bordered input-sm w-full" />
                        </div>
                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Nama <span class="text-error">*</span></label>
                            <input v-model="form.nama" type="text" maxlength="150" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Jenis Kelamin</label>
                            <select v-model="form.jk" class="select select-bordered select-sm w-full">
                                <option value="L">Laki-laki</option>
                                <option value="P">Perempuan</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tempat Lahir</label>
                            <input v-model="form.tmp_lahir" type="text" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal Lahir</label>
                            <input v-model="form.tgl_lahir" type="date" class="input input-bordered input-sm w-full" />
                        </div>
                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Alamat <span class="text-error">*</span></label>
                            <input v-model="form.alamat" type="text" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Telp <span class="text-error">*</span></label>
                            <input v-model="form.no_telp" type="text" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Email</label>
                            <input v-model="form.email" type="email" class="input input-bordered input-sm w-full" @keyup.enter="simpan" />
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
        <div class="modal-box max-w-2xl">
            <h3 class="font-bold text-base mb-4">Edit Member</h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Member</label>
                    <input v-model="editForm.no_member" type="text" maxlength="20" class="input input-bordered input-sm w-full" />
                </div>
                <div class="sm:col-span-2">
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Nama</label>
                    <input v-model="editForm.nama" type="text" maxlength="150" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Jenis Kelamin</label>
                    <select v-model="editForm.jk" class="select select-bordered select-sm w-full">
                        <option value="L">Laki-laki</option>
                        <option value="P">Perempuan</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tempat Lahir</label>
                    <input v-model="editForm.tmp_lahir" type="text" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal Lahir</label>
                    <input v-model="editForm.tgl_lahir" type="date" class="input input-bordered input-sm w-full" />
                </div>
                <div class="sm:col-span-3">
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Alamat</label>
                    <input v-model="editForm.alamat" type="text" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Telp</label>
                    <input v-model="editForm.no_telp" type="text" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Email</label>
                    <input v-model="editForm.email" type="email" class="input input-bordered input-sm w-full" />
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
