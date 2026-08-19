<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Plus, Printer, Save, Search, Trash2, WalletCards, X } from 'lucide-vue-next'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'

const authStore = useAuthStore()
const { showToast } = useToast()

const rows = ref([])
const total = ref(0)
const kategoriList = ref([])
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)

const today = new Date().toISOString().slice(0, 10)
const filter = ref({ tgl_awal: today, tgl_akhir: today, keyword: '' })
const search = ref('')
const page = ref(1)
const pageSize = ref(20)

const form = ref({ tanggal: today, kode_kategori: '', keterangan: '', biaya: 0 })
const nextNoKeluar = ref('')

const kategoriOptions = computed(() => kategoriList.value.map(k => ({ ...k, display: `${k.kode_kategori} — ${k.nama_kategori}` })))

const paginatedRows = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return rows.value.slice(start, start + pageSize.value)
})

function money(value) {
    return new Intl.NumberFormat('id-ID').format(Number(value || 0))
}

function esc(value) {
    return String(value ?? '-').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
}

async function load() {
    loading.value = true
    try {
        const params = { tgl_awal: filter.value.tgl_awal, tgl_akhir: filter.value.tgl_akhir, keyword: search.value.trim() }
        const result = await window.api.keuangan.pengeluaranHarian.list(authStore.token, params)
        rows.value = result.rows
        total.value = result.total
        if (result.message) showToast(result.message, 'error')
    } catch (err) {
        showToast(err?.message || 'Gagal memuat pengeluaran harian', 'error')
    } finally {
        loading.value = false
    }
}

async function loadKategori() {
    try {
        kategoriList.value = await window.api.keuangan.kategoriPengeluaran.list(authStore.token)
    } catch (err) {
        console.error('Gagal memuat kategori pengeluaran', err)
    }
}

async function loadNextNo() {
    try {
        nextNoKeluar.value = await window.api.keuangan.pengeluaranHarian.nextNo(authStore.token, form.value.tanggal)
    } catch (err) {
        console.error('Gagal generate nomor', err)
    }
}

watch(() => form.value.tanggal, () => {
    if (showModal.value) loadNextNo()
})

function openNew() {
    form.value = { tanggal: today, kode_kategori: '', keterangan: '', biaya: 0 }
    loadNextNo()
    showModal.value = true
}

function closeModal() {
    showModal.value = false
}

async function save() {
    if (!form.value.kode_kategori) return showToast('Pilih kategori terlebih dahulu', 'warning')
    if (!form.value.keterangan.trim()) return showToast('Keterangan tidak boleh kosong', 'warning')
    if (!form.value.biaya || Number(form.value.biaya) <= 0) return showToast('Pengeluaran harus lebih dari 0', 'warning')

    saving.value = true
    try {
        const payload = { ...form.value, nip: authStore.user.username }
        const result = await window.api.keuangan.pengeluaranHarian.create(authStore.token, payload)
        if (!result.success) return showToast(result.message || 'Gagal menyimpan pengeluaran', 'error')

        showToast('Pengeluaran berhasil disimpan')
        closeModal()
        await load()
    } catch (err) {
        showToast(err?.message || 'Gagal menyimpan pengeluaran', 'error')
    } finally {
        saving.value = false
    }
}

async function remove(row) {
    if (!confirm(`Batalkan pengeluaran ${row.no_keluar} (${row.nama_kategori}, Rp ${money(row.biaya)})?\n\nJurnal asli TIDAK dihapus — koreksi diposting sebagai jurnal pembalik baru.`)) return
    const result = await window.api.keuangan.pengeluaranHarian.delete(authStore.token, row.no_keluar)
    if (!result.success) return showToast(result.message || 'Gagal membatalkan pengeluaran', 'error')
    showToast('Pengeluaran berhasil dibatalkan (jurnal pembalik diposting)')
    await load()
}

