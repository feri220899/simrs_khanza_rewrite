<script setup>
import { ref, reactive, computed, h, onMounted, watch } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Plus, List, PackageCheck, Trash2, Printer } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'

// Penerimaan Barang Non Medis (kredit/hutang) — src/ipsrs/IPSRSPemesanan.java
// (nama class Java menyesatkan, ini form PENERIMAAN bukan "pemesanan").
// Bisa mulai dari Surat Pemesanan berstatus "Sudah Datang" (prefill No.Order/
// Supplier/Meterai/baris barang) atau langsung standalone tanpa PO. Posting
// jurnal + tambah stok terjadi DI SINI (bukan di Surat Pemesanan) — lihat
// IpsrsPenerimaanService.js utk detail lengkap 1:1 audit Java.
//
// `nip` (petugas) WAJIB dropdown eksplisit (FK ke tabel `petugas`, BUKAN
// `pegawai` seperti Surat Pemesanan) — TIDAK boleh auto dari authStore.user.
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehBuat = () => authStore.can('penerimaan_non_medis')
const bolehUbahHarga = () => authStore.can('ipsrs_barang')

const activeTab = ref('buat')

const header = reactive({
    no_faktur: '',
    no_order: '',
    tgl_pesan: new Date().toISOString().slice(0, 10),
    tgl_faktur: new Date().toISOString().slice(0, 10),
    tgl_tempo: new Date().toISOString().slice(0, 10),
    kode_suplier: '',
    nip: '',
    ppnPercent: 11,
    meterai: 0,
})
const items = ref([]) // [{kode_brng, nama_satuan?, kode_sat, jumlah, h_pesan, dis, updateHarga}]
const opsiBarang = ref([])
const opsiSuplier = ref([])
const opsiPetugas = ref([])
const opsiPOSudahDatang = ref([])
const poTerpilih = ref('')
const saving = ref(false)
const loadingPO = ref(false)

async function muatOpsi() {
    const [barang, suplier, petugas, po] = await Promise.all([
        window.api.ipsrs.barang.listAktif(),
        window.api.ipsrs.suplier.listAll(),
        window.api.ipsrs.penerimaan.listPetugas(),
        window.api.ipsrs.suratPemesanan.list({ status: 'Sudah Datang', pageSize: 200 }),
    ])
    opsiBarang.value = barang
    opsiSuplier.value = suplier
    opsiPetugas.value = petugas
    opsiPOSudahDatang.value = po.data.map(p => ({ ...p, display: `${p.no_pemesanan} — ${p.nama_suplier || '-'}` }))
}

async function siapkanNomor() {
    header.no_faktur = await window.api.ipsrs.penerimaan.nextNoFaktur(header.tgl_pesan)
}
watch(() => header.tgl_pesan, siapkanNomor)

function kosongkanForm() {
    header.no_order = ''
    header.kode_suplier = ''
    header.nip = ''
    header.ppnPercent = 11
    header.meterai = 0
    items.value = []
    poTerpilih.value = ''
}

async function muatDariPO(noPemesanan) {
    if (!noPemesanan) return
    loadingPO.value = true
    try {
        const res = await window.api.ipsrs.penerimaan.getFromPO(noPemesanan)
        if (!res.success) { showToast(res.message, 'error'); return }
        header.no_order = res.no_order
        header.kode_suplier = res.kode_suplier
        header.meterai = res.meterai
        items.value = res.items.map(it => ({
            kode_brng: it.kode_brng, nama_satuan: it.nama_satuan, kode_sat: it.kode_sat,
            jumlah: it.jumlah, h_pesan: it.h_pesan, dis: it.dis || 0, updateHarga: true,
        }))
        showToast(`Barang dari Surat Pemesanan ${noPemesanan} berhasil dimuat — lengkapi Petugas lalu periksa jumlah yang benar-benar diterima.`, 'warning')
    } finally {
        loadingPO.value = false
    }
}
watch(poTerpilih, v => { if (v) muatDariPO(v) })

function tambahBaris() {
    items.value.push({ kode_brng: '', jumlah: '', h_pesan: '', dis: 0, updateHarga: false })
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
    items.value[i].h_pesan = b.harga
}

