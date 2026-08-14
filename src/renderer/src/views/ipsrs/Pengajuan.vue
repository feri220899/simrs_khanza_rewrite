<script setup>
import { ref, reactive, h, onMounted, watch } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { useRouter } from 'vue-router'
import { Plus, List, ClipboardList, Trash2, Printer, FileText } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'

// Pengajuan Barang Non Medis — src/ipsrs/IPSRSPengajuanBarangNonMedis.java
// (buat) & src/ipsrs/DlgCariPengajuanBarangNonMedis.java (list+approve+tolak+
// hapus+proses). TIDAK ADA efek stok/jurnal (murni proposal, sama seperti
// Permintaan) — bedanya Pengajuan yang disetujui berlanjut jadi Surat
// Pemesanan (PO beneran), makanya ada tombol "Setujui" yang navigasi ke
// SuratPemesanan.vue setelah approve sukses.
//
// Petugas (nip) DIPAKSA = pegawai yang sedang login, replika persis
// `kdptg.setText(akses.getkode()); btnPetugas.setEnabled(false)` di Java
// (dikonfirmasi `user.id_user` == `pegawai.nik`) — field readonly, BUKAN
// dropdown, SAMA pola Permintaan.vue.
const { showToast } = useToast()
const authStore = useAuthStore()
const router = useRouter()
const bolehBuat = () => authStore.can('pengajuan_barang_nonmedis')
// Replika DlgCariPengajuanBarangNonMedis.isCek() baris 1079-1086: Setujui
// digate slug modul SURAT PEMESANAN (`surat_pemesanan_non_medis`) — BUKAN
// slug modul ini sendiri, krn approve = langkah awal alur PO. Tolak/Proses
// Ulang/Hapus tetap digate slug modul INI SENDIRI.
const bolehSetujui = () => authStore.can('surat_pemesanan_non_medis')

const activeTab = ref('buat')

// ── Tab: Buat Pengajuan ───────────────────────────────────────────────────
const header = reactive({ no_pengajuan: '', tanggal: new Date().toISOString().slice(0, 10), keterangan: '' })
const items = ref([]) // [{kode_brng, nama_satuan, kode_sat, jumlah, h_pengajuan}]
const opsiBarang = ref([])
const saving = ref(false)

async function muatOpsiBarang() {
    opsiBarang.value = await window.api.ipsrs.barang.listAktif()
}

async function siapkanNomor() {
    header.no_pengajuan = await window.api.ipsrs.pengajuan.nextNomor(header.tanggal)
}
watch(() => header.tanggal, siapkanNomor)

function tambahBaris() {
    items.value.push({ kode_brng: '', jumlah: '', h_pengajuan: '' })
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
    // Replika default h_pengajuan = harga barang, TETAP bisa diedit manual
    // (bukan dikunci) — dikonfirmasi field `h_pengajuan` di Java tidak
    // di-disable sesudah auto-fill.
    items.value[ i ].h_pengajuan = b.harga
}
function totalBaris(it) {
    const jumlah = Number(it.jumlah) || 0
    const hPengajuan = Number(it.h_pengajuan) || 0
    return jumlah * hPengajuan
}

async function simpan() {
    if (!header.keterangan.trim()) { showToast('Keterangan tidak boleh kosong', 'error'); return }
    if (items.value.length === 0) { showToast('Maaf, data sudah habis...!!!!', 'error'); return }
    const terisi = items.value.filter(it => it.kode_brng && Number(it.jumlah) > 0)
    if (terisi.length === 0) { showToast('Maaf, Silahkan masukkan permintaan...!!!!', 'error'); return }

    saving.value = true
    try {
        // Backend (IpsrsPengajuanService.create) yang hitung ulang total per
        // baris (jumlah * h_pengajuan) & simpan — form cuma kirim h_pengajuan
        // mentah, JANGAN kirim field total dari client.
        const res = await window.api.ipsrs.pengajuan.create(authStore.token, {
            no_pengajuan: header.no_pengajuan,
            nip: authStore.user.username,
            tanggal: header.tanggal,
            keterangan: header.keterangan,
            items: terisi.map(it => ({ kode_brng: it.kode_brng, kode_sat: it.kode_sat, jumlah: it.jumlah, h_pengajuan: it.h_pengajuan })),
        })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Pengajuan berhasil disimpan.')
        header.keterangan = ''
        items.value = []
        await siapkanNomor()
        fetchData()
    } finally {
        saving.value = false
    }
}

