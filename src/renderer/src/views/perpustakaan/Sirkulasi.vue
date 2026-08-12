<script setup>
import { ref, reactive, computed, h, onMounted } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { Repeat, TriangleAlert } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'
import AppPagination from '../../components/AppPagination.vue'
import AppSelect from '../../components/AppSelect.vue'

// src/perpustakaan/PerpustakaanSirkulasi.java — transaksi inti (pinjam/
// kembali/perpanjang). Entity KOMPLEKS (field yg tampil beda tergantung
// mode pinjam vs kembali) -> pola SATU modal dipakai utk kedua alur,
// dibedakan lewat state `mode`, list SELALU jadi halaman utama (bukan
// ditab-kan) — sesuai Konvensi UI "Aturan 1" utk entity kompleks.
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can('peminjaman_perpustakaan')

const setting = ref(null)
const statusFilter = ref('')
const opsiAnggota = ref([])
const opsiInventaris = ref([])
// "Petugas" (nip) — replika src/kepegawaian/DlgCariPetugas.java: dipilih
// eksplisit dari daftar petugas AKTIF, BUKAN otomatis dari akun yang login
// (lihat catatan koreksi di PerpustakaanSirkulasiService.listPetugas()).
const opsiPetugas = ref([])

// AppSelect (dropdown pencarian) nonaktifkan opsi lewat field `disabled` —
// buku yang statusnya bukan 'Ada' tidak boleh dipinjam lagi.
const opsiInventarisPinjam = computed(() => opsiInventaris.value.map(o => ({
    ...o,
    tampilan: `${o.judul_buku} (${o.no_inventaris})${o.status_buku !== 'Ada' ? ` — ${o.status_buku}` : ''}`,
    disabled: o.status_buku !== 'Ada',
})))

async function muatAwal() {
    setting.value = await window.api.perpustakaan.sirkulasi.getSetting()
    const [a, i, p] = await Promise.all([
        window.api.perpustakaan.anggota.list({ pageSize: 1000 }),
        window.api.perpustakaan.inventaris.list({ pageSize: 1000 }),
        window.api.perpustakaan.sirkulasi.listPetugas(),
    ])
    opsiAnggota.value = a.data
    opsiInventaris.value = i.data
    opsiPetugas.value = p
}

const columns = [
    { accessorKey: 'nama_anggota', header: 'Peminjam', meta: { headerClass: 'w-48' } },
    { accessorKey: 'judul_buku', header: 'Judul Buku' },
    { accessorKey: 'tgl_pinjam', header: 'Tgl. Pinjam', meta: { headerClass: 'w-28' } },
    {
        accessorKey: 'tgl_kembali', header: 'Tgl. Kembali', meta: { headerClass: 'w-28' },
        cell: info => info.getValue()?.slice?.(0, 10) || info.getValue() || '-',
    },
    {
        accessorKey: 'status_pinjam', header: 'Status', enableSorting: false, meta: { headerClass: 'w-36 text-center', cellClass: 'text-center' },
        cell: info => h('span', {
            class: `inline-flex items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${info.getValue() === 'Masih Dipinjam' ? 'bg-warning' : 'bg-success'}`,
        }, info.getValue()),
    },
    {
        id: 'aksi', header: 'Aksi', enableSorting: false,
        meta: { headerClass: 'text-center w-64', cellClass: 'text-center' },
        cell: info => {
            const row = info.row.original
            if (row.status_pinjam === 'Masih Dipinjam') {
                return h('div', { class: 'flex gap-1 justify-center' }, [
                    h('button', { class: 'btn btn-primary btn-sm', onClick: () => openKembali(row) }, 'Kembalikan'),
                    h('button', { class: 'btn btn-ghost btn-sm', onClick: () => openPerpanjang(row) }, 'Perpanjang'),
                ])
            }
            return h('button', { class: 'btn btn-ghost btn-sm text-error', onClick: () => hapus(row) }, 'Hapus')
        },
    },
]