function printList() {
    if (!rows.value.length) return showToast('Tidak ada data untuk dicetak', 'warning')
    const win = window.open('', '_blank', 'width=1100,height=800')
    if (!win) return showToast('Popup cetak diblokir', 'error')
    const body = rows.value.map(r => `<tr><td>${esc(r.no_keluar)}</td><td>${esc(r.tanggal)}</td><td>${esc(r.kode_kategori)} ${esc(r.nama_kategori)}</td><td>${esc(r.nip)} ${esc(r.nama_petugas)}</td><td>${esc(r.keterangan)}</td><td class="right">${money(r.biaya)}</td></tr>`).join('')
    win.document.write(`<html><head><title>Pengeluaran Harian</title><style>body{font:12px Arial;margin:20px;color:#111}h1,h2{text-align:center;margin:4px 0}h1{font-size:18px}h2{font-size:13px;font-weight:normal}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #777;padding:6px}th{background:#eee}.right{text-align:right}@media print{body{margin:10mm}}</style></head><body><h1>PENGELUARAN HARIAN</h1><h2>Periode ${esc(filter.value.tgl_awal)} s.d. ${esc(filter.value.tgl_akhir)}</h2><table><thead><tr><th>No. Transaksi</th><th>Tanggal</th><th>Kategori</th><th>Petugas</th><th>Keterangan</th><th>Pengeluaran</th></tr></thead><tbody>${body}</tbody><tfoot><tr><th colspan="5" class="right">Jumlah Total Pengeluaran</th><th class="right">${money(total.value)}</th></tr></tfoot></table></body></html>`)
    win.document.close()
    win.focus()
    win.print()
}

