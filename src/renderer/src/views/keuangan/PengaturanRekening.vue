<script setup>
import { computed, onMounted, ref } from 'vue'
import { Save, RotateCcw, Settings, Search } from 'lucide-vue-next'
import AppSelect from '../../components/AppSelect.vue'
import AppPagination from '../../components/AppPagination.vue'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'

const authStore = useAuthStore()
const { showToast } = useToast()

const groups = [
    { key: 'ralan', label: 'Rawat Jalan', description: 'Mapping akun default transaksi pelayanan rawat jalan' },
    { key: 'ranap', label: 'Rawat Inap', description: 'Mapping akun default transaksi pelayanan rawat inap' },
    { key: 'tokoIpsrs', label: 'Toko / IPSRS / Obat', description: 'Mapping akun default farmasi, toko, IPSRS, dan pembayaran piutang' },
]

const fields = {
    ralan: [
        ['Suspen_Piutang_Tindakan_Ralan', 'Suspen Piutang Tindakan Ralan'],
        ['Tindakan_Ralan', 'Pendapatan Tindakan Ralan'],
        ['Beban_Jasa_Medik_Dokter_Tindakan_Ralan', 'Beban Jasa Medik Dokter Ralan'],
        ['Utang_Jasa_Medik_Dokter_Tindakan_Ralan', 'Utang Jasa Medik Dokter Ralan'],
        ['Beban_Jasa_Medik_Paramedis_Tindakan_Ralan', 'Beban Jasa Medik Paramedis Ralan'],
        ['Utang_Jasa_Medik_Paramedis_Tindakan_Ralan', 'Utang Jasa Medik Paramedis Ralan'],
        ['Beban_KSO_Tindakan_Ralan', 'Beban KSO Tindakan Ralan'],
        ['Utang_KSO_Tindakan_Ralan', 'Utang KSO Tindakan Ralan'],
        ['Beban_Jasa_Sarana_Tindakan_Ralan', 'Beban Jasa Sarana Ralan'],
        ['Utang_Jasa_Sarana_Tindakan_Ralan', 'Utang Jasa Sarana Ralan'],
        ['HPP_BHP_Tindakan_Ralan', 'HPP BHP Tindakan Ralan'],
        ['Persediaan_BHP_Tindakan_Ralan', 'Persediaan BHP Tindakan Ralan'],
        ['Suspen_Piutang_Obat_Ralan', 'Suspen Piutang Obat Ralan'],
        ['Obat_Ralan', 'Pendapatan Obat Ralan'],
        ['HPP_Obat_Rawat_Jalan', 'HPP Obat Ralan'],
        ['Persediaan_Obat_Rawat_Jalan', 'Persediaan Obat Ralan'],
        ['Registrasi_Ralan', 'Pendapatan Registrasi Ralan'],
        ['Tambahan_Ralan', 'Pendapatan Tambahan Ralan'],
        ['Potongan_Ralan', 'Potongan Biaya Ralan'],
    ],
    ranap: [
        ['Suspen_Piutang_Tindakan_Ranap', 'Suspen Piutang Tindakan Ranap'],
        ['Tindakan_Ranap', 'Pendapatan Tindakan Ranap'],
        ['Beban_Jasa_Medik_Dokter_Tindakan_Ranap', 'Beban Jasa Medik Dokter Ranap'],
        ['Utang_Jasa_Medik_Dokter_Tindakan_Ranap', 'Utang Jasa Medik Dokter Ranap'],
        ['Beban_Jasa_Medik_Paramedis_Tindakan_Ranap', 'Beban Jasa Medik Paramedis Ranap'],
        ['Utang_Jasa_Medik_Paramedis_Tindakan_Ranap', 'Utang Jasa Medik Paramedis Ranap'],
        ['Beban_KSO_Tindakan_Ranap', 'Beban KSO Tindakan Ranap'],
        ['Utang_KSO_Tindakan_Ranap', 'Utang KSO Tindakan Ranap'],
        ['HPP_BHP_Tindakan_Ranap', 'HPP BHP Tindakan Ranap'],
        ['Persediaan_BHP_Tindakan_Ranap', 'Persediaan BHP Tindakan Ranap'],
        ['Suspen_Piutang_Obat_Ranap', 'Suspen Piutang Obat Ranap'],
        ['Obat_Ranap', 'Pendapatan Obat Ranap'],
        ['HPP_Obat_Rawat_Inap', 'HPP Obat Ranap'],
        ['Persediaan_Obat_Rawat_Inap', 'Persediaan Obat Ranap'],
        ['Registrasi_Ranap', 'Pendapatan Registrasi Ranap'],
        ['Service_Ranap', 'Pendapatan Service Ranap'],
        ['Tambahan_Ranap', 'Pendapatan Tambahan Ranap'],
        ['Potongan_Ranap', 'Potongan Biaya Ranap'],
        ['Retur_Obat_Ranap', 'Retur Obat Ranap'],
        ['Kamar_Inap', 'Pendapatan Kamar Inap'],
    ],
    tokoIpsrs: [
        ['Pengadaan_Obat', 'Hutang Pengadaan Obat'],
        ['Pemesanan_Obat', 'Hutang Pemesanan Obat'],
        ['Penjualan_Obat', 'Pendapatan Penjualan Obat'],
        ['Piutang_Obat', 'Piutang Obat'],
        ['Pengadaan_Ipsrs', 'Hutang Pengadaan IPSRS'],
        ['Stok_Keluar_Ipsrs', 'Beban Stok Keluar IPSRS'],
        ['Bayar_Piutang_Pasien', 'Kas/Bank Penerimaan Piutang Pasien'],
        ['Penerimaan_NonMedis', 'Penerimaan Logistik Non Medis'],
        ['Bayar_Pemesanan_Non_Medis', 'Hutang Vendor Non Medis'],
        ['Pengadaan_Toko', 'Hutang Pengadaan Toko'],
        ['Bayar_Pemesanan_Toko', 'Kas/Bank Bayar Pemesanan Toko'],
        ['Penjualan_Toko', 'Pendapatan Penjualan Toko'],
        ['HPP_Barang_Toko', 'HPP Barang Toko'],
        ['Persediaan_Barang_Toko', 'Persediaan Barang Toko'],
        ['Piutang_Toko', 'Piutang Toko'],
        ['Retur_Beli_Toko', 'Retur Beli Toko'],
        ['Retur_Jual_Toko', 'Retur Jual Toko'],
    ],
}