// Tab: Daftar Pengajuan
const statusFilter = ref('')
const selectedNoPengajuan = ref(null)
const detailItems = ref([])
const loadingDetail = ref(false)

async function toggleDetail(noPengajuan) {
    if (selectedNoPengajuan.value === noPengajuan) {
        selectedNoPengajuan.value = null
        detailItems.value = []
        return
    }
    selectedNoPengajuan.value = noPengajuan
    loadingDetail.value = true
    try {
        detailItems.value = await window.api.ipsrs.pengajuan.detail(noPengajuan)
    } catch (e) {
        showToast('Gagal memuat detail', 'error')
    } finally {
        loadingDetail.value = false
    }
}

const columns = [
    { accessorKey: 'no_pengajuan', header: 'No. Pengajuan', meta: { headerClass: 'w-40', cellClass: 'font-medium' } },
    { accessorKey: 'nama_petugas', header: 'Petugas', enableSorting: false },
    { accessorKey: 'tanggal', header: 'Tanggal', meta: { headerClass: 'w-28' } },
    { accessorKey: 'keterangan', header: 'Keterangan', enableSorting: false },
    {
        accessorKey: 'status', header: 'Status', meta: { headerClass: 'w-40', cellClass: 'whitespace-nowrap' },
        cell: info => {
            const s = info.getValue()
            const cls = s === 'Disetujui' ? 'badge-success' : s === 'Ditolak' ? 'badge-error' : 'badge-warning'
            return h('span', { class: `badge badge-sm ${cls} whitespace-nowrap min-w-max` }, s)
        },
    },
    {
        id: 'aksi', header: 'Aksi', enableSorting: false,
        meta: { headerClass: 'text-center w-56', cellClass: 'text-center' },
        cell: info => {
            const row = info.row.original
            const btns = []
            if (row.status === 'Proses Pengajuan') {
                btns.push(h('button', { class: 'btn btn-ghost btn-sm text-success', disabled: !bolehSetujui(), onClick: event => { event.stopPropagation(); setujui(row) } }, 'Setujui'))
                btns.push(h('button', { class: 'btn btn-ghost btn-sm text-error', disabled: !bolehBuat(), onClick: event => { event.stopPropagation(); ubahStatus(row, 'Ditolak') } }, 'Tolak'))
            }
            if (row.status === 'Ditolak') {
                btns.push(h('button', { class: 'btn btn-ghost btn-sm', disabled: !bolehBuat(), onClick: event => { event.stopPropagation(); ubahStatus(row, 'Proses Pengajuan') } }, 'Proses Ulang'))
            }
            btns.push(h('button', { class: 'btn btn-ghost btn-sm', disabled: !bolehBuat(), onClick: event => { event.stopPropagation(); hapus(row) } }, 'Hapus'))
            return h('div', { class: 'flex gap-1 justify-center' }, btns)
        },
    },
]

const { table, loading, search, fetchData } = useServerTable({
    columns,
    fetchFn: params => window.api.ipsrs.pengajuan.list({ ...params, status: statusFilter.value }),
    pageSize: 10,
    defaultSortBy: 'tanggal',
    defaultSortOrder: 'desc',
})
watch(statusFilter, fetchData)

// Replika ppDisetujuiActionPerformed: Java asli LANGSUNG buka form
// IPSRSSuratPemesanan sesudah approve sukses buat prefill baris item. Di
// Electron ini direplikasi lewat navigasi + query param `dariPengajuan`,
// ditangkap SuratPemesanan.vue di onMounted. Kalau approve gagal (mis. guard
// "sudah tervalidasi"), JANGAN navigasi, cukup toast error.
async function setujui(row) {
    if (!confirm(`Setujui pengajuan "${row.no_pengajuan}"? Anda akan diarahkan ke form Surat Pemesanan.`)) return
    const res = await window.api.ipsrs.pengajuan.approve(authStore.token, row.no_pengajuan)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Pengajuan berhasil disetujui.')
    router.push({ path: '/ipsrs/surat-pemesanan', query: { dariPengajuan: row.no_pengajuan } })
}

