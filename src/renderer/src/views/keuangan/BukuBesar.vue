<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Printer, Search } from 'lucide-vue-next'
import AppSelect from '../../components/AppSelect.vue'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'

const authStore = useAuthStore()
const { showToast } = useToast()
const today = new Date().toISOString().slice(0, 10)
const filter = ref({ tgl_awal: today, tgl_akhir: today, kd_rek: '' })
const rows = ref([])
const accounts = ref([])
const loading = ref(false)

const mutasiSebelumDebet = ref(0)
const mutasiSebelumKredit = ref(0)
const totalDebet = ref(0)
const totalKredit = ref(0)

const selectedAccount = computed(() => accounts.value.find(row => row.kd_rek === filter.value.kd_rek))
const accountOptions = computed(() => accounts.value.map(row => ({ ...row, display: `${row.kd_rek} — ${row.nm_rek}` })))

const saldoAwalTahun = computed(() => Number(selectedAccount.value?.saldo_awal || 0))

const saldoAwalPeriode = computed(() => {
    if (!selectedAccount.value) return 0
    const awalTahun = saldoAwalTahun.value
    const isKredit = selectedAccount.value.balance === 'K'
    const mutasiKredit = mutasiSebelumKredit.value
    const mutasiDebet = mutasiSebelumDebet.value
    
    return isKredit 
        ? awalTahun + mutasiKredit - mutasiDebet
        : awalTahun + mutasiDebet - mutasiKredit
})

const saldoAkhir = computed(() => {
    if (!selectedAccount.value) return 0
    const isKredit = selectedAccount.value.balance === 'K'
    return isKredit
        ? saldoAwalPeriode.value + totalKredit.value - totalDebet.value
        : saldoAwalPeriode.value + totalDebet.value - totalKredit.value
})

const rowsWithSaldo = computed(() => {
    if (!selectedAccount.value) return []
    const isKredit = selectedAccount.value.balance === 'K'
    let currentSaldo = saldoAwalPeriode.value
    
    return rows.value.map(row => {
        const d = Number(row.debet || 0)
        const k = Number(row.kredit || 0)
        
        currentSaldo = isKredit 
            ? currentSaldo + k - d 
            : currentSaldo + d - k
            
        return { ...row, saldoKumulatif: currentSaldo }
    })
})

function money(value) {
    return new Intl.NumberFormat('id-ID').format(Number(value || 0))
}

function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
}

async function load() {
    if (!filter.value.kd_rek) {
        showToast('Pilih rekening terlebih dahulu', 'warning')
        return
    }
    
    loading.value = true
    try {
        const result = await window.api.keuangan.bukuBesar.list(authStore.token, { ...filter.value })
        rows.value = result.rows
        totalDebet.value = result.mutasi_debet
        totalKredit.value = result.mutasi_kredit
        mutasiSebelumDebet.value = result.mutasi_sebelum_debet
        mutasiSebelumKredit.value = result.mutasi_sebelum_kredit
        if (result.message) showToast(result.message, 'error')
    } catch (err) {
        showToast(err?.message || 'Gagal memuat buku besar', 'error')
    } finally {
        loading.value = false
    }
}

async function loadAccounts() {
    try {
        const thn = filter.value.tgl_awal.substring(0, 4)
        accounts.value = await window.api.keuangan.bukuBesar.accounts(authStore.token, thn)
    } catch(err) {
        console.error(err)
    }
}

// Reload account balances if year changes
watch(() => filter.value.tgl_awal, (newVal, oldVal) => {
    if (newVal?.substring(0, 4) !== oldVal?.substring(0, 4)) {
        loadAccounts()
    }
})

