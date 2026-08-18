<script setup>
import { computed, onMounted, ref } from 'vue'
import { BookOpen, Printer, RotateCcw, Search } from 'lucide-vue-next'
import AppSelect from '../../components/AppSelect.vue'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'

const authStore = useAuthStore()
const { showToast } = useToast()
const today = new Date().toISOString().slice(0, 10)
const filter = ref({ tgl_awal: today, tgl_akhir: today, no_jurnal: '', kd_rek: '', keyword: '' })
const rows = ref([])
const accounts = ref([])
const loading = ref(false)
const totalDebet = ref(0)
const totalKredit = ref(0)
const selectedAccount = computed(() => accounts.value.find(row => row.kd_rek === filter.value.kd_rek))
const accountOptions = computed(() => accounts.value.map(row => ({ ...row, display: `${row.kd_rek} — ${row.nm_rek}` })))
const saldoAwal = computed(() => Number(selectedAccount.value?.saldo_awal || 0))
const saldoAkhir = computed(() => {
    if (!selectedAccount.value) return 0
    return selectedAccount.value.balance === 'K'
        ? saldoAwal.value + totalKredit.value - totalDebet.value
        : saldoAwal.value + totalDebet.value - totalKredit.value
})

function money(value) {
    return new Intl.NumberFormat('id-ID').format(Number(value || 0))
}

function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
}

async function load() {
    loading.value = true
    try {
        const result = await window.api.keuangan.jurnalHarian.list(authStore.token, { ...filter.value })
        rows.value = result.rows
        totalDebet.value = result.total_debet
        totalKredit.value = result.total_kredit
        if (result.message) showToast(result.message, 'error')
    } catch (err) {
        showToast(err?.message || 'Gagal memuat jurnal harian', 'error')
    } finally {
        loading.value = false
    }
}

async function loadAccounts() {
    accounts.value = await window.api.keuangan.jurnalHarian.accounts(authStore.token, filter.value.tgl_awal.substring(0, 4))
}

function reset() {
    filter.value = { tgl_awal: today, tgl_akhir: today, no_jurnal: '', kd_rek: '', keyword: '' }
    load()
    loadAccounts()
}

function printReport() {
    if (!rows.value.length) return showToast('Tidak ada jurnal untuk dicetak', 'warning')
    const win = window.open('', '_blank', 'width=1100,height=800')
    if (!win) return showToast('Popup cetak diblokir', 'error')
    const body = rows.value.map(row => `<tr><td>${esc(row.tgl_jurnal)} ${esc(row.jam_jurnal)}</td><td>${esc(row.kd_rek)}</td><td>${esc(row.nm_rek)}</td><td>No.Jur ${esc(row.no_jurnal)}, No.Buk ${esc(row.no_bukti)}, ${esc(row.keterangan)}</td><td class="right">${money(row.debet)}</td><td class="right">${money(row.kredit)}</td></tr>`).join('')
    win.document.write(`<html><head><title>Jurnal Harian</title><style>body{font:12px Arial;margin:20px;color:#111}h1,h2{text-align:center}h1{font-size:18px;margin-bottom:4px}h2{font-size:13px;font-weight:normal}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:6px}th{background:#eee}.right{text-align:right}@media print{body{margin:10mm}}</style></head><body><h1>JURNAL HARIAN</h1><h2>Periode ${esc(filter.value.tgl_awal)} s.d. ${esc(filter.value.tgl_akhir)}</h2><table><thead><tr><th>Tanggal</th><th>Kode Akun</th><th>Nama Akun</th><th>Keterangan</th><th>Debet</th><th>Kredit</th></tr></thead><tbody>${body}</tbody><tfoot><tr><th colspan="4" class="right">Jumlah Total</th><th class="right">${money(totalDebet.value)}</th><th class="right">${money(totalKredit.value)}</th></tr></tfoot></table></body></html>`)
    win.document.close()
    win.focus()
    win.print()
}

onMounted(async () => {
    await Promise.all([loadAccounts(), load()])
})
</script>

