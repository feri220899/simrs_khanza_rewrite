<script setup>
import { ref, reactive, computed, h, onMounted, watch } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, ClipboardList, Trash2 } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'

// Permintaan Barang Non Medis — src/ipsrs/IPSRSPermintaan.java (buat) &
// src/ipsrs/IPSRSCariPermintaan.java (list+approve+hapus). TIDAK ADA efek
// stok/jurnal SAMA SEKALI (murni proposal permintaan ruangan).
//
// Petugas (nip) di Java asli DIPAKSA = pegawai yang sedang login
// (`akses.getkode()`, tombol cari petugas DI-DISABLE) — BEDA dari kasus
// Perpustakaan Sirkulasi (yang harus EKSPLISIT dipilih lewat DlgCariPetugas).
// Di sini replikasi persis: nip = username sesi (dikonfirmasi `user.id_user`
// == `pegawai.nik` di skema asli), field readonly, BUKAN dropdown pilihan.
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehBuat = () => authStore.can('permintaan_non_medis')
// Replika DlgCariPermintaan.isCek(): ppDisetujui/ppTidakDisetujui gate slug
// `ipsrs_stok_keluar` (modul Pengeluaran yg dibuka Java asli sesudahnya),
// BUKAN slug modul ini sendiri. ppHapus gate ROLE "Admin Utama" PERSIS.
const bolehSetujui = () => authStore.can('ipsrs_stok_keluar')
const isAdminUtama = authStore.user?.role === 'Admin Utama'

const activeTab = ref('buat')

// ── Tab: Buat Permintaan ──────────────────────────────────────────────────
const header = reactive({ no_permintaan: '', ruang: '', tanggal: new Date().toISOString().slice(0, 10) })
const items = ref([]) // [{kode_brng, nama_brng, kode_sat, nama_satuan, jumlah, keterangan}]
const opsiBarang = ref([])
const saving = ref(false)

async function muatOpsiBarang() {
    opsiBarang.value = await window.api.ipsrs.barang.listAktif()
}

async function siapkanNomor() {
    header.no_permintaan = await window.api.ipsrs.permintaan.nextNomor(header.tanggal)
}
watch(() => header.tanggal, siapkanNomor)

function tambahBaris() {
    items.value.push({ kode_brng: '', jumlah: '', keterangan: '' })
}
function hapusBaris(i) {
    items.value.splice(i, 1)
}
function pilihBarang(i, kodeBrng) {
    const b = opsiBarang.value.find(x => x.kode_brng === kodeBrng)
    if (!b) return
    items.value[i].kode_brng = b.kode_brng
    items.value[i].kode_sat = b.kode_sat
    items.value[i].nama_satuan = b.nama_satuan
}

async function simpan() {
    if (!header.ruang.trim()) { showToast('Ruangan tidak boleh kosong', 'error'); return }
    const terisi = items.value.filter(it => it.kode_brng && Number(it.jumlah) > 0)
    if (terisi.length === 0) { showToast('Maaf, Silahkan masukkan permintaan', 'error'); return }

    saving.value = true
    try {
        const res = await window.api.ipsrs.permintaan.create(authStore.token, {
            no_permintaan: header.no_permintaan,
            ruang: header.ruang,
            nip: authStore.user.username,
            tanggal: header.tanggal,
            items: terisi,
        })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Permintaan berhasil disimpan.')
        header.ruang = ''
        items.value = []
        await siapkanNomor()
        fetchData()
    } finally {
        saving.value = false
    }
}

// ── Tab: Daftar Permintaan ────────────────────────────────────────────────
const statusFilter = ref('')
const columns = [
    { accessorKey: 'no_permintaan', header: 'No. Permintaan', meta: { headerClass: 'w-40', cellClass: 'font-medium' } },
    { accessorKey: 'ruang', header: 'Ruangan', enableSorting: false },
    { accessorKey: 'nama_petugas', header: 'Petugas', enableSorting: false },
    { accessorKey: 'tanggal', header: 'Tanggal', meta: { headerClass: 'w-28' } },
    {
        accessorKey: 'status', header: 'Status', meta: { headerClass: 'w-32' },
        cell: info => {
            const s = info.getValue()
            const cls = s === 'Disetujui' ? 'badge-success' : s === 'Tidak Disetujui' ? 'badge-error' : 'badge-warning'
            return h('span', { class: `badge badge-sm ${cls}` }, s)
        },
    },
    {
        id: 'aksi', header: 'Aksi', enableSorting: false,
        meta: { headerClass: 'text-center w-56', cellClass: 'text-center' },
        cell: info => {
            const row = info.row.original
            const btns = []
            if (row.status === 'Baru') {
                btns.push(h('button', { class: 'btn btn-ghost btn-sm text-success', disabled: !bolehSetujui(), onClick: () => ubahStatus(row, 'Disetujui') }, 'Setujui'))
                btns.push(h('button', { class: 'btn btn-ghost btn-sm text-error', disabled: !bolehSetujui(), onClick: () => ubahStatus(row, 'Tidak Disetujui') }, 'Tolak'))
            }
            if (isAdminUtama) btns.push(h('button', { class: 'btn btn-ghost btn-sm', onClick: () => hapus(row) }, 'Hapus'))
            return h('div', { class: 'flex gap-1 justify-center' }, btns)
        },
    },
]

const { table, loading, search, fetchData } = useServerTable({
    columns,
    fetchFn: params => window.api.ipsrs.permintaan.list({ ...params, status: statusFilter.value }),
    pageSize: 10,
    defaultSortBy: 'tanggal',
    defaultSortOrder: 'desc',
})
watch(statusFilter, fetchData)

