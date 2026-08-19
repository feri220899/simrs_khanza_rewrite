<script setup>
import { ref, reactive, computed, h, onMounted, watch } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, Undo2, Trash2 } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'

// Retur Beli Barang Non Medis (retur ke suplier) — src/ipsrs/IPSRSReturBeli.java.
// Jurnal pembalik SEBAGIAN dari Penerimaan Barang Non Medis (kurangi
// Persediaan + kurangi Hutang). Lihat IpsrsReturBeliService.js utk detail
// lengkap 1:1 audit Java.
//
// `nip` (petugas) WAJIB dropdown eksplisit (FK ke tabel `petugas`) — TIDAK
// boleh auto dari authStore.user.
//
// `No. Faktur` per baris itu TEKS BEBAS (bukan FK tervalidasi ke transaksi
// pembelian manapun) — replika 1:1 Java, opsional, sekadar catatan referensi.
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehBuat = () => authStore.can('ipsrs_returbeli')

const activeTab = ref('buat')

const header = reactive({
    no_retur_beli: '',
    tgl_retur: new Date().toISOString().slice(0, 10),
    kode_suplier: '',
    nip: '',
    catatan: '',
})
const items = ref([]) // [{kode_brng, nama_satuan?, kode_sat, jumlah, h_beli, h_retur, no_faktur, stok}]
const opsiBarang = ref([])
const opsiSuplier = ref([])
const opsiPetugas = ref([])
const saving = ref(false)

async function muatOpsi() {
    const [barang, suplier, petugas] = await Promise.all([
        window.api.ipsrs.barang.listAktif(),
        window.api.ipsrs.suplier.listAll(),
        window.api.ipsrs.returBeli.listPetugas(),
    ])
    opsiBarang.value = barang
    opsiSuplier.value = suplier
    opsiPetugas.value = petugas
}

async function siapkanNomor() {
    header.no_retur_beli = await window.api.ipsrs.returBeli.nextNoRetur(header.tgl_retur)
}
watch(() => header.tgl_retur, siapkanNomor)

function kosongkanForm() {
    header.kode_suplier = ''
    header.nip = ''
    header.catatan = ''
    items.value = []
}

function tambahBaris() {
    items.value.push({ kode_brng: '', jumlah: '', h_beli: '', h_retur: '', no_faktur: '' })
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
    items.value[i].h_beli = b.harga
    items.value[i].h_retur = b.harga
    items.value[i].stok = b.stok
}

function totalBaris(it) {
    return (Number(it.jumlah) || 0) * (Number(it.h_retur) || 0)
}

const ringkasan = computed(() => {
    const terisi = items.value.filter(it => it.kode_brng && Number(it.jumlah) > 0)
    const total = terisi.reduce((s, it) => s + totalBaris(it), 0)
    return { total }
})

function rupiah(v) {
    return 'Rp ' + (Number(v) || 0).toLocaleString('id-ID')
}

async function simpan() {
    if (!header.kode_suplier) { showToast('Supplier tidak boleh kosong', 'error'); return }
    if (!header.nip) { showToast('Petugas tidak boleh kosong', 'error'); return }
    if (!header.catatan.trim()) { showToast('Catatan tidak boleh kosong', 'error'); return }
    if (items.value.length === 0) { showToast('Maaf, data sudah habis', 'error'); return }
    const terisi = items.value.filter(it => it.kode_brng && Number(it.jumlah) > 0)
    if (terisi.length === 0) { showToast('Maaf, Silahkan masukkan retur', 'error'); return }
    const lebihDariStok = terisi.find(it => Number(it.jumlah) > Number(it.stok))
    if (lebihDariStok) { showToast(`Maaf stok tidak mencukupi untuk ${lebihDariStok.nama_satuan ? lebihDariStok.kode_brng : lebihDariStok.kode_brng} (stok: ${lebihDariStok.stok})`, 'error'); return }

    saving.value = true
    try {
        const itemsPayload = terisi.map(it => ({
            kode_brng: it.kode_brng, kode_sat: it.kode_sat, jumlah: it.jumlah,
            h_beli: it.h_beli, h_retur: it.h_retur, no_faktur: it.no_faktur || '',
        }))
        const res = await window.api.ipsrs.returBeli.create(authStore.token, {
            kode_suplier: header.kode_suplier,
            nip: header.nip,
            tgl_retur: header.tgl_retur,
            catatan: header.catatan,
            items: itemsPayload,
        })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(`Retur Beli ${res.no_retur_beli} berhasil disimpan, jurnal & stok sudah diposting.`)
        kosongkanForm()
        await siapkanNomor()
        fetchData()
    } finally {
        saving.value = false
    }
}

// ── Tab: Daftar Retur Beli ────────────────────────────────────────────────
const selectedNoRetur = ref(null)
const detailItems = ref([])
const loadingDetail = ref(false)

async function toggleDetail(noReturBeli) {
    if (selectedNoRetur.value === noReturBeli) {
        selectedNoRetur.value = null
        detailItems.value = []
        return
    }
    selectedNoRetur.value = noReturBeli
    loadingDetail.value = true
    try {
        detailItems.value = await window.api.ipsrs.returBeli.detail(noReturBeli)
    } finally {
        loadingDetail.value = false
    }
}