<template>
    <div class="flex flex-col h-full min-h-0 gap-4">
        <div class="flex items-center justify-end">
            <button class="btn btn-ghost btn-sm gap-2 border border-base-200 bg-base-100" :disabled="loading || !rows.length" @click="printReport"><Printer class="size-4" /> Cetak Laporan</button>
        </div>
        <div class="card bg-base-100 border border-base-200 shadow-sm"><div class="card-body p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div class="flex flex-col gap-1.5"><label class="block text-sm font-medium px-1">Tanggal Awal</label><input v-model="filter.tgl_awal" type="date" class="input input-bordered input-sm w-full" /></div>
            <div class="flex flex-col gap-1.5"><label class="block text-sm font-medium px-1">Tanggal Akhir</label><input v-model="filter.tgl_akhir" type="date" class="input input-bordered input-sm w-full" /></div>
            <div class="flex flex-col gap-1.5"><label class="block text-sm font-medium px-1">No. Jurnal</label><input v-model="filter.no_jurnal" maxlength="8" class="input input-bordered input-sm w-full" @keyup.enter="load" /></div>
            <div class="flex flex-col gap-1.5 lg:col-span-2"><label class="block text-sm font-medium px-1">Rekening</label><AppSelect v-model="filter.kd_rek" :options="accountOptions" value-prop="kd_rek" label="display" placeholder="Semua rekening" /></div>
            <div class="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4"><label class="block text-sm font-medium px-1">Pencarian rekening / keterangan</label><input v-model="filter.keyword" maxlength="100" placeholder="No jurnal, no bukti, kode/nama rekening, keterangan" class="input input-bordered input-sm w-full" @keyup.enter="load" /></div>
            <div class="flex gap-2"><button class="btn btn-primary btn-sm flex-1" :disabled="loading" @click="load"><Search class="size-4" /> Cari</button><button class="btn btn-ghost btn-sm" @click="reset"><RotateCcw class="size-4" /></button></div>
        </div></div>
        <div v-if="selectedAccount" class="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div class="stat bg-base-100 border border-base-200 rounded-lg p-3 md:col-span-2"><div class="stat-title text-xs">Rekening</div><div class="font-semibold">{{ selectedAccount.kd_rek }} — {{ selectedAccount.nm_rek }}</div></div>
            <div class="stat bg-base-100 border border-base-200 rounded-lg p-3"><div class="stat-title text-xs">Tipe / Balance</div><div class="font-semibold">{{ selectedAccount.tipe }} / {{ selectedAccount.balance }}</div></div>
            <div class="stat bg-base-100 border border-base-200 rounded-lg p-3"><div class="stat-title text-xs">Saldo Awal</div><div class="font-semibold">Rp {{ money(saldoAwal) }}</div></div>
            <div class="stat bg-base-100 border border-base-200 rounded-lg p-3"><div class="stat-title text-xs">Mutasi D / K</div><div class="font-semibold">{{ money(totalDebet) }} / {{ money(totalKredit) }}</div></div>
            <div class="stat bg-base-100 border border-base-200 rounded-lg p-3"><div class="stat-title text-xs">Saldo Akhir</div><div class="font-semibold">Rp {{ money(saldoAkhir) }}</div></div>
        </div>
        <div class="relative overflow-auto grow min-h-[300px] border border-base-200 rounded-lg bg-base-100">
            <div v-if="loading" class="absolute inset-0 z-20 bg-base-100/80 flex items-center justify-center"><span class="loading loading-spinner text-primary"></span></div>
            <table class="table table-sm"><thead class="sticky top-0 z-10 bg-base-200"><tr><th>Tanggal</th><th>Kode Akun</th><th>Nama Akun</th><th>Keterangan</th><th class="text-right">Debet</th><th class="text-right">Kredit</th></tr></thead>
                <tbody><tr v-for="(row, index) in rows" :key="`${row.no_jurnal}-${row.kd_rek}-${index}`"><td class="whitespace-nowrap">{{ row.tgl_jurnal }} {{ row.jam_jurnal }}</td><td class="font-mono">{{ row.kd_rek }}</td><td :class="{ 'pl-6': row.kredit > 0 }">{{ row.nm_rek }}</td><td>No.Jur {{ row.no_jurnal }}, No.Buk {{ row.no_bukti }}, {{ row.keterangan }}</td><td class="text-right">{{ money(row.debet) }}</td><td class="text-right">{{ money(row.kredit) }}</td></tr><tr v-if="!rows.length"><td colspan="6" class="text-center py-10 text-base-content/50">Tidak ada data jurnal.</td></tr></tbody>
                <tfoot class="sticky bottom-0 bg-base-200 font-bold"><tr><td colspan="4" class="text-right">Jumlah Total</td><td class="text-right">{{ money(totalDebet) }}</td><td class="text-right">{{ money(totalKredit) }}</td></tr></tfoot>
            </table>
        </div>
    </div>
</template>
