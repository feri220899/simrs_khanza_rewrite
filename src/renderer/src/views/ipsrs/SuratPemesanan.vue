<script setup>
import { ref, reactive, computed, h, onMounted, watch } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { useRoute } from 'vue-router'
import { Plus, List, ClipboardList, Trash2 } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'

// Surat Pemesanan (PO) Barang Non Medis — src/ipsrs/IPSRSSuratPemesanan.java
// (buat+simpan, prefill dari Pengajuan disetujui) & src/ipsrs/
// IPSRSCariSuratPemesanan.java (list+ubah status). INI PO ASLI (nulis ke DB
// beneran), BUKAN sekadar cetak. TIDAK ADA efek stok/jurnal di modul INI
// SENDIRI — status "Sudah Datang" di Java asli LANGSUNG buka IPSRSPemesanan
// (form Penerimaan, DITUNDA Fase 3 krn situ yang posting jurnal+nambah
// stok). Di sini tandaiSudahDatang() CUMA update status, TIDAK auto-buka
// Penerimaan (modulnya belum ada) — PO yang sudah "Sudah Datang" menunggu
// diproses manual begitu modul Penerimaan digarap di Fase 3.
//
// Formula per baris & header, replika PERSIS getData()/tbDokterMouseClicked
// Java baris 1552-1612 & 998-1010, DIHITUNG DI SISI KLIEN (backend
// IpsrsSuratPemesananService.create() TIDAK menghitung ulang field ini,
// cuma menjumlah utk header) — SENGAJA beda dari Pengajuan yang backend-nya
// hitung ulang total baris.
const { showToast } = useToast()
const authStore = useAuthStore()
const route = useRoute()
const bolehBuat = () => authStore.can('surat_pemesanan_non_medis')

const activeTab = ref('buat')

// ── Tab: Buat Surat Pemesanan ─────────────────────────────────────────────
const header = reactive({
    no_pemesanan: '',
    tanggal: new Date().toISOString().slice(0, 10),
    kode_suplier: '',
    ppnPercent: 11,
    meterai: 0,
})
const items = ref([]) // [{kode_brng, nama_satuan, kode_sat, jumlah, h_pesan, dis}]
const opsiBarang = ref([])
const opsiSuplier = ref([])
const saving = ref(false)

async function muatOpsi() {
    opsiBarang.value = await window.api.ipsrs.barang.listAktif()
    opsiSuplier.value = await window.api.ipsrs.suplier.listAll()
}

async function siapkanNomor() {
    header.no_pemesanan = await window.api.ipsrs.suratPemesanan.nextNomor(header.tanggal)
}
watch(() => header.tanggal, siapkanNomor)

function tambahBaris() {
    items.value.push({ kode_brng: '', jumlah: '', h_pesan: '', dis: 0 })
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
    // Default Harga Pesan = harga barang, tetap bisa diedit manual (bukan dikunci).
    items.value[i].h_pesan = b.harga
}

// Replika getData(): subtotal = jumlah*h_pesan, besardis = ROUND(subtotal*dis%/100), total = subtotal-besardis.
function hitungBaris(it) {
    const jumlah = Number(it.jumlah) || 0
    const hPesan = Number(it.h_pesan) || 0
    const dis = Number(it.dis) || 0
    const subtotal = jumlah * hPesan
    const besardis = Math.round(subtotal * dis / 100)
    const total = subtotal - besardis
    return { subtotal, besardis, total }
}

// Ringkasan bawah tabel — dihitung live dari SEMUA baris terisi (jumlah>0).
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

