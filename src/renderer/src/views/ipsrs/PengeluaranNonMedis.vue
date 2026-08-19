<script setup>
import { ref, reactive, computed, h, onMounted, watch } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, PackageMinus, Trash2 } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'

// Pengeluaran Barang Non Medis (stok keluar ke unit internal) — src/ipsrs/
// IPSRSPengeluaran.java. Bisa mulai dari Permintaan berstatus "Disetujui"
// (prefill item + Keterangan) atau standalone langsung. Lihat
// IpsrsPengeluaranService.js utk detail lengkap 1:1 audit Java.
//
// `nip` (petugas) WAJIB dropdown eksplisit (FK ke tabel `petugas`, BEDA dari
// `permintaan_non_medis.nip` yang FK ke `pegawai`) — TIDAK boleh auto dari
// authStore.user.
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehBuat = () => authStore.can('ipsrs_stok_keluar')

const activeTab = ref('buat')

const header = reactive({
    no_keluar: '',
    tanggal: new Date().toISOString().slice(0, 10),
    nip: '',
    keterangan: '',
})
const items = ref([]) // [{kode_brng, nama_satuan?, kode_sat, jumlah, harga, stok}]
const opsiBarang = ref([])
const opsiPetugas = ref([])
const opsiPermintaanDisetujui = ref([])
const permintaanTerpilih = ref('')
const saving = ref(false)
const loadingPermintaan = ref(false)

async function muatOpsi() {
    const [barang, petugas, permintaan] = await Promise.all([
        window.api.ipsrs.barang.listAktif(),
        window.api.ipsrs.pengeluaran.listPetugas(),
        window.api.ipsrs.permintaan.list({ status: 'Disetujui', pageSize: 200 }),
    ])
    opsiBarang.value = barang
    opsiPetugas.value = petugas
    opsiPermintaanDisetujui.value = permintaan.data.map(p => ({ ...p, display: `${p.no_permintaan} — Ruangan ${p.ruang}` }))
}

async function siapkanNomor() {
    header.no_keluar = await window.api.ipsrs.pengeluaran.nextNoKeluar(header.tanggal)
}
watch(() => header.tanggal, siapkanNomor)

function kosongkanForm() {
    header.nip = ''
    header.keterangan = ''
    items.value = []
    permintaanTerpilih.value = ''
}

async function muatDariPermintaan(noPermintaan) {
    if (!noPermintaan) return
    loadingPermintaan.value = true
    try {
        const res = await window.api.ipsrs.pengeluaran.getFromPermintaan(noPermintaan)
        if (!res.success) { showToast(res.message, 'error'); return }
        header.keterangan = res.keterangan
        items.value = res.items.map(it => ({
            kode_brng: it.kode_brng, nama_satuan: it.nama_satuan, kode_sat: it.kode_sat,
            jumlah: it.jumlah, harga: it.harga, stok: it.stok,
        }))
        if (res.peringatanStokKurang) {
            showToast(`Stok tidak mencukupi untuk: ${res.peringatanStokKurang.join(', ')} — jumlah baris itu dikosongkan, isi manual sesuai stok tersedia.`, 'warning')
        } else {
            showToast(`Item dari Permintaan ${noPermintaan} berhasil dimuat — lengkapi Petugas lalu periksa jumlah yang benar-benar dikeluarkan.`, 'warning')
        }
    } finally {
        loadingPermintaan.value = false
    }
}
watch(permintaanTerpilih, v => { if (v) muatDariPermintaan(v) })

function tambahBaris() {
    items.value.push({ kode_brng: '', jumlah: '', harga: '' })
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
    items.value[i].harga = b.harga
    items.value[i].stok = b.stok
}

function totalBaris(it) {
    return (Number(it.jumlah) || 0) * (Number(it.harga) || 0)
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
    if (!header.keterangan.trim()) { showToast('Keterangan tidak boleh kosong', 'error'); return }
    if (!header.nip) { showToast('Petugas tidak boleh kosong', 'error'); return }
    if (items.value.length === 0) { showToast('Maaf, data sudah habis', 'error'); return }
    const terisi = items.value.filter(it => it.kode_brng && Number(it.jumlah) > 0)
    if (terisi.length === 0) { showToast('Maaf, Silahkan masukkan pengeluaran', 'error'); return }

    saving.value = true
    try {
        const itemsPayload = terisi.map(it => ({
            kode_brng: it.kode_brng, kode_sat: it.kode_sat, jumlah: it.jumlah, harga: it.harga,
        }))
        const res = await window.api.ipsrs.pengeluaran.create(authStore.token, {
            nip: header.nip,
            tanggal: header.tanggal,
            keterangan: header.keterangan,
            items: itemsPayload,
        })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(`Pengeluaran ${res.no_keluar} berhasil disimpan, jurnal & stok sudah diposting.`)
        kosongkanForm()
        await siapkanNomor()
        fetchData()
    } finally {
        saving.value = false
    }
}

