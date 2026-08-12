<script setup>
import { ref, reactive, h, onMounted } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, UserCircle } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'

// src/perpustakaan/PerpustakaanAnggota.java — 12 field, semua wajib kecuali
// tanggal (default combobox), tidak ada field kondisional -> pola SEDERHANA.
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can('anggota_perpustakaan')

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
    { accessorKey: 'no_anggota', header: 'No. Anggota', meta: { headerClass: 'w-32', cellClass: 'font-medium' } },
    { accessorKey: 'nama_anggota', header: 'Nama' },
    { accessorKey: 'jenis_anggota', header: 'Jenis', enableSorting: false, meta: { headerClass: 'w-28' } },
    { accessorKey: 'no_telp', header: 'Telp', enableSorting: false },
    { accessorKey: 'masa_berlaku', header: 'Berlaku s/d', meta: { headerClass: 'w-32' } },
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
    fetchFn: params => window.api.perpustakaan.anggota.list(params),
    pageSize: 10,
    defaultSortBy: 'no_anggota',
})

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = () => ({
    no_anggota: '', nama_anggota: '', tmp_lahir: '', tgl_lahir: today(), j_kel: 'Laki-laki',
    alamat: '', no_telp: '', email: '', tgl_gabung: today(), masa_berlaku: today(),
    jenis_anggota: 'Umum', nomer_id: '',
})

const saving = ref(false)
const form = reactive(emptyForm())

async function siapkanFormBaru() {
    const next = await window.api.perpustakaan.anggota.nextKode()
    Object.assign(form, emptyForm())
    form.no_anggota = next
}

async function simpan() {
    saving.value = true
    try {
        const res = await window.api.perpustakaan.anggota.create(authStore.token, { ...form })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Anggota berhasil disimpan.')
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
    editOldKode.value = row.no_anggota
    Object.assign(editForm, {
        ...row,
        tgl_lahir: row.tgl_lahir?.slice(0, 10) || today(),
        tgl_gabung: row.tgl_gabung?.slice(0, 10) || today(),
        masa_berlaku: row.masa_berlaku?.slice(0, 10) || today(),
    })
    modalEdit.value?.showModal()
}

async function update() {
    updating.value = true
    try {
        const res = await window.api.perpustakaan.anggota.update(authStore.token, editOldKode.value, { ...editForm })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Anggota berhasil diupdate.')
        modalEdit.value?.close()
        fetchData()
    } finally {
        updating.value = false
    }
}

async function hapus(row) {
    if (!confirm(`Hapus anggota "${row.nama_anggota}"?`)) return
    const res = await window.api.perpustakaan.anggota.delete(authStore.token, row.no_anggota)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Anggota berhasil dihapus.')
    fetchData()
}

onMounted(siapkanFormBaru)
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="flex items-center justify-between mb-4 shrink-0">
            <div>
                <h1 class="text-2xl font-bold tracking-tight">Perpustakaan — Anggota</h1>
                <p class="text-sm text-base-content/60 mt-0.5">Data anggota perpustakaan (src/perpustakaan/PerpustakaanAnggota.java)</p>
            </div>
        </div>

        <div class="flex bg-base-200 rounded-xl p-1 w-fit mb-2 shrink-0 gap-0.5">
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'tambah' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'tambah'">
                <Plus class="size-4" />
                Tambah Anggota
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'list'">
                <List class="size-4" />
                Daftar Anggota
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
                                <td colspan="7" class="py-16 text-center">
                                    <span class="loading loading-spinner loading-md text-primary"></span>
                                </td>
                            </tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="7" class="py-16 text-center">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
                                            <UserCircle class="size-7 text-base-content/30" />
                                        </div>
                                        <div>
                                            <p class="font-semibold text-base-content/60">Belum ada anggota</p>
                                            <p class="text-sm text-base-content/40 mt-0.5">
                                                Klik tab
                                                <button class="text-primary font-semibold hover:underline cursor-pointer"
                                                    @click="activeTab = 'tambah'">Tambah Anggota</button>
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
                    <h3 class="font-semibold text-base-content">Informasi Anggota</h3>
                </div>
                <div class="p-5">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Anggota</label>
                            <input v-model="form.no_anggota" type="text" maxlength="30" class="input input-bordered input-sm w-full" />
                        </div>
                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Nama <span class="text-error">*</span></label>
                            <input v-model="form.nama_anggota" type="text" maxlength="150" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tempat Lahir <span class="text-error">*</span></label>
                            <input v-model="form.tmp_lahir" type="text" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal Lahir</label>
                            <input v-model="form.tgl_lahir" type="date" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Jenis Kelamin</label>
                            <select v-model="form.j_kel" class="select select-bordered select-sm w-full">
                                <option>Laki-laki</option>
                                <option>Perempuan</option>
                            </select>
                        </div>
                        <div class="sm:col-span-3">
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Alamat <span class="text-error">*</span></label>
                            <input v-model="form.alamat" type="text" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Telp <span class="text-error">*</span></label>
                            <input v-model="form.no_telp" type="text" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Email <span class="text-error">*</span></label>
                            <input v-model="form.email" type="email" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. RM/NIP/No. KTP <span class="text-error">*</span></label>
                            <input v-model="form.nomer_id" type="text" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal Gabung</label>
                            <input v-model="form.tgl_gabung" type="date" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Masa Berlaku s/d</label>
                            <input v-model="form.masa_berlaku" type="date" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Jenis Anggota</label>
                            <select v-model="form.jenis_anggota" class="select select-bordered select-sm w-full">
                                <option>Pasien</option>
                                <option>Pegawai</option>
                                <option>Umum</option>
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

    <dialog ref="modalEdit" class="modal">
        <div class="modal-box max-w-2xl">
            <h3 class="font-bold text-base mb-4">Edit Anggota</h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Anggota</label>
                    <input v-model="editForm.no_anggota" type="text" maxlength="30" class="input input-bordered input-sm w-full" />
                </div>
                <div class="sm:col-span-2">
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Nama</label>
                    <input v-model="editForm.nama_anggota" type="text" maxlength="150" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tempat Lahir</label>
                    <input v-model="editForm.tmp_lahir" type="text" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal Lahir</label>
                    <input v-model="editForm.tgl_lahir" type="date" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Jenis Kelamin</label>
                    <select v-model="editForm.j_kel" class="select select-bordered select-sm w-full">
                        <option>Laki-laki</option>
                        <option>Perempuan</option>
                    </select>
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
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. RM/NIP/No. KTP</label>
                    <input v-model="editForm.nomer_id" type="text" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal Gabung</label>
                    <input v-model="editForm.tgl_gabung" type="date" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Masa Berlaku s/d</label>
                    <input v-model="editForm.masa_berlaku" type="date" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Jenis Anggota</label>
                    <select v-model="editForm.jenis_anggota" class="select select-bordered select-sm w-full">
                        <option>Pasien</option>
                        <option>Pegawai</option>
                        <option>Umum</option>
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
