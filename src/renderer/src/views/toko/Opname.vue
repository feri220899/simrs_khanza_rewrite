<script setup>
import { ref, reactive, computed, h, onMounted } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, ClipboardCheck, Eraser } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'

// src/toko/TokoInputStok.java (input) + TokoStokOpname.java (viewer/hapus).
// TIDAK menyentuh jurnal Keuangan — aman dibangun sekarang.
//
// KOREKSI (hasil audit): alur asli itu BATCH — SEMUA barang aktif tampil
// sekaligus, user isi kolom "Real" utk banyak baris, SATU tombol Simpan
// proses SEMUA baris terisi dalam SATU transaksi (dialog konfirmasi dulu),
// bukan 1 barang per submit. `Selisih`/`Nomi Hilang` DIHITUNG OTOMATIS
// (kurang = stok - real, cuma dicatat kalau KEKURANGAN — real>=stok berarti
// selisih=0), bukan diinput manual — lihat TokoOpnameService.js.
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can('stok_opname_toko')

const activeTab = ref('list')

// ── Tab: Riwayat Opname (viewer, sudah benar sebelumnya) ─────────────────
const columns = [
    { accessorKey: 'tanggal', header: 'Tanggal', meta: { headerClass: 'w-28' } },
    { accessorKey: 'nama_brng', header: 'Barang' },
    { accessorKey: 'stok', header: 'Stok Sistem', meta: { headerClass: 'w-28 text-right', cellClass: 'text-right tabular-nums' } },
    { accessorKey: 'real', header: 'Stok Real', meta: { headerClass: 'w-28 text-right', cellClass: 'text-right tabular-nums' } },
    {
        accessorKey: 'selisih', header: 'Selisih (Kurang)', meta: { headerClass: 'w-32 text-right', cellClass: 'text-right tabular-nums' },
        cell: info => h('span', { class: Number(info.getValue()) > 0 ? 'text-error' : '' }, info.getValue()),
    },
    {
        accessorKey: 'nomihilang', header: 'Nomi Hilang', meta: { headerClass: 'w-32 text-right', cellClass: 'text-right tabular-nums' },
        cell: info => 'Rp ' + Number(info.getValue()).toLocaleString('id-ID'),
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

async function hapus(row) {
    if (!confirm(`Hapus riwayat opname "${row.nama_brng}" tgl ${row.tanggal}? (stok TIDAK dikembalikan, sesuai perilaku asli)`)) return
    const res = await window.api.toko.opname.delete(authStore.token, { tanggal: row.tanggal, kode_brng: row.kode_brng })
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Riwayat opname berhasil dihapus.')
    fetchData()
}

// ── Tab: Input Opname (BATCH — replika alur Java asli) ──────────────────
const barangList = ref([]) // [{kode_brng, nama_brng, nm_jenis, kode_sat, dasar, stok, real}]
const barangLoading = ref(false)
const cariBarang = ref('')
const tanggal = ref(new Date().toISOString().slice(0, 10))
const keterangan = ref('')
const saving = ref(false)

const barangTampil = computed(() => {
    if (!cariBarang.value.trim()) return barangList.value
    const kw = cariBarang.value.trim().toLowerCase()
    return barangList.value.filter(b =>
        b.kode_brng.toLowerCase().includes(kw) || b.nama_brng.toLowerCase().includes(kw) ||
        b.kode_sat.toLowerCase().includes(kw) || b.nm_jenis.toLowerCase().includes(kw)
    )
})

// Replika getData() Java: kurang = stok - real, selisih cuma kalau KURANG.
function hitungSelisih(b) {
    if (b.real === '' || b.real === null || b.real === undefined) return { selisih: 0, nomihilang: 0 }
    const kurang = Number(b.stok) - Number(b.real)
    const selisih = kurang > 0 ? kurang : 0
    const nomihilang = kurang > 0 ? kurang * Number(b.dasar) : 0
    return { selisih, nomihilang }
}

async function muatBarang() {
    barangLoading.value = true
    try {
        const data = await window.api.toko.opname.listBarang({})
        // Pertahankan nilai "Real" yang sudah diketik user (kalau ada) saat refresh.
        const realLama = new Map(barangList.value.map(b => [b.kode_brng, b.real]))
        barangList.value = data.map(b => ({ ...b, real: realLama.get(b.kode_brng) ?? '' }))
    } finally {
        barangLoading.value = false
    }
}

function bersihkan() {
    if (!confirm('Bersihkan semua isian "Real" yang sudah diketik?')) return
    barangList.value.forEach(b => { b.real = '' })
}

async function simpan() {
    if (!keterangan.value.trim()) { showToast('Keterangan tidak boleh kosong', 'error'); return }
    const terisi = barangList.value.filter(b => b.real !== '' && b.real !== null && b.real !== undefined)
    if (terisi.length === 0) { showToast('Maaf, data kosong', 'error'); return }
    if (!confirm(`Sudah yakin dengan data yang mau disimpan? (${terisi.length} barang akan diproses)`)) return

    saving.value = true
    try {
        const res = await window.api.toko.opname.createBatch(authStore.token, {
            tanggal: tanggal.value,
            keterangan: keterangan.value,
            items: terisi.map(b => ({ kode_brng: b.kode_brng, real: b.real })),
        })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(`Stok opname berhasil disimpan (${res.diproses} barang diproses).`)
        keterangan.value = ''
        await muatBarang()
        barangList.value.forEach(b => { b.real = '' })
        fetchData()
        activeTab.value = 'list'
    } finally {
        saving.value = false
    }
}

onMounted(muatBarang)
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
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'tambah' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'tambah'">
                <Plus class="size-4" />
                Input Opname
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
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
                            <tr v-if="loading"><td colspan="8" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="8" class="py-16 text-center">
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

        <div v-show="activeTab === 'tambah'" class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
                <div class="px-5 py-3.5 border-b border-base-200 flex flex-wrap items-end gap-3 shrink-0">
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Tanggal</label>
                        <input v-model="tanggal" type="date" class="input input-bordered input-sm w-36" />
                    </div>
                    <div class="flex-1 min-w-48">
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Keterangan <span class="text-error">*</span></label>
                        <input v-model="keterangan" type="text" class="input input-bordered input-sm w-full" placeholder="Contoh: Opname bulanan Januari" />
                    </div>
                    <div class="flex-1 min-w-48">
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Cari Barang</label>
                        <input v-model="cariBarang" type="text" class="input input-bordered input-sm w-full" placeholder="Kode / nama / jenis / satuan" />
                    </div>
                    <button class="btn btn-ghost btn-sm gap-1" @click="bersihkan">
                        <Eraser class="size-4" />
                        Bersihkan
                    </button>
                    <button class="btn btn-primary btn-sm gap-2" :disabled="saving || !bolehTulis()" @click="simpan">
                        <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                        Simpan Semua
                    </button>
                </div>
                <p v-if="!bolehTulis()" class="text-warning text-sm px-5 pt-2 shrink-0">Anda tidak punya akses menambah data ini.</p>

                <div class="flex-1 min-h-0 overflow-y-auto">
                    <table class="table">
                        <thead class="sticky top-0 z-10 bg-base-100">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th class="text-sm font-medium py-2 w-32">Kode</th>
                                <th class="text-sm font-medium py-2">Nama Barang</th>
                                <th class="text-sm font-medium py-2 w-28">Jenis</th>
                                <th class="text-sm font-medium py-2 w-20">Satuan</th>
                                <th class="text-sm font-medium py-2 w-28 text-right">Stok Sistem</th>
                                <th class="text-sm font-medium py-2 w-32 text-center">Stok Real</th>
                                <th class="text-sm font-medium py-2 w-28 text-right">Selisih</th>
                                <th class="text-sm font-medium py-2 w-32 text-right">Nomi Hilang</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="barangLoading"><td colspan="8" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                            <tr v-else-if="barangTampil.length === 0"><td colspan="8" class="py-16 text-center text-base-content/50">Tidak ada barang cocok</td></tr>
                            <tr v-else v-for="b in barangTampil" :key="b.kode_brng" class="border-b border-base-200 hover:bg-primary/5">
                                <td class="py-1.5 font-medium">{{ b.kode_brng }}</td>
                                <td class="py-1.5">{{ b.nama_brng }}</td>
                                <td class="py-1.5">{{ b.nm_jenis }}</td>
                                <td class="py-1.5">{{ b.kode_sat }}</td>
                                <td class="py-1.5 text-right tabular-nums">{{ b.stok }}</td>
                                <td class="py-1.5">
                                    <input v-model="b.real" type="number" min="0" class="input input-bordered input-sm w-full text-right" />
                                </td>
                                <td class="py-1.5 text-right tabular-nums" :class="hitungSelisih(b).selisih > 0 ? 'text-error' : ''">
                                    {{ hitungSelisih(b).selisih }}
                                </td>
                                <td class="py-1.5 text-right tabular-nums">Rp {{ hitungSelisih(b).nomihilang.toLocaleString('id-ID') }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>
