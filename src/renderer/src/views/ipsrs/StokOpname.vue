<script setup>
import { ref, computed, h, onMounted } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, ClipboardCheck, Eraser, Printer } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'

// src/ipsrs/IPSRSInputStok.java (input) + IPSRSStokOpname.java (viewer/hapus).
// TIDAK menyentuh jurnal Keuangan. Pola BATCH identik
// src/renderer/src/views/toko/Opname.vue, BEDA: IPSRS catat DUA ARAH
// (kurang -> selisih/nomihilang, lebih -> lebih/nomilebih), bukan cuma
// kekurangan spt Toko — replika persis IPSRSInputStok.getData().
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can('stok_opname_logistik')

const activeTab = ref('list')

// ── Tab: Riwayat Opname (viewer) ──────────────────────────────────────────
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
        accessorKey: 'lebih', header: 'Lebih', meta: { headerClass: 'w-24 text-right', cellClass: 'text-right tabular-nums' },
        cell: info => h('span', { class: Number(info.getValue()) > 0 ? 'text-success' : '' }, info.getValue()),
    },
    {
        accessorKey: 'nomihilang', header: 'Nomi Hilang', meta: { headerClass: 'w-32 text-right', cellClass: 'text-right tabular-nums' },
        cell: info => 'Rp ' + Number(info.getValue()).toLocaleString('id-ID'),
    },
    {
        accessorKey: 'nomilebih', header: 'Nomi Lebih', meta: { headerClass: 'w-32 text-right', cellClass: 'text-right tabular-nums' },
        cell: info => 'Rp ' + Number(info.getValue()).toLocaleString('id-ID'),
    },
    { accessorKey: 'keterangan', header: 'Keterangan', enableSorting: false },
    {
        id: 'aksi', header: 'Aksi', enableSorting: false,
        meta: { headerClass: 'text-center w-24', cellClass: 'text-center' },
        cell: info => h('button', { class: 'btn btn-ghost btn-sm text-error', onClick: () => hapus(info.row.original) }, 'Hapus'),
    },
]

const tgl1 = ref('')
const tgl2 = ref('')
const jenis = ref('')
const summary = ref({ totalReal: 0, nominalHilang: 0, nominalLebih: 0 })

const { table, loading, search, fetchData } = useServerTable({
    columns,
    fetchFn: async params => {
        const res = await window.api.ipsrs.stok.list({ ...params, tgl1: tgl1.value, tgl2: tgl2.value, jenis: jenis.value })
        summary.value = res.summary ?? { totalReal: 0, nominalHilang: 0, nominalLebih: 0 }
        return res
    },
    pageSize: 10,
    defaultSortBy: 'tanggal',
    defaultSortOrder: 'desc',
})

async function hapus(row) {
    if (!confirm(`Hapus riwayat opname "${row.nama_brng}" tgl ${row.tanggal}? (stok TIDAK dikembalikan, sesuai perilaku asli)`)) return
    const res = await window.api.ipsrs.stok.delete(authStore.token, { tanggal: row.tanggal, kode_brng: row.kode_brng })
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Riwayat opname berhasil dihapus.')
    fetchData()
}

// ── Tab: Input Opname (BATCH) ─────────────────────────────────────────────
const barangList = ref([])
const barangLoading = ref(false)
const cariBarang = ref('')
const opnameMode = ref('semua')
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

function hitung(b) {
    if (b.real === '' || b.real === null || b.real === undefined) return { selisih: 0, lebih: 0, nomihilang: 0, nomilebih: 0 }
    const kurang = Number(b.stok) - Number(b.real)
    if (kurang > 0) return { selisih: kurang, lebih: 0, nomihilang: kurang * Number(b.harga), nomilebih: 0 }
    return { selisih: 0, lebih: -kurang, nomihilang: 0, nomilebih: -kurang * Number(b.harga) }
}

async function muatBarang() {
    barangLoading.value = true
    try {
        const data = await window.api.ipsrs.stok.listBarang({ tanggal: tanggal.value, mode: opnameMode.value })
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
        const res = await window.api.ipsrs.stok.createBatch(authStore.token, {
            tanggal: tanggal.value,
            keterangan: keterangan.value,
            items: terisi.map(b => ({ kode_brng: b.kode_brng, real: b.real })),
        })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(`Stok opname berhasil disimpan (${res.diproses} barang diproses).`)
        keterangan.value = ''
        await muatBarang()
        fetchData()
        activeTab.value = 'list'
    } finally {
        saving.value = false
    }
}

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char])
}