async function ubahStatus(row, status) {
    const label = status === 'Ditolak' ? 'Tolak' : 'Proses ulang'
    if (!confirm(`${label} pengajuan "${row.no_pengajuan}"?`)) return
    const res = await window.api.ipsrs.pengajuan.setStatus(authStore.token, row.no_pengajuan, status)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast(`Pengajuan berhasil di${status === 'Ditolak' ? 'tolak' : 'proses ulang'}.`)
    fetchData()
}

// Replika ppHapusActionPerformed — gate permission `pengajuan_barang_nonmedis`
// biasa (BUKAN role-based spt Permintaan.vue).
async function hapus(row) {
    if (!confirm(`Hapus pengajuan "${row.no_pengajuan}"? Ini TIDAK BISA dibatalkan.`)) return
    const res = await window.api.ipsrs.pengajuan.delete(authStore.token, row.no_pengajuan)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Pengajuan berhasil dihapus.')
    fetchData()
}

function cetakPengajuan(row) {
    if (!detailItems.value.length) { showToast('Detail belum dimuat', 'warning'); return }
    const w = window.open('', '_blank', 'width=800,height=600')
    if (!w) return
    const rows = detailItems.value.map(it => `<tr><td>${it.nama_brng}</td><td class="text-center">${it.nama_satuan}</td><td class="text-center">${it.jumlah}</td><td class="text-right">Rp ${Number(it.h_pengajuan).toLocaleString('id-ID')}</td><td class="text-right">Rp ${Number(it.total).toLocaleString('id-ID')}</td></tr>`).join('')
    const total = detailItems.value.reduce((sum, it) => sum + Number(it.total), 0)
    w.document.write(`<html><head><title>Cetak Pengajuan</title><style>body{font:12px Arial;margin:20px}h2{text-align:center;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #000;padding:6px}th{background:#eee}.text-center{text-align:center}.text-right{text-align:right}.info{margin-bottom:15px;line-height:1.6}.info span{display:inline-block;width:120px;font-weight:bold}tfoot th{background:#eee}</style></head><body><h2>PENGAJUAN BARANG NON MEDIS</h2><div class="info"><div><span>No. Pengajuan</span>: ${row.no_pengajuan}</div><div><span>Tanggal</span>: ${row.tanggal}</div><div><span>Petugas</span>: ${row.nama_petugas}</div><div><span>Keterangan</span>: ${row.keterangan || '-'}</div><div><span>Status</span>: ${row.status}</div></div><table><thead><tr><th>Barang</th><th class="text-center">Satuan</th><th class="text-center">Jumlah</th><th class="text-right">Harga Pengajuan</th><th class="text-right">Total</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="4" class="text-right">Grand Total</th><th class="text-right">Rp ${total.toLocaleString('id-ID')}</th></tr></tfoot></table></body></html>`)
    w.document.close()
    w.focus()
    w.print()
    w.close()
}


// ── Tab: Ringkasan Pengajuan ───────────────────────────────────────────────
const today = new Date()
const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)

const tglAwal = ref(defaultStart)
const tglAkhir = ref(defaultEnd)
const statusFilterRingkasan = ref('Semua')
const petugas = ref('')
const jenis = ref('')
const barang = ref('')

const summary = ref({ jumlah: 0, total: 0 })

const columnsRingkasan = [
    { accessorKey: 'kode_brng', header: 'Kode Barang', meta: { headerClass: 'w-32 font-medium' } },
    { accessorKey: 'nama_brng', header: 'Nama Barang' },
    { accessorKey: 'kode_sat', header: 'Kode Sat', meta: { headerClass: 'w-24 text-center', cellClass: 'text-center' } },
    { accessorKey: 'satuan', header: 'Satuan', meta: { headerClass: 'w-28 text-center', cellClass: 'text-center' } },
    { accessorKey: 'namajenis', header: 'Jenis', meta: { headerClass: 'w-32' } },
    { accessorKey: 'jumlah', header: 'Jumlah', meta: { headerClass: 'w-24 text-right', cellClass: 'text-right tabular-nums' } },
    {
        accessorKey: 'total', header: 'Total', meta: { headerClass: 'w-36 text-right', cellClass: 'text-right tabular-nums font-medium' },
        cell: info => `Rp ${Number(info.getValue()).toLocaleString('id-ID')}`
    }
]

