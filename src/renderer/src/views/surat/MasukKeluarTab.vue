<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Plus, List, Inbox, Paperclip, Trash2 } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'

// Surat Masuk/Keluar — MODUL PERTAMA hasil porting dari pola hybrid webview
// (PHP webapps/surat/pages/{input,input2,list,list2}.php) ke native, lihat
// SuratMasukKeluarService.js & Khanza.md > "Arsitektur Hybrid WebView".
// Komponen GENERIK dipakai utk 'masuk' & 'keluar' (schema-nya 95% sama, cuma
// beda field `asal` & label tanggal pokok) — sesuai prop `jenis`.
//
// Field TIDAK ada yang kondisional (semua selalu tampil), TAPI aslinya
// TIDAK ADA fitur Edit sama sekali (cuma Create+List+Delete) — jadi cukup
// 2 tab (Tambah/Daftar), TANPA modal edit sama sekali.
const props = defineProps({
    jenis: { type: String, required: true }, // 'masuk' | 'keluar'
})

const { showToast } = useToast()
const authStore = useAuthStore()
const permission = props.jenis === 'masuk' ? 'surat_masuk' : 'surat_keluar'
const bolehTulis = () => authStore.can(permission)
const labelTglPokok = props.jenis === 'masuk' ? 'Tanggal Terima' : 'Tanggal Kirim'
const labelNoUrut = props.jenis === 'masuk' ? 'Nomor Masuk' : 'Nomor Keluar'

const activeTab = ref('list')

// ── Opsi dropdown (8 taksonomi, cuma indeks yg tidak dipakai di sini) ──────
const opsi = reactive({ almari: [], rak: [], map: [], ruang: [], sifat: [], balas: [], status: [], klasifikasi: [] })
async function muatOpsi() {
    const jenisTaksonomi = ['almari', 'rak', 'map', 'ruang', 'sifat', 'balas', 'status', 'klasifikasi']
    const hasil = await Promise.all(jenisTaksonomi.map(j => window.api.surat.list(j, { pageSize: 1000 })))
    jenisTaksonomi.forEach((j, i) => { opsi[j] = hasil[i].data })
}

// ── Tabel Daftar ─────────────────────────────────────────────────────────
const { table, loading, search, fetchData } = useServerTable({
    columns: buildColumns(),
    fetchFn: params => window.api.surat.masukKeluar.list(props.jenis, params),
    pageSize: 10,
    defaultSortBy: 'no_urut',
    defaultSortOrder: 'desc',
})

function buildColumns() {
    const cols = [
        { accessorKey: 'no_urut', header: labelNoUrut, meta: { headerClass: 'w-32', cellClass: 'font-medium' } },
        { accessorKey: 'no_surat', header: 'No. Surat' },
    ]
    if (props.jenis === 'masuk') cols.push({ accessorKey: 'asal', header: 'Asal' })
    cols.push(
        { accessorKey: 'tujuan', header: 'Tujuan' },
        { accessorKey: 'perihal', header: 'Perihal' },
        { accessorKey: props.jenis === 'masuk' ? 'tgl_terima' : 'tgl_kirim', header: labelTglPokok, meta: { headerClass: 'w-28' } },
        { accessorKey: 'status', header: 'Status', enableSorting: false },
    )
    return cols
}

// ── Form Tambah ──────────────────────────────────────────────────────────
const emptyForm = () => ({
    no_surat: '', asal: '', tujuan: '', tgl_surat: today(), perihal: '', tgl_pokok: today(),
    kd_lemari: '', kd_rak: '', kd_map: '', kd_ruang: '', kd_sifat: '', lampiran: '', tembusan: '',
    tgl_deadline_balas: today(), kd_balas: '', keterangan: '', kd_status: '', kd_klasifikasi: '',
})
function today() { return new Date().toISOString().slice(0, 10) }

const saving = ref(false)
const uploading = ref(false)
const form = reactive(emptyForm())
const noUrutPreview = ref('')
const fileInput = ref(null)
const fileDipilih = ref(null)

async function refreshNoUrutPreview() {
    noUrutPreview.value = await window.api.surat.masukKeluar.nextNoUrut(props.jenis, form.tgl_pokok)
}

async function siapkanFormBaru() {
    Object.assign(form, emptyForm())
    fileDipilih.value = null
    if (fileInput.value) fileInput.value.value = ''
    await refreshNoUrutPreview()
}

function onFileChange(e) {
    const file = e.target.files[0]
    if (!file) { fileDipilih.value = null; return }
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!['.pdf', '.jpg', '.jpeg'].includes(ext)) {
        showToast('Berkas harus PDF/JPG', 'error')
        e.target.value = ''
        fileDipilih.value = null
        return
    }
    fileDipilih.value = file
}

