<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Plus, Save, X, Search, BookText, Trash, Printer } from 'lucide-vue-next'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'
import JurnalHarian from './JurnalHarian.vue'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'

const authStore = useAuthStore()
const { showToast } = useToast()

const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const activeTab = ref('jurnal')
const rekeningList = ref([])

const today = new Date().toISOString().split('T')[ 0 ]
const filter = ref({
    tgl_awal: today,
    tgl_akhir: today,
    keyword: ''
})
const search = ref('')
const page = ref(1)
const pageSize = ref(20)

const form = ref({
    tgl_jurnal: today,
    jam_jurnal: new Date().toTimeString().split(' ')[ 0 ],
    no_bukti: '',
    jenis: 'U',
    keterangan: '',
    details: []
})

const nextNoJurnal = ref('')

const rekeningOptions = computed(() => rekeningList.value.map(row => ({
    ...row,
    display: `${row.kd_rek} — ${row.nm_rek}`
})))

const detailAccountRef = ref(null)
const detailDebetRef = ref(null)
const detailKreditRef = ref(null)

const formDetail = ref({
    rekening: null,
    debet: 0,
    kredit: 0
})

const formSelisih = computed(() => Math.abs(formTotalDebet.value - formTotalKredit.value))
const formTotalDebet = computed(() => form.value.details.reduce((sum, d) => sum + Number(d.debet), 0))
const formTotalKredit = computed(() => form.value.details.reduce((sum, d) => sum + Number(d.kredit), 0))
const formBalance = computed(() => Math.abs(formTotalDebet.value - formTotalKredit.value) < 0.01)

const paginatedRows = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return rows.value.slice(start, start + pageSize.value)
})

async function load() {
    loading.value = true
    try {
        const params = {
            tgl_awal: filter.value.tgl_awal,
            tgl_akhir: filter.value.tgl_akhir,
            keyword: search.value.trim()
        }
        rows.value = await window.api.keuangan.jurnal.list(params)
    } catch (err) {
        showToast(err?.message || 'Gagal memuat jurnal', 'error')
    } finally {
        loading.value = false
    }
}

async function loadRekening() {
    try {
        rekeningList.value = await window.api.keuangan.rekening.list()
    } catch (err) {
        console.error('Gagal memuat rekening', err)
    }
}

async function loadNextNo() {
    try {
        nextNoJurnal.value = await window.api.keuangan.jurnal.nextNo(form.value.tgl_jurnal)
    } catch (err) {
        console.error('Gagal generate nomor jurnal', err)
    }
}

watch(() => form.value.tgl_jurnal, () => {
    if (showModal.value) loadNextNo()
})

function formatRupiah(value) {
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(value || 0)
}

function esc(value) {
    return String(value ?? '-').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ char ])
}

function printHtml(title, body) {
    const win = window.open('', '_blank', 'width=1100,height=800')
    if (!win) return showToast('Popup cetak diblokir', 'error')
    win.document.write(`<html><head><title>${esc(title)}</title><style>body{font:12px Arial;color:#111;margin:20px}h1{text-align:center;font-size:18px;margin:0 0 5px}h2{text-align:center;font-size:13px;font-weight:normal;margin:0 0 18px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #777;padding:6px}th{background:#eee}.right{text-align:right}.center{text-align:center}.summary{margin:16px 0 0 auto;width:300px}.summary div{display:flex;justify-content:space-between;padding:4px;border-bottom:1px solid #ddd}.summary .total{font-weight:bold;border-top:2px solid #111;border-bottom:0}@media print{body{margin:10mm}}</style></head><body>${body}</body></html>`)
    win.document.close()
    win.focus()
    win.print()
}