const { table: tableRingkasan, loading: loadingRingkasan, search: searchRingkasan, fetchData: fetchRingkasan } = useServerTable({
    columns: columnsRingkasan,
    fetchFn: async params => {
        const res = await window.api.ipsrs.laporan.ringkasanPengajuan({
            ...params, tglAwal: tglAwal.value, tglAkhir: tglAkhir.value,
            status: statusFilterRingkasan.value, petugas: petugas.value, jenis: jenis.value, barang: barang.value
        })
        summary.value = res.summary || { jumlah: 0, total: 0 }
        return res
    },
    pageSize: 50,
    defaultSortBy: 'kode_brng',
    defaultSortOrder: 'asc',
})

const esc = (s) => (s ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const rupiah = (num) => `Rp ${Number(num || 0).toLocaleString('id-ID')}`

function terapkanFilterRingkasan() {
    fetchRingkasan()
}

function cetakRingkasan() {
    const data = tableRingkasan.getRowModel().rows.map(r => r.original)
    if (data.length === 0) { showToast('Tidak ada data untuk dicetak', 'error'); return }
    const w = window.open('', '_blank', 'width=1000,height=700')
    if (!w) { showToast('Popup cetak diblokir browser', 'error'); return }

    const headerText = `<b>Tanggal:</b> ${esc(tglAwal.value)} s/d ${esc(tglAkhir.value)}<br>` +
        `<b>Status:</b> ${esc(statusFilterRingkasan.value)}`

    const rowsHtml = data.map(r => `<tr><td>${esc(r.kode_brng)}</td><td>${esc(r.nama_brng)}</td><td class="text-center">${esc(r.kode_sat)}</td><td class="text-center">${esc(r.satuan)}</td><td>${esc(r.namajenis)}</td><td class="num">${esc(r.jumlah)}</td><td class="num">${rupiah(r.total)}</td></tr>`).join('')

    const summaryHtml = `<div class="summary"><div><span>Total Pengajuan</span><span>${rupiah(summary.value.total)}</span></div></div>`

    w.document.write(`<html><head><title>Ringkasan Pengajuan Non Medis</title><style>body{font:12px Arial;margin:20px}h1{text-align:center;font-size:16px;margin:0 0 4px}h2{text-align:center;font-size:14px;font-weight:normal;margin:0 0 16px}.info{margin-bottom:12px;line-height:1.6}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #777;padding:6px;text-align:left}th{background:#eee}.num{text-align:right}.text-center{text-align:center}.summary{margin:14px 0 0 auto;width:300px}.summary div{display:flex;justify-content:space-between;padding:3px;border-top:2px solid #111;font-weight:bold}@media print{body{margin:10mm}}</style></head><body><h1>RINGKASAN PENGAJUAN BARANG NON MEDIS</h1><h2>IPSRS — Sarana Prasarana</h2><div class="info">${headerText}</div><table><thead><tr><th>Kode Barang</th><th>Nama Barang</th><th class="text-center">Kode Sat</th><th class="text-center">Satuan</th><th>Jenis</th><th class="num">Jumlah</th><th class="num">Total</th></tr></thead><tbody>${rowsHtml}</tbody></table>${summaryHtml}</body></html>`)
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
            <h1 class="text-xl font-semibold tracking-tight">IPSRS — Pengajuan Barang Non Medis</h1>
            <p class="text-sm text-base-content/60 mt-0.5">Pengajuan barang, tanpa efek stok/jurnal
                (src/ipsrs/IPSRSPengajuanBarangNonMedis.java, DlgCariPengajuanBarangNonMedis.java)</p>
        </div>

        <div class="flex justify-between items-center mb-2 shrink-0 w-full">
            <div class="flex bg-base-200 rounded-xl p-1 w-fit gap-0.5">
                <button
                    :class="[ 'px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                        activeTab === 'buat' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content' ]"
                    @click="activeTab = 'buat'">
                    <Plus class="size-4" />
                    Buat Pengajuan
                </button>
                <button
                    :class="[ 'px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                        activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content' ]"
                    @click="activeTab = 'list'">
                    <List class="size-4" />
                    Daftar Pengajuan
                </button>
                <button
                    :class="[ 'px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                        activeTab === 'ringkasan' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content' ]"
                    @click="activeTab = 'ringkasan'">
                    <FileText class="size-4" />
                    Ringkasan Pengajuan
                </button>
            </div>
            <button v-show="activeTab === 'ringkasan'" class="btn btn-ghost btn-xs text-primary gap-1 cursor-pointer"
                @click="cetakRingkasan">
                <Printer class="size-3.5" /> Cetak Ringkasan
            </button>
        </div>

        <!-- Tab: Buat -->
        <div v-show="activeTab === 'buat'" class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div
                class="bg-base-100 rounded-2xl border border-base-200 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
                <div class="px-5 py-3.5 border-b border-base-200 grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">No. Pengajuan</label>
                        <input :value="header.no_pengajuan" type="text" readonly
                            class="input input-bordered input-sm w-full bg-base-200" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Tanggal</label>
                        <input v-model="header.tanggal" type="date" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Keterangan <span
                                class="text-error">*</span></label>
                        <input v-model="header.keterangan" type="text" class="input input-bordered input-sm w-full"
                            placeholder="Keterangan pengajuan" />
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
                                <th class="text-sm font-medium py-2 w-72">Barang</th>
                                <th class="text-sm font-medium py-2 w-20">Satuan</th>
                                <th class="text-sm font-medium py-2 w-24 text-right">Jumlah</th>
                                <th class="text-sm font-medium py-2 w-32 text-right">Harga Pengajuan</th>
                                <th class="text-sm font-medium py-2 w-32 text-right">Total</th>
                                <th class="text-sm font-medium py-2 w-16 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="items.length === 0">
                                <td colspan="6" class="py-16 text-center text-base-content/50">Belum ada baris, klik
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
                                    <input v-model="it.h_pengajuan" type="number" min="0"
                                        class="input input-bordered input-sm w-full text-right" />
                                </td>
                                <td class="py-1.5 text-right">{{ totalBaris(it).toLocaleString('id-ID') }}</td>
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
                    <p v-if="!bolehBuat()" class="text-warning text-sm">Anda tidak punya akses membuat pengajuan.</p>
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
                    v-for="s in [ { v: '', l: 'Semua' }, { v: 'Proses Pengajuan', l: 'Proses Pengajuan' }, { v: 'Disetujui', l: 'Disetujui' }, { v: 'Ditolak', l: 'Ditolak' } ]"
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
                                        <p class="font-semibold text-base-content/60">Belum ada pengajuan</p>
                                    </div>
                                </td>
                            </tr>
                            <template v-else v-for="row in table.getRowModel().rows" :key="row.id">
                                <tr :class="[ 'border-b border-base-200 cursor-pointer transition-colors', selectedNoPengajuan === row.original.no_pengajuan ? 'bg-primary/10' : 'hover:bg-primary/5' ]"
                                    @click="toggleDetail(row.original.no_pengajuan)">
                                    <td v-for="cell in row.getVisibleCells()" :key="cell.id"
                                        :class="[ 'py-2', cell.column.columnDef.meta?.cellClass ]">
                                        <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                                    </td>
                                </tr>
                                <tr v-if="selectedNoPengajuan === row.original.no_pengajuan" class="bg-base-200/50">
                                    <td :colspan="table.getVisibleLeafColumns().length" class="p-4">
                                        <div
                                            class="rounded-xl border border-base-200 bg-base-100 shadow-sm overflow-hidden">
                                            <div
                                                class="flex items-center justify-between gap-3 px-4 py-2 border-b border-base-200 bg-base-200/40">
                                                <div>
                                                    <p class="text-xs font-semibold text-base-content/60 uppercase">
                                                        Detail Pengajuan</p>
                                                    <p class="text-sm font-medium">{{ row.original.no_pengajuan }}</p>
                                                </div>
                                                <button class="btn btn-ghost btn-xs text-primary"
                                                    @click.stop="cetakPengajuan(row.original)"
                                                    :disabled="loadingDetail || detailItems.length === 0">
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
                                                    <thead>
                                                        <tr class="bg-base-200/40">
                                                            <th class="pl-4">Barang</th>
                                                            <th>Satuan</th>
                                                            <th class="text-right">Jumlah</th>
                                                            <th class="text-right">Harga Pengajuan</th>
                                                            <th class="pr-4 text-right">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
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
                                                            <td class="text-right tabular-nums">Rp {{
                                                                Number(item.h_pengajuan).toLocaleString('id-ID') }}</td>
                                                            <td
                                                                class="pr-4 text-right font-semibold tabular-nums text-primary">
                                                                Rp {{ Number(item.total).toLocaleString('id-ID') }}</td>
                                                        </tr>
                                                    </tbody>
                                                    <tfoot>
                                                        <tr class="bg-base-200/20 font-bold border-t border-base-200">
                                                            <td colspan="4" class="text-right py-2">Grand Total:</td>
                                                            <td class="pr-4 text-right text-primary py-2">Rp {{
                                                                detailItems.reduce((acc, x) => acc + Number(x.total),
                                                                0).toLocaleString('id-ID') }}</td>
                                                        </tr>
                                                    </tfoot>
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

        <!-- Tab: Ringkasan Pengajuan -->
        <div v-show="activeTab === 'ringkasan'" class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div
                class="bg-base-100 rounded-2xl border border-base-200 shadow-sm h-full flex flex-col overflow-hidden px-4 py-3">
                <div class="flex flex-wrap items-end gap-2 mb-3 shrink-0">
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Dari Tanggal</label>
                        <input v-model="tglAwal" type="date" class="input input-bordered input-sm w-36" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Sampai</label>
                        <input v-model="tglAkhir" type="date" class="input input-bordered input-sm w-36" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Status</label>
                        <select v-model="statusFilterRingkasan" class="select select-bordered select-sm w-36">
                            <option value="Semua">Semua</option>
                            <option value="Proses Pengajuan">Proses Pengajuan</option>
                            <option value="Disetujui">Disetujui</option>
                            <option value="Ditolak">Ditolak</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Petugas</label>
                        <input v-model="petugas" type="text" class="input input-bordered input-sm w-32" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Jenis</label>
                        <input v-model="jenis" type="text" class="input input-bordered input-sm w-32" />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-base-content/60 mb-1">Barang</label>
                        <input v-model="barang" type="text" class="input input-bordered input-sm w-32" />
                    </div>
                    <button class="btn btn-neutral btn-sm" @click="terapkanFilterRingkasan">Filter</button>
                </div>
                <AppPagination :table="tableRingkasan" v-model:search="searchRingkasan" class="flex-1 min-h-0">
                    <table class="table table-sm">
                        <thead class="sticky top-0 z-10">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th v-for="header in tableRingkasan.getFlatHeaders()" :key="header.id"
                                    :class="[ 'text-xs font-semibold py-2', header.column.columnDef.meta?.headerClass ]">
                                    <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loadingRingkasan">
                                <td colspan="7" class="py-16 text-center"><span
                                        class="loading loading-spinner loading-md text-primary"></span></td>
                            </tr>
                            <tr v-else-if="tableRingkasan.getRowModel().rows.length === 0">
                                <td colspan="7" class="py-16 text-center">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
                                            <FileText class="size-7 text-base-content/30" />
                                        </div>
                                        <p class="font-semibold text-base-content/60">Data tidak ditemukan</p>
                                    </div>
                                </td>
                            </tr>
                            <tr v-else v-for="row in tableRingkasan.getRowModel().rows" :key="row.id"
                                class="border-b border-base-200 hover:bg-primary/5">
                                <td v-for="cell in row.getVisibleCells()" :key="cell.id"
                                    :class="[ 'py-2 text-sm', cell.column.columnDef.meta?.cellClass ]">
                                    <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </AppPagination>
                <div v-if="!loadingRingkasan && tableRingkasan.getRowModel().rows.length > 0"
                    class="pt-3 border-t border-base-200 flex justify-end gap-6 text-sm">
                    <div class="text-base-content/60">Total Item: <span class="font-semibold text-base-content">{{
                            summary.jumlah }}</span></div>
                    <div class="text-base-content/60">Total Nilai: <span class="font-semibold text-base-content">Rp {{
                        Number(summary.total).toLocaleString('id-ID') }}</span></div>
                </div>
            </div>
        </div>
    </div>
</template>