const { table, loading, search, fetchData } = useServerTable({
    columns,
    fetchFn: params => window.api.perpustakaan.sirkulasi.list({ ...params, status: statusFilter.value }),
    pageSize: 10,
    defaultSortBy: 'tgl_pinjam',
    defaultSortOrder: 'desc',
})

// ── Modal Pinjam/Kembali (dual-mode) ────────────────────────────────────
const modal = ref(null)
const mode = ref('pinjam') // 'pinjam' | 'kembali'
const saving = ref(false)
const preview = ref(null)
const form = reactive({ no_anggota: '', no_inventaris: '', tgl_pinjam: '', tgl_kembali: '', nip: '' })

function today() { return new Date().toISOString().slice(0, 10) }

function openPinjam() {
    mode.value = 'pinjam'
    Object.assign(form, { no_anggota: '', no_inventaris: '', tgl_pinjam: today(), tgl_kembali: '', nip: '' })
    preview.value = null
    modal.value?.showModal()
}

function openKembali(row) {
    mode.value = 'kembali'
    Object.assign(form, {
        no_anggota: row.no_anggota, no_inventaris: row.no_inventaris,
        tgl_pinjam: row.tgl_pinjam?.slice?.(0, 10) || row.tgl_pinjam, tgl_kembali: today(), nip: '',
    })
    preview.value = null
    cekPreview()
    modal.value?.showModal()
}

async function cekPreview() {
    preview.value = null
    if (mode.value === 'pinjam') {
        if (!form.no_anggota || !form.no_inventaris || !form.tgl_pinjam) return
        preview.value = await window.api.perpustakaan.sirkulasi.previewPinjam({ ...form })
    } else {
        if (!form.tgl_kembali) return
        preview.value = await window.api.perpustakaan.sirkulasi.previewKembali({ ...form })
    }
}

async function simpanModal() {
    saving.value = true
    try {
        const res = mode.value === 'pinjam'
            ? await window.api.perpustakaan.sirkulasi.pinjam(authStore.token, { ...form })
            : await window.api.perpustakaan.sirkulasi.kembali(authStore.token, { ...form })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(mode.value === 'pinjam' ? 'Peminjaman berhasil dicatat.' : 'Pengembalian berhasil dicatat.')
        modal.value?.close()
        fetchData()
        muatAwal() // refresh opsi inventaris (status berubah)
    } finally {
        saving.value = false
    }
}

// ── Modal Perpanjang (kecil, terpisah) ──────────────────────────────────
const modalPerpanjang = ref(null)
const perpanjangSaving = ref(false)
const perpanjangForm = reactive({ no_anggota: '', no_inventaris: '', tgl_pinjam_lama: '', tgl_pinjam_baru: '', judul_buku: '', nama_anggota: '', nip: '' })

function openPerpanjang(row) {
    Object.assign(perpanjangForm, {
        no_anggota: row.no_anggota, no_inventaris: row.no_inventaris,
        tgl_pinjam_lama: row.tgl_pinjam?.slice?.(0, 10) || row.tgl_pinjam, tgl_pinjam_baru: today(),
        judul_buku: row.judul_buku, nama_anggota: row.nama_anggota, nip: '',
    })
    modalPerpanjang.value?.showModal()
}

async function simpanPerpanjang() {
    perpanjangSaving.value = true
    try {
        const res = await window.api.perpustakaan.sirkulasi.perpanjang(authStore.token, { ...perpanjangForm })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Peminjaman berhasil diperpanjang.')
        modalPerpanjang.value?.close()
        fetchData()
    } finally {
        perpanjangSaving.value = false
    }
}

async function hapus(row) {
    if (!confirm(`Hapus riwayat peminjaman "${row.judul_buku}" oleh "${row.nama_anggota}"?`)) return
    const res = await window.api.perpustakaan.sirkulasi.delete(authStore.token, {
        no_anggota: row.no_anggota, no_inventaris: row.no_inventaris, tgl_pinjam: row.tgl_pinjam,
    })
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Riwayat peminjaman berhasil dihapus.')
    fetchData()
}