function printJurnal(row) {
    const detailRows = row.details.map((detail, index) => `<tr><td class="center">${index + 1}</td><td>${esc(detail.kd_rek)}</td><td>${esc(detail.nm_rek)}</td><td class="right">${detail.debet ? formatRupiah(detail.debet) : '-'}</td><td class="right">${detail.kredit ? formatRupiah(detail.kredit) : '-'}</td></tr>`).join('')
    printHtml(`Jurnal ${row.no_jurnal}`, `<h1>VOUCHER JURNAL UMUM</h1><h2>${esc(row.no_jurnal)}</h2><p><b>Tanggal:</b> ${esc(row.tgl_jurnal)} &nbsp; <b>Jam:</b> ${esc(row.jam_jurnal)} &nbsp; <b>No. Bukti:</b> ${esc(row.no_bukti)}</p><p><b>Keterangan:</b> ${esc(row.keterangan)}</p><table><thead><tr><th>No</th><th>Kode Rekening</th><th>Nama Rekening</th><th>Debet (Rp)</th><th>Kredit (Rp)</th></tr></thead><tbody>${detailRows}</tbody></table><div class="summary"><div><span>Total Debet</span><span>${formatRupiah(row.total_debet)}</span></div><div class="total"><span>Total Kredit</span><span>${formatRupiah(row.total_kredit)}</span></div></div><br><br><table><tr><td class="center">Dibuat Oleh</td><td class="center">Diperiksa Oleh</td><td class="center">Disetujui Oleh</td></tr><tr><td style="height:70px"></td><td></td><td></td></tr></table>`)
}

function printList() {
    if (!rows.value.length) return showToast('Tidak ada jurnal untuk dicetak', 'warning')
    const reportRows = rows.value.flatMap(row => row.details.map((detail, index) => `<tr>${index === 0 ? `<td rowspan="${row.details.length}">${esc(row.no_jurnal)}</td><td rowspan="${row.details.length}">${esc(row.tgl_jurnal)}</td>` : ''}<td>${esc(detail.kd_rek)}</td><td>${esc(detail.nm_rek)}</td><td class="right">${detail.debet ? formatRupiah(detail.debet) : '-'}</td><td class="right">${detail.kredit ? formatRupiah(detail.kredit) : '-'}</td></tr>`)).join('')
    const totalDebet = rows.value.reduce((sum, row) => sum + row.total_debet, 0)
    const totalKredit = rows.value.reduce((sum, row) => sum + row.total_kredit, 0)
    printHtml('Daftar Jurnal', `<h1>DAFTAR JURNAL</h1><h2>Periode ${esc(filter.value.tgl_awal)} s.d. ${esc(filter.value.tgl_akhir)}</h2><table><thead><tr><th>No. Jurnal</th><th>Tanggal</th><th>Kode Rekening</th><th>Nama Rekening</th><th>Debet (Rp)</th><th>Kredit (Rp)</th></tr></thead><tbody>${reportRows}</tbody><tfoot><tr><th colspan="4" class="right">TOTAL</th><th class="right">${formatRupiah(totalDebet)}</th><th class="right">${formatRupiah(totalKredit)}</th></tr></tfoot></table>`)
}

function openNew() {
    form.value = {
        tgl_jurnal: today,
        jam_jurnal: new Date().toTimeString().split(' ')[ 0 ],
        no_bukti: '',
        jenis: 'U',
        keterangan: '',
        details: []
    }
    formDetail.value = { rekening: null, debet: 0, kredit: 0 }
    loadNextNo()
    showModal.value = true
}

function closeModal() {
    showModal.value = false
}

function addDetail() {
    if (!formDetail.value.rekening) return showToast('Pilih rekening terlebih dahulu', 'warning')
    if (formDetail.value.debet <= 0 && formDetail.value.kredit <= 0) return showToast('Isi nilai Debet atau Kredit', 'warning')
    if (formDetail.value.debet > 0 && formDetail.value.kredit > 0) return showToast('Satu baris hanya boleh memiliki nilai Debet atau Kredit', 'warning')

    const rek = rekeningList.value.find(r => r.kd_rek === formDetail.value.rekening)

    form.value.details.push({
        kd_rek: rek.kd_rek,
        nm_rek: rek.nm_rek,
        debet: Number(formDetail.value.debet || 0),
        kredit: Number(formDetail.value.kredit || 0)
    })

    formDetail.value = { rekening: null, debet: 0, kredit: 0 }

    // Auto-focus kembali ke input rekening
    if (detailAccountRef.value?.$el?.querySelector('input')) {
        detailAccountRef.value.$el.querySelector('input').focus()
    }
}

function handleEnter(e) {
    if (e.key === 'Enter') {
        e.preventDefault()
        addDetail()
    }
}

function removeDetail(index) {
    form.value.details.splice(index, 1)
}