// Replika getData(): subtotal = jumlah*harga, besardis = ROUND(subtotal*dis%/100), total = subtotal-besardis.
function hitungBaris(it) {
    const jumlah = Number(it.jumlah) || 0
    const harga = Number(it.h_pesan) || 0
    const dis = Number(it.dis) || 0
    const subtotal = jumlah * harga
    const besardis = Math.round(subtotal * dis / 100)
    const total = subtotal - besardis
    return { subtotal, besardis, total }
}

const ringkasan = computed(() => {
    const terisi = items.value.filter(it => it.kode_brng && Number(it.jumlah) > 0)
    const subtotal = terisi.reduce((s, it) => s + hitungBaris(it).subtotal, 0)
    const potongan = terisi.reduce((s, it) => s + hitungBaris(it).besardis, 0)
    const total = subtotal - potongan
    const ppn = Math.round((Number(header.ppnPercent) || 0) / 100 * total)
    const meterai = Number(header.meterai) || 0
    const tagihan = total + ppn + meterai
    return { subtotal, potongan, total, ppn, tagihan }
})

function rupiah(v) {
    return 'Rp ' + (Number(v) || 0).toLocaleString('id-ID')
}
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char])
}

async function simpan() {
    if (!header.no_order.trim()) { showToast('No. Order tidak boleh kosong', 'error'); return }
    if (!header.kode_suplier) { showToast('Supplier tidak boleh kosong', 'error'); return }
    if (!header.nip) { showToast('Petugas tidak boleh kosong', 'error'); return }
    if (header.meterai === '' || header.meterai === null || header.meterai === undefined) { showToast('Meterai tidak boleh kosong', 'error'); return }
    if (items.value.length === 0) { showToast('Maaf, data sudah habis', 'error'); return }
    const terisi = items.value.filter(it => it.kode_brng && Number(it.jumlah) > 0)
    if (terisi.length === 0) { showToast('Maaf, Silahkan masukkan pembelian', 'error'); return }

    saving.value = true
    try {
        const itemsPayload = terisi.map(it => {
            const { subtotal, besardis, total } = hitungBaris(it)
            return {
                kode_brng: it.kode_brng, kode_sat: it.kode_sat, jumlah: it.jumlah, h_pesan: it.h_pesan,
                dis: it.dis || 0, subtotal, besardis, total, updateHarga: !!it.updateHarga && bolehUbahHarga(),
            }
        })
        const res = await window.api.ipsrs.penerimaan.create(authStore.token, {
            no_order: header.no_order,
            kode_suplier: header.kode_suplier,
            nip: header.nip,
            tgl_pesan: header.tgl_pesan,
            tgl_faktur: header.tgl_faktur,
            tgl_tempo: header.tgl_tempo,
            meterai: header.meterai,
            ppn: ringkasan.value.ppn,
            ppnPercent: header.ppnPercent,
            items: itemsPayload,
        })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(`Penerimaan ${res.no_faktur} berhasil disimpan, jurnal & stok sudah diposting.`)
        kosongkanForm()
        await siapkanNomor()
        fetchData()
    } finally {
        saving.value = false
    }
}

// ── Tab: Daftar Penerimaan ────────────────────────────────────────────────
const selectedNoFaktur = ref(null)
const detailItems = ref([])
const loadingDetail = ref(false)

async function toggleDetail(noFaktur) {
    if (selectedNoFaktur.value === noFaktur) {
        selectedNoFaktur.value = null
        detailItems.value = []
        return
    }
    selectedNoFaktur.value = noFaktur
    loadingDetail.value = true
    try {
        detailItems.value = await window.api.ipsrs.penerimaan.detail(noFaktur)
    } finally {
        loadingDetail.value = false
    }
}

