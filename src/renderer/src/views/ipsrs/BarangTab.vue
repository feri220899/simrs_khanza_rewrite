<script setup>
import { ref, reactive, h, onMounted } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, Package, Trash2 } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'

// src/ipsrs/IPSRSBarang.java — CUMA SATU kolom harga (beda dari
// TokoBarang.java yang punya dasar/h_beli/distributor/grosir/retail), jadi
// TIDAK ADA hitungHarga() di sini. Kode Barang DIKETIK MANUAL (tidak ada
// Valid.autoNomer di Java asli) — TIDAK ADA nextKode(). Hapus = SOFT DELETE,
// tab "Data Sampah" (restore/hapus permanen) direplika dari src/restore/
// DlgRestoreIPSRSBarang.java, gate-nya Administrator/Admin Utama (bukan
// cuma permission ipsrs_barang biasa) — sama pola persis
// src/renderer/src/views/toko/BarangTab.vue.
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can('ipsrs_barang')
const isAdmin = authStore.user?.role === 'Administrator'

const activeTab = ref('list')
const opsiJenis = ref([])
const opsiSatuan = ref([])
async function muatOpsi() {
    opsiJenis.value = await window.api.ipsrs.jenis.listAll()
    opsiSatuan.value = (await window.api.satuan.list({ pageSize: 1000 })).data
}

const columns = [
    { accessorKey: 'kode_brng', header: 'Kode', meta: { headerClass: 'w-32', cellClass: 'font-medium' } },
    { accessorKey: 'nama_brng', header: 'Nama Barang' },
    { accessorKey: 'nm_jenis', header: 'Jenis', enableSorting: false },
    { accessorKey: 'nama_satuan', header: 'Satuan', enableSorting: false, meta: { headerClass: 'w-24' } },
    { accessorKey: 'stok', header: 'Stok', meta: { headerClass: 'w-24 text-right', cellClass: 'text-right tabular-nums' } },
    {
        accessorKey: 'harga', header: 'Harga', meta: { headerClass: 'text-right w-32', cellClass: 'text-right tabular-nums' },
        cell: info => 'Rp ' + Number(info.getValue()).toLocaleString('id-ID'),
    },
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
    fetchFn: params => window.api.ipsrs.barang.list(params),
    pageSize: 10,
    defaultSortBy: 'kode_brng',
})

const emptyForm = () => ({ kode_brng: '', nama_brng: '', kode_sat: '', jenis: '', harga: '' })
const saving = ref(false)
const form = reactive(emptyForm())

async function siapkanFormBaru() {
    Object.assign(form, emptyForm())
    // Fitur baru atas permintaan user (bukan dari Java asli — di Java kode
    // barang IPSRS diketik manual, lihat catatan header IpsrsBarangService.js)
    // — tetap bisa ditimpa manual, cuma nilai awal yang disarankan.
    form.kode_brng = await window.api.ipsrs.barang.nextKode()
}