// ── Tab: Daftar Pengeluaran ───────────────────────────────────────────────
const selectedNoKeluar = ref(null)
const detailItems = ref([])
const loadingDetail = ref(false)

async function toggleDetail(noKeluar) {
    if (selectedNoKeluar.value === noKeluar) {
        selectedNoKeluar.value = null
        detailItems.value = []
        return
    }
    selectedNoKeluar.value = noKeluar
    loadingDetail.value = true
    try {
        detailItems.value = await window.api.ipsrs.pengeluaran.detail(noKeluar)
    } finally {
        loadingDetail.value = false
    }
}

const columns = [
    { accessorKey: 'no_keluar', header: 'No. Keluar', meta: { headerClass: 'w-36', cellClass: 'font-medium' } },
    { accessorKey: 'nama_petugas', header: 'Petugas', enableSorting: false },
    { accessorKey: 'keterangan', header: 'Keterangan', enableSorting: false },
    { accessorKey: 'tanggal', header: 'Tanggal', meta: { headerClass: 'w-28' } },
    {
        accessorKey: 'total', header: 'Total', meta: { headerClass: 'w-36 text-right', cellClass: 'text-right' },
        cell: info => rupiah(info.getValue()),
    },
]

const { table, loading, search, fetchData } = useServerTable({
    columns,
    fetchFn: params => window.api.ipsrs.pengeluaran.list(params),
    pageSize: 10,
    defaultSortBy: 'tanggal',
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
            <h1 class="text-xl font-semibold tracking-tight">IPSRS — Pengeluaran Barang Non Medis</h1>
            <p class="text-sm text-base-content/60 mt-0.5">Stok keluar ke unit internal + posting jurnal &amp; stok otomatis — src/ipsrs/IPSRSPengeluaran.java</p>
        </div>

        <div class="flex justify-between items-center mb-2 shrink-0 w-full">
            <div class="flex bg-base-200 rounded-xl p-1 w-fit gap-0.5">
                <button :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer', activeTab === 'buat' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']" @click="activeTab = 'buat'">
                    <Plus class="size-4" /> Keluarkan Barang
                </button>
                <button :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer', activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']" @click="activeTab = 'list'">
                    <List class="size-4" /> Daftar Pengeluaran
                </button>
            </div>
        </div>

        <!-- Tab: Keluarkan Barang -->
        <div v-show="activeTab === 'buat'" class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
                <div class="px-5 py-3 border-b border-base-200 shrink-0">
                    <label class="block text-xs font-medium text-base-content/60 mb-1">Muat dari Permintaan (status "Disetujui") — opsional</label>
                    <AppSelect v-model="permintaanTerpilih" :options="opsiPermintaanDisetujui" value-prop="no_permintaan" label="display" placeholder="Cari & pilih Permintaan..." :disabled="loadingPermintaan" />
                </div>
                <div class="px-5 py-3.5 border-b border-base-200 grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">No. Keluar</label>
                        <input :value="header.no_keluar" type="text" readonly class="input input-bordered input-sm w-full bg-base-200" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Tanggal Keluar</label>
                        <input v-model="header.tanggal" type="date" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Petugas <span class="text-error">*</span></label>
                        <AppSelect v-model="header.nip" :options="opsiPetugas" value-prop="nip" label="nama" placeholder="Pilih Petugas" />
                    </div>
                    <div class="sm:col-span-1">
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Keterangan <span class="text-error">*</span></label>
                        <input v-model="header.keterangan" type="text" class="input input-bordered input-sm w-full" placeholder="Keperluan pengeluaran..." />
                    </div>
                </div>

                <div class="px-5 py-2 border-b border-base-200 shrink-0">
                    <button class="btn btn-ghost btn-sm gap-1" @click="tambahBaris"><Plus class="size-4" /> Tambah Baris</button>
                </div>

                <div class="flex-1 min-h-0 overflow-y-auto">
                    <table class="table">
                        <thead class="sticky top-0 z-10 bg-base-100">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th class="text-sm font-medium py-2 w-64">Barang</th>
                                <th class="text-sm font-medium py-2 w-20">Satuan</th>
                                <th class="text-sm font-medium py-2 w-20 text-right">Stok</th>
                                <th class="text-sm font-medium py-2 w-24 text-right">Jumlah</th>
                                <th class="text-sm font-medium py-2 w-32 text-right">Harga</th>
                                <th class="text-sm font-medium py-2 w-32 text-right">Total</th>
                                <th class="text-sm font-medium py-2 w-16 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="items.length === 0">
                                <td colspan="7" class="py-16 text-center text-base-content/50">Belum ada baris, klik "Tambah Baris" atau muat dari Permintaan</td>
                            </tr>
                            <tr v-else v-for="(it, i) in items" :key="i" class="border-b border-base-200">
                                <td class="py-1.5">
                                    <AppSelect :model-value="it.kode_brng" @update:model-value="v => pilihBarang(i, v)" :options="opsiBarang" value-prop="kode_brng" label="nama_brng" placeholder="Pilih Barang" />
                                </td>
                                <td class="py-1.5">{{ it.nama_satuan || '-' }}</td>
                                <td class="py-1.5 text-right tabular-nums">{{ it.stok ?? '-' }}</td>
                                <td class="py-1.5"><input v-model="it.jumlah" type="number" min="0" :max="it.stok" class="input input-bordered input-sm w-full text-right" /></td>
                                <td class="py-1.5"><input v-model="it.harga" type="number" min="0" class="input input-bordered input-sm w-full text-right" /></td>
                                <td class="py-1.5 text-right">{{ totalBaris(it).toLocaleString('id-ID') }}</td>
                                <td class="py-1.5 text-center">
                                    <button class="btn btn-ghost btn-sm text-error" @click="hapusBaris(i)"><Trash2 class="size-4" /></button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="px-5 py-2 border-t border-base-200 shrink-0 flex items-center justify-between gap-4">
                    <div v-if="!bolehBuat()" class="text-warning text-sm">Anda tidak punya akses menyimpan pengeluaran barang.</div>
                    <div v-else class="flex flex-wrap gap-x-8 gap-y-3 text-sm bg-base-200/30 rounded-xl px-5 py-2 border border-base-200">
                        <div class="flex flex-col items-end">
                            <p class="text-[11px] uppercase tracking-wide text-base-content/50 w-full text-right">Total Pengeluaran</p>
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
                                <td colspan="5" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td>
                            </tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="5" class="py-16 text-center">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
                                            <PackageMinus class="size-7 text-base-content/30" />
                                        </div>
                                        <p class="font-semibold text-base-content/60">Belum ada pengeluaran barang</p>
                                    </div>
                                </td>
                            </tr>
                            <template v-else v-for="row in table.getRowModel().rows" :key="row.id">
                                <tr :class="['border-b border-base-200 cursor-pointer transition-colors', selectedNoKeluar === row.original.no_keluar ? 'bg-primary/10' : 'hover:bg-primary/5']" @click="toggleDetail(row.original.no_keluar)">
                                    <td v-for="cell in row.getVisibleCells()" :key="cell.id" :class="['py-2', cell.column.columnDef.meta?.cellClass]">
                                        <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                                    </td>
                                </tr>
                                <tr v-if="selectedNoKeluar === row.original.no_keluar" class="bg-base-200/50">
                                    <td :colspan="table.getVisibleLeafColumns().length" class="p-4">
                                        <div class="rounded-xl border border-base-200 bg-base-100 shadow-sm overflow-hidden">
                                            <div v-if="loadingDetail" class="py-10 text-center"><span class="loading loading-spinner loading-md text-primary"></span></div>
                                            <div v-else-if="detailItems.length === 0" class="py-10 text-center text-sm text-base-content/50">Tidak ada detail barang.</div>
                                            <table v-else class="table table-sm">
                                                <thead>
                                                    <tr class="bg-base-200/40">
                                                        <th class="pl-4">Barang</th>
                                                        <th>Satuan</th>
                                                        <th class="text-right">Jumlah</th>
                                                        <th class="text-right">Harga</th>
                                                        <th class="pr-4 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr v-for="item in detailItems" :key="item.kode_brng" class="hover:bg-base-200/30">
                                                        <td class="pl-4"><p class="font-medium">{{ item.nama_brng }}</p><p class="text-xs text-base-content/50">{{ item.kode_brng }}</p></td>
                                                        <td><span class="badge badge-ghost badge-sm">{{ item.nama_satuan }}</span></td>
                                                        <td class="text-right font-semibold tabular-nums">{{ Number(item.jumlah).toLocaleString('id-ID') }}</td>
                                                        <td class="text-right tabular-nums">{{ rupiah(item.harga) }}</td>
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
