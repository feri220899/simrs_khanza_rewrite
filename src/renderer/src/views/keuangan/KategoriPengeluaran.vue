<script setup>
import { computed, onMounted, ref } from 'vue'
import { Bookmark, Pencil, Plus, Save, Trash2, X } from 'lucide-vue-next'
import AppSelect from '../../components/AppSelect.vue'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'

const authStore = useAuthStore()
const { showToast } = useToast()

const rows = ref([])
const rekeningList = ref([])
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const isEdit = ref(false)
const editingKode = ref('')

const form = ref({ kode_kategori: '', nama_kategori: '', kd_rek: '', kd_rek2: '' })

const rekeningOptions = computed(() => rekeningList.value.map(r => ({ ...r, display: `${r.kd_rek} — ${r.nm_rek}` })))

async function load() {
    loading.value = true
    try {
        rows.value = await window.api.keuangan.kategoriPengeluaran.list(authStore.token)
    } catch (err) {
        showToast(err?.message || 'Gagal memuat kategori pengeluaran', 'error')
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

function openNew() {
    isEdit.value = false
    editingKode.value = ''
    form.value = { kode_kategori: '', nama_kategori: '', kd_rek: '', kd_rek2: '' }
    showModal.value = true
}

function openEdit(row) {
    isEdit.value = true
    editingKode.value = row.kode_kategori
    form.value = { kode_kategori: row.kode_kategori, nama_kategori: row.nama_kategori, kd_rek: row.kd_rek, kd_rek2: row.kd_rek2 }
    showModal.value = true
}

function closeModal() {
    showModal.value = false
}

async function save() {
    saving.value = true
    try {
        const result = isEdit.value
            ? await window.api.keuangan.kategoriPengeluaran.update(authStore.token, editingKode.value, form.value)
            : await window.api.keuangan.kategoriPengeluaran.create(authStore.token, form.value)

        if (!result.success) return showToast(result.message || 'Gagal menyimpan kategori', 'error')

        showToast('Kategori berhasil disimpan')
        closeModal()
        await load()
    } catch (err) {
        showToast(err?.message || 'Gagal menyimpan kategori', 'error')
    } finally {
        saving.value = false
    }
}

async function remove(row) {
    if (!confirm(`Hapus kategori "${row.nama_kategori}"?`)) return
    const result = await window.api.keuangan.kategoriPengeluaran.delete(authStore.token, row.kode_kategori)
    if (!result.success) return showToast(result.message || 'Gagal menghapus kategori', 'error')
    showToast('Kategori berhasil dihapus')
    await load()
}

onMounted(() => {
    load()
    loadRekening()
})
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <div class="mb-4 flex items-center justify-between shrink-0">
            <div>
                <h1 class="text-xl font-bold flex items-center gap-2"><Bookmark class="size-6 text-primary" /> Kategori Pengeluaran Harian</h1>
                <p class="text-sm text-base-content/60">Master kategori beserta akun beban & kontra akun kas/bank</p>
            </div>
            <button class="btn btn-primary btn-sm gap-2" @click="openNew"><Plus class="size-4" /> Kategori Baru</button>
        </div>

        <div class="relative overflow-auto grow min-h-[300px] border border-base-200 rounded-lg bg-base-100">
            <div v-if="loading" class="absolute inset-0 z-20 bg-base-100/80 flex items-center justify-center"><span class="loading loading-spinner text-primary"></span></div>
            <table class="table table-sm w-full">
                <thead class="sticky top-0 z-10 bg-base-200">
                    <tr>
                        <th class="w-20">Kode</th>
                        <th>Nama Kategori</th>
                        <th>Akun Beban</th>
                        <th>Kontra Akun (Kas/Bank)</th>
                        <th class="w-24 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in rows" :key="row.kode_kategori">
                        <td class="font-mono">{{ row.kode_kategori }}</td>
                        <td>{{ row.nama_kategori }}</td>
                        <td><span class="font-mono text-xs text-base-content/60">{{ row.kd_rek }}</span> {{ row.nm_rek_akun }}</td>
                        <td><span class="font-mono text-xs text-base-content/60">{{ row.kd_rek2 }}</span> {{ row.nm_rek_kontra }}</td>
                        <td class="text-center">
                            <button class="btn btn-ghost btn-xs text-primary" @click="openEdit(row)"><Pencil class="size-4" /></button>
                            <button class="btn btn-ghost btn-xs text-error" @click="remove(row)"><Trash2 class="size-4" /></button>
                        </td>
                    </tr>
                    <tr v-if="!rows.length"><td colspan="5" class="text-center py-8 text-base-content/50">Belum ada kategori pengeluaran.</td></tr>
                </tbody>
            </table>
        </div>

        <dialog class="modal" :class="{ 'modal-open': showModal }">
            <div class="modal-box rounded-2xl border border-base-200 max-w-lg">
                <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
                    <component :is="isEdit ? Pencil : Plus" class="size-5" /> {{ isEdit ? 'Edit Kategori' : 'Tambah Kategori' }}
                </h3>
                <div class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-sm font-medium px-1">Kode Kategori <span class="text-error">*</span></label>
                        <input type="text" v-model="form.kode_kategori" maxlength="5" class="input input-bordered input-sm w-full uppercase" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-sm font-medium px-1">Nama Kategori <span class="text-error">*</span></label>
                        <input type="text" v-model="form.nama_kategori" maxlength="40" class="input input-bordered input-sm w-full uppercase" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-sm font-medium px-1">Akun Beban (didebet) <span class="text-error">*</span></label>
                        <AppSelect v-model="form.kd_rek" :options="rekeningOptions" value-prop="kd_rek" label="display" placeholder="Pilih akun beban..." />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-sm font-medium px-1">Kontra Akun Kas/Bank (dikredit) <span class="text-error">*</span></label>
                        <AppSelect v-model="form.kd_rek2" :options="rekeningOptions" value-prop="kd_rek" label="display" placeholder="Pilih akun kas/bank..." />
                    </div>
                </div>
                <div class="modal-action">
                    <button class="btn btn-ghost btn-sm" @click="closeModal"><X class="size-4" /> Batal</button>
                    <button class="btn btn-primary btn-sm gap-2" :disabled="saving" @click="save">
                        <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                        <Save v-else class="size-4" /> Simpan
                    </button>
                </div>
            </div>
            <form method="dialog" class="modal-backdrop bg-black/40"><button @click="closeModal">Tutup</button></form>
        </dialog>
    </div>
</template>