async function simpan() {
    if (!fileDipilih.value) { showToast('File Berkas (PDF/JPG) tidak boleh kosong', 'error'); return }

    saving.value = true
    uploading.value = true
    try {
        const buffer = await fileDipilih.value.arrayBuffer()
        const objectKey = `surat/${props.jenis}/${Date.now()}-${fileDipilih.value.name.replace(/\s+/g, '_')}`
        const up = await window.api.file.upload(objectKey, buffer, fileDipilih.value.type)
        uploading.value = false
        if (!up.success) { showToast(up.message, 'error'); return }

        const res = await window.api.surat.masukKeluar.create(authStore.token, props.jenis, { ...form, file_url: objectKey })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(`Surat ${props.jenis} "${res.no_urut}" berhasil disimpan.`)
        await siapkanFormBaru()
        fetchData()
        activeTab.value = 'list'
    } finally {
        saving.value = false
        uploading.value = false
    }
}

// ── Hapus + lihat berkas ─────────────────────────────────────────────────
async function hapus(row) {
    if (!confirm(`Hapus surat "${row.no_surat}"? Berkas lampirannya juga akan dihapus.`)) return
    const res = await window.api.surat.masukKeluar.delete(authStore.token, props.jenis, row.no_urut)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Surat berhasil dihapus.')
    fetchData()
}

async function lihatBerkas(row) {
    const url = await window.api.file.getUrl(row.file_url)
    window.open(url, '_blank')
}