async function cetakPO(row) {
    const detail = await window.api.ipsrs.suratPemesanan.detail(row.no_pemesanan)
    const supplier = opsiSuplier.value.find(item => item.kode_suplier === row.kode_suplier)
    const rows = detail.map((item, index) => `<tr><td>${index + 1}</td><td>${esc(item.kode_brng)}</td><td>${esc(item.nama_brng)}</td><td>${esc(item.nama_satuan)}</td><td class="num">${item.jumlah}</td><td class="num">${rupiah(item.h_pesan)}</td><td class="num">${rupiah(item.subtotal)}</td><td class="num">${rupiah(item.besardis)}</td><td class="num">${rupiah(item.total)}</td></tr>`).join('')
    const html = `<html><head><title>Surat Pemesanan ${esc(row.no_pemesanan)}</title><style>body{font:12px Arial;color:#111;margin:24px}h1{text-align:center;font-size:18px;margin:0 0 4px}h2{text-align:center;font-size:14px;margin:0 0 20px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #555;padding:5px}th{background:#eee}.num{text-align:right}.summary{margin:16px 0 0 auto;width:280px}.summary div{display:flex;justify-content:space-between;padding:3px}.total{font-weight:bold;border-top:2px solid #111;margin-top:4px;padding-top:6px!important}@media print{body{margin:10mm}}</style></head><body><h1>SURAT PEMESANAN BARANG NON MEDIS</h1><h2>${esc(row.no_pemesanan)}</h2><div><b>Supplier:</b> ${esc(row.nama_suplier || supplier?.nama_suplier)}<br><b>Tanggal:</b> ${esc(row.tanggal)}<br><b>Petugas:</b> ${esc(row.nama_petugas || row.nip)}</div><table><thead><tr><th>No</th><th>Kode</th><th>Barang</th><th>Satuan</th><th>Jumlah</th><th>Harga</th><th>Subtotal</th><th>Potongan</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><div><span>Subtotal</span><span>${rupiah(row.subtotal)}</span></div><div><span>Potongan</span><span>${rupiah(row.potongan)}</span></div><div><span>PPN</span><span>${rupiah(row.ppn)}</span></div><div><span>Meterai</span><span>${rupiah(row.meterai)}</span></div><div class="total"><span>Tagihan</span><span>${rupiah(row.tagihan)}</span></div></div></body></html>`
    const printWindow = window.open('', '_blank', 'width=1000,height=700')
    if (!printWindow) { showToast('Popup cetak diblokir browser', 'error'); return }
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    printWindow.close()
}

async function simpan() {
    if (!header.no_pemesanan.trim()) { showToast('No. Pemesanan tidak boleh kosong', 'error'); return }
    if (!header.kode_suplier) { showToast('Supplier tidak boleh kosong', 'error'); return }
    if (!authStore.user?.username) { showToast('Petugas tidak boleh kosong', 'error'); return }
    if (header.meterai === '' || header.meterai === null || header.meterai === undefined) { showToast('Meterai tidak boleh kosong', 'error'); return }
    if (items.value.length === 0) { showToast('Maaf, data sudah habis', 'error'); return }
    const terisi = items.value.filter(it => it.kode_brng && Number(it.jumlah) > 0)
    if (terisi.length === 0) { showToast('Maaf, Silahkan masukkan pemesanan', 'error'); return }

    saving.value = true
    try {
        // Backend TIDAK menghitung ulang subtotal/besardis/total per baris —
        // WAJIB dikirim sudah dihitung dari client (beda dari Pengajuan).
        const itemsPayload = terisi.map(it => {
            const { subtotal, besardis, total } = hitungBaris(it)
            return { kode_brng: it.kode_brng, kode_sat: it.kode_sat, jumlah: it.jumlah, h_pesan: it.h_pesan, dis: it.dis || 0, subtotal, besardis, total }
        })
        const res = await window.api.ipsrs.suratPemesanan.create(authStore.token, {
            no_pemesanan: header.no_pemesanan,
            kode_suplier: header.kode_suplier,
            nip: authStore.user.username,
            tanggal: header.tanggal,
            meterai: header.meterai,
            ppn: ringkasan.value.ppn, // nilai rupiah PPN yang sudah dihitung, BUKAN persennya
            items: itemsPayload,
        })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Surat Pemesanan berhasil disimpan.')
        header.kode_suplier = ''
        header.ppnPercent = 11,
        header.meterai = 0
        items.value = []
        await siapkanNomor()
        fetchData()
    } finally {
        saving.value = false
    }
}