function bukaCetak(title, header, rows, summaryHtml = '') {
    if (!rows.length) { showToast('Tidak ada data untuk dicetak', 'warning'); return }
    const w = window.open('', '_blank', 'width=1100,height=700')
    if (!w) { showToast('Popup cetak diblokir browser', 'error'); return }
    w.document.write(`<html><head><title>${esc(title)}</title><style>body{font:11px Arial;color:#111;margin:20px}h1{text-align:center;font-size:17px;margin:0 0 4px}h2{text-align:center;font-size:13px;font-weight:normal;margin:0 0 16px}.info{margin-bottom:12px;line-height:1.6}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:5px}th{background:#eee}.num{text-align:right}.summary{margin:14px 0 0 auto;width:300px}.summary div{display:flex;justify-content:space-between;padding:3px;border-bottom:1px solid #ddd}.summary div:last-child{font-weight:bold;border-top:2px solid #111;border-bottom:0;margin-top:3px;padding-top:6px}@media print{body{margin:10mm}}</style></head><body><h1>${esc(title)}</h1><h2>IPSRS — Sarana Prasarana</h2><div class="info">${header}</div><table>${rows}</table>${summaryHtml}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
    w.close()
}

function cetakRiwayat() {
    const data = table.getRowModel().rows.map(row => row.original)
    const body = data.map((row, index) => `<tr><td>${index + 1}</td><td>${esc(row.tanggal)}</td><td>${esc(row.kode_brng)}</td><td>${esc(row.nama_brng)}</td><td class="num">${Number(row.stok).toLocaleString('id-ID')}</td><td class="num">${Number(row.real).toLocaleString('id-ID')}</td><td class="num">${Number(row.selisih).toLocaleString('id-ID')}</td><td class="num">${Number(row.lebih).toLocaleString('id-ID')}</td><td class="num">Rp ${Number(row.nomihilang).toLocaleString('id-ID')}</td><td class="num">Rp ${Number(row.nomilebih).toLocaleString('id-ID')}</td><td>${esc(row.keterangan)}</td></tr>`).join('')
    const header = `<b>Periode:</b> ${esc(tgl1.value || 'Semua tanggal')} s.d. ${esc(tgl2.value || 'Semua tanggal')}<br><b>Jenis:</b> ${esc(jenis.value || 'Semua jenis')}`
    const summaryHtml = `<div class="summary"><div><span>Total Stok Real</span><span>Rp ${Number(summary.value.totalReal).toLocaleString('id-ID')}</span></div><div><span>Nominal Hilang</span><span>Rp ${Number(summary.value.nominalHilang).toLocaleString('id-ID')}</span></div><div><span>Nominal Lebih</span><span>Rp ${Number(summary.value.nominalLebih).toLocaleString('id-ID')}</span></div></div>`
    bukaCetak('RIWAYAT STOK OPNAME', header, `<thead><tr><th>No</th><th>Tanggal</th><th>Kode</th><th>Barang</th><th>Stok Sistem</th><th>Stok Real</th><th>Kurang</th><th>Lebih</th><th>Nomi Hilang</th><th>Nomi Lebih</th><th>Keterangan</th></tr></thead><tbody>${body}</tbody>`, summaryHtml)
}

function cetakInput() {
    const data = barangTampil.value.filter(row => row.real !== '' && row.real !== null && row.real !== undefined)
    const body = data.map((row, index) => {
        const hasil = hitung(row)
        return `<tr><td>${index + 1}</td><td>${esc(row.kode_brng)}</td><td>${esc(row.nama_brng)}</td><td>${esc(row.nm_jenis)}</td><td>${esc(row.kode_sat)}</td><td class="num">${Number(row.stok).toLocaleString('id-ID')}</td><td class="num">${Number(row.real).toLocaleString('id-ID')}</td><td class="num">${hasil.selisih.toLocaleString('id-ID')}</td><td class="num">${hasil.lebih.toLocaleString('id-ID')}</td><td class="num">Rp ${hasil.nomihilang.toLocaleString('id-ID')}</td><td class="num">Rp ${hasil.nomilebih.toLocaleString('id-ID')}</td></tr>`
    }).join('')
    const header = `<b>Tanggal Opname:</b> ${esc(tanggal.value)}<br><b>Keterangan:</b> ${esc(keterangan.value || '-')}<br><b>Jumlah Barang Dicetak:</b> ${data.length}`
    bukaCetak('INPUT STOK OPNAME', header, `<thead><tr><th>No</th><th>Kode</th><th>Barang</th><th>Jenis</th><th>Satuan</th><th>Stok Sistem</th><th>Stok Real</th><th>Kurang</th><th>Lebih</th><th>Nomi Hilang</th><th>Nomi Lebih</th></tr></thead><tbody>${body}</tbody>`)
}

onMounted(muatBarang)
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="flex items-center justify-between mb-4 shrink-0">
            <div>
                <h1 class="text-xl font-semibold tracking-tight">IPSRS — Stok Opname</h1>
                <p class="text-sm text-base-content/60 mt-0.5">Input & riwayat hitung fisik stok (src/ipsrs/IPSRSInputStok.java, IPSRSStokOpname.java)</p>
            </div>
        </div>

        <div class="flex items-center justify-between gap-3 mb-2 shrink-0">
            <div class="flex bg-base-200 rounded-xl p-1 w-fit gap-0.5">
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
            <button class="btn btn-ghost btn-xs text-primary gap-1" @click="activeTab === 'list' ? cetakRiwayat() : cetakInput()">
                <Printer class="size-3.5" />
                Cetak
            </button>
        </div>

        <div v-show="activeTab === 'list'" class="flex-1 min-h-0 overflow-hidden">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm h-full flex flex-col overflow-hidden px-4 py-3">
                <div class="flex flex-wrap items-end gap-2 mb-3">
                    <input v-model="tgl1" type="date" class="input input-bordered input-sm w-36" />
                    <input v-model="tgl2" type="date" class="input input-bordered input-sm w-36" />
                    <input v-model="jenis" class="input input-bordered input-sm w-44" placeholder="Filter jenis" />
                    <button class="btn btn-primary btn-sm" @click="fetchData">Terapkan</button>
                    <span class="badge badge-outline p-3">Real Rp {{ Number(summary.totalReal).toLocaleString('id-ID') }}</span>
                    <span class="badge badge-error badge-outline p-3">Hilang Rp {{ Number(summary.nominalHilang).toLocaleString('id-ID') }}</span>
                    <span class="badge badge-success badge-outline p-3">Lebih Rp {{ Number(summary.nominalLebih).toLocaleString('id-ID') }}</span>
                </div>
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
                            <tr v-if="loading"><td colspan="9" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="9" class="py-16 text-center">
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
                        <input v-model="tanggal" type="date" class="input input-bordered input-sm w-36" @change="muatBarang" />
                    </div>
                    <div class="flex-1 min-w-48">
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Keterangan <span class="text-error">*</span></label>
                        <input v-model="keterangan" type="text" class="input input-bordered input-sm w-full" placeholder="Contoh: Opname bulanan Januari" />
                    </div>
                    <div class="flex-1 min-w-48">
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Cari Barang</label>
                        <input v-model="cariBarang" type="text" class="input input-bordered input-sm w-full" placeholder="Kode / nama / jenis / satuan" />
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-xs font-medium text-base-content/60">Mode Opname</label>
                        <select v-model="opnameMode" class="select select-bordered select-sm w-36" @change="muatBarang">
                            <option value="semua">Semua</option>
                            <option value="belum">Belum Opname</option>
                            <option value="sudah">Sudah Opname</option>
                        </select>
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
                                <th class="text-sm font-medium py-2 w-24 text-right">Selisih</th>
                                <th class="text-sm font-medium py-2 w-20 text-right">Lebih</th>
                                <th class="text-sm font-medium py-2 w-32 text-right">Nomi Hilang</th>
                                <th class="text-sm font-medium py-2 w-32 text-right">Nomi Lebih</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="barangLoading"><td colspan="10" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                            <tr v-else-if="barangTampil.length === 0"><td colspan="10" class="py-16 text-center text-base-content/50">Tidak ada barang cocok</td></tr>
                            <tr v-else v-for="b in barangTampil" :key="b.kode_brng" class="border-b border-base-200 hover:bg-primary/5">
                                <td class="py-1.5 font-medium">{{ b.kode_brng }}</td>
                                <td class="py-1.5">{{ b.nama_brng }}</td>
                                <td class="py-1.5">{{ b.nm_jenis }}</td>
                                <td class="py-1.5">{{ b.kode_sat }}</td>
                                <td class="py-1.5 text-right tabular-nums">{{ b.stok }}</td>
                                <td class="py-1.5">
                                    <input v-model="b.real" type="number" min="0" class="input input-bordered input-sm w-full text-right" />
                                </td>
                                <td class="py-1.5 text-right tabular-nums" :class="hitung(b).selisih > 0 ? 'text-error' : ''">{{ hitung(b).selisih }}</td>
                                <td class="py-1.5 text-right tabular-nums" :class="hitung(b).lebih > 0 ? 'text-success' : ''">{{ hitung(b).lebih }}</td>
                                <td class="py-1.5 text-right tabular-nums">Rp {{ hitung(b).nomihilang.toLocaleString('id-ID') }}</td>
                                <td class="py-1.5 text-right tabular-nums">Rp {{ hitung(b).nomilebih.toLocaleString('id-ID') }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>