function printReport() {
    if (!rows.value.length && !selectedAccount.value) return showToast('Pilih rekening terlebih dahulu', 'warning')
    const win = window.open('', '_blank', 'width=1100,height=800')
    if (!win) return showToast('Popup diblokir', 'error')
    
    const body = rowsWithSaldo.value.map(row => `<tr>
        <td>${esc(row.tgl_jurnal)} ${esc(row.jam_jurnal)}</td>
        <td>${esc(row.no_jurnal)}</td>
        <td>${esc(row.no_bukti)}</td>
        <td>${esc(row.keterangan)}</td>
        <td class="right">${money(row.debet)}</td>
        <td class="right">${money(row.kredit)}</td>
        <td class="right">${money(row.saldoKumulatif)}</td>
    </tr>`).join('')
    
    win.document.write(`<html><head><title>Buku Besar</title><style>
        body{font:12px Arial;margin:20px;color:#111}
        h1,h2,h3{text-align:center;margin:4px 0}
        h1{font-size:18px} h2{font-size:14px} h3{font-size:13px;font-weight:normal}
        .info-table{margin-bottom:10px;width:100%;max-width:500px}
        .info-table td{padding:2px;border:none}
        table.data{width:100%;border-collapse:collapse}
        table.data th,table.data td{border:1px solid #777;padding:6px}
        table.data th{background:#eee}
        .right{text-align:right}
        @media print{body{margin:10mm}}
    </style></head><body>
        <h1>BUKU BESAR</h1>
        <h2>Rekening: ${esc(selectedAccount.value?.kd_rek)} — ${esc(selectedAccount.value?.nm_rek)}</h2>
        <h3>Periode ${esc(filter.value.tgl_awal)} s.d. ${esc(filter.value.tgl_akhir)}</h3>
        
        <table class="info-table">
            <tr><td>Saldo Awal Tahun</td><td>: Rp ${money(saldoAwalTahun.value)}</td></tr>
            <tr><td>Mutasi Sebelum Periode</td><td>: D ${money(mutasiSebelumDebet.value)} / K ${money(mutasiSebelumKredit.value)}</td></tr>
            <tr><td><strong>Saldo Awal Periode</strong></td><td><strong>: Rp ${money(saldoAwalPeriode.value)}</strong></td></tr>
        </table>
        
        <table class="data">
            <thead><tr>
                <th>Tgl Jurnal</th><th>No Jurnal</th><th>No Bukti</th><th>Keterangan</th>
                <th>Debet</th><th>Kredit</th><th>Saldo</th>
            </tr></thead>
            <tbody>
                <tr>
                    <td colspan="6" class="right"><strong>SALDO AWAL</strong></td>
                    <td class="right"><strong>${money(saldoAwalPeriode.value)}</strong></td>
                </tr>
                ${body || '<tr><td colspan="7" style="text-align:center">Tidak ada mutasi</td></tr>'}
            </tbody>
            <tfoot><tr>
                <th colspan="4" class="right">Jumlah Total Mutasi Periode</th>
                <th class="right">${money(totalDebet.value)}</th>
                <th class="right">${money(totalKredit.value)}</th>
                <th class="right">${money(saldoAkhir.value)}</th>
            </tr></tfoot>
        </table>
    </body></html>`)
    win.document.close()
    win.focus()
    win.print()
}

onMounted(async () => {
    await loadAccounts()
})
</script>