// Replika IPSRSSuratPemesanan.panggilgetData(String) — prefill dari
// Pengajuan yang baru disetujui (navigasi dari Pengajuan.vue lewat query
// param `dariPengajuan`). Halaman langsung buka tab "Buat" (bukan "Daftar")
// begitu datang dari prefill ini.
async function muatPrefillDariPengajuan(noPengajuan) {
    const rows = await window.api.ipsrs.pengajuan.prefillForSuratPemesanan(noPengajuan)
    // opsiBarang sudah dimuat lebih dulu di onMounted (lihat urutan panggilan
    // di bawah), jadi nama_satuan bisa langsung dicari di sini.
    items.value = rows.map(r => ({
        kode_brng: r.kode_brng,
        nama_satuan: opsiBarang.value.find(x => x.kode_brng === r.kode_brng)?.nama_satuan,
        kode_sat: r.kode_sat,
        jumlah: r.jumlah,
        h_pesan: r.h_pengajuan,
        dis: 0,
    }))
    activeTab.value = 'buat'
    // useToast cuma dukung success/warning/error (bukan 'info') — pakai
    // 'warning' biar pesan ini tetap menonjol tanpa disalah-artikan error.
    showToast(`Item dari Pengajuan ${noPengajuan} berhasil dimuat, silakan lengkapi Supplier/PPN/Meterai lalu simpan.`, 'warning')
}

// Tab: Daftar Surat Pemesanan
const statusFilter = ref('')
const selectedNoPemesanan = ref(null)
const detailItems = ref([])
const loadingDetail = ref(false)

async function toggleDetail(noPemesanan) {
    if (selectedNoPemesanan.value === noPemesanan) {
        selectedNoPemesanan.value = null
        detailItems.value = []
        return
    }
    selectedNoPemesanan.value = noPemesanan
    loadingDetail.value = true
    try {
        detailItems.value = await window.api.ipsrs.suratPemesanan.detail(noPemesanan)
    } catch (e) {
        showToast('Gagal memuat detail', 'error')
    } finally {
        loadingDetail.value = false
    }
}

async function hapus(row) {
    if (!confirm(`Hapus Surat Pemesanan "${row.no_pemesanan}"? Ini TIDAK BISA dibatalkan.`)) return
    const res = await window.api.ipsrs.suratPemesanan.delete(authStore.token, row.no_pemesanan)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Surat Pemesanan berhasil dihapus.')
    fetchData()
}

const columns = [
    { accessorKey: 'no_pemesanan', header: 'No. Pemesanan', meta: { headerClass: 'w-40', cellClass: 'font-medium' } },
    { accessorKey: 'nama_suplier', header: 'Supplier', enableSorting: false },
    { accessorKey: 'nama_petugas', header: 'Petugas', enableSorting: false },
    { accessorKey: 'tanggal', header: 'Tanggal', meta: { headerClass: 'w-28' } },
    {
        accessorKey: 'tagihan', header: 'Tagihan', meta: { headerClass: 'w-36 text-right', cellClass: 'text-right' },
        cell: info => rupiah(info.getValue()),
    },
    {
        accessorKey: 'status', header: 'Status', meta: { headerClass: 'w-32' },
        cell: info => {
            const s = info.getValue()
            const cls = s === 'Sudah Datang' ? 'badge-success' : 'badge-warning'
            return h('span', { class: `badge badge-sm ${cls}` }, s)
        },
    },
    {
        id: 'aksi', header: 'Aksi', enableSorting: false,
        meta: { headerClass: 'text-center w-64', cellClass: 'text-center' },
        cell: info => {
            const row = info.row.original
            const btns = []
            btns.push(h('button', { class: 'btn btn-ghost btn-sm text-primary', onClick: event => { event.stopPropagation(); cetakPO(row) } }, 'Cetak'))
            if (row.status === 'Proses Pesan') {
                btns.push(h('button', { class: 'btn btn-ghost btn-sm text-success', disabled: !bolehBuat(), onClick: event => { event.stopPropagation(); tandaiDatang(row) } }, 'Tandai Sudah Datang'))
            }
            if (row.status === 'Sudah Datang') {
                btns.push(h('button', { class: 'btn btn-ghost btn-sm', disabled: !bolehBuat(), onClick: event => { event.stopPropagation(); kembalikanProses(row) } }, 'Kembalikan ke Proses Pesan'))
            }
            btns.push(h('button', { class: 'btn btn-ghost btn-sm text-error', disabled: !bolehBuat(), onClick: event => { event.stopPropagation(); hapus(row) } }, 'Hapus'))
            return h('div', { class: 'flex gap-1 justify-center' }, btns)
        },
    },
]

