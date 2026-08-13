<script setup>
import { ref, reactive, computed, h, onMounted, watch } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, ClipboardList, Trash2, Printer } from 'lucide-vue-next'
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
    items.value[ i ].kode_brng = b.kode_brng
    items.value[ i ].kode_sat = b.kode_sat
    items.value[ i ].nama_satuan = b.nama_satuan
}

async function simpan() {
    if (!header.ruang.trim()) { showToast('Ruangan tidak boleh kosong', 'error'); return }
    const terisi = items.value
        .filter(it => it.kode_brng && Number(it.jumlah) > 0)
        .map(it => ({ kode_brng: it.kode_brng, kode_sat: it.kode_sat, jumlah: Number(it.jumlah), keterangan: it.keterangan || '' }))
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

// Tab: Daftar Permintaan
const statusFilter = ref('')
const selectedNoPermintaan = ref(null)
const detailItems = ref([])
const loadingDetail = ref(false)

async function toggleDetail(noPermintaan) {
    if (selectedNoPermintaan.value === noPermintaan) {
        selectedNoPermintaan.value = null
        detailItems.value = []
        return
    }
    selectedNoPermintaan.value = noPermintaan
    loadingDetail.value = true
    try {
        detailItems.value = await window.api.ipsrs.permintaan.detail(noPermintaan)
    } catch (e) {
        showToast('Gagal memuat detail', 'error')
    } finally {
        loadingDetail.value = false
    }
}

const columns = [
    { accessorKey: 'no_permintaan', header: 'No. Permintaan', meta: { headerClass: 'w-40', cellClass: 'font-medium' } },
    { accessorKey: 'ruang', header: 'Ruangan', enableSorting: false },
    { accessorKey: 'nama_petugas', header: 'Petugas', enableSorting: false },
    { accessorKey: 'tanggal', header: 'Tanggal', meta: { headerClass: 'w-28' } },
    {
        accessorKey: 'status', header: 'Status', meta: { headerClass: 'w-40', cellClass: 'whitespace-nowrap' },
        cell: info => {
            const s = info.getValue()
            const cls = s === 'Disetujui' ? 'badge-success' : s === 'Tidak Disetujui' ? 'badge-error' : 'badge-warning'
            return h('span', { class: `badge badge-sm ${cls} whitespace-nowrap min-w-max` }, s)
        },
    },
    {
        id: 'aksi', header: 'Aksi', enableSorting: false,
        meta: { headerClass: 'text-center w-56', cellClass: 'text-center' },
        cell: info => {
            const row = info.row.original
            const btns = []
            if (row.status === 'Baru') {
                btns.push(h('button', { class: 'btn btn-ghost btn-sm text-success', disabled: !bolehSetujui(), onClick: event => { event.stopPropagation(); ubahStatus(row, 'Disetujui') } }, 'Setujui'))
                btns.push(h('button', { class: 'btn btn-ghost btn-sm text-error', disabled: !bolehSetujui(), onClick: event => { event.stopPropagation(); ubahStatus(row, 'Tidak Disetujui') } }, 'Tolak'))
            }
            if (isAdminUtama) btns.push(h('button', { class: 'btn btn-ghost btn-sm', onClick: event => { event.stopPropagation(); hapus(row) } }, 'Hapus'))
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

function cetakDaftar() {
    const data = table.getRowModel().rows.map(r => r.original)
    if (data.length === 0) { showToast('Tidak ada data untuk dicetak', 'error'); return }
    const w = window.open('', '_blank', 'width=1000,height=700')
    if (!w) return
    const rows = data.map(r => `<tr><td>${r.no_permintaan}</td><td>${r.ruang}</td><td>${r.nama_petugas||'-'}</td><td>${r.tanggal}</td><td>${r.status}</td></tr>`).join('')
    w.document.write(`<html><head><title>Daftar Permintaan IPSRS</title><style>body{font:12px Arial;margin:20px}h2{text-align:center}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f0f0f0}</style></head><body><h2>Daftar Permintaan Barang Non Medis</h2><table><thead><tr><th>No. Permintaan</th><th>Ruangan</th><th>Petugas</th><th>Tanggal</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`)
    w.document.close()
    w.focus()
    w.print()
    w.close()
}

function cetakPermintaan(row) {
    if (!detailItems.value.length) { showToast('Detail belum dimuat', 'warning'); return }
    const w = window.open('', '_blank', 'width=800,height=600')
    if (!w) return
    const rows = detailItems.value.map(it => `<tr><td>${it.nama_brng}</td><td class="text-center">${it.nama_satuan}</td><td class="text-center">${it.jumlah}</td><td>${it.keterangan || ''}</td></tr>`).join('')
    w.document.write(`<html><head><title>Cetak Permintaan</title><style>body{font:12px Arial;margin:20px}h2{text-align:center;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #000;padding:6px}th{background:#eee}.text-center{text-align:center}.info{margin-bottom:15px;line-height:1.6}.info span{display:inline-block;width:120px;font-weight:bold}</style></head><body><h2>PERMINTAAN BARANG NON MEDIS</h2><div class="info"><div><span>No. Permintaan</span>: ${row.no_permintaan}</div><div><span>Ruangan</span>: ${row.ruang}</div><div><span>Tanggal</span>: ${row.tanggal}</div><div><span>Petugas</span>: ${row.nama_petugas}</div><div><span>Status</span>: ${row.status}</div></div><table><thead><tr><th>Barang</th><th class="text-center">Satuan</th><th class="text-center">Jumlah</th><th>Keterangan</th></tr></thead><tbody>${rows}</tbody></table></body></html>`)
    w.document.close()
    w.focus()
    w.print()
    w.close()
}

onMounted(async () => {
    await muatOpsiBarang()
    await siapkanNomor()
})
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="mb-2 shrink-0">
            <h1 class="text-xl font-semibold tracking-tight">IPSRS — Permintaan Barang Non Medis</h1>
            <p class="text-xs text-base-content/60 mt-0.5">Permintaan ruangan, tanpa efek stok/jurnal</p>
        </div>

        <div class="flex justify-between items-center mb-2 shrink-0">
            <div class="flex bg-base-200 rounded-xl p-1 w-fit gap-0.5">
                <button
                    :class="[ 'px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5 cursor-pointer',
                        activeTab === 'buat' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content' ]"
                    @click="activeTab = 'buat'">
                    <Plus class="size-3.5" />
                    Buat Permintaan
                </button>
                <button
                    :class="[ 'px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5 cursor-pointer',
                        activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content' ]"
                    @click="activeTab = 'list'">
                    <List class="size-3.5" />
                    Daftar Permintaan
                </button>
            </div>
            <button v-show="activeTab === 'list'" class="btn btn-ghost btn-xs text-primary gap-1 cursor-pointer" @click="cetakDaftar">
                <Printer class="size-3.5" />
                Cetak Daftar
            </button>
        </div>

        <!-- Tab: Buat -->
        <div v-show="activeTab === 'buat'" class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div
                class="bg-base-100 rounded-2xl border border-base-200 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
                <div class="px-5 py-3.5 border-b border-base-200 grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">No. Permintaan</label>
                        <input :value="header.no_permintaan" type="text" readonly
                            class="input input-bordered input-sm w-full bg-base-200" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Tanggal</label>
                        <input v-model="header.tanggal" type="date" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Ruangan <span
                                class="text-error">*</span></label>
                        <input v-model="header.ruang" type="text" class="input input-bordered input-sm w-full"
                            placeholder="Contoh: IGD" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Petugas</label>
                        <input :value="authStore.user?.username" type="text" readonly
                            class="input input-bordered input-sm w-full bg-base-200" />
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
                            <tr v-if="items.length === 0">
                                <td colspan="5" class="py-16 text-center text-base-content/50">Belum ada baris, klik
                                    "Tambah Baris"</td>
                            </tr>
                            <tr v-else v-for="(it, i) in items" :key="i" class="border-b border-base-200">
                                <td class="py-1.5">
                                    <AppSelect :model-value="it.kode_brng" @update:model-value="v => pilihBarang(i, v)"
                                        :options="opsiBarang" value-prop="kode_brng" label="nama_brng"
                                        placeholder="Pilih Barang" />
                                </td>
                                <td class="py-1.5">{{ it.nama_satuan || '-' }}</td>
                                <td class="py-1.5">
                                    <input v-model="it.jumlah" type="number" min="0"
                                        class="input input-bordered input-sm w-full text-right" />
                                </td>
                                <td class="py-1.5">
                                    <input v-model="it.keterangan" type="text"
                                        class="input input-bordered input-sm w-full" />
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
                <button
                    v-for="s in [ { v: '', l: 'Semua' }, { v: 'Baru', l: 'Baru' }, { v: 'Disetujui', l: 'Disetujui' }, { v: 'Tidak Disetujui', l: 'Tidak Disetujui' } ]"
                    :key="s.v" class="btn btn-sm" :class="statusFilter === s.v ? 'btn-primary' : 'btn-ghost'"
                    @click="statusFilter = s.v">
                    {{ s.l }}
                </button>
            </div>
            <div
                class="bg-base-100 rounded-2xl border border-base-200 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden px-4 py-3">
                <AppPagination :table="table" v-model:search="search" class="flex-1 min-h-0">
                    <table class="table">
                        <thead class="sticky top-0 z-10">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th v-for="header in table.getFlatHeaders()" :key="header.id"
                                    :class="[ 'text-sm font-medium py-2', header.column.columnDef.meta?.headerClass,
                                        header.column.getCanSort() ? 'cursor-pointer select-none hover:text-primary transition-colors' : '' ]"
                                    @click="header.column.getToggleSortingHandler()?.($event)">
                                    <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                                    <span v-if="header.column.getIsSorted() === 'asc'" class="text-primary">↑</span>
                                    <span v-else-if="header.column.getIsSorted() === 'desc'"
                                        class="text-primary">↓</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading">
                                <td colspan="6" class="py-16 text-center"><span
                                        class="loading loading-spinner loading-md text-primary"></span></td>
                            </tr>
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
                            <template v-else v-for="row in table.getRowModel().rows" :key="row.id">
                                <tr :class="[ 'border-b border-base-200 cursor-pointer transition-colors', selectedNoPermintaan === row.original.no_permintaan ? 'bg-primary/10' : 'hover:bg-primary/5' ]"
                                    @click="toggleDetail(row.original.no_permintaan)">
                                    <td v-for="cell in row.getVisibleCells()" :key="cell.id"
                                        :class="[ 'py-2', cell.column.columnDef.meta?.cellClass ]">
                                        <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                                    </td>
                                </tr>
                                <tr v-if="selectedNoPermintaan === row.original.no_permintaan" class="bg-base-200/50">
                                    <td :colspan="table.getVisibleLeafColumns().length" class="p-4">
                                         <div class="rounded-sm border border-base-200 bg-base-100 shadow-sm overflow-hidden">
                                             <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-base-200 bg-base-200/40">
                                                 <div class="flex items-center gap-3">
                                                     <p class="text-xs font-semibold text-base-content/60 uppercase">Detail Item</p>
                                                 </div>
                                                 <button class="btn btn-ghost btn-xs text-primary" @click.stop="cetakPermintaan(row.original)" :disabled="loadingDetail || detailItems.length === 0">
                                                     <Printer class="size-3.5 mr-1" /> Cetak Detail
                                                 </button>
                                             </div>
                                             <div v-if="loadingDetail" class="py-10 text-center"><span
                                                    class="loading loading-spinner loading-md text-primary"></span>
                                            </div>
                                            <div v-else-if="detailItems.length === 0"
                                                class="py-10 text-center text-sm text-base-content/50">Tidak ada detail
                                                barang.</div>
                                            <div v-else class="overflow-x-auto">
                                                <table class="table table-sm">
                                                    <thead class="p-0">
                                                        <tr class="bg-base-200/40">
                                                            <th class="pl-4">Barang</th>
                                                            <th>Satuan</th>
                                                            <th class="text-right">Jumlah</th>
                                                            <th class="pr-4">Keterangan</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody class="p-0">
                                                        <tr v-for="item in detailItems" :key="item.kode_brng"
                                                            class="hover:bg-base-200/30">
                                                            <td class="pl-4">
                                                                <p class="font-medium">{{ item.nama_brng }}</p>
                                                                <p class="text-xs text-base-content/50">{{
                                                                    item.kode_brng }}</p>
                                                            </td>
                                                            <td><span class="badge badge-ghost badge-sm">{{
                                                                    item.nama_satuan }}</span></td>
                                                            <td class="text-right font-semibold tabular-nums">{{
                                                                Number(item.jumlah).toLocaleString('id-ID') }}</td>
                                                            <td class="pr-4 text-base-content/70">{{ item.keterangan ||
                                                                '—' }}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </AppPagination>
            </div>
        </div>
    </div>
</template>