onMounted(() => {
    load()
    loadKategori()
})
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <div class="mb-4 flex items-center justify-between shrink-0">
            <div>
                <h1 class="text-xl font-bold flex items-center gap-2"><WalletCards class="size-6 text-primary" /> Pengeluaran Harian</h1>
                <p class="text-sm text-base-content/60">Pencatatan kas keluar harian beserta posting jurnal otomatis</p>
            </div>
            <div class="flex gap-2">
                <button class="btn btn-ghost btn-sm gap-2" @click="printList" :disabled="loading || !rows.length"><Printer class="size-4" /> Cetak</button>
                <button class="btn btn-primary btn-sm gap-2" @click="openNew"><Plus class="size-4" /> Pengeluaran Baru</button>
            </div>
        </div>

        <div class="card bg-base-100 shadow-sm border border-base-200 mb-4 shrink-0">
            <div class="card-body p-4 flex flex-row flex-wrap items-end gap-4">
                <div class="flex flex-col gap-1.5 w-full max-w-[150px]">
                    <label class="label"><span class="label-text font-medium">Tanggal Awal</span></label>
                    <input type="date" v-model="filter.tgl_awal" class="input input-bordered input-sm" />
                </div>
                <div class="flex flex-col gap-1.5 w-full max-w-[150px]">
                    <label class="label"><span class="label-text font-medium">Tanggal Akhir</span></label>
                    <input type="date" v-model="filter.tgl_akhir" class="input input-bordered input-sm" />
                </div>
                <div class="flex flex-col gap-1.5 w-full max-w-xs">
                    <label class="label"><span class="label-text font-medium">Pencarian</span></label>
                    <div class="join w-full">
                        <input type="text" v-model="search" placeholder="No, kategori, petugas, keterangan..." class="input input-bordered input-sm join-item w-full" @keyup.enter="load" />
                        <button class="btn btn-primary btn-sm join-item" @click="load" :disabled="loading"><Search class="size-4" /> Cari</button>
                    </div>
                </div>
            </div>
        </div>

        <AppPagination v-model:page="page" v-model:page-size="pageSize" :total="rows.length" :page-sizes="[10, 20, 50, 100]" :hide-search="true">
            <div class="overflow-x-auto border border-base-200 rounded-lg relative min-h-[300px] max-h-[60vh] overflow-y-auto">
                <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center bg-base-100/80 z-10"><span class="loading loading-spinner loading-md text-primary"></span></div>
                <table class="table table-sm w-full table-fixed">
                    <thead class="sticky top-0 z-20 bg-base-200 text-base-content font-semibold shadow-sm">
                        <tr>
                            <th class="w-32">No. Transaksi</th>
                            <th class="w-32">Tanggal</th>
                            <th>Kategori</th>
                            <th>Petugas</th>
                            <th>Keterangan</th>
                            <th class="w-32 text-right">Pengeluaran</th>
                            <th class="w-16 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody v-if="paginatedRows.length > 0">
                        <tr v-for="row in paginatedRows" :key="row.no_keluar" class="hover">
                            <td class="font-mono">{{ row.no_keluar }}</td>
                            <td>{{ row.tanggal }}</td>
                            <td><span class="font-mono text-xs text-base-content/60">{{ row.kode_kategori }}</span> {{ row.nama_kategori }}</td>
                            <td>{{ row.nama_petugas }}</td>
                            <td>{{ row.keterangan }}</td>
                            <td class="text-right font-semibold">{{ money(row.biaya) }}</td>
                            <td class="text-center">
                                <button class="btn btn-ghost btn-xs text-error" @click="remove(row)" title="Batalkan"><Trash2 class="size-4" /></button>
                            </td>
                        </tr>
                    </tbody>
                    <tbody v-else>
                        <tr><td colspan="7" class="text-center py-8 text-base-content/50">Tidak ada data pengeluaran.</td></tr>
                    </tbody>
                    <tfoot v-if="rows.length" class="sticky bottom-0 bg-base-200/90 font-bold">
                        <tr>
                            <td colspan="5" class="text-right">Jumlah Total Pengeluaran</td>
                            <td class="text-right">{{ money(total) }}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </AppPagination>

        <dialog class="modal" :class="{ 'modal-open': showModal }">
            <div class="modal-box rounded-2xl border border-base-200 max-w-lg">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-bold text-lg flex items-center gap-2"><Plus class="size-5" /> Pengeluaran Baru</h3>
                    <button class="btn btn-sm btn-circle btn-ghost" @click="closeModal"><X class="size-4" /></button>
                </div>
                <div class="flex flex-col gap-3">
                    <div class="grid grid-cols-2 gap-3">
                        <div class="flex flex-col gap-1.5">
                            <label class="text-sm font-medium px-1">No. Transaksi</label>
                            <input type="text" :value="nextNoKeluar" class="input input-bordered input-sm w-full bg-base-200" readonly />
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-sm font-medium px-1">Tanggal <span class="text-error">*</span></label>
                            <input type="date" v-model="form.tanggal" class="input input-bordered input-sm w-full" />
                        </div>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-sm font-medium px-1">Kategori <span class="text-error">*</span></label>
                        <AppSelect v-model="form.kode_kategori" :options="kategoriOptions" value-prop="kode_kategori" label="display" placeholder="Pilih kategori pengeluaran..." />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-sm font-medium px-1">Pengeluaran (Rp) <span class="text-error">*</span></label>
                        <input type="number" v-model.number="form.biaya" min="0" class="input input-bordered input-sm w-full text-right" @focus="$event.target.select()" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-sm font-medium px-1">Keterangan <span class="text-error">*</span></label>
                        <input type="text" v-model="form.keterangan" maxlength="100" class="input input-bordered input-sm w-full uppercase" />
                    </div>
                </div>
                <div class="modal-action">
                    <button class="btn btn-ghost btn-sm" @click="closeModal">Batal</button>
                    <button class="btn btn-primary btn-sm gap-2 min-w-32" :disabled="saving" @click="save">
                        <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                        <Save v-else class="size-4" /> Simpan
                    </button>
                </div>
            </div>
            <form method="dialog" class="modal-backdrop bg-black/40"><button @click="closeModal">Tutup</button></form>
        </dialog>
    </div>
</template>