const { table, loading, search, fetchData } = useServerTable({
    columns,
    fetchFn: params => window.api.ipsrs.suratPemesanan.list({ ...params, status: statusFilter.value }),
    pageSize: 10,
    defaultSortBy: 'tanggal',
    defaultSortOrder: 'desc',
})
watch(statusFilter, fetchData)

// Replika ppDatangActionPerformed: Java asli LANGSUNG buka form IPSRSPemesanan
// (Penerimaan) sesudah tandai "Sudah Datang" buat proses stok+jurnal — modul
// itu DITUNDA ke Fase 3 (belum dibangun), jadi di sini aksi CUMA menandai
// status, TIDAK membuka form apa pun setelahnya.
async function tandaiDatang(row) {
    if (!confirm(`Tandai Surat Pemesanan "${row.no_pemesanan}" sebagai Sudah Datang?`)) return
    const res = await window.api.ipsrs.suratPemesanan.tandaiSudahDatang(authStore.token, row.no_pemesanan)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Surat Pemesanan ditandai Sudah Datang.')
    fetchData()
}

// Replika ppProsesActionPerformed — koreksi kalau salah tandai.
async function kembalikanProses(row) {
    if (!confirm(`Kembalikan Surat Pemesanan "${row.no_pemesanan}" ke Proses Pesan?`)) return
    const res = await window.api.ipsrs.suratPemesanan.tandaiProsesPesan(authStore.token, row.no_pemesanan)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Surat Pemesanan dikembalikan ke Proses Pesan.')
    fetchData()
}