const loading = ref(false)
const saving = ref(false)
const active = ref('ralan')
const rekening = ref([])
const mappings = ref({ ralan: {}, ranap: {}, tokoIpsrs: {} })
const search = ref('')
const page = ref(1)
const pageSize = ref(20)

const rekeningOptions = computed(() => rekening.value.map(row => ({
    kd_rek: row.kd_rek,
    nm_rek: `${row.kd_rek} — ${row.nm_rek}`,
    nama_asli: row.nm_rek,
    display: `${row.kd_rek} — ${row.nm_rek}`,
    tipe: row.tipe,
    balance: row.balance
})))

function accountDetail(code) {
    if (!code) return null
    const value = typeof code === 'object' ? code.kd_rek : code
    return rekeningOptions.value.find(row => row.kd_rek === value) || null
}
const currentGroup = computed(() => groups.find(item => item.key === active.value) || groups[0])
const fieldRows = computed(() => {
    const q = search.value.trim().toLowerCase()
    const source = fields[active.value] || []
    return !q ? source : source.filter(([key, label]) => `${key} ${label}`.toLowerCase().includes(q))
})

const paginatedFields = computed(() => fieldRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

async function load() {
    loading.value = true
    try {
        const [akun, data] = await Promise.all([
            window.api.keuangan.rekening.list(),
            window.api.keuangan.pengaturanRekening.get(authStore.token)
        ])
        rekening.value = akun
        mappings.value = { ralan: data.ralan || {}, ranap: data.ranap || {}, tokoIpsrs: data.tokoIpsrs || {} }
    } catch (err) {
        showToast(err?.message || 'Gagal memuat pengaturan rekening', 'error')
    } finally {
        loading.value = false
    }
}

async function save() {
    saving.value = true
    try {
        const payload = Object.fromEntries((fields[active.value] || []).map(([key]) => {
            const raw = mappings.value[active.value]?.[key]
            const value = typeof raw === 'object' ? raw?.kd_rek || '' : raw || ''
            return [key, String(value)]
        }))
        const result = await window.api.keuangan.pengaturanRekening.save(authStore.token, active.value, payload)
        if (!result.success) return showToast(result.message || 'Gagal menyimpan pengaturan rekening', 'error')
        showToast('Pengaturan rekening berhasil disimpan')
        await load()
    } catch (err) {
        showToast(err?.message || 'Gagal menyimpan pengaturan rekening', 'error')
    } finally {
        saving.value = false
    }
}

onMounted(load)
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
            <div>
                <h1 class="text-xl font-bold flex items-center gap-2"><Settings class="size-6 text-primary" /> Pengaturan Rekening</h1>
                <p class="text-sm text-base-content/60">Mapping akun default untuk auto-posting transaksi Khanza</p>
            </div>
            <div class="flex items-center gap-2">
                <button class="btn btn-ghost btn-sm gap-2" :disabled="loading || saving" @click="load"><RotateCcw class="size-4" /> Refresh</button>
                <button class="btn btn-primary btn-sm gap-2" :disabled="loading || saving" @click="save"><span v-if="saving" class="loading loading-spinner loading-xs"></span><Save v-else class="size-4" /> Simpan Tab Ini</button>
            </div>
        </div>

        <div role="tablist" class="tabs tabs-boxed mb-3 w-fit shrink-0">
            <a v-for="group in groups" :key="group.key" role="tab" class="tab cursor-pointer" :class="active === group.key ? 'tab-active' : ''" @click="active = group.key; page = 1; search = ''">
                {{ group.label }}
            </a>
        </div>

        <div class="bg-base-100 border border-base-200 rounded-2xl p-4 mb-4 shrink-0">
            <div class="font-semibold">{{ currentGroup.label }}</div>
            <p class="text-sm text-base-content/60">{{ currentGroup.description }}</p>
        </div>

        <AppPagination v-model:search="search" v-model:page="page" v-model:page-size="pageSize" :total="fieldRows.length" :page-sizes="[10, 20, 50, 100]">
            <div class="border border-base-200 rounded-lg overflow-auto max-h-[70vh] relative">
                <div v-if="loading" class="absolute inset-0 bg-base-100/80 z-20 flex flex-col items-center justify-center">
                    <span class="loading loading-spinner loading-md text-primary"></span>
                    <p class="text-sm text-base-content/60 mt-2">Memuat mapping akun...</p>
                </div>
                <table class="table table-sm w-full">
                    <thead class="sticky top-0 bg-base-200 z-10 shadow-sm">
                        <tr>
                            <th class="w-[36%] bg-base-200">Letak Akun Rekening</th>
                            <th class="bg-base-200">Akun Rekening</th>
                            <th class="w-20 bg-base-200">Tipe</th>
                            <th class="w-24 bg-base-200">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="([key, label]) in paginatedFields" :key="key" class="hover">
                            <td>
                                <div class="font-semibold text-sm">{{ label }}</div>
                                <div class="font-mono text-[11px] text-base-content/40">{{ key }}</div>
                            </td>
                            <td class="align-top">
                                <AppSelect v-model="mappings[active][key]" :options="rekeningOptions" value-prop="kd_rek" label="display" placeholder="Pilih rekening..." />
                            </td>
                            <td class="align-middle">
                                <span v-if="accountDetail(mappings[active][key])" class="badge badge-sm badge-outline" :class="accountDetail(mappings[active][key]).tipe === 'N' ? 'badge-info' : accountDetail(mappings[active][key]).tipe === 'R' ? 'badge-warning' : 'badge-secondary'">{{ accountDetail(mappings[active][key]).tipe }}</span>
                                <span v-else class="text-base-content/30">-</span>
                            </td>
                            <td class="align-middle">
                                <span v-if="accountDetail(mappings[active][key])" class="badge badge-sm" :class="accountDetail(mappings[active][key]).balance === 'D' ? 'badge-success badge-soft' : 'badge-error badge-soft'">{{ accountDetail(mappings[active][key]).balance }}</span>
                                <span v-else class="text-base-content/30">-</span>
                            </td>
                        </tr>
                        <tr v-if="!paginatedFields.length && !loading"><td colspan="4" class="text-center py-10 text-base-content/50">Tidak ada mapping yang cocok.</td></tr>
                    </tbody>
                </table>
            </div>
        </AppPagination>
    </div>
</template>
