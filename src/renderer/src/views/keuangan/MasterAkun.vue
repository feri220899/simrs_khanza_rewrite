<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Plus, Pencil, Trash2, RotateCcw, Save, X, Bookmark } from 'lucide-vue-next'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'

const authStore = useAuthStore()
const { showToast } = useToast()

const tabs = [
    { key: 'bayar', label: 'Akun Bayar Kasir', permission: 'akun_bayar' },
    { key: 'piutang', label: 'Akun Piutang Penjamin', permission: 'akun_piutang' },
    { key: 'bayarHutang', label: 'Akun Bayar Hutang', permission: 'akun_bayar_hutang' },
    { key: 'aset', label: 'Akun Aset Inventaris', permission: 'akun_aset_inventaris' },
    { key: 'pemasukan', label: 'Kategori Pemasukan', permission: 'kategori_pemasukan_lain' },
    { key: 'pengeluaran', label: 'Kategori Pengeluaran', permission: 'kategori_pengeluaran_harian' },
    { key: 'penagihanPiutang', label: 'Akun Penagihan Piutang', permission: 'akun_penagihan_piutang' }
]

const visibleTabs = computed(() => tabs.filter(t => authStore.can(t.permission)))
const activeTab = ref(visibleTabs.value[0]?.key || 'bayar')

const rows = ref([])
const rekening = ref([])
const penjab = ref([])
const inventarisJenis = ref([])
const loading = ref(false)
const saving = ref(false)
const editing = ref(null)
const search = ref('')
const showModal = ref(false)
const page = ref(1)
const pageSize = ref(20)

const form = ref({})

const rekeningOptions = computed(() => rekening.value.map(row => ({
    kd_rek: row.kd_rek,
    display: `${row.kd_rek} — ${row.nm_rek}`,
    nm_rek: row.nm_rek,
    tipe: row.tipe,
    balance: row.balance
})))

const penjabOptions = computed(() => penjab.value.map(row => ({
    kd_pj: row.kd_pj,
    display: `${row.kd_pj} — ${row.png_jawab}`
})))

const inventarisOptions = computed(() => inventarisJenis.value.map(row => ({
    id_jenis: row.id_jenis,
    display: `${row.id_jenis} — ${row.nama_jenis}`
})))

const filteredRows = computed(() => {
    const q = search.value.trim().toLowerCase()
    if (!q) return rows.value
    return rows.value.filter(row => JSON.stringify(row).toLowerCase().includes(q))
})

const paginatedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

function openNew() {
    editing.value = null
    form.value = {}
    showModal.value = true
}

function openEdit(row) {
    editing.value = { ...row }
    form.value = { ...row }
    showModal.value = true
}

function closeModal() {
    showModal.value = false
    form.value = {}
    editing.value = null
}

async function load() {
    loading.value = true
    rows.value = []
    try {
        if (rekening.value.length === 0) {
            rekening.value = await window.api.keuangan.rekening.list()
        }

        if (activeTab.value === 'bayar') rows.value = await window.api.keuangan.masterAkun.listBayar()
        else if (activeTab.value === 'piutang') {
            if (penjab.value.length === 0) {
                // Gunakan cara manual utk fetch penjab jika blm ada API spesifik, asumsikan ada atau abaikan sementara 
                // Untuk tahap ini mock/kosongkan dulu jika belum dibuat
                // penjab.value = await window.api.penjab.list()
            }
            rows.value = await window.api.keuangan.masterAkun.listPiutang()
        }
        else if (activeTab.value === 'bayarHutang') rows.value = await window.api.keuangan.masterAkun.listBayarHutang()
        else if (activeTab.value === 'aset') rows.value = await window.api.keuangan.masterAkun.listAset()
        else if (activeTab.value === 'pemasukan') rows.value = await window.api.keuangan.masterAkun.listKategoriPemasukan()
        else if (activeTab.value === 'pengeluaran') rows.value = await window.api.keuangan.masterAkun.listKategoriPengeluaran()
        else if (activeTab.value === 'penagihanPiutang') rows.value = await window.api.keuangan.masterAkun.listPenagihanPiutang()
 
    } catch (err) {
        showToast(err?.message || 'Gagal memuat data master', 'error')
    } finally {
        loading.value = false
    }
}