onMounted(async () => {
    await muatOpsi()
    await siapkanNomor()
    const noPengajuan = route.query.dariPengajuan
    if (noPengajuan) await muatPrefillDariPengajuan(noPengajuan)
})
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="mb-2 shrink-0">
            <h1 class="text-xl font-semibold tracking-tight">IPSRS — Surat Pemesanan Barang Non Medis</h1>
            <p class="text-sm text-base-content/60 mt-0.5">PO ke Supplier (src/ipsrs/IPSRSSuratPemesanan.java, IPSRSCariSuratPemesanan.java)</p>
        </div>

        <div class="flex bg-base-200 rounded-xl p-1 w-fit mb-2 shrink-0 gap-0.5">
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'buat' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'buat'">
                <Plus class="size-4" />
                Buat Surat Pemesanan
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'list'">
                <List class="size-4" />
                Daftar Surat Pemesanan
            </button>
        </div>

        <!-- Tab: Buat -->
        <div v-show="activeTab === 'buat'" class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
                <div class="px-5 py-3.5 border-b border-base-200 grid grid-cols-1 sm:grid-cols-6 gap-3 shrink-0">
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">No. Pemesanan</label>
                        <input :value="header.no_pemesanan" type="text" readonly class="input input-bordered input-sm w-full bg-base-200" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Tanggal</label>
                        <input v-model="header.tanggal" type="date" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Supplier <span class="text-error">*</span></label>
                        <AppSelect v-model="header.kode_suplier" :options="opsiSuplier" value-prop="kode_suplier" label="nama_suplier" placeholder="Pilih Supplier" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Petugas</label>
                        <input :value="authStore.user?.username" type="text" readonly class="input input-bordered input-sm w-full bg-base-200" />
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
                    <button class="btn btn-ghost btn-sm gap-1" @click="tambahBaris">
                        <Plus class="size-4" />
                        Tambah Baris
                    </button>
                </div>

                <div class="flex-1 min-h-0 overflow-y-auto">
                    <table class="table">
                        <thead class="sticky top-0 z-10 bg-base-100">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th class="text-sm font-medium py-2 w-64">Barang</th>
                                <th class="text-sm font-medium py-2 w-20">Satuan</th>
                                <th class="text-sm font-medium py-2 w-20 text-right">Jumlah</th>
                                <th class="text-sm font-medium py-2 w-28 text-right">Harga Pesan</th>
                                <th class="text-sm font-medium py-2 w-20 text-right">Diskon %</th>
                                <th class="text-sm font-medium py-2 w-28 text-right">Subtotal</th>
                                <th class="text-sm font-medium py-2 w-24 text-right">Besar Disk.</th>
                                <th class="text-sm font-medium py-2 w-28 text-right">Total</th>
                                <th class="text-sm font-medium py-2 w-16 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="items.length === 0"><td colspan="9" class="py-16 text-center text-base-content/50">Belum ada baris, klik "Tambah Baris"</td></tr>
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
                                    <input v-model="it.h_pesan" type="number" min="0" class="input input-bordered input-sm w-full text-right" />
                                </td>
                                <td class="py-1.5">
                                    <input v-model="it.dis" type="number" min="0" class="input input-bordered input-sm w-full text-right" />
                                </td>
                                <td class="py-1.5 text-right">{{ hitungBaris(it).subtotal.toLocaleString('id-ID') }}</td>
                                <td class="py-1.5 text-right">{{ hitungBaris(it).besardis.toLocaleString('id-ID') }}</td>
                                <td class="py-1.5 text-right">{{ hitungBaris(it).total.toLocaleString('id-ID') }}</td>
                                <td class="py-1.5 text-center">
                                    <button class="btn btn-ghost btn-sm text-error" @click="hapusBaris(i)">
                                        <Trash2 class="size-4" />
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="px-5 py-3 border-t border-base-200 shrink-0 flex items-start justify-between gap-4">
                    <div v-if="!bolehBuat()" class="text-warning text-sm">Anda tidak punya akses membuat surat pemesanan.</div>
                    <div v-else class="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-1 text-sm">
                        <span class="text-base-content/60">Subtotal</span><span class="text-right font-medium">{{ rupiah(ringkasan.subtotal) }}</span>
                        <span class="text-base-content/60">Potongan</span><span class="text-right font-medium">{{ rupiah(ringkasan.potongan) }}</span>
                        <span class="text-base-content/60">Total</span><span class="text-right font-medium">{{ rupiah(ringkasan.total) }}</span>
                        <span class="text-base-content/60">PPN</span><span class="text-right font-medium">{{ rupiah(ringkasan.ppn) }}</span>
                        <span class="text-base-content/60 font-semibold">Tagihan</span><span class="text-right font-semibold">{{ rupiah(ringkasan.tagihan) }}</span>
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
            <div class="flex gap-2 mb-2 shrink-0">
                <button v-for="s in [{v:'',l:'Semua'},{v:'Proses Pesan',l:'Proses Pesan'},{v:'Sudah Datang',l:'Sudah Datang'}]" :key="s.v"
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
                            <tr v-if="loading"><td colspan="7" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="7" class="py-16 text-center">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
                                            <ClipboardList class="size-7 text-base-content/30" />
                                        </div>
                                        <p class="font-semibold text-base-content/60">Belum ada surat pemesanan</p>
                                    </div>
                                </td>
                            </tr>