async function simpan() {
    saving.value = true
    try {
        const res = await window.api.ipsrs.barang.create(authStore.token, { ...form })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Barang berhasil disimpan.')
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
    editOldKode.value = row.kode_brng
    Object.assign(editForm, {
        kode_brng: row.kode_brng, nama_brng: row.nama_brng, kode_sat: row.kode_sat, jenis: row.jenis, harga: row.harga,
    })
    modalEdit.value?.showModal()
}

async function update() {
    updating.value = true
    try {
        const res = await window.api.ipsrs.barang.update(authStore.token, editOldKode.value, { ...editForm })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Barang berhasil diupdate.')
        modalEdit.value?.close()
        fetchData()
    } finally {
        updating.value = false
    }
}

async function hapus(row) {
    if (!confirm(`Hapus barang "${row.nama_brng}"? (bisa dipulihkan lewat Data Sampah)`)) return
    const res = await window.api.ipsrs.barang.delete(authStore.token, row.kode_brng)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Barang berhasil dihapus.')
    fetchData()
}

// ── Data Sampah (Administrator only) ────────────────────────────────────
const sampahLoading = ref(false)
const sampahData = ref([])
async function muatSampah() {
    sampahLoading.value = true
    try {
        const res = await window.api.ipsrs.barang.listSampah(authStore.token, { pageSize: 100 })
        sampahData.value = res.data
    } finally {
        sampahLoading.value = false
    }
}

async function restore(row) {
    if (!confirm(`Pulihkan barang "${row.nama_brng}"?`)) return
    const res = await window.api.ipsrs.barang.restore(authStore.token, row.kode_brng)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Barang berhasil dipulihkan.')
    muatSampah()
    fetchData()
}

// Replika BtnHapus di DlgRestoreIPSRSBarang.java — HAPUS PERMANEN (DELETE
// beneran, bukan soft-delete lagi), TIDAK BISA dibatalkan.
async function hapusPermanen(row) {
    if (!confirm(`HAPUS PERMANEN barang "${row.nama_brng}"?\n\nIni TIDAK BISA dibatalkan — data tidak akan bisa dipulihkan lagi.`)) return
    const res = await window.api.ipsrs.barang.hardDelete(authStore.token, row.kode_brng)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Barang berhasil dihapus permanen.')
    muatSampah()
}

function onTabChange(tab) {
    activeTab.value = tab
    if (tab === 'sampah') muatSampah()
}

onMounted(async () => {
    await muatOpsi()
    await siapkanFormBaru()
})
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="flex bg-base-200 rounded-xl p-1 w-fit mb-2 shrink-0 gap-0.5">
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'tambah' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="onTabChange('tambah')">
                <Plus class="size-4" />
                Tambah Barang
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="onTabChange('list')">
                <List class="size-4" />
                Daftar Barang
                <span :class="['badge badge-xs p-2 pb-1.5 mb-0.5', activeTab === 'list' ? 'badge-primary' : 'badge-neutral']">
                    {{ table.getRowCount() }}
                </span>
            </button>
            <button v-if="isAdmin"
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'sampah' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="onTabChange('sampah')">
                <Trash2 class="size-4" />
                Data Sampah
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
                                    <div :class="['flex items-center gap-1', header.column.columnDef.meta?.headerClass?.includes('text-right') ? 'justify-end' : '']">
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
                                            <Package class="size-7 text-base-content/30" />
                                        </div>
                                        <p class="font-semibold text-base-content/60">Belum ada barang</p>
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
                    <h3 class="font-semibold text-base-content">Informasi Barang</h3>
                </div>
                <div class="p-5">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kode <span class="text-error">*</span></label>
                            <input v-model="form.kode_brng" type="text" maxlength="20" class="input input-bordered input-sm w-full" />
                        </div>
                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Nama Barang <span class="text-error">*</span></label>
                            <input v-model="form.nama_brng" type="text" maxlength="150" class="input input-bordered input-sm w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Satuan <span class="text-error">*</span></label>
                            <AppSelect v-model="form.kode_sat" :options="opsiSatuan" value-prop="kode_sat" label="satuan" placeholder="Pilih Satuan" />
                        </div>
                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Jenis Barang <span class="text-error">*</span></label>
                            <AppSelect v-model="form.jenis" :options="opsiJenis" value-prop="kd_jenis" label="nm_jenis" placeholder="Pilih Jenis" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Harga <span class="text-error">*</span></label>
                            <input v-model="form.harga" type="number" min="0" class="input input-bordered input-sm w-full" @keyup.enter="simpan" />
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

        <!-- Tab: Data Sampah -->
        <div v-if="isAdmin" v-show="activeTab === 'sampah'" class="flex-1 min-h-0 overflow-hidden">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm h-full flex flex-col overflow-hidden px-4 py-3">
                <p class="text-sm text-base-content/60 mb-2 shrink-0">Barang yang sudah dihapus — cuma Administrator yang bisa lihat & pulihkan.</p>
                <div class="flex-1 min-h-0 overflow-y-auto">
                    <table class="table">
                        <thead class="sticky top-0 z-10 bg-base-100">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th class="text-sm font-medium py-2">Kode</th>
                                <th class="text-sm font-medium py-2">Nama Barang</th>
                                <th class="text-sm font-medium py-2 text-center w-56">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="sampahLoading"><td colspan="3" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                            <tr v-else-if="sampahData.length === 0"><td colspan="3" class="py-16 text-center text-base-content/50">Data sampah kosong</td></tr>
                            <tr v-else v-for="row in sampahData" :key="row.kode_brng" class="border-b border-base-200 hover:bg-primary/5">
                                <td class="py-2 font-medium">{{ row.kode_brng }}</td>
                                <td class="py-2">{{ row.nama_brng }}</td>
                                <td class="py-2 text-center">
                                    <button class="btn btn-ghost btn-sm text-success" @click="restore(row)">Pulihkan</button>
                                    <button class="btn btn-ghost btn-sm text-error" @click="hapusPermanen(row)">Hapus Permanen</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <dialog ref="modalEdit" class="modal">
        <div class="modal-box max-w-2xl">
            <h3 class="font-bold text-base mb-4">Edit Barang</h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Kode</label>
                    <input v-model="editForm.kode_brng" type="text" maxlength="20" class="input input-bordered input-sm w-full" />
                </div>
                <div class="sm:col-span-2">
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Nama Barang</label>
                    <input v-model="editForm.nama_brng" type="text" maxlength="150" class="input input-bordered input-sm w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Satuan</label>
                    <AppSelect v-model="editForm.kode_sat" :options="opsiSatuan" value-prop="kode_sat" label="satuan" placeholder="Pilih Satuan" />
                </div>
                <div class="sm:col-span-2">
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Jenis Barang</label>
                    <AppSelect v-model="editForm.jenis" :options="opsiJenis" value-prop="kd_jenis" label="nm_jenis" placeholder="Pilih Jenis" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Harga</label>
                    <input v-model="editForm.harga" type="number" min="0" class="input input-bordered input-sm w-full" />
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