async function cetak(row) {
    const detail = await window.api.ipsrs.penerimaan.detail(row.no_faktur)
    const rows = detail.map((item, index) => `<tr><td>${index + 1}</td><td>${esc(item.kode_brng)}</td><td>${esc(item.nama_brng)}</td><td>${esc(item.nama_satuan)}</td><td class="num">${item.jumlah}</td><td class="num">${rupiah(item.harga)}</td><td class="num">${rupiah(item.subtotal)}</td><td class="num">${rupiah(item.besardis)}</td><td class="num">${rupiah(item.total)}</td></tr>`).join('')
    const html = `<html><head><title>Penerimaan ${esc(row.no_faktur)}</title><style>body{font:12px Arial;color:#111;margin:24px}h1{text-align:center;font-size:18px;margin:0 0 4px}h2{text-align:center;font-size:14px;margin:0 0 20px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #555;padding:5px}th{background:#eee}.num{text-align:right}.summary{margin:16px 0 0 auto;width:280px}.summary div{display:flex;justify-content:space-between;padding:3px}.total{font-weight:bold;border-top:2px solid #111;margin-top:4px;padding-top:6px!important}@media print{body{margin:10mm}}</style></head><body><h1>PENERIMAAN BARANG NON MEDIS</h1><h2>${esc(row.no_faktur)} (No. Order: ${esc(row.no_order)})</h2><div><b>Supplier:</b> ${esc(row.nama_suplier)}<br><b>Tanggal:</b> ${esc(row.tgl_pesan)}<br><b>Petugas:</b> ${esc(row.nama_petugas || row.nip)}</div><table><thead><tr><th>No</th><th>Kode</th><th>Barang</th><th>Satuan</th><th>Jumlah</th><th>Harga</th><th>Subtotal</th><th>Potongan</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><div><span>Subtotal</span><span>${rupiah(row.total1)}</span></div><div><span>Potongan</span><span>${rupiah(row.potongan)}</span></div><div><span>PPN</span><span>${rupiah(row.ppn)}</span></div><div><span>Meterai</span><span>${rupiah(row.meterai)}</span></div><div class="total"><span>Tagihan</span><span>${rupiah(row.tagihan)}</span></div></div></body></html>`
    const printWindow = window.open('', '_blank', 'width=1000,height=700')
    if (!printWindow) { showToast('Popup cetak diblokir browser', 'error'); return }
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    printWindow.close()
}

const columns = [
    { accessorKey: 'no_faktur', header: 'No. Faktur', meta: { headerClass: 'w-36', cellClass: 'font-medium' } },
    { accessorKey: 'no_order', header: 'No. Order', meta: { headerClass: 'w-36' } },
    { accessorKey: 'nama_suplier', header: 'Supplier', enableSorting: false },
    { accessorKey: 'nama_petugas', header: 'Petugas', enableSorting: false },
    { accessorKey: 'tgl_pesan', header: 'Tanggal', meta: { headerClass: 'w-28' } },
    {
        accessorKey: 'tagihan', header: 'Tagihan', meta: { headerClass: 'w-36 text-right', cellClass: 'text-right' },
        cell: info => rupiah(info.getValue()),
    },
    { accessorKey: 'status', header: 'Status', meta: { headerClass: 'w-32' } },
    {
        id: 'aksi', header: 'Aksi', enableSorting: false,
        meta: { headerClass: 'text-center w-24', cellClass: 'text-center' },
        cell: info => h('button', { class: 'btn btn-ghost btn-sm text-primary', onClick: event => { event.stopPropagation(); cetak(info.row.original) } }, 'Cetak'),
    },
]

