<script setup>
import { ref, reactive, h, onMounted } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, BookOpen } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'

// src/perpustakaan/PerpustakaanKoleksi.java — katalog buku, FK ke 4 master
// data (Penerbit/Pengarang/Kategori/Jenis). Java asli pakai popup picker
// terpisah buat tiap FK (window baru, klik baris, window nutup sendiri) —
// di sini disederhanakan jadi <select> biasa (master datanya kecil, sudah
// ada halaman Master Data sendiri buat kelola isinya). Field TIDAK ada yang
// kondisional, jadi tetap pola SEDERHANA (2 tab + modal edit) sesuai
// Konvensi UI, bukan modal tunggal ala entity kompleks.
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can('koleksi_perpustakaan')

const activeTab = ref('list')
const opsiPenerbit = ref([])
const opsiPengarang = ref([])
const opsiKategori = ref([])
const opsiJenis = ref([])

async function muatOpsi() {
    const [p, pg, k, j] = await Promise.all([
        window.api.perpustakaan.penerbit.list({ pageSize: 1000 }),
        window.api.perpustakaan.taksonomi.list('pengarang', { pageSize: 1000 }),
        window.api.perpustakaan.taksonomi.list('kategori', { pageSize: 1000 }),
        window.api.perpustakaan.taksonomi.list('jenis', { pageSize: 1000 }),
    ])
    opsiPenerbit.value = p.data
    opsiPengarang.value = pg.data
    opsiKategori.value = k.data
    opsiJenis.value = j.data
}

const columns = [
    {
        id: 'index', header: 'No', enableSorting: false,
        meta: { headerClass: 'w-10 text-center', cellClass: 'text-center text-sm text-base-content/40 tabular-nums' },
        cell: info => {
            const { pageIndex, pageSize } = info.table.getState().pagination
            return pageIndex * pageSize + info.row.index + 1
        },
    },
    { accessorKey: 'kode_buku', header: 'Kode', meta: { headerClass: 'w-32', cellClass: 'font-medium' } },
    { accessorKey: 'judul_buku', header: 'Judul' },
    { accessorKey: 'nama_penerbit', header: 'Penerbit', enableSorting: false },
    { accessorKey: 'nama_pengarang', header: 'Pengarang', enableSorting: false },
    { accessorKey: 'thn_terbit', header: 'Tahun', enableSorting: true, meta: { headerClass: 'w-20 text-center', cellClass: 'text-center' } },
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
    fetchFn: params => window.api.perpustakaan.koleksi.list(params),
    pageSize: 10,
    defaultSortBy: 'kode_buku',
})

const emptyForm = () => ({
    kode_buku: '', judul_buku: '', jml_halaman: '', kode_penerbit: '', kode_pengarang: '',
    thn_terbit: '', isbn: '', id_kategori: '', id_jenis: '',
})

const saving = ref(false)
const form = reactive(emptyForm())

async function siapkanFormBaru() {
    const next = await window.api.perpustakaan.koleksi.nextKode()
    Object.assign(form, emptyForm())
    form.kode_buku = next
}