<template>
    <div class="flex flex-col h-full min-h-0 gap-4">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-bold">Buku Besar</h1>
            <button class="btn btn-ghost btn-sm gap-2 border border-base-200 bg-base-100" :disabled="loading || !selectedAccount" @click="printReport"><Printer class="size-4" /> Cetak Laporan</button>
        </div>
        
        <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                <div class="flex flex-col gap-1.5 lg:col-span-3">
                    <label class="block text-sm font-medium px-1">Rekening COA</label>
                    <AppSelect v-model="filter.kd_rek" :options="accountOptions" value-prop="kd_rek" label="display" placeholder="Pilih rekening..." search />
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="block text-sm font-medium px-1">Tanggal Awal</label>
                    <input v-model="filter.tgl_awal" type="date" class="input input-bordered input-sm w-full" />
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="block text-sm font-medium px-1">Tanggal Akhir</label>
                    <input v-model="filter.tgl_akhir" type="date" class="input input-bordered input-sm w-full" @keyup.enter="load" />
                </div>
                <div class="flex">
                    <button class="btn btn-primary btn-sm w-full" :disabled="loading" @click="load"><Search class="size-4" /> Cari</button>
                </div>
            </div>
        </div>
        
        <div v-if="selectedAccount" class="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div class="stat bg-base-100 border border-base-200 rounded-lg p-3 md:col-span-2">
                <div class="stat-title text-xs">Rekening</div>
                <div class="font-semibold text-sm">{{ selectedAccount.kd_rek }} — {{ selectedAccount.nm_rek }} ({{ selectedAccount.tipe }} / {{ selectedAccount.balance }})</div>
            </div>
            <div class="stat bg-base-100 border border-base-200 rounded-lg p-3">
                <div class="stat-title text-xs">Saldo Awal Periode</div>
                <div class="font-semibold text-sm">Rp {{ money(saldoAwalPeriode) }}</div>
            </div>
            <div class="stat bg-base-100 border border-base-200 rounded-lg p-3">
                <div class="stat-title text-xs">Mutasi D / K</div>
                <div class="font-semibold text-sm">{{ money(totalDebet) }} / {{ money(totalKredit) }}</div>
            </div>
            <div class="stat bg-base-100 border border-base-200 rounded-lg p-3">
                <div class="stat-title text-xs">Saldo Akhir Periode</div>
                <div class="font-semibold text-sm">Rp {{ money(saldoAkhir) }}</div>
            </div>
        </div>
        
        <div class="relative overflow-auto grow min-h-[300px] border border-base-200 rounded-lg bg-base-100">
            <div v-if="loading" class="absolute inset-0 z-20 bg-base-100/80 flex items-center justify-center"><span class="loading loading-spinner text-primary"></span></div>
            <table class="table table-sm">
                <thead class="sticky top-0 z-10 bg-base-200">
                    <tr>
                        <th>Tanggal</th>
                        <th>No Jurnal</th>
                        <th>No Bukti</th>
                        <th>Keterangan</th>
                        <th class="text-right">Debet</th>
                        <th class="text-right">Kredit</th>
                        <th class="text-right">Saldo Kumulatif</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="selectedAccount" class="bg-base-200/50">
                        <td colspan="6" class="text-right font-medium">SALDO AWAL</td>
                        <td class="text-right font-medium">{{ money(saldoAwalPeriode) }}</td>
                    </tr>
                    <tr v-for="(row, index) in rowsWithSaldo" :key="`${row.no_jurnal}-${index}`">
                        <td class="whitespace-nowrap">{{ row.tgl_jurnal }} {{ row.jam_jurnal }}</td>
                        <td>{{ row.no_jurnal }}</td>
                        <td>{{ row.no_bukti }}</td>
                        <td>{{ row.keterangan }}</td>
                        <td class="text-right">{{ money(row.debet) }}</td>
                        <td class="text-right">{{ money(row.kredit) }}</td>
                        <td class="text-right">{{ money(row.saldoKumulatif) }}</td>
                    </tr>
                    <tr v-if="!rows.length && selectedAccount">
                        <td colspan="7" class="text-center py-10 text-base-content/50">Tidak ada mutasi pada periode ini.</td>
                    </tr>
                    <tr v-if="!selectedAccount">
                        <td colspan="7" class="text-center py-10 text-base-content/50">Pilih rekening untuk melihat buku besar.</td>
                    </tr>
                </tbody>
                <tfoot v-if="selectedAccount" class="sticky bottom-0 bg-base-200 font-bold">
                    <tr>
                        <td colspan="4" class="text-right">Jumlah Total Mutasi</td>
                        <td class="text-right">{{ money(totalDebet) }}</td>
                        <td class="text-right">{{ money(totalKredit) }}</td>
                        <td class="text-right">{{ money(saldoAkhir) }}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
</template>