async function ubahStatus(row, status) {
    if (!confirm(`${status === 'Disetujui' ? 'Setujui' : 'Tolak'} permintaan "${row.no_permintaan}"?`)) return
    const res = await window.api.ipsrs.permintaan.setStatus(authStore.token, row.no_permintaan, status)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast(`Permintaan berhasil di${status === 'Disetujui' ? 'setujui' : 'tolak'}.`)
    fetchData()
}

async function hapus(row) {
    if (!confirm(`Hapus permintaan "${row.no_permintaan}"? Ini TIDAK BISA dibatalkan.`)) return
    const res = await window.api.ipsrs.permintaan.delete(authStore.token, row.no_permintaan)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Permintaan berhasil dihapus.')
    fetchData()
}

onMounted(async () => {
    await muatOpsiBarang()
    await siapkanNomor()
})
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="mb-2 shrink-0">
            <h1 class="text-2xl font-bold tracking-tight">IPSRS — Permintaan Barang Non Medis</h1>
            <p class="text-sm text-base-content/60 mt-0.5">Permintaan ruangan, tanpa efek stok/jurnal (src/ipsrs/IPSRSPermintaan.java, IPSRSCariPermintaan.java)</p>
        </div>

        <div class="flex bg-base-200 rounded-xl p-1 w-fit mb-2 shrink-0 gap-0.5">
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'buat' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'buat'">
                <Plus class="size-4" />
                Buat Permintaan
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'list'">
                <List class="size-4" />
                Daftar Permintaan
            </button>
        </div>

        <!-- Tab: Buat -->
        <div v-show="activeTab === 'buat'" class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
                <div class="px-5 py-3.5 border-b border-base-200 grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">No. Permintaan</label>
                        <input :value="header.no_permintaan" type="text" readonly class="input input-bordered input-sm w-full bg-base-200" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Tanggal</label>
                        <input v-model="header.tanggal" type="date" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Ruangan <span class="text-error">*</span></label>
                        <input v-model="header.ruang" type="text" class="input input-bordered input-sm w-full" placeholder="Contoh: IGD" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Petugas</label>
                        <input :value="authStore.user?.username" type="text" readonly class="input input-bordered input-sm w-full bg-base-200" />
                    </div>
                </div>

                <div class="px-5 py-2 border-b border-base-200 shrink-0">
                    <button class="btn btn-ghost btn-sm gap-1" @click="tambahBaris">
                        <Plus class="size-4" />
                        Tambah Baris
                    </button>
                </div>

                <div class="flex-1 min-h-0 overflow-y-auto">
                    <table class="table">
                        <thead class="sticky top-0 z-10 bg-base-100">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th class="text-sm font-medium py-2 w-80">Barang</th>
                                <th class="text-sm font-medium py-2 w-20">Satuan</th>
                                <th class="text-sm font-medium py-2 w-28 text-right">Jumlah</th>
                                <th class="text-sm font-medium py-2">Keterangan</th>
                                <th class="text-sm font-medium py-2 w-16 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="items.length === 0"><td colspan="5" class="py-16 text-center text-base-content/50">Belum ada baris, klik "Tambah Baris"</td></tr>
                            <tr v-else v-for="(it, i) in items" :key="i" class="border-b border-base-200">
                                <td class="py-1.5">
                                    <AppSelect :model-value="it.kode_brng" @update:model-value="v => pilihBarang(i, v)"
                                        :options="opsiBarang" value-prop="kode_brng" label="nama_brng" placeholder="Pilih Barang" />
                                </td>
                                <td class="py-1.5">{{ it.nama_satuan || '-' }}</td>
                                <td class="py-1.5">
                                    <input v-model="it.jumlah" type="number" min="0" class="input input-bordered input-sm w-full text-right" />
                                </td>
                                <td class="py-1.5">
                                    <input v-model="it.keterangan" type="text" class="input input-bordered input-sm w-full" />
                                </td>
                                <td class="py-1.5 text-center">
                                    <button class="btn btn-ghost btn-sm text-error" @click="hapusBaris(i)">
                                        <Trash2 class="size-4" />
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="px-5 py-3 border-t border-base-200 shrink-0 flex items-center justify-between">
                    <p v-if="!bolehBuat()" class="text-warning text-sm">Anda tidak punya akses membuat permintaan.</p>
                    <span v-else></span>
                    <button class="btn btn-primary gap-2" :disabled="saving || !bolehBuat()" @click="simpan">
                        <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                        Simpan
                    </button>
                </div>
            </div>
        </div>

        <!-- Tab: Daftar -->
        <div v-show="activeTab === 'list'" class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div class="flex gap-2 mb-2 shrink-0">
                <button v-for="s in [{v:'',l:'Semua'},{v:'Baru',l:'Baru'},{v:'Disetujui',l:'Disetujui'},{v:'Tidak Disetujui',l:'Tidak Disetujui'}]" :key="s.v"
                    class="btn btn-sm" :class="statusFilter === s.v ? 'btn-primary' : 'btn-ghost'" @click="statusFilter = s.v">
                    {{ s.l }}
                </button>
            </div>
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden px-4 py-3">
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
                            <tr v-if="loading"><td colspan="6" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="6" class="py-16 text-center">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
                                            <ClipboardList class="size-7 text-base-content/30" />
                                        </div>
                                        <p class="font-semibold text-base-content/60">Belum ada permintaan</p>
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
    </div>
</template>