function onFilterChange() {
    fetchData()
}

onMounted(muatAwal)
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="flex items-center justify-between mb-4 shrink-0">
            <div>
                <h1 class="text-2xl font-bold tracking-tight">Perpustakaan — Sirkulasi</h1>
                <p class="text-sm text-base-content/60 mt-0.5">Peminjaman & pengembalian buku (src/perpustakaan/PerpustakaanSirkulasi.java)</p>
            </div>
            <button class="btn btn-primary gap-2" :disabled="!bolehTulis()" @click="openPinjam">
                <Repeat class="size-4" />
                Pinjamkan Buku
            </button>
        </div>

        <div v-if="setting === null" class="alert alert-warning mb-3 shrink-0">
            <TriangleAlert class="size-5" />
            <span>Pengaturan Peminjaman belum diatur — buka menu <b>Pengaturan Peminjaman</b> dulu sebelum bisa meminjamkan buku.</span>
        </div>

        <div class="mb-2 shrink-0">
            <select v-model="statusFilter" class="select select-bordered select-sm" @change="onFilterChange">
                <option value="">Semua Status</option>
                <option value="Masih Dipinjam">Masih Dipinjam</option>
                <option value="Sudah Kembali">Sudah Kembali</option>
            </select>
        </div>

        <div class="flex-1 min-h-0 overflow-hidden">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm h-full flex flex-col overflow-hidden px-4 py-3">
                <AppPagination :table="table" v-model:search="search" class="flex-1 min-h-0">
                    <table class="table">
                        <thead class="sticky top-0 z-10">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th v-for="header in table.getFlatHeaders()" :key="header.id"
                                    :class="['text-sm font-medium py-2', header.column.columnDef.meta?.headerClass,
                                             header.column.getCanSort() ? 'cursor-pointer select-none hover:text-primary transition-colors' : '']"
                                    @click="header.column.getToggleSortingHandler()?.($event)">
                                    <div :class="['flex items-center gap-1', header.column.columnDef.meta?.headerClass?.includes('text-center') ? 'justify-center' : '']">
                                        <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                                        <span v-if="header.column.getIsSorted() === 'asc'" class="text-primary">↑</span>
                                        <span v-else-if="header.column.getIsSorted() === 'desc'" class="text-primary">↓</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading">
                                <td colspan="6" class="py-16 text-center">
                                    <span class="loading loading-spinner loading-md text-primary"></span>
                                </td>
                            </tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="6" class="py-16 text-center text-base-content/50">Belum ada data peminjaman</td>
                            </tr>
                            <tr v-else v-for="row in table.getRowModel().rows" :key="row.id"
                                class="border-b border-base-200 hover:bg-primary/5 transition-colors duration-100">
                                <td v-for="cell in row.getVisibleCells()" :key="cell.id"
                                    :class="['py-2', cell.column.columnDef.meta?.cellClass]">
                                    <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </AppPagination>
            </div>
        </div>
    </div>

    <!-- Modal Pinjam / Kembali -->
    <dialog ref="modal" class="modal">
        <div class="modal-box max-w-md">
            <h3 class="font-bold text-base mb-4">{{ mode === 'pinjam' ? 'Pinjamkan Buku' : 'Kembalikan Buku' }}</h3>
            <div class="space-y-3">
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Petugas <span class="text-error">*</span></label>
                    <AppSelect v-model="form.nip" :options="opsiPetugas" value-prop="nip" label="nama" placeholder="Pilih Petugas" @change="cekPreview" />
                </div>
                <template v-if="mode === 'pinjam'">
                    <div>
                        <label class="block text-sm font-medium text-base-content/80 mb-1.5">Peminjam (Anggota) <span class="text-error">*</span></label>
                        <AppSelect v-model="form.no_anggota" :options="opsiAnggota" value-prop="no_anggota" label="nama_anggota" placeholder="Pilih Anggota" @change="cekPreview" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-base-content/80 mb-1.5">Buku (Inventaris) <span class="text-error">*</span></label>
                        <AppSelect v-model="form.no_inventaris" :options="opsiInventarisPinjam" value-prop="no_inventaris" label="tampilan" placeholder="Pilih Buku" @change="cekPreview" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal Pinjam</label>
                        <input v-model="form.tgl_pinjam" type="date" class="input input-bordered input-sm w-full" @change="cekPreview" />
                    </div>
                </template>
                <template v-else>
                    <p class="text-sm">
                        <span class="text-base-content/60">Peminjam:</span> <b>{{ opsiAnggota.find(a => a.no_anggota === form.no_anggota)?.nama_anggota }}</b><br />
                        <span class="text-base-content/60">Buku:</span> <b>{{ opsiInventaris.find(i => i.no_inventaris === form.no_inventaris)?.judul_buku }}</b><br />
                        <span class="text-base-content/60">Tgl. Pinjam:</span> {{ form.tgl_pinjam }}
                    </p>
                    <div>
                        <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal Kembali</label>
                        <input v-model="form.tgl_kembali" type="date" class="input input-bordered input-sm w-full" @change="cekPreview" />
                    </div>
                </template>

                <div v-if="preview?.success" class="alert alert-info py-2 text-sm">
                    <span v-if="mode === 'pinjam'">Jatuh tempo: <b>{{ preview.jatuhTempo }}</b></span>
                    <span v-else>
                        Jatuh tempo: <b>{{ preview.jatuhTempo }}</b> — Telat <b>{{ preview.hariTelat }}</b> hari —
                        Denda: <b>Rp {{ Number(preview.besarDenda).toLocaleString('id-ID') }}</b>
                    </span>
                </div>
                <div v-else-if="preview && !preview.success" class="alert alert-error py-2 text-sm">{{ preview.message }}</div>
            </div>
            <div class="modal-action mt-4">
                <button class="btn btn-ghost btn-sm" @click="modal?.close()">Batal</button>
                <button class="btn btn-primary btn-sm gap-2" :disabled="saving || !form.nip || preview?.success === false" @click="simpanModal">
                    <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                    {{ mode === 'pinjam' ? 'Pinjamkan' : 'Kembalikan' }}
                </button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>

    <!-- Modal Perpanjang -->
    <dialog ref="modalPerpanjang" class="modal">
        <div class="modal-box max-w-sm">
            <h3 class="font-bold text-base mb-4">Perpanjang Peminjaman</h3>
            <p class="text-sm mb-3">
                <span class="text-base-content/60">Peminjam:</span> <b>{{ perpanjangForm.nama_anggota }}</b><br />
                <span class="text-base-content/60">Buku:</span> <b>{{ perpanjangForm.judul_buku }}</b>
            </p>
            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Tanggal Pinjam Baru</label>
            <input v-model="perpanjangForm.tgl_pinjam_baru" type="date" class="input input-bordered input-sm w-full" />
            <div class="mt-3">
                <label class="block text-sm font-medium text-base-content/80 mb-1.5">Petugas <span class="text-error">*</span></label>
                <AppSelect v-model="perpanjangForm.nip" :options="opsiPetugas" value-prop="nip" label="nama" placeholder="Pilih Petugas" />
            </div>
            <div class="modal-action mt-4">
                <button class="btn btn-ghost btn-sm" @click="modalPerpanjang?.close()">Batal</button>
                <button class="btn btn-primary btn-sm gap-2" :disabled="perpanjangSaving || !perpanjangForm.nip" @click="simpanPerpanjang">
                    <span v-if="perpanjangSaving" class="loading loading-spinner loading-xs"></span>
                    Simpan
                </button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>
</template>