onMounted(async () => {
    await muatOpsi()
    await siapkanFormBaru()
})
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="flex bg-base-200 rounded-xl p-1 w-fit mb-2 shrink-0 gap-0.5">
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2',
                    activeTab === 'tambah' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'tambah'">
                <Plus class="size-4" />
                Tambah Surat {{ jenis === 'masuk' ? 'Masuk' : 'Keluar' }}
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2',
                    activeTab === 'list' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'list'">
                <List class="size-4" />
                Daftar
                <span :class="['badge badge-xs p-2 pb-1.5 mb-0.5', activeTab === 'list' ? 'badge-primary' : 'badge-neutral']">
                    {{ table.getRowCount() }}
                </span>
            </button>
        </div>

        <!-- Tab: Daftar -->
        <div v-show="activeTab === 'list'" class="flex-1 min-h-0 overflow-hidden">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm h-full flex flex-col overflow-hidden px-4 py-3">
                <AppPagination :table="table" v-model:search="search" class="flex-1 min-h-0">
                    <table class="table">
                        <thead class="sticky top-0 z-10">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th v-for="header in table.getFlatHeaders()" :key="header.id"
                                    :class="['text-sm font-medium py-2', header.column.columnDef.meta?.headerClass,
                                             header.column.getCanSort() ? 'cursor-pointer select-none hover:text-primary transition-colors' : '']"
                                    @click="header.column.getToggleSortingHandler()?.($event)">
                                    {{ header.column.columnDef.header }}
                                    <span v-if="header.column.getIsSorted() === 'asc'" class="text-primary">↑</span>
                                    <span v-else-if="header.column.getIsSorted() === 'desc'" class="text-primary">↓</span>
                                </th>
                                <th class="text-sm font-medium py-2 text-center w-32">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading">
                                <td :colspan="table.getFlatHeaders().length + 1" class="py-16 text-center">
                                    <span class="loading loading-spinner loading-md text-primary"></span>
                                </td>
                            </tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td :colspan="table.getFlatHeaders().length + 1" class="py-16 text-center">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
                                            <Inbox class="size-7 text-base-content/30" />
                                        </div>
                                        <p class="font-semibold text-base-content/60">Belum ada surat {{ jenis }}</p>
                                    </div>
                                </td>
                            </tr>
                            <tr v-else v-for="row in table.getRowModel().rows" :key="row.id"
                                class="border-b border-base-200 hover:bg-primary/5 transition-colors duration-100">
                                <td v-for="cell in row.getVisibleCells()" :key="cell.id" class="py-2">
                                    {{ row.original[cell.column.id] }}
                                </td>
                                <td class="py-2 text-center">
                                    <div class="flex gap-1 justify-center">
                                        <button class="btn btn-ghost btn-sm" title="Lihat Berkas" @click="lihatBerkas(row.original)">
                                            <Paperclip class="size-4" />
                                        </button>
                                        <button class="btn btn-ghost btn-sm text-error" title="Hapus" @click="hapus(row.original)">
                                            <Trash2 class="size-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </AppPagination>
            </div>
        </div>

        <!-- Tab: Tambah (TIDAK ADA edit sama sekali, sesuai asli) -->
        <div v-show="activeTab === 'tambah'" class="flex-1 overflow-y-auto pb-6">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden">
                <div class="px-5 py-3.5 border-b border-base-200 flex items-center gap-3">
                    <div class="w-1 h-5 bg-primary rounded-full"></div>
                    <h3 class="font-semibold text-base-content">Informasi Surat {{ jenis === 'masuk' ? 'Masuk' : 'Keluar' }}</h3>
                </div>
                <div class="p-5">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl">
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">
                                {{ labelNoUrut }}
                                <span class="text-base-content/40 font-normal">(otomatis)</span>
                            </label>
                            <input :value="noUrutPreview" type="text" disabled class="input input-bordered w-full opacity-60" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">No. Surat <span class="text-error">*</span></label>
                            <input v-model="form.no_surat" type="text" maxlength="35" class="input input-bordered w-full" />
                        </div>
                        <div v-if="jenis === 'masuk'">
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Asal <span class="text-error">*</span></label>
                            <input v-model="form.asal" type="text" maxlength="300" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tujuan <span class="text-error">*</span></label>
                            <input v-model="form.tujuan" type="text" maxlength="300" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal Surat <span class="text-error">*</span></label>
                            <input v-model="form.tgl_surat" type="date" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Perihal <span class="text-error">*</span></label>
                            <input v-model="form.perihal" type="text" maxlength="300" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">{{ labelTglPokok }} <span class="text-error">*</span></label>
                            <input v-model="form.tgl_pokok" type="date" class="input input-bordered w-full" @change="refreshNoUrutPreview" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Almari Surat <span class="text-error">*</span></label>
                            <AppSelect v-model="form.kd_lemari" :options="opsi.almari" value-prop="kd" label="nama" placeholder="Pilih Almari" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Rak Surat <span class="text-error">*</span></label>
                            <AppSelect v-model="form.kd_rak" :options="opsi.rak" value-prop="kd" label="nama" placeholder="Pilih Rak" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Map Surat <span class="text-error">*</span></label>
                            <AppSelect v-model="form.kd_map" :options="opsi.map" value-prop="kd" label="nama" placeholder="Pilih Map" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Ruang Surat <span class="text-error">*</span></label>
                            <AppSelect v-model="form.kd_ruang" :options="opsi.ruang" value-prop="kd" label="nama" placeholder="Pilih Ruang" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Sifat Surat <span class="text-error">*</span></label>
                            <AppSelect v-model="form.kd_sifat" :options="opsi.sifat" value-prop="kd" label="nama" placeholder="Pilih Sifat" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Lampiran <span class="text-error">*</span></label>
                            <input v-model="form.lampiran" type="text" maxlength="300" class="input input-bordered w-full" placeholder="Keterangan lampiran fisik" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tembusan <span class="text-error">*</span></label>
                            <input v-model="form.tembusan" type="text" maxlength="300" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Deadline Balas <span class="text-error">*</span></label>
                            <input v-model="form.tgl_deadline_balas" type="date" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Status Balas <span class="text-error">*</span></label>
                            <AppSelect v-model="form.kd_balas" :options="opsi.balas" value-prop="kd" label="nama" placeholder="Pilih Status Balas" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Keterangan <span class="text-error">*</span></label>
                            <input v-model="form.keterangan" type="text" maxlength="300" class="input input-bordered w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Status Surat <span class="text-error">*</span></label>
                            <AppSelect v-model="form.kd_status" :options="opsi.status" value-prop="kd" label="nama" placeholder="Pilih Status" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Klasifikasi Surat <span class="text-error">*</span></label>
                            <AppSelect v-model="form.kd_klasifikasi" :options="opsi.klasifikasi" value-prop="kd" label="nama" placeholder="Pilih Klasifikasi" />
                        </div>
                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-base-content/80 mb-1.5">File Berkas (PDF/JPG) <span class="text-error">*</span></label>
                            <input ref="fileInput" type="file" accept=".pdf,.jpg,.jpeg" class="file-input file-input-bordered w-full" @change="onFileChange" />
                        </div>
                    </div>
                    <p v-if="!bolehTulis()" class="text-warning text-sm mt-3">Anda tidak punya akses menambah data ini.</p>
                    <div class="mt-4">
                        <button class="btn btn-primary gap-2" :disabled="saving || !bolehTulis()" @click="simpan">
                            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                            {{ uploading ? 'Mengunggah berkas...' : 'Simpan' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