async function save() {
    saving.value = true
    try {
        let result
        const token = authStore.token
        const d = form.value

        if (activeTab.value === 'bayar') result = editing.value ? await window.api.keuangan.masterAkun.updateBayar(token, editing.value.nama_bayar, d) : await window.api.keuangan.masterAkun.createBayar(token, d)
        else if (activeTab.value === 'piutang') result = editing.value ? await window.api.keuangan.masterAkun.updatePiutang(token, editing.value.nama_bayar, d) : await window.api.keuangan.masterAkun.createPiutang(token, d)
        else if (activeTab.value === 'bayarHutang') result = editing.value ? await window.api.keuangan.masterAkun.updateBayarHutang(token, editing.value.nama_bayar, d) : await window.api.keuangan.masterAkun.createBayarHutang(token, d)
        else if (activeTab.value === 'aset') result = editing.value ? await window.api.keuangan.masterAkun.updateAset(token, editing.value.id_jenis, d) : await window.api.keuangan.masterAkun.createAset(token, d)
        else if (activeTab.value === 'pemasukan') result = editing.value ? await window.api.keuangan.masterAkun.updateKategoriPemasukan(token, editing.value.kode_kategori, d) : await window.api.keuangan.masterAkun.createKategoriPemasukan(token, d)
        else if (activeTab.value === 'pengeluaran') result = editing.value ? await window.api.keuangan.masterAkun.updateKategoriPengeluaran(token, editing.value.kode_kategori, d) : await window.api.keuangan.masterAkun.createKategoriPengeluaran(token, d)
        else if (activeTab.value === 'penagihanPiutang') result = editing.value ? await window.api.keuangan.masterAkun.updatePenagihanPiutang(token, editing.value.kd_rek, d) : await window.api.keuangan.masterAkun.createPenagihanPiutang(token, d)

        if (!result.success) return showToast(result.message || 'Gagal menyimpan', 'error')
        showToast('Berhasil disimpan')
        closeModal()
        await load()
    } catch (err) {
        showToast(err?.message || 'Gagal menyimpan', 'error')
    } finally {
        saving.value = false
    }
}

async function remove(row) {
    if (!confirm(`Hapus data ini?`)) return
    try {
        let result
        const token = authStore.token

        if (activeTab.value === 'bayar') result = await window.api.keuangan.masterAkun.deleteBayar(token, row.nama_bayar)
        else if (activeTab.value === 'piutang') result = await window.api.keuangan.masterAkun.deletePiutang(token, row.nama_bayar)
        else if (activeTab.value === 'bayarHutang') result = await window.api.keuangan.masterAkun.deleteBayarHutang(token, row.nama_bayar)
        else if (activeTab.value === 'aset') result = await window.api.keuangan.masterAkun.deleteAset(token, row.id_jenis)
        else if (activeTab.value === 'pemasukan') result = await window.api.keuangan.masterAkun.deleteKategoriPemasukan(token, row.kode_kategori)
        else if (activeTab.value === 'pengeluaran') result = await window.api.keuangan.masterAkun.deleteKategoriPengeluaran(token, row.kode_kategori)
        else if (activeTab.value === 'penagihanPiutang') result = await window.api.keuangan.masterAkun.deletePenagihanPiutang(token, row.kd_rek)

        if (!result.success) return showToast(result.message || 'Gagal menghapus', 'error')
        showToast('Berhasil dihapus')
        await load()
    } catch (err) {
        showToast(err?.message || 'Gagal menghapus', 'error')
    }
}

watch(activeTab, () => {
    page.value = 1
    search.value = ''
    load()
})