async function save() {
    if (form.value.details.length === 0) return showToast('Detail jurnal tidak boleh kosong', 'warning')
    if (!formBalance.value) return showToast('Total Debet dan Kredit tidak balance', 'warning')

    saving.value = true
    try {
        const payload = JSON.parse(JSON.stringify(form.value))
        const result = await window.api.keuangan.jurnal.create(authStore.token, payload)

        if (!result.success) return showToast(result.message || 'Gagal menyimpan jurnal', 'error')

        showToast('Jurnal berhasil disimpan')
        closeModal()
        await load()
    } catch (err) {
        showToast(err?.message || 'Gagal menyimpan jurnal', 'error')
    } finally {
        saving.value = false
    }
}

onMounted(() => {
    load()
    loadRekening()
})
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <div class="mb-0 shrink-0">
            <h1 class="text-xl font-bold flex items-center gap-1 mb-1">
                <BookText class="size-6 text-primary" /> Jurnal & Riwayat
            </h1>
            <p class="text-sm text-base-content/60 mb-3">Pengelolaan transaksi jurnal dan buku riwayat harian</p>
            
            <div class="flex bg-base-200 rounded-xl p-1 w-fit gap-0.5">
                <button :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer', activeTab === 'jurnal' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']" @click="activeTab = 'jurnal'">Jurnal Umum</button>
                <button :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer', activeTab === 'harian' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']" @click="activeTab = 'harian'">Jurnal Harian</button>
            </div>
        </div>

        <template v-if="activeTab === 'jurnal'">
            <div class="flex items-center justify-end gap-2 mb-4 shrink-0">
                <button class="btn btn-ghost btn-sm gap-2" @click="printList" :disabled="loading || !rows.length">
                    <Printer class="size-4" /> Cetak Daftar
                </button>
                <button class="btn btn-primary btn-sm gap-2" @click="openNew">
                    <Plus class="size-4" /> Jurnal Baru
                </button>
            </div>

            <div class="card bg-base-100 shadow-sm border border-base-200 mb-4 shrink-0">
                <div class="card-body p-4 flex flex-row flex-wrap items-end gap-4">
                    <div class="form-control w-full max-w-[150px]">
                        <label class="label"><span class="label-text font-medium">Tanggal Awal</span></label>
                        <input type="date" v-model="filter.tgl_awal" class="input input-bordered input-sm" />
                    </div>
                    <div class="form-control w-full max-w-[150px]">
                        <label class="label"><span class="label-text font-medium">Tanggal Akhir</span></label>
                        <input type="date" v-model="filter.tgl_akhir" class="input input-bordered input-sm" />
                    </div>
                    <div class="form-control w-full max-w-xs">
                        <label class="label"><span class="label-text font-medium">Pencarian</span></label>
                        <div class="join w-full">
                            <input type="text" v-model="search" placeholder="No Jurnal, No Bukti, Keterangan..."
                                class="input input-bordered input-sm join-item w-full" @keyup.enter="load" />
                            <button class="btn btn-primary btn-sm join-item" @click="load" :disabled="loading">
                                <Search class="size-4" /> Cari
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <AppPagination v-model:page="page" v-model:page-size="pageSize" :total="rows.length"
                :page-sizes="[ 10, 20, 50, 100 ]" :hide-search="true">
                <div
                    class="overflow-x-auto border border-base-200 rounded-lg relative min-h-[300px] max-h-[60vh] overflow-y-auto">
                    <div v-if="loading"
                        class="absolute inset-0 flex flex-col items-center justify-center bg-base-100/80 z-10">
                        <span class="loading loading-spinner loading-md text-primary"></span>
                    </div>
                    <table class="table table-sm w-full table-fixed">
                        <thead class="sticky top-0 z-20 bg-base-200 text-base-content font-semibold shadow-sm">
                            <tr>
                                <th class="w-32">No. Jurnal</th>
                                <th class="w-32">No. Bukti</th>
                                <th class="w-24">Tanggal</th>
                                <th>Keterangan</th>
                                <th class="w-32 text-right">Debet</th>
                                <th class="w-32 text-right">Kredit</th>
                                <th class="w-24 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody v-if="paginatedRows.length > 0">
                            <template v-for="row in paginatedRows" :key="row.no_jurnal">
                                <tr class="bg-base-200/50">
                                    <td class="font-mono font-semibold">{{ row.no_jurnal }}</td>
                                    <td class="font-mono">{{ row.no_bukti }}</td>
                                    <td>{{ row.tgl_jurnal }}</td>
                                    <td class="font-medium text-primary">{{ row.keterangan }}</td>
                                    <td class="text-right font-semibold">{{ formatRupiah(row.total_debet) }}</td>
                                    <td class="text-right font-semibold">{{ formatRupiah(row.total_kredit) }}</td>
                                    <td class="text-center">
                                        <button class="btn btn-ghost btn-xs text-primary" @click="printJurnal(row)"
                                            title="Cetak Jurnal">
                                            <Printer class="size-4" />
                                        </button>
                                    </td>
                                </tr>
                                <tr v-for="(detail, i) in row.details" :key="`${row.no_jurnal}-d${i}`" class="hover">
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td>
                                        <span class="font-mono text-base-content/70 mr-2">{{ detail.kd_rek }}</span>
                                        {{ detail.nm_rek }}
                                    </td>
                                    <td class="text-right">{{ formatRupiah(detail.debet) }}</td>
                                    <td class="text-right">{{ formatRupiah(detail.kredit) }}</td>
                                    <td></td>
                                </tr>
                            </template>
                        </tbody>
                        <tbody v-else>
                            <tr>
                                <td colspan="7" class="text-center py-8 text-base-content/50">Tidak ada data jurnal.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </AppPagination>

            <dialog class="modal" :class="{ 'modal-open': showModal }">
                <div
                    class="modal-box p-0 rounded-2xl border border-base-200 w-11/12 max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
                    <div
                        class="bg-base-200/60 px-6 py-4 flex items-center justify-between border-b border-base-200 shrink-0">
                        <h3 class="font-bold text-lg flex items-center gap-2">
                            <Plus class="size-5" /> Tambah Jurnal
                        </h3>
                        <button class="btn btn-sm btn-circle btn-ghost" type="button" @click="closeModal">
                            <X class="size-4" />
                        </button>
                    </div>

                    <div class="overflow-y-auto p-6 grow">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div class="flex flex-col gap-1.5">
                                <label class="block text-sm font-medium px-1">No. Jurnal <span
                                        class="text-error">*</span></label>
                                <input type="text" :value="nextNoJurnal"
                                    class="input input-bordered input-sm w-full bg-base-200" readonly />
                            </div>
                            <div class="flex flex-col gap-1.5">
                                <label class="block text-sm font-medium px-1">No. Bukti</label>
                                <input type="text" v-model="form.no_bukti"
                                    class="input input-bordered input-sm w-full uppercase" maxlength="30" />
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div class="flex flex-col gap-1.5">
                                    <label class="block text-sm font-medium px-1">Tanggal <span
                                            class="text-error">*</span></label>
                                    <input type="date" v-model="form.tgl_jurnal"
                                        class="input input-bordered input-sm w-full" />
                                </div>
                                <div class="flex flex-col gap-1.5">
                                    <label class="block text-sm font-medium px-1">Jam <span
                                            class="text-error">*</span></label>
                                    <input type="time" v-model="form.jam_jurnal" step="1"
                                        class="input input-bordered input-sm w-full" />
                                </div>
                            </div>
                            <div class="flex flex-col gap-1.5">
                                <label class="block text-sm font-medium px-1">Jenis Jurnal</label>
                                <select v-model="form.jenis" class="select select-bordered select-sm w-full">
                                    <option value="U">Umum (U)</option>
                                    <option value="P">Penyesuaian (P)</option>
                                </select>
                            </div>
                            <div class="flex flex-col gap-1.5 md:col-span-2">
                                <label class="block text-sm font-medium px-1">Keterangan</label>
                                <input type="text" v-model="form.keterangan"
                                    class="input input-bordered input-sm w-full uppercase" maxlength="350" />
                            </div>
                        </div>

                        <div class="divider mt-2 mb-2">Detail Rekening</div>

                        <div class="bg-base-200/50 p-4 rounded-xl border border-base-300 mb-4">
                            <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                                <div class="lg:col-span-6 flex flex-col gap-1">
                                    <label class="text-xs font-semibold px-1">Pilih Rekening (COA)</label>
                                    <AppSelect ref="detailAccountRef" v-model="formDetail.rekening"
                                        :options="rekeningOptions" value-prop="kd_rek" label="display"
                                        placeholder="Cari kode / nama rekening..." />
                                </div>
                                <div class="lg:col-span-2 flex flex-col gap-1">
                                    <label class="text-xs font-semibold px-1"
                                        :class="{ 'text-base-content/40': formDetail.kredit > 0 }">Debet (Rp)</label>
                                    <input type="number" ref="detailDebetRef" v-model.number="formDetail.debet"
                                        :disabled="formDetail.kredit > 0"
                                        class="input input-bordered input-sm text-right w-full disabled:bg-base-200/50"
                                        min="0" @input="formDetail.kredit = 0" @focus="$event.target.select()"
                                        @keydown="handleEnter" />
                                </div>
                                <div class="lg:col-span-2 flex flex-col gap-1">
                                    <label class="text-xs font-semibold px-1"
                                        :class="{ 'text-base-content/40': formDetail.debet > 0 }">Kredit (Rp)</label>
                                    <input type="number" ref="detailKreditRef" v-model.number="formDetail.kredit"
                                        :disabled="formDetail.debet > 0"
                                        class="input input-bordered input-sm text-right w-full disabled:bg-base-200/50"
                                        min="0" @input="formDetail.debet = 0" @focus="$event.target.select()"
                                        @keydown="handleEnter" />
                                </div>
                                <div class="lg:col-span-2 flex flex-col gap-1">
                                    <button class="btn btn-primary btn-sm w-full gap-1" @click="addDetail"
                                        :disabled="!formDetail.rekening || (formDetail.debet <= 0 && formDetail.kredit <= 0)">
                                        <Plus class="size-4" /> Tambah
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="overflow-x-auto border border-base-200 rounded-lg max-h-[300px] overflow-y-auto">
                            <table class="table table-sm w-full">
                                <thead class="sticky top-0 bg-base-200 z-10">
                                    <tr>
                                        <th class="w-24">Kode</th>
                                        <th>Nama Rekening</th>
                                        <th class="w-32 text-right">Debet</th>
                                        <th class="w-32 text-right">Kredit</th>
                                        <th class="w-12 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(d, i) in form.details" :key="i" class="hover">
                                        <td class="font-mono text-xs">{{ d.kd_rek }}</td>
                                        <td>{{ d.nm_rek }}</td>
                                        <td class="text-right">{{ formatRupiah(d.debet) }}</td>
                                        <td class="text-right">{{ formatRupiah(d.kredit) }}</td>
                                        <td class="text-center">
                                            <button class="btn btn-ghost btn-xs text-error" @click="removeDetail(i)">
                                                <Trash class="size-3" />
                                            </button>
                                        </td>
                                    </tr>
                                    <tr v-if="form.details.length === 0">
                                        <td colspan="5" class="text-center py-4 text-base-content/50">Belum ada rekening
                                            ditambahkan.</td>
                                    </tr>
                                </tbody>
                                <tfoot class="sticky bottom-0 bg-base-200/90 font-bold z-10">
                                    <tr>
                                        <td colspan="2" class="text-right">
                                            <div class="flex items-center justify-end gap-3">
                                                <span v-if="!formBalance && form.details.length > 0"
                                                    class="badge badge-error badge-sm">Belum Balance (Selisih: {{
                                                    formatRupiah(formSelisih) }})</span>
                                                <span v-else-if="formBalance && form.details.length >= 2"
                                                    class="badge badge-success badge-sm text-white">Balance</span>
                                                TOTAL
                                            </div>
                                        </td>
                                        <td class="text-right" :class="{ 'text-error': !formBalance }">{{
                                            formatRupiah(formTotalDebet)
                                            }}</td>
                                        <td class="text-right" :class="{ 'text-error': !formBalance }">{{
                                            formatRupiah(formTotalKredit) }}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <div class="bg-base-100 px-6 py-4 border-t border-base-200 flex justify-end gap-2 shrink-0">
                        <button class="btn btn-ghost btn-sm" @click="closeModal">Batal</button>
                        <button class="btn btn-primary btn-sm gap-2 min-w-32" @click="save"
                            :disabled="saving || !formBalance || form.details.length === 0">
                            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                            <Save v-else class="size-4" />
                            Simpan Jurnal
                        </button>
                    </div>
                </div>
                <form method="dialog" class="modal-backdrop bg-black/40">
                    <button @click="closeModal">Tutup</button>
                </form>
            </dialog>
        </template>

        <JurnalHarian v-else-if="activeTab === 'harian'" class="grow" />
    </div>
</template>