async function simpan() {
    saving.value = true
    try {
        const res = await window.api.perpustakaan.koleksi.create(authStore.token, { ...form })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Koleksi berhasil disimpan.')
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
    editOldKode.value = row.kode_buku
    Object.assign(editForm, {
        kode_buku: row.kode_buku, judul_buku: row.judul_buku, jml_halaman: row.jml_halaman,
        kode_penerbit: row.kode_penerbit, kode_pengarang: row.kode_pengarang, thn_terbit: row.thn_terbit,
        isbn: row.isbn, id_kategori: row.id_kategori, id_jenis: row.id_jenis,
    })
    modalEdit.value?.showModal()
}

async function update() {
    updating.value = true
    try {
        const res = await window.api.perpustakaan.koleksi.update(authStore.token, editOldKode.value, { ...editForm })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Koleksi berhasil diupdate.')
        modalEdit.value?.close()
        fetchData()
    } finally {
        updating.value = false
    }
}

async function hapus(row) {
    if (!confirm(`Hapus koleksi "${row.judul_buku}"?`)) return
    const res = await window.api.perpustakaan.koleksi.delete(authStore.token, row.kode_buku)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Koleksi berhasil dihapus.')
    fetchData()
}

onMounted(async () => {
    await muatOpsi()
    await siapkanFormBaru()
})
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="flex items-center justify-between mb-4 shrink-0">
            <div>
                <h1 class="text-2xl font-bold tracking-tight">Perpustakaan — Koleksi</h1>
                <p class="text-sm text-base-content/60 mt-0.5">Katalog judul buku (src/perpustakaan/PerpustakaanKoleksi.java)</p>
            </div>
        </div>

        <div class="flex bg-base-200 rounded-xl p-1 w-fit mb-2 shrink-0 gap-0.5">
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2',
                    activeTab === 'tambah' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'tambah'">
                <Plus class="size-4" />
                Tambah Koleksi
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2',
                    activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'list'">
                <List class="size-4" />
                Daftar Koleksi
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
                                            <BookOpen class="size-7 text-base-content/30" />
                                        </div>
                                        <div>
                                            <p class="font-semibold text-base-content/60">Belum ada koleksi buku</p>
                                            <p class="text-sm text-base-content/40 mt-0.5">
                                                Klik tab
                                                <button class="text-primary font-semibold hover:underline"
                                                    @click="activeTab = 'tambah'">Tambah Koleksi</button>
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
                    <h3 class="font-semibold text-base-content">Informasi Koleksi</h3>
                </div>
                <div class="p-5">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kode</label>
                            <input v-model="form.kode_buku" type="text" maxlength="20" class="input input-bordered w-full" />
                        </div>
                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Judul <span class="text-error">*</span></label>
                            <input v-model="form.judul_buku" type="text" maxlength="255" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Jml. Halaman <span class="text-error">*</span></label>
                            <input v-model="form.jml_halaman" type="number" min="0" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tahun Terbit</label>
                            <input v-model="form.thn_terbit" type="number" min="0" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">ISBN</label>
                            <input v-model="form.isbn" type="text" maxlength="30" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Penerbit <span class="text-error">*</span></label>
                            <select v-model="form.kode_penerbit" class="select select-bordered w-full">
                                <option value="" disabled>Pilih Penerbit</option>
                                <option v-for="o in opsiPenerbit" :key="o.kode_penerbit" :value="o.kode_penerbit">{{ o.nama_penerbit }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Pengarang <span class="text-error">*</span></label>
                            <select v-model="form.kode_pengarang" class="select select-bordered w-full">
                                <option value="" disabled>Pilih Pengarang</option>
                                <option v-for="o in opsiPengarang" :key="o.kd" :value="o.kd">{{ o.nama }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Jenis <span class="text-error">*</span></label>
                            <select v-model="form.id_jenis" class="select select-bordered w-full">
                                <option value="" disabled>Pilih Jenis</option>
                                <option v-for="o in opsiJenis" :key="o.kd" :value="o.kd">{{ o.nama }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kategori <span class="text-error">*</span></label>
                            <select v-model="form.id_kategori" class="select select-bordered w-full">
                                <option value="" disabled>Pilih Kategori</option>
                                <option v-for="o in opsiKategori" :key="o.kd" :value="o.kd">{{ o.nama }}</option>
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
            <h3 class="font-bold text-base mb-4">Edit Koleksi</h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kode</label>
                    <input v-model="editForm.kode_buku" type="text" maxlength="20" class="input input-bordered w-full" />
                </div>
                <div class="sm:col-span-2">
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Judul</label>
                    <input v-model="editForm.judul_buku" type="text" maxlength="255" class="input input-bordered w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Jml. Halaman</label>
                    <input v-model="editForm.jml_halaman" type="number" min="0" class="input input-bordered w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tahun Terbit</label>
                    <input v-model="editForm.thn_terbit" type="number" min="0" class="input input-bordered w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">ISBN</label>
                    <input v-model="editForm.isbn" type="text" maxlength="30" class="input input-bordered w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Penerbit</label>
                    <select v-model="editForm.kode_penerbit" class="select select-bordered w-full">
                        <option v-for="o in opsiPenerbit" :key="o.kode_penerbit" :value="o.kode_penerbit">{{ o.nama_penerbit }}</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Pengarang</label>
                    <select v-model="editForm.kode_pengarang" class="select select-bordered w-full">
                        <option v-for="o in opsiPengarang" :key="o.kd" :value="o.kd">{{ o.nama }}</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Jenis</label>
                    <select v-model="editForm.id_jenis" class="select select-bordered w-full">
                        <option v-for="o in opsiJenis" :key="o.kd" :value="o.kd">{{ o.nama }}</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kategori</label>
                    <select v-model="editForm.id_kategori" class="select select-bordered w-full">
                        <option v-for="o in opsiKategori" :key="o.kd" :value="o.kd">{{ o.nama }}</option>
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