const columns = [
    { accessorKey: 'no_retur_beli', header: 'No. Retur', meta: { headerClass: 'w-36', cellClass: 'font-medium' } },
    { accessorKey: 'nama_suplier', header: 'Supplier', enableSorting: false },
    { accessorKey: 'nama_petugas', header: 'Petugas', enableSorting: false },
    { accessorKey: 'catatan', header: 'Catatan', enableSorting: false },
    { accessorKey: 'tgl_retur', header: 'Tanggal', meta: { headerClass: 'w-28' } },
    {
        accessorKey: 'total', header: 'Total', meta: { headerClass: 'w-36 text-right', cellClass: 'text-right' },
        cell: info => rupiah(info.getValue()),
    },
]

const { table, loading, search, fetchData } = useServerTable({
    columns,
    fetchFn: params => window.api.ipsrs.returBeli.list(params),
    pageSize: 10,
    defaultSortBy: 'tgl_retur',
    defaultSortOrder: 'desc',
})

onMounted(async () => {
    await muatOpsi()
    await siapkanNomor()
})
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="mb-2 shrink-0">
            <h1 class="text-xl font-semibold tracking-tight">IPSRS — Retur Beli Barang Non Medis</h1>
            <p class="text-sm text-base-content/60 mt-0.5">Retur barang ke Suplier + posting jurnal &amp; stok otomatis — src/ipsrs/IPSRSReturBeli.java</p>
        </div>

        <div class="flex justify-between items-center mb-2 shrink-0 w-full">
            <div class="flex bg-base-200 rounded-xl p-1 w-fit gap-0.5">
                <button :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer', activeTab === 'buat' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']" @click="activeTab = 'buat'">
                    <Plus class="size-4" /> Retur Baru
                </button>
                <button :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer', activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']" @click="activeTab = 'list'">
                    <List class="size-4" /> Daftar Retur Beli
                </button>
            </div>
        </div>

        <!-- Tab: Retur Baru -->
        <div v-show="activeTab === 'buat'" class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
                <div class="px-5 py-3.5 border-b border-base-200 grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">No. Retur</label>
                        <input :value="header.no_retur_beli" type="text" readonly class="input input-bordered input-sm w-full bg-base-200" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Tanggal Retur</label>
                        <input v-model="header.tgl_retur" type="date" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Supplier <span class="text-error">*</span></label>
                        <AppSelect v-model="header.kode_suplier" :options="opsiSuplier" value-prop="kode_suplier" label="nama_suplier" placeholder="Pilih Supplier" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Petugas <span class="text-error">*</span></label>
                        <AppSelect v-model="header.nip" :options="opsiPetugas" value-prop="nip" label="nama" placeholder="Pilih Petugas" />
                    </div>
                    <div class="sm:col-span-4">
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Catatan <span class="text-error">*</span></label>
                        <input v-model="header.catatan" type="text" maxlength="40" class="input input-bordered input-sm w-full" placeholder="Alasan retur..." />
                    </div>
                </div>

                <div class="px-5 py-2 border-b border-base-200 shrink-0">
                    <button class="btn btn-ghost btn-sm gap-1" @click="tambahBaris"><Plus class="size-4" /> Tambah Baris</button>
                </div>

                <div class="flex-1 min-h-0 overflow-y-auto">
                    <table class="table">
                        <thead class="sticky top-0 z-10 bg-base-100">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th class="text-sm font-medium py-2 w-56">Barang</th>
                                <th class="text-sm font-medium py-2 w-20">Satuan</th>
                                <th class="text-sm font-medium py-2 w-20 text-right">Stok</th>
                                <th class="text-sm font-medium py-2 w-20 text-right">Jumlah</th>
                                <th class="text-sm font-medium py-2 w-28 text-right">Harga Dasar</th>
                                <th class="text-sm font-medium py-2 w-28 text-right">Harga Retur</th>
                                <th class="text-sm font-medium py-2 w-32">No. Faktur</th>
                                <th class="text-sm font-medium py-2 w-28 text-right">Total</th>
                                <th class="text-sm font-medium py-2 w-16 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="items.length === 0">
                                <td colspan="9" class="py-16 text-center text-base-content/50">Belum ada baris, klik "Tambah Baris"</td>
                            </tr>
                            <tr v-else v-for="(it, i) in items" :key="i" class="border-b border-base-200">
                                <td class="py-1.5">
                                    <AppSelect :model-value="it.kode_brng" @update:model-value="v => pilihBarang(i, v)" :options="opsiBarang" value-prop="kode_brng" label="nama_brng" placeholder="Pilih Barang" />
                                </td>
                                <td class="py-1.5">{{ it.nama_satuan || '-' }}</td>
                                <td class="py-1.5 text-right tabular-nums">{{ it.stok ?? '-' }}</td>
                                <td class="py-1.5"><input v-model="it.jumlah" type="number" min="0" :max="it.stok" class="input input-bordered input-sm w-full text-right" /></td>
                                <td class="py-1.5 text-right tabular-nums">{{ rupiah(it.h_beli) }}</td>
                                <td class="py-1.5"><input v-model="it.h_retur" type="number" min="0" class="input input-bordered input-sm w-full text-right" /></td>
                                <td class="py-1.5"><input v-model="it.no_faktur" type="text" class="input input-bordered input-sm w-full" placeholder="Opsional" /></td>
                                <td class="py-1.5 text-right">{{ totalBaris(it).toLocaleString('id-ID') }}</td>
                                <td class="py-1.5 text-center">
                                    <button class="btn btn-ghost btn-sm text-error" @click="hapusBaris(i)"><Trash2 class="size-4" /></button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="px-5 py-2 border-t border-base-200 shrink-0 flex items-center justify-between gap-4">
                    <div v-if="!bolehBuat()" class="text-warning text-sm">Anda tidak punya akses menyimpan retur beli.</div>
                    <div v-else class="flex flex-wrap gap-x-8 gap-y-3 text-sm bg-base-200/30 rounded-xl px-5 py-2 border border-base-200">
                        <div class="flex flex-col items-end">
                            <p class="text-[11px] uppercase tracking-wide text-base-content/50 w-full text-right">Total Retur</p>
                            <p class="font-bold text-primary tabular-nums">{{ rupiah(ringkasan.total) }}</p>
                        </div>
                    </div>
                    <button class="btn btn-primary gap-2 shrink-0" :disabled="saving || !bolehBuat()" @click="simpan">
                        <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                        Simpan
                    </button>
                </div>
            </div>
        </div>

        <!-- Tab: Daftar -->
        <div v-show="activeTab === 'list'" class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden px-4 py-3">
                <AppPagination :table="table" v-model:search="search" class="flex-1 min-h-0">
                    <table class="table">
                        <thead class="sticky top-0 z-10">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th v-for="hd in table.getFlatHeaders()" :key="hd.id"
                                    :class="['text-sm font-medium py-2', hd.column.columnDef.meta?.headerClass, hd.column.getCanSort() ? 'cursor-pointer select-none hover:text-primary transition-colors' : '']"
                                    @click="hd.column.getToggleSortingHandler()?.($event)">
                                    <FlexRender :render="hd.column.columnDef.header" :props="hd.getContext()" />
                                    <span v-if="hd.column.getIsSorted() === 'asc'" class="text-primary">↑</span>
                                    <span v-else-if="hd.column.getIsSorted() === 'desc'" class="text-primary">↓</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading">
                                <td colspan="6" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td>
                            </tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="6" class="py-16 text-center">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
                                            <Undo2 class="size-7 text-base-content/30" />
                                        </div>
                                        <p class="font-semibold text-base-content/60">Belum ada retur beli</p>
                                    </div>
                                </td>
                            </tr>
                            <template v-else v-for="row in table.getRowModel().rows" :key="row.id">
                                <tr :class="['border-b border-base-200 cursor-pointer transition-colors', selectedNoRetur === row.original.no_retur_beli ? 'bg-primary/10' : 'hover:bg-primary/5']" @click="toggleDetail(row.original.no_retur_beli)">
                                    <td v-for="cell in row.getVisibleCells()" :key="cell.id" :class="['py-2', cell.column.columnDef.meta?.cellClass]">
                                        <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                                    </td>
                                </tr>
                                <tr v-if="selectedNoRetur === row.original.no_retur_beli" class="bg-base-200/50">
                                    <td :colspan="table.getVisibleLeafColumns().length" class="p-4">
                                        <div class="rounded-xl border border-base-200 bg-base-100 shadow-sm overflow-hidden">
                                            <div v-if="loadingDetail" class="py-10 text-center"><span class="loading loading-spinner loading-md text-primary"></span></div>
                                            <div v-else-if="detailItems.length === 0" class="py-10 text-center text-sm text-base-content/50">Tidak ada detail barang.</div>
                                            <table v-else class="table table-sm">
                                                <thead>
                                                    <tr class="bg-base-200/40">
                                                        <th class="pl-4">Barang</th>
                                                        <th>Satuan</th>
                                                        <th>No. Faktur</th>
                                                        <th class="text-right">Jumlah</th>
                                                        <th class="text-right">Harga Retur</th>
                                                        <th class="pr-4 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr v-for="item in detailItems" :key="item.kode_brng" class="hover:bg-base-200/30">
                                                        <td class="pl-4"><p class="font-medium">{{ item.nama_brng }}</p><p class="text-xs text-base-content/50">{{ item.kode_brng }}</p></td>
                                                        <td><span class="badge badge-ghost badge-sm">{{ item.nama_satuan }}</span></td>
                                                        <td>{{ item.no_faktur || '-' }}</td>
                                                        <td class="text-right font-semibold tabular-nums">{{ Number(item.jml_retur).toLocaleString('id-ID') }}</td>
                                                        <td class="text-right tabular-nums">{{ rupiah(item.h_retur) }}</td>
                                                        <td class="pr-4 text-right font-semibold tabular-nums text-primary">{{ rupiah(item.total) }}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
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