onMounted(load)
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
            <div>
                <h1 class="text-xl font-bold flex items-center gap-2"><Bookmark class="size-6 text-primary" /> Master Akun & Kategori</h1>
                <p class="text-sm text-base-content/60">Pengaturan akun bayar, piutang, dan kategori pemasukan/pengeluaran</p>
            </div>
            <div class="flex items-center gap-2">
                <button class="btn btn-ghost btn-sm gap-2" :disabled="loading" @click="load"><RotateCcw class="size-4" /> Refresh</button>
                <button class="btn btn-primary btn-sm gap-2" @click="openNew"><Plus class="size-4" /> Tambah Data</button>
            </div>
        </div>

        <div role="tablist" class="tabs tabs-boxed mb-4 w-fit shrink-0">
            <button v-for="tab in visibleTabs" :key="tab.key" class="tab" :class="activeTab === tab.key ? 'tab-active' : ''" @click="activeTab = tab.key">
                {{ tab.label }}
            </button>
        </div>

        <AppPagination v-model:search="search" v-model:page="page" v-model:page-size="pageSize" :total="filteredRows.length" :page-sizes="[10, 20, 50, 100]">
            <div class="border border-base-200 rounded-lg overflow-auto max-h-[70vh] relative">
                <div v-if="loading" class="absolute inset-0 bg-base-100/80 z-20 flex flex-col items-center justify-center">
                    <span class="loading loading-spinner loading-md text-primary"></span>
                </div>
                <table class="table table-sm w-full table-fixed whitespace-nowrap">
                    <thead class="sticky top-0 bg-base-200 z-10 shadow-sm">
                        <!-- Header Dinamis -->
                        <tr v-if="activeTab === 'bayar' || activeTab === 'bayarHutang'">
                            <th class="w-1/3 bg-base-200">Nama Bayar</th>
                            <th class="bg-base-200">Kode Rekening</th>
                            <th class="bg-base-200">Nama Rekening</th>
                            <th v-if="activeTab === 'bayar'" class="w-24 text-right bg-base-200">PPN (%)</th>
                            <th class="w-16 text-right bg-base-200">Aksi</th>
                        </tr>
                        <tr v-else-if="activeTab === 'piutang'"><th class="w-1/4 bg-base-200">Nama Asuransi / Piutang</th><th class="bg-base-200">Rekening</th><th class="bg-base-200">Penjamin (Tabel Penjab)</th><th class="w-16 text-right bg-base-200">Aksi</th></tr>
                        <tr v-else-if="activeTab === 'aset'">
                            <th class="w-1/4 bg-base-200">ID Jenis</th>
                            <th class="bg-base-200">Nama Jenis Inventaris</th>
                            <th class="bg-base-200">Rekening Aset</th>
                            <th class="w-16 text-right bg-base-200">Aksi</th>
                        </tr>
                        <tr v-else-if="activeTab === 'penagihanPiutang'">
                            <th class="bg-base-200">Rekening</th>
                            <th class="bg-base-200">Nama Bank</th>
                            <th class="bg-base-200">Atas Nama</th>
                            <th class="bg-base-200">No Rekening</th>
                            <th class="w-24 text-right bg-base-200">Aksi</th>
                        </tr>
                        <tr v-else>
                            <th class="w-24 bg-base-200">Kode Kategori</th>
                            <th class="w-1/3 bg-base-200">Nama Kategori</th>
                            <th class="bg-base-200">Rekening Debet</th>
                            <th class="bg-base-200">Rekening Kredit (Kontra)</th>
                            <th class="w-24 text-right bg-base-200">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in paginatedRows" :key="row.nama_bayar || row.kode_kategori || row.id_jenis" class="hover">
                            <!-- Body Dinamis -->
                            <template v-if="activeTab === 'bayar' || activeTab === 'bayarHutang'">
                                <td class="font-semibold">{{ row.nama_bayar }}</td>
                                <td class="font-mono text-primary">{{ row.kd_rek }}</td>
                                <td>{{ row.nm_rek }}</td>
                                <td v-if="activeTab === 'bayar'" class="text-right">{{ row.ppn }}</td>
                            </template>
                            <template v-else-if="activeTab === 'piutang'">
                                <td class="font-semibold">{{ row.nama_bayar }}</td>
                                <td><span class="font-mono text-primary">{{ row.kd_rek }}</span><br><span class="text-xs">{{ row.nm_rek }}</span></td>
                                <td><span class="font-mono">{{ row.kd_pj }}</span><br><span class="text-xs">{{ row.png_jawab }}</span></td>
                            </template>
                            <template v-else-if="activeTab === 'aset'">
                                <td class="font-mono font-semibold">{{ row.id_jenis }}</td>
                                <td>{{ row.nama_jenis }}</td>
                                <td><span class="font-mono text-primary">{{ row.kd_rek }}</span><br><span class="text-xs">{{ row.nm_rek }}</span></td>
                            </template>
                            <template v-else-if="activeTab === 'penagihanPiutang'">
                                <td><span class="font-mono text-primary">{{ row.kd_rek }}</span><br><span class="text-xs">{{ row.nm_rek }}</span></td>
                                <td>{{ row.nama_bank }}</td>
                                <td>{{ row.atas_nama }}</td>
                                <td class="font-mono">{{ row.no_rek }}</td>
                            </template>
                            <template v-else>
                                <td class="font-mono font-semibold">{{ row.kode_kategori }}</td>
                                <td>{{ row.nama_kategori }}</td>
                                <td><span class="font-mono text-primary">{{ row.kd_rek }}</span><br><span class="text-xs">{{ row.nm_rek }}</span></td>
                                <td><span class="font-mono text-primary">{{ row.kd_rek2 }}</span><br><span class="text-xs">{{ row.nm_rek2 }}</span></td>
                            </template>
                            
                            <td class="text-right">
                                <button class="btn btn-ghost btn-xs text-info" title="Edit" @click="openEdit(row)"><Pencil class="size-3.5" /></button>
                                <button class="btn btn-ghost btn-xs text-error" title="Hapus" @click="remove(row)"><Trash2 class="size-3.5" /></button>
                            </td>
                        </tr>
                        <tr v-if="!paginatedRows.length && !loading"><td colspan="5" class="text-center py-10 text-base-content/50">Tidak ada data master yang cocok.</td></tr>
                    </tbody>
                </table>
            </div>
        </AppPagination>

        <!-- Modal Form (Create Only karena master referensi) -->
        <dialog class="modal" :class="{ 'modal-open': showModal }">
            <div class="modal-box p-0 rounded-2xl border border-base-200 overflow-hidden">
                <div class="bg-base-200/60 px-6 py-4 flex items-center justify-between border-b border-base-200">
                    <h3 class="font-bold text-lg">{{ editing ? 'Edit' : 'Tambah' }} {{ visibleTabs.find(t => t.key === activeTab)?.label }}</h3>
                    <button class="btn btn-sm btn-circle btn-ghost" type="button" @click="closeModal"><X class="size-4" /></button>
                </div>
                <form @submit.prevent="save">
                    <div class="p-6 space-y-4">
                        <template v-if="activeTab === 'bayar' || activeTab === 'piutang' || activeTab === 'bayarHutang'">
                            <label class="form-control gap-1"><span class="label-text font-semibold">Nama Bayar / Asuransi</span><input v-model="form.nama_bayar" type="text" class="input input-sm input-bordered" required /></label>
                        </template>
                        <template v-else-if="activeTab === 'aset'">
                            <label class="form-control gap-1"><span class="label-text font-semibold">Jenis Inventaris (Kode ID)</span><AppSelect v-model="form.id_jenis" :options="inventarisOptions" value-prop="id_jenis" label="display" placeholder="Pilih jenis inventaris..." /></label>
                        </template>
                        <template v-else-if="activeTab === 'penagihanPiutang'">
                            <label class="form-control gap-1"><span class="label-text font-semibold">Rekening</span><AppSelect v-model="form.kd_rek" :options="rekeningOptions" value-prop="kd_rek" label="display" placeholder="Pilih rekening COA..." /></label>
                            <label class="form-control gap-1"><span class="label-text font-semibold">Nama Bank</span><input v-model="form.nama_bank" type="text" class="input input-sm input-bordered" required /></label>
                            <label class="form-control gap-1"><span class="label-text font-semibold">Atas Nama</span><input v-model="form.atas_nama" type="text" class="input input-sm input-bordered" /></label>
                            <label class="form-control gap-1"><span class="label-text font-semibold">No Rekening</span><input v-model="form.no_rek" type="text" class="input input-sm input-bordered" /></label>
                        </template>
                        <template v-else>
                            <label class="form-control gap-1"><span class="label-text font-semibold">Kode Kategori</span><input v-model="form.kode_kategori" type="text" class="input input-sm input-bordered font-mono" required /></label>
                            <label class="form-control gap-1"><span class="label-text font-semibold">Nama Kategori</span><input v-model="form.nama_kategori" type="text" class="input input-sm input-bordered" required /></label>
                        </template>

                        <div class="form-control gap-1">
                            <span class="label-text font-semibold">Rekening {{ activeTab === 'pemasukan' || activeTab === 'pengeluaran' ? 'Debet' : '' }}</span>
                            <AppSelect v-model="form.kd_rek" :options="rekeningOptions" value-prop="kd_rek" label="display" placeholder="Pilih rekening COA..." />
                        </div>

                        <template v-if="activeTab === 'pemasukan' || activeTab === 'pengeluaran'">
                            <div class="form-control gap-1">
                                <span class="label-text font-semibold">Rekening Kredit (Kontra)</span>
                                <AppSelect v-model="form.kd_rek2" :options="rekeningOptions" value-prop="kd_rek" label="display" placeholder="Pilih rekening kontra COA..." />
                            </div>
                        </template>

                        <template v-if="activeTab === 'bayar'">
                            <label class="form-control gap-1"><span class="label-text font-semibold">PPN (%)</span><input v-model.number="form.ppn" type="number" step="0.01" class="input input-sm input-bordered w-32" /></label>
                        </template>

                        <template v-if="activeTab === 'piutang'">
                            <label class="form-control gap-1"><span class="label-text font-semibold">Penjamin (Kode Penjab)</span><input v-model="form.kd_pj" type="text" class="input input-sm input-bordered font-mono" placeholder="Contoh: BPJ" required /></label>
                        </template>
                    </div>
                    <div class="bg-base-100 px-6 py-4 border-t border-base-200 flex justify-end gap-2">
                        <button type="button" class="btn btn-ghost btn-sm" @click="closeModal">Batal</button>
                        <button type="submit" class="btn btn-primary btn-sm gap-2 min-w-32" :disabled="saving"><span v-if="saving" class="loading loading-spinner loading-xs"></span><Save v-else class="size-4" /> Simpan</button>
                    </div>
                </form>
            </div>
            <div class="modal-backdrop bg-black/40" @click="closeModal"></div>
        </dialog>
    </div>
</template>