const { table, loading, search, fetchData } = useServerTable({
    columns,
    fetchFn: params => window.api.ipsrs.penerimaan.list(params),
    pageSize: 10,
    defaultSortBy: 'tgl_pesan',
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
            <h1 class="text-xl font-semibold tracking-tight">IPSRS — Penerimaan Barang Non Medis</h1>
            <p class="text-sm text-base-content/60 mt-0.5">Penerimaan dari Suplier (kredit/hutang) + posting jurnal &amp; stok otomatis — src/ipsrs/IPSRSPemesanan.java</p>
        </div>

        <div class="flex justify-between items-center mb-2 shrink-0 w-full">
            <div class="flex bg-base-200 rounded-xl p-1 w-fit gap-0.5">
                <button :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer', activeTab === 'buat' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']" @click="activeTab = 'buat'">
                    <Plus class="size-4" /> Terima Barang
                </button>
                <button :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer', activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']" @click="activeTab = 'list'">
                    <List class="size-4" /> Daftar Penerimaan
                </button>
            </div>
        </div>

        <!-- Tab: Terima Barang -->
        <div v-show="activeTab === 'buat'" class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
                <div class="px-5 py-3 border-b border-base-200 shrink-0">
                    <label class="block text-xs font-medium text-base-content/60 mb-1">Muat dari Surat Pemesanan (status "Sudah Datang") — opsional</label>
                    <AppSelect v-model="poTerpilih" :options="opsiPOSudahDatang" value-prop="no_pemesanan" label="display" placeholder="Cari & pilih Surat Pemesanan..." :disabled="loadingPO" />
                </div>
                <div class="px-5 py-3.5 border-b border-base-200 grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">No. Faktur</label>
                        <input :value="header.no_faktur" type="text" readonly class="input input-bordered input-sm w-full bg-base-200" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">No. Order <span class="text-error">*</span></label>
                        <input v-model="header.no_order" type="text" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Supplier <span class="text-error">*</span></label>
                        <AppSelect v-model="header.kode_suplier" :options="opsiSuplier" value-prop="kode_suplier" label="nama_suplier" placeholder="Pilih Supplier" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Petugas <span class="text-error">*</span></label>
                        <AppSelect v-model="header.nip" :options="opsiPetugas" value-prop="nip" label="nama" placeholder="Pilih Petugas" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Tanggal Pesan</label>
                        <input v-model="header.tgl_pesan" type="date" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Tanggal Faktur</label>
                        <input v-model="header.tgl_faktur" type="date" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Tanggal Tempo</label>
                        <input v-model="header.tgl_tempo" type="date" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">PPN (%)</label>
                        <input v-model="header.ppnPercent" type="number" min="0" class="input input-bordered input-sm w-full text-right" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Meterai <span class="text-error">*</span></label>
                        <input v-model="header.meterai" type="number" min="0" class="input input-bordered input-sm w-full text-right" />
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
                                <th class="text-sm font-medium py-2 w-20 text-right">Jumlah</th>
                                <th class="text-sm font-medium py-2 w-28 text-right">Harga</th>
                                <th class="text-sm font-medium py-2 w-20 text-right">Diskon %</th>
                                <th class="text-sm font-medium py-2 w-28 text-right">Subtotal</th>
                                <th class="text-sm font-medium py-2 w-24 text-right">Besar Disk.</th>
                                <th class="text-sm font-medium py-2 w-28 text-right">Total</th>
                                <th v-if="bolehUbahHarga()" class="text-sm font-medium py-2 w-24 text-center" title="Timpa harga master barang dengan harga penerimaan ini">Update Harga</th>
                                <th class="text-sm font-medium py-2 w-16 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="items.length === 0">
                                <td :colspan="bolehUbahHarga() ? 10 : 9" class="py-16 text-center text-base-content/50">Belum ada baris, klik "Tambah Baris" atau muat dari Surat Pemesanan</td>
                            </tr>
                            <tr v-else v-for="(it, i) in items" :key="i" class="border-b border-base-200">
                                <td class="py-1.5">
                                    <AppSelect :model-value="it.kode_brng" @update:model-value="v => pilihBarang(i, v)" :options="opsiBarang" value-prop="kode_brng" label="nama_brng" placeholder="Pilih Barang" />
                                </td>
                                <td class="py-1.5">{{ it.nama_satuan || '-' }}</td>
                                <td class="py-1.5"><input v-model="it.jumlah" type="number" min="0" class="input input-bordered input-sm w-full text-right" /></td>
                                <td class="py-1.5"><input v-model="it.h_pesan" type="number" min="0" class="input input-bordered input-sm w-full text-right" /></td>
                                <td class="py-1.5"><input v-model="it.dis" type="number" min="0" class="input input-bordered input-sm w-full text-right" /></td>
                                <td class="py-1.5 text-right">{{ hitungBaris(it).subtotal.toLocaleString('id-ID') }}</td>
                                <td class="py-1.5 text-right">{{ hitungBaris(it).besardis.toLocaleString('id-ID') }}</td>
                                <td class="py-1.5 text-right">{{ hitungBaris(it).total.toLocaleString('id-ID') }}</td>
                                <td v-if="bolehUbahHarga()" class="py-1.5 text-center">
                                    <input v-model="it.updateHarga" type="checkbox" class="checkbox checkbox-sm" />
                                </td>
                                <td class="py-1.5 text-center">
                                    <button class="btn btn-ghost btn-sm text-error" @click="hapusBaris(i)"><Trash2 class="size-4" /></button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="px-5 py-2 border-t border-base-200 shrink-0 flex items-center justify-between gap-4">
                    <div v-if="!bolehBuat()" class="text-warning text-sm">Anda tidak punya akses menyimpan penerimaan barang.</div>
                    <div v-else class="flex flex-wrap gap-x-8 gap-y-3 text-sm bg-base-200/30 rounded-xl px-5 py-2 border border-base-200">
                        <div class="flex flex-col items-end">
                            <p class="text-[11px] uppercase tracking-wide text-base-content/50 w-full text-right">Subtotal</p>
                            <p class="font-semibold tabular-nums">{{ rupiah(ringkasan.subtotal) }}</p>
                        </div>
                        <div class="flex flex-col items-end">
                            <p class="text-[11px] uppercase tracking-wide text-base-content/50 w-full text-right">Potongan</p>
                            <p class="font-semibold tabular-nums">{{ rupiah(ringkasan.potongan) }}</p>
                        </div>
                        <div class="flex flex-col items-end">
                            <p class="text-[11px] uppercase tracking-wide text-base-content/50 w-full text-right">Total</p>
                            <p class="font-semibold tabular-nums">{{ rupiah(ringkasan.total) }}</p>
                        </div>
                        <div class="flex flex-col items-end">
                            <p class="text-[11px] uppercase tracking-wide text-base-content/50 w-full text-right">PPN</p>
                            <p class="font-semibold tabular-nums">{{ rupiah(ringkasan.ppn) }}</p>
                        </div>
                        <div class="flex flex-col items-end">
                            <p class="text-[11px] uppercase tracking-wide text-base-content/50 w-full text-right">Tagihan</p>
                            <p class="font-bold text-primary tabular-nums">{{ rupiah(ringkasan.tagihan) }}</p>
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
                                <td colspan="7" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td>
                            </tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="7" class="py-16 text-center">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
                                            <PackageCheck class="size-7 text-base-content/30" />
                                        </div>
                                        <p class="font-semibold text-base-content/60">Belum ada penerimaan barang</p>
                                    </div>
                                </td>
                            </tr>
                            <template v-else v-for="row in table.getRowModel().rows" :key="row.id">
                                <tr :class="['border-b border-base-200 cursor-pointer transition-colors', selectedNoFaktur === row.original.no_faktur ? 'bg-primary/10' : 'hover:bg-primary/5']" @click="toggleDetail(row.original.no_faktur)">
                                    <td v-for="cell in row.getVisibleCells()" :key="cell.id" :class="['py-2', cell.column.columnDef.meta?.cellClass]">
                                        <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                                    </td>
                                </tr>
                                <tr v-if="selectedNoFaktur === row.original.no_faktur" class="bg-base-200/50">
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
                                                        <th class="text-right">Subtotal</th>
                                                        <th class="pr-4 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr v-for="item in detailItems" :key="item.kode_brng" class="hover:bg-base-200/30">
                                                        <td class="pl-4"><p class="font-medium">{{ item.nama_brng }}</p><p class="text-xs text-base-content/50">{{ item.kode_brng }}</p></td>
                                                        <td><span class="badge badge-ghost badge-sm">{{ item.nama_satuan }}</span></td>
                                                        <td class="text-right font-semibold tabular-nums">{{ Number(item.jumlah).toLocaleString('id-ID') }}</td>
                                                        <td class="text-right tabular-nums">{{ rupiah(item.harga) }}</td>
                                                        <td class="text-right tabular-nums">{{ rupiah(item.subtotal) }}</td>
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