<template v-else v-for="row in table.getRowModel().rows" :key="row.id">
                                 <tr
                                     :class="['border-b border-base-200 cursor-pointer transition-colors', selectedNoPemesanan === row.original.no_pemesanan ? 'bg-primary/10' : 'hover:bg-primary/5']"
                                     @click="toggleDetail(row.original.no_pemesanan)">
                                     <td v-for="cell in row.getVisibleCells()" :key="cell.id" :class="['py-2', cell.column.columnDef.meta?.cellClass]">
                                         <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                                     </td>
                                 </tr>
                                 <tr v-if="selectedNoPemesanan === row.original.no_pemesanan" class="bg-base-200/50">
                                     <td :colspan="table.getVisibleLeafColumns().length" class="p-4">
                                         <div class="rounded-xl border border-base-200 bg-base-100 shadow-sm overflow-hidden">
                                             <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-base-200 bg-base-200/40">
                                                 <div>
                                                     <p class="text-xs font-medium uppercase tracking-wide text-base-content/50">Detail Surat Pemesanan</p>
                                                     <p class="font-semibold">{{ row.original.no_pemesanan }}</p>
                                                 </div>
                                                 <span :class="['badge badge-sm whitespace-nowrap', row.original.status === 'Sudah Datang' ? 'badge-success' : 'badge-warning']">{{ row.original.status }}</span>
                                             </div>
                                             <div class="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-3 text-sm border-b border-base-200">
                                                 <div><p class="text-xs text-base-content/50">Supplier</p><p class="font-medium">{{ row.original.nama_suplier || '—' }}</p></div>
                                                 <div><p class="text-xs text-base-content/50">Petugas</p><p class="font-medium">{{ row.original.nama_petugas || '—' }}</p></div>
                                                 <div><p class="text-xs text-base-content/50">Tanggal</p><p class="font-medium">{{ row.original.tanggal }}</p></div>
                                                 <div><p class="text-xs text-base-content/50">Kode Supplier</p><p class="font-medium">{{ row.original.kode_suplier }}</p></div>
                                             </div>
                                             <div v-if="loadingDetail" class="py-10 text-center"><span class="loading loading-spinner loading-md text-primary"></span></div>
                                             <div v-else-if="detailItems.length === 0" class="py-10 text-center text-sm text-base-content/50">Tidak ada detail barang.</div>
                                             <div v-else class="overflow-x-auto">
                                                 <table class="table table-sm">
                                                     <thead><tr class="bg-base-200/40"><th class="pl-4">Barang</th><th>Satuan</th><th class="text-right">Jumlah</th><th class="text-right">Harga</th><th class="text-right">Subtotal</th><th class="text-right">Diskon</th><th class="pr-4 text-right">Total</th></tr></thead>
                                                     <tbody>
                                                         <tr v-for="item in detailItems" :key="item.kode_brng" class="hover:bg-base-200/30">
                                                             <td class="pl-4"><p class="font-medium">{{ item.nama_brng }}</p><p class="text-xs text-base-content/50">{{ item.kode_brng }}</p></td>
                                                             <td><span class="badge badge-ghost badge-sm">{{ item.nama_satuan }}</span></td>
                                                             <td class="text-right font-semibold tabular-nums">{{ Number(item.jumlah).toLocaleString('id-ID') }}</td>
                                                             <td class="text-right tabular-nums">Rp {{ Number(item.h_pesan).toLocaleString('id-ID') }}</td>
                                                             <td class="text-right tabular-nums">Rp {{ Number(item.subtotal).toLocaleString('id-ID') }}</td>
                                                             <td class="text-right tabular-nums">{{ Number(item.dis).toLocaleString('id-ID') }}%<span class="block text-xs text-base-content/50">Rp {{ Number(item.besardis).toLocaleString('id-ID') }}</span></td>
                                                             <td class="pr-4 text-right font-semibold tabular-nums text-primary">Rp {{ Number(item.total).toLocaleString('id-ID') }}</td>
                                                         </tr>
                                                     </tbody>
                                                 </table>
                                             </div>
                                             <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 border-t border-base-200 bg-base-200/20 text-sm">
                                                 <div><p class="text-xs text-base-content/50">Subtotal</p><p class="font-semibold">{{ rupiah(row.original.subtotal) }}</p></div>
                                                 <div><p class="text-xs text-base-content/50">Potongan</p><p class="font-semibold">{{ rupiah(row.original.potongan) }}</p></div>
                                                 <div><p class="text-xs text-base-content/50">PPN</p><p class="font-semibold">{{ rupiah(row.original.ppn) }}</p></div>
                                                 <div><p class="text-xs text-base-content/50">Total Tagihan</p><p class="font-bold text-primary">{{ rupiah(row.original.tagihan) }}</p></div>
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
