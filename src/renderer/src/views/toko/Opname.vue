<script setup>
import { ref, reactive, h, onMounted } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, ClipboardCheck } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'

// src/toko/TokoInputStok.java (input) + TokoStokOpname.java (viewer/hapus).
// TIDAK menyentuh jurnal Keuangan — aman dibangun sekarang. Efek "Opname" =
// OVERWRITE stok (bukan tambah/kurang), lihat TokoOpnameService.js.
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can('stok_opname_toko')

const activeTab = ref('list')
const opsiBarang = ref([])
async function muatOpsi() {
    opsiBarang.value = (await window.api.toko.barang.list({ pageSize: 1000 })).data
}

const columns = [
    { accessorKey: 'tanggal', header: 'Tanggal', meta: { headerClass: 'w-28' } },
    { accessorKey: 'nama_brng', header: 'Barang' },
    { accessorKey: 'stok', header: 'Stok Sistem', meta: { headerClass: 'w-28 text-right', cellClass: 'text-right tabular-nums' } },
    { accessorKey: 'real', header: 'Stok Real', meta: { headerClass: 'w-28 text-right', cellClass: 'text-right tabular-nums' } },
    {
        accessorKey: 'selisih', header: 'Selisih', meta: { headerClass: 'w-24 text-right', cellClass: 'text-right tabular-nums' },
        cell: info => h('span', { class: Number(info.getValue()) < 0 ? 'text-error' : Number(info.getValue()) > 0 ? 'text-success' : '' }, info.getValue()),
    },
    { accessorKey: 'keterangan', header: 'Keterangan', enableSorting: false },
    {
        id: 'aksi', header: 'Aksi', enableSorting: false,
        meta: { headerClass: 'text-center w-24', cellClass: 'text-center' },
        cell: info => h('button', { class: 'btn btn-ghost btn-sm text-error', onClick: () => hapus(info.row.original) }, 'Hapus'),
    },
]

const { table, loading, search, fetchData } = useServerTable({
    columns,
    fetchFn: params => window.api.toko.opname.list(params),
    pageSize: 10,
    defaultSortBy: 'tanggal',
    defaultSortOrder: 'desc',
})

const emptyForm = () => ({ kode_brng: '', tanggal: new Date().toISOString().slice(0, 10), real: '', nomihilang: '', keterangan: '' })
const saving = ref(false)
const form = reactive(emptyForm())
const barangTerpilih = ref(null)

function onBarangChange() {
    barangTerpilih.value = opsiBarang.value.find(b => b.kode_brng === form.kode_brng) || null
}

async function simpan() {
    saving.value = true
    try {
        const res = await window.api.toko.opname.create(authStore.token, { ...form })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Stok opname berhasil disimpan.')
        Object.assign(form, emptyForm())
        barangTerpilih.value = null
        await muatOpsi() // refresh stok terbaru
        fetchData()
        activeTab.value = 'list'
    } finally {
        saving.value = false
    }
}

async function hapus(row) {
    if (!confirm(`Hapus riwayat opname "${row.nama_brng}" tgl ${row.tanggal}? (stok TIDAK dikembalikan, sesuai perilaku asli)`)) return
    const res = await window.api.toko.opname.delete(authStore.token, { tanggal: row.tanggal, kode_brng: row.kode_brng })
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Riwayat opname berhasil dihapus.')
    fetchData()
}

onMounted(muatOpsi)
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="flex items-center justify-between mb-4 shrink-0">
            <div>
                <h1 class="text-2xl font-bold tracking-tight">Toko — Stok Opname</h1>
                <p class="text-sm text-base-content/60 mt-0.5">Input & riwayat hitung fisik stok (src/toko/TokoInputStok.java, TokoStokOpname.java)</p>
            </div>
        </div>

        <div class="flex bg-base-200 rounded-xl p-1 w-fit mb-2 shrink-0 gap-0.5">
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2',
                    activeTab === 'tambah' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'tambah'">
                <Plus class="size-4" />
                Input Opname
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2',
                    activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'list'">
                <List class="size-4" />
                Riwayat Opname
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
                                    :class="['text-sm font-medium py-2', header.column.columnDef.meta?.headerClass]">
                                    <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading"><td colspan="7" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="7" class="py-16 text-center">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
                                            <ClipboardCheck class="size-7 text-base-content/30" />
                                        </div>
                                        <p class="font-semibold text-base-content/60">Belum ada riwayat opname</p>
                                    </div>
                                </td>
                            </tr>
                            <tr v-else v-for="row in table.getRowModel().rows" :key="row.id" class="border-b border-base-200 hover:bg-primary/5">
                                <td v-for="cell in row.getVisibleCells()" :key="cell.id" :class="['py-2', cell.column.columnDef.meta?.cellClass]">
                                    <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </AppPagination>
            </div>
        </div>

        <div v-show="activeTab === 'tambah'" class="flex-1 overflow-y-auto pb-6">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden max-w-2xl">
                <div class="px-5 py-3.5 border-b border-base-200 flex items-center gap-3">
                    <div class="w-1 h-5 bg-primary rounded-full"></div>
                    <h3 class="font-semibold text-base-content">Input Stok Opname</h3>
                </div>
                <div class="p-5">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Barang <span class="text-error">*</span></label>
                            <AppSelect v-model="form.kode_brng" :options="opsiBarang" value-prop="kode_brng" label="nama_brng" placeholder="Pilih Barang" @change="onBarangChange" />
                        </div>
                        <div v-if="barangTerpilih" class="sm:col-span-2 text-sm text-base-content/60 -mt-2">
                            Stok sistem saat ini: <b>{{ barangTerpilih.stok }}</b> {{ barangTerpilih.kode_sat }}
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal</label>
                            <input v-model="form.tanggal" type="date" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Stok Real (hasil hitung fisik) <span class="text-error">*</span></label>
                            <input v-model="form.real" type="number" min="0" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Nomi Hilang</label>
                            <input v-model="form.nomihilang" type="text" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Keterangan <span class="text-error">*</span></label>
                            <input v-model="form.keterangan" type="text" class="input input-bordered w-full" @keyup.enter="simpan" />
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
</template>
