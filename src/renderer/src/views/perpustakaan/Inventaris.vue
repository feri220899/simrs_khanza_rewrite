<script setup>
import { ref, reactive, h, onMounted } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, Archive } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'

// src/perpustakaan/PerpustakaanInventaris.java — eksemplar fisik per judul
// buku. `status_buku` biasanya DIUBAH OTOMATIS oleh Sirkulasi (pinjam/
// kembali) -- form di sini tetap sediakan field-nya (buat kasus Rusak/Hilang
// yang diinput manual petugas), TAPI beri catatan jelas di UI.
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can('inventaris_perpustakaan')

const activeTab = ref('list')
const opsiBuku = ref([])
const opsiRuang = ref([])
const summary = ref({ jumlah: 0, nilai_total: 0 })

async function muatOpsi() {
    const [b, r, s] = await Promise.all([
        window.api.perpustakaan.koleksi.list({ pageSize: 1000 }),
        window.api.perpustakaan.taksonomi.list('ruang', { pageSize: 1000 }),
        window.api.perpustakaan.inventaris.summary(),
    ])
    opsiBuku.value = b.data
    opsiRuang.value = r.data
    summary.value = s
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
    { accessorKey: 'no_inventaris', header: 'No. Inventaris', meta: { headerClass: 'w-36', cellClass: 'font-medium' } },
    { accessorKey: 'judul_buku', header: 'Judul' },
    {
        accessorKey: 'harga', header: 'Harga', meta: { headerClass: 'text-right w-32', cellClass: 'text-right tabular-nums' },
        cell: info => 'Rp ' + Number(info.getValue()).toLocaleString('id-ID'),
    },
    {
        accessorKey: 'status_buku', header: 'Status', enableSorting: false, meta: { headerClass: 'w-32 text-center', cellClass: 'text-center' },
        cell: info => {
            const v = info.getValue()
            const cls = v === 'Ada' ? 'bg-success/15 text-success' : v === 'Dipinjam' ? 'bg-warning/15 text-warning' : 'bg-error/15 text-error'
            return h('span', { class: `inline-flex items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${cls}` }, v)
        },
    },
    { accessorKey: 'nm_ruang', header: 'Ruang', enableSorting: false },
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
    fetchFn: params => window.api.perpustakaan.inventaris.list(params),
    pageSize: 10,
    defaultSortBy: 'no_inventaris',
})

const emptyForm = () => ({
    no_inventaris: '', kode_buku: '', asal_buku: 'Beli', tgl_pengadaan: new Date().toISOString().slice(0, 10),
    harga: '', status_buku: 'Ada', kd_ruang: '', no_rak: '', no_box: '',
})

const saving = ref(false)
const form = reactive(emptyForm())

async function siapkanFormBaru() {
    const next = await window.api.perpustakaan.inventaris.nextKode()
    Object.assign(form, emptyForm())
    form.no_inventaris = next
}

async function refreshSummary() {
    summary.value = await window.api.perpustakaan.inventaris.summary()
}

