<script setup>
import { ref, reactive, h, onMounted } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'

// Tab "Denda Keterlambatan" — src/perpustakaan/PerpustakaanBayarDenda.java
// (tab 0). besar_denda dihitung SERVER-SIDE (keterlambatan x denda_perhari
// terkini dari Pengaturan Peminjaman), bukan diinput manual.
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can('bayar_denda_perpustakaan')

const activeTab = ref('list')
const opsiAnggota = ref([])
const opsiInventaris = ref([])

async function muatOpsi() {
    const [a, i] = await Promise.all([
        window.api.perpustakaan.anggota.list({ pageSize: 1000 }),
        window.api.perpustakaan.inventaris.list({ pageSize: 1000 }),
    ])
    opsiAnggota.value = a.data
    opsiInventaris.value = i.data
}

const columns = [
    { accessorKey: 'tgl_denda', header: 'Tanggal', meta: { headerClass: 'w-28' } },
    { accessorKey: 'nama_anggota', header: 'Peminjam' },
    { accessorKey: 'judul_buku', header: 'Buku' },
    { accessorKey: 'keterlambatan', header: 'Telat (hari)', meta: { headerClass: 'w-28 text-center', cellClass: 'text-center' } },
    {
        accessorKey: 'besar_denda', header: 'Denda', meta: { headerClass: 'text-right w-32', cellClass: 'text-right tabular-nums' },
        cell: info => 'Rp ' + Number(info.getValue()).toLocaleString('id-ID'),
    },
    {
        id: 'aksi', header: 'Aksi', enableSorting: false,
        meta: { headerClass: 'text-center w-24', cellClass: 'text-center' },
        cell: info => h('button', { class: 'btn btn-ghost btn-sm text-error', onClick: () => hapus(info.row.original) }, 'Hapus'),
    },
]

const { table, loading, search, fetchData } = useServerTable({
    columns,
    fetchFn: params => window.api.perpustakaan.bayarDenda.listHarian(params),
    pageSize: 10,
    defaultSortBy: 'tgl_denda',
    defaultSortOrder: 'desc',
})

const emptyForm = () => ({ tgl_denda: new Date().toISOString().slice(0, 10), no_anggota: '', no_inventaris: '', keterlambatan: '' })
const saving = ref(false)
const form = reactive(emptyForm())

async function simpan() {
    saving.value = true
    try {
        const res = await window.api.perpustakaan.bayarDenda.createHarian(authStore.token, { ...form })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(`Denda keterlambatan berhasil dicatat (Rp ${Number(res.besarDenda).toLocaleString('id-ID')}).`)
        Object.assign(form, emptyForm())
        fetchData()
        activeTab.value = 'list'
    } finally {
        saving.value = false
    }
}

async function hapus(row) {
    if (!confirm(`Hapus catatan denda "${row.judul_buku}"?`)) return
    const res = await window.api.perpustakaan.bayarDenda.deleteHarian(authStore.token, {
        tgl_denda: row.tgl_denda, no_anggota: row.no_anggota, no_inventaris: row.no_inventaris,
    })
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Catatan denda berhasil dihapus.')
    fetchData()
}

onMounted(muatOpsi)
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="flex bg-base-200 rounded-xl p-1 w-fit mb-2 shrink-0 gap-0.5">
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2',
                    activeTab === 'tambah' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'tambah'">
                <Plus class="size-4" />
                Catat Denda
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2',
                    activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'list'">
                <List class="size-4" />
                Daftar
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
                                <th v-for="header in table.getFlatHeaders()" :key="header.id" :class="['text-sm font-medium py-2', header.column.columnDef.meta?.headerClass]">
                                    <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading"><td colspan="6" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0"><td colspan="6" class="py-16 text-center text-base-content/50">Belum ada catatan denda keterlambatan</td></tr>
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
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden">
                <div class="px-5 py-3.5 border-b border-base-200 flex items-center gap-3">
                    <div class="w-1 h-5 bg-primary rounded-full"></div>
                    <h3 class="font-semibold text-base-content">Catat Denda Keterlambatan</h3>
                </div>
                <div class="p-5">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal</label>
                            <input v-model="form.tgl_denda" type="date" class="input input-bordered w-full" />
                        </div>
                        <div></div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Peminjam <span class="text-error">*</span></label>
                            <select v-model="form.no_anggota" class="select select-bordered w-full">
                                <option value="" disabled>Pilih Anggota</option>
                                <option v-for="o in opsiAnggota" :key="o.no_anggota" :value="o.no_anggota">{{ o.nama_anggota }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Buku <span class="text-error">*</span></label>
                            <select v-model="form.no_inventaris" class="select select-bordered w-full">
                                <option value="" disabled>Pilih Buku</option>
                                <option v-for="o in opsiInventaris" :key="o.no_inventaris" :value="o.no_inventaris">{{ o.judul_buku }} ({{ o.no_inventaris }})</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Keterlambatan (hari) <span class="text-error">*</span></label>
                            <input v-model="form.keterlambatan" type="number" min="1" class="input input-bordered w-full" @keyup.enter="simpan" />
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