async function simpan() {
    saving.value = true
    try {
        const res = await window.api.perpustakaan.inventaris.create(authStore.token, { ...form })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Inventaris berhasil disimpan.')
        await siapkanFormBaru()
        fetchData()
        refreshSummary()
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
    editOldKode.value = row.no_inventaris
    Object.assign(editForm, {
        no_inventaris: row.no_inventaris, kode_buku: row.kode_buku, asal_buku: row.asal_buku,
        tgl_pengadaan: row.tgl_pengadaan?.slice(0, 10) || '', harga: row.harga, status_buku: row.status_buku,
        kd_ruang: row.kd_ruang, no_rak: row.no_rak, no_box: row.no_box,
    })
    modalEdit.value?.showModal()
}

async function update() {
    updating.value = true
    try {
        const res = await window.api.perpustakaan.inventaris.update(authStore.token, editOldKode.value, { ...editForm })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Inventaris berhasil diupdate.')
        modalEdit.value?.close()
        fetchData()
        refreshSummary()
    } finally {
        updating.value = false
    }
}

async function hapus(row) {
    if (!confirm(`Hapus inventaris "${row.no_inventaris}"?`)) return
    const res = await window.api.perpustakaan.inventaris.delete(authStore.token, row.no_inventaris)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Inventaris berhasil dihapus.')
    fetchData()
    refreshSummary()
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
                <h1 class="text-2xl font-bold tracking-tight">Perpustakaan — Inventaris</h1>
                <p class="text-sm text-base-content/60 mt-0.5">Eksemplar fisik per judul buku (src/perpustakaan/PerpustakaanInventaris.java)</p>
            </div>
            <div class="text-right">
                <p class="text-xs text-base-content/50">Total {{ summary.jumlah }} eksemplar</p>
                <p class="font-semibold">Rp {{ Number(summary.nilai_total).toLocaleString('id-ID') }}</p>
            </div>
        </div>

        <div class="flex bg-base-200 rounded-xl p-1 w-fit mb-2 shrink-0 gap-0.5">
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'tambah' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'tambah'">
                <Plus class="size-4" />
                Tambah Inventaris
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'list'">
                <List class="size-4" />
                Daftar Inventaris
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
                                <td colspan="7" class="py-16 text-center">
                                    <span class="loading loading-spinner loading-md text-primary"></span>
                                </td>
                            </tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="7" class="py-16 text-center">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
                                            <Archive class="size-7 text-base-content/30" />
                                        </div>
                                        <div>
                                            <p class="font-semibold text-base-content/60">Belum ada eksemplar inventaris</p>
                                            <p class="text-sm text-base-content/40 mt-0.5">
                                                Klik tab
                                                <button class="text-primary font-semibold hover:underline cursor-pointer"
                                                    @click="activeTab = 'tambah'">Tambah Inventaris</button>
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
                    <h3 class="font-semibold text-base-content">Informasi Inventaris</h3>
                </div>
                <div class="p-5">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Inventaris</label>
                            <input v-model="form.no_inventaris" type="text" maxlength="30" class="input input-bordered input-sm w-full" />
                        </div>
                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Judul (Koleksi) <span class="text-error">*</span></label>
                            <AppSelect v-model="form.kode_buku" :options="opsiBuku" value-prop="kode_buku" label="judul_buku" placeholder="Pilih Koleksi" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Harga <span class="text-error">*</span></label>
                            <input v-model="form.harga" type="number" min="0" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Asal</label>
                            <select v-model="form.asal_buku" class="select select-bordered select-sm w-full">
                                <option>Beli</option>
                                <option>Bantuan</option>
                                <option>Hibah</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal Pengadaan</label>
                            <input v-model="form.tgl_pengadaan" type="date" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Ruang <span class="text-error">*</span></label>
                            <AppSelect v-model="form.kd_ruang" :options="opsiRuang" value-prop="kd" label="nama" placeholder="Pilih Ruang" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Rak</label>
                            <input v-model="form.no_rak" type="text" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Box</label>
                            <input v-model="form.no_box" type="text" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">
                                Status
                                <span class="text-base-content/40 font-normal">(otomatis oleh Sirkulasi saat pinjam/kembali)</span>
                            </label>
                            <select v-model="form.status_buku" class="select select-bordered select-sm w-full">
                                <option>Ada</option>
                                <option>Rusak</option>
                                <option>Hilang</option>
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
            <h3 class="font-bold text-base mb-4">Edit Inventaris</h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Inventaris</label>
                    <input v-model="editForm.no_inventaris" type="text" maxlength="30" class="input input-bordered input-sm w-full" />
                </div>
                <div class="sm:col-span-2">
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Judul (Koleksi)</label>
                    <AppSelect v-model="editForm.kode_buku" :options="opsiBuku" value-prop="kode_buku" label="judul_buku" placeholder="Pilih Koleksi" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Harga</label>
                    <input v-model="editForm.harga" type="number" min="0" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Asal</label>
                    <select v-model="editForm.asal_buku" class="select select-bordered select-sm w-full">
                        <option>Beli</option>
                        <option>Bantuan</option>
                        <option>Hibah</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal Pengadaan</label>
                    <input v-model="editForm.tgl_pengadaan" type="date" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Ruang</label>
                    <AppSelect v-model="editForm.kd_ruang" :options="opsiRuang" value-prop="kd" label="nama" placeholder="Pilih Ruang" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Rak</label>
                    <input v-model="editForm.no_rak" type="text" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Box</label>
                    <input v-model="editForm.no_box" type="text" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Status</label>
                    <select v-model="editForm.status_buku" class="select select-bordered select-sm w-full">
                        <option>Ada</option>
                        <option>Rusak</option>
                        <option>Hilang</option>
                        <option>Dipinjam</option>
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
