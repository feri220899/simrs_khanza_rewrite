<script setup>
import { reactive, ref, onMounted } from 'vue'
import { Database, HardDrive, Wifi, Save, Check, X, FileDown, FileUp, KeyRound } from 'lucide-vue-next'

// Hub konfigurasi infra (MySQL + service pihak ke-3 tambahan) SETELAH login
// — beda dari "Pengaturan Awal" (PengaturanAwal.vue, sebelum login) yang
// cuma wajibkan MySQL sekali di awal lalu dilewati otomatis. Di sini
// database yang sudah pernah di-set TETAP ditampilkan & bisa diedit lagi
// (mis. server pindah IP), bukan hilang setelah pertama kali diisi. MinIO &
// service tambahan nanti (mis. Redis) tetap opsional. Export/Import di
// bagian bawah dipakai buat rollout banyak PC di RS yang sama tanpa ngetik
// ulang manual di tiap komputer — lihat catatan lengkap di ConfigService.js.
const db = reactive({ host: '', port: 3306, database: 'sik', user: 'root', password: '' })
const minio = reactive({ endpoint: '', port: 9000, useSSL: false, accessKey: '', secretKey: '', bucket: 'khanza' })

const loading = ref(true)
const dbTesting = ref(false)
const dbTest = ref(null)
const dbSaving = ref(false)
const dbSaved = ref(false)
const minioTesting = ref(false)
const minioTest = ref(null)
const minioSaving = ref(false)
const minioSaved = ref(false)

const exportPass = ref('')
const importPass = ref('')
const exportBusy = ref(false)
const importBusy = ref(false)
const exportResult = ref(null)
const importResult = ref(null)

onMounted(async () => {
    const savedDb = await window.api.config.getDbConfig()
    if (savedDb) Object.assign(db, savedDb)
    const savedMinio = await window.api.config.getMinioConfig()
    if (savedMinio) Object.assign(minio, savedMinio)
    loading.value = false
})

async function cekDb() {
    dbTesting.value = true
    dbSaved.value = false
    try {
        dbTest.value = await window.api.config.testDbConnection({ ...db, port: Number(db.port) })
    } finally {
        dbTesting.value = false
    }
}

async function simpanDb() {
    if (!confirm('Mengubah koneksi database akan langsung berlaku untuk aplikasi ini SEKARANG. Pastikan "Cek Koneksi" sudah berhasil. Lanjutkan?')) return
    dbSaving.value = true
    try {
        await window.api.config.saveDbConfig({ ...db, port: Number(db.port) })
        dbSaved.value = true
    } finally {
        dbSaving.value = false
    }
}

async function cekMinio() {
    minioTesting.value = true
    minioSaved.value = false
    try {
        minioTest.value = await window.api.config.testMinioConnection({ ...minio, port: Number(minio.port) })
    } finally {
        minioTesting.value = false
    }
}

async function simpanMinio() {
    minioSaving.value = true
    try {
        await window.api.config.saveMinioConfig({ ...minio, port: Number(minio.port) })
        minioSaved.value = true
    } finally {
        minioSaving.value = false
    }
}

async function exportKonfigurasi() {
    exportBusy.value = true
    exportResult.value = null
    try {
        exportResult.value = await window.api.config.exportConfig(exportPass.value)
    } finally {
        exportBusy.value = false
        exportPass.value = ''
    }
}

async function importKonfigurasi() {
    if (!confirm('Import akan MENIMPA konfigurasi MySQL/MinIO yang tersimpan di komputer ini SEKARANG. Lanjutkan?')) return
    importBusy.value = true
    importResult.value = null
    try {
        const res = await window.api.config.importConfig(importPass.value)
        importResult.value = res
        if (res.success) {
            if (res.data.db) Object.assign(db, res.data.db)
            if (res.data.minio) Object.assign(minio, res.data.minio)
            dbTest.value = null
            minioTest.value = null
        }
    } finally {
        importBusy.value = false
        importPass.value = ''
    }
}
</script>

<template>
    <div>
        <p class="text-sm text-base-content/60 mb-4">
            Alamat & kredensial layanan yang dipakai aplikasi ini — MySQL wajib, sisanya opsional
            dan bisa diisi belakangan tanpa mengganggu pemakaian.
        </p>

        <p v-if="loading" class="text-sm text-base-content/50">Memuat...</p>

        <template v-else>
            <!-- Export/Import — di PALING ATAS (utilitas rollout banyak PC), dibedakan
                 warna latar biar kelihatan beda fungsi dari card config service di bawah -->
            <div class="bg-base-200/60 rounded-2xl border border-base-200 p-4 mb-4">
                <h3 class="font-semibold text-sm mb-1">Export / Import Konfigurasi</h3>
                <p class="text-xs text-base-content/50 mb-3">
                    Buat instalasi banyak PC di RS yang sama (host MySQL/MinIO sama persis) —
                    export sekali dari komputer ini, import di komputer lain, tidak perlu ketik
                    ulang manual. File hasil export dilindungi passphrase (BUKAN file
                    <code>config.dat</code> mentah — itu terkunci ke komputer ini saja, tidak bisa
                    dipakai di komputer lain). Simpan passphrase-nya baik-baik, dan hapus file
                    export setelah selesai dipakai.
                </p>

                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-base-100 rounded-xl p-3 border border-base-200">
                        <label class="label text-xs flex items-center gap-1.5"><FileDown class="size-3.5" /> Export — buat passphrase baru</label>
                        <label class="input input-bordered input-sm w-full flex items-center gap-2">
                            <KeyRound class="size-3.5 text-base-content/40" />
                            <input v-model="exportPass" type="password" class="grow" placeholder="Passphrase" />
                        </label>
                        <button class="btn btn-sm mt-2 w-full gap-2" :disabled="exportBusy || !exportPass" @click="exportKonfigurasi">
                            <span v-if="exportBusy" class="loading loading-spinner loading-xs"></span>
                            <FileDown v-else class="size-3.5" /> Export ke File
                        </button>
                        <p v-if="exportResult?.success" class="text-success text-xs mt-1.5">Tersimpan: {{ exportResult.path }}</p>
                        <p v-else-if="exportResult && !exportResult.success" class="text-error text-xs mt-1.5">{{ exportResult.message }}</p>
                    </div>
                    <div class="bg-base-100 rounded-xl p-3 border border-base-200">
                        <label class="label text-xs flex items-center gap-1.5"><FileUp class="size-3.5" /> Import — passphrase dari file</label>
                        <label class="input input-bordered input-sm w-full flex items-center gap-2">
                            <KeyRound class="size-3.5 text-base-content/40" />
                            <input v-model="importPass" type="password" class="grow" placeholder="Passphrase" />
                        </label>
                        <button class="btn btn-sm mt-2 w-full gap-2" :disabled="importBusy || !importPass" @click="importKonfigurasi">
                            <span v-if="importBusy" class="loading loading-spinner loading-xs"></span>
                            <FileUp v-else class="size-3.5" /> Pilih File & Import
                        </button>
                        <p v-if="importResult?.success" class="text-success text-xs mt-1.5">Berhasil di-import & langsung dipakai.</p>
                        <p v-else-if="importResult && !importResult.success" class="text-error text-xs mt-1.5">{{ importResult.message }}</p>
                    </div>
                </div>
            </div>

            <!-- Config service — grid 3 kolom otomatis. Database & MinIO isi 2 slot,
                 sisa 1 kosong sampai ada config ke-3 (mis. Redis) — nambah nanti
                 tinggal taruh 1 card baru di sini, otomatis kepasang di slot
                 kosong/baris berikutnya, TIDAK perlu restructure layout. -->
            <div class="grid grid-cols-3 gap-4">
            <!-- Database MySQL — WAJIB. `flex flex-col` + tombol `mt-auto` supaya
                 baris tombol nempel di BAWAH card, sejajar antar card walau jumlah
                 field beda-beda (grid item otomatis sama tinggi = card MinIO/dst). -->
            <div class="bg-base-100 rounded-2xl border border-base-200 p-4 flex flex-col">
                <div class="flex items-center justify-between mb-1">
                    <h3 class="font-semibold text-sm flex items-center gap-2">
                        <Database class="size-4 text-primary" /> Database MySQL
                        <span class="badge badge-outline badge-sm">Wajib</span>
                    </h3>
                    <span v-if="dbTest?.success" class="badge badge-success badge-sm gap-1"><Check class="size-3" /> Terhubung</span>
                    <span v-else-if="dbTest && !dbTest.success" class="badge badge-error badge-sm gap-1"><X class="size-3" /> Gagal</span>
                </div>
                <p class="text-xs text-base-content/50 mb-3">
                    Koneksi ke database <code>sik</code> — diisi pertama kali lewat "Pengaturan
                    Awal", tetap bisa diubah di sini kalau server pindah alamat.
                </p>

                <div class="grid grid-cols-2 gap-2">
                    <div class="col-span-2">
                        <label class="label text-xs">Host</label>
                        <input v-model="db.host" type="text" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="label text-xs">Port</label>
                        <input v-model="db.port" type="number" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="label text-xs">Nama Database</label>
                        <input v-model="db.database" type="text" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="label text-xs">User</label>
                        <input v-model="db.user" type="text" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="label text-xs">Password</label>
                        <input v-model="db.password" type="password" class="input input-bordered input-sm w-full" />
                    </div>
                </div>

                <div class="flex items-center flex-wrap gap-2 mt-auto pt-3">
                    <button class="btn btn-sm gap-2" :disabled="dbTesting" @click="cekDb">
                        <span v-if="dbTesting" class="loading loading-spinner loading-xs"></span>
                        <Wifi v-else class="size-3.5" /> Cek Koneksi
                    </button>
                    <button class="btn btn-primary btn-sm gap-2" :disabled="dbSaving" @click="simpanDb">
                        <span v-if="dbSaving" class="loading loading-spinner loading-xs"></span>
                        <Save v-else class="size-3.5" /> Simpan
                    </button>
                    <span v-if="dbSaved" class="badge badge-success badge-sm gap-1"><Check class="size-3" /> Tersimpan</span>
                </div>
                <div v-if="dbTest && !dbTest.success" class="alert alert-error text-xs py-2 mt-3">{{ dbTest.message }}</div>
            </div>

            <!-- MinIO — Wajib -->
            <div class="bg-base-100 rounded-2xl border border-base-200 p-4 flex flex-col">
                <div class="flex items-center justify-between mb-1">
                    <h3 class="font-semibold text-sm flex items-center gap-2">
                        <HardDrive class="size-4 text-base-content/60" /> MinIO
                        <span class="badge badge-outline badge-sm">Wajib</span>
                    </h3>
                    <span v-if="minioTest?.success" class="badge badge-success badge-sm gap-1"><Check class="size-3" /> Terhubung</span>
                    <span v-else-if="minioTest && !minioTest.success" class="badge badge-error badge-sm gap-1"><X class="size-3" /> Gagal</span>
                </div>
                <p class="text-xs text-base-content/50 mb-3">
                    Object storage buat lampiran file (mis. Surat Masuk/Keluar). Boleh dikosongkan
                    dulu — fitur yang butuh ini baru error saat benar-benar dipakai kalau belum
                    diisi/salah.
                </p>

                <div class="grid grid-cols-2 gap-2">
                    <div class="col-span-2">
                        <label class="label text-xs">Endpoint</label>
                        <input v-model="minio.endpoint" type="text" class="input input-bordered input-sm w-full" placeholder="localhost" />
                    </div>
                    <div>
                        <label class="label text-xs">Port</label>
                        <input v-model="minio.port" type="number" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="label text-xs">Nama Bucket</label>
                        <input v-model="minio.bucket" type="text" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="label text-xs">Access Key</label>
                        <input v-model="minio.accessKey" type="text" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="label text-xs">Secret Key</label>
                        <input v-model="minio.secretKey" type="password" class="input input-bordered input-sm w-full" />
                    </div>
                    <label class="label cursor-pointer justify-start gap-2 col-span-2">
                        <input v-model="minio.useSSL" type="checkbox" class="checkbox checkbox-sm" />
                        <span class="label-text text-xs">Pakai SSL</span>
                    </label>
                </div>

                <div class="flex items-center flex-wrap gap-2 mt-auto pt-3">
                    <button class="btn btn-sm gap-2" :disabled="minioTesting" @click="cekMinio">
                        <span v-if="minioTesting" class="loading loading-spinner loading-xs"></span>
                        <Wifi v-else class="size-3.5" /> Cek Koneksi
                    </button>
                    <button class="btn btn-primary btn-sm gap-2" :disabled="minioSaving" @click="simpanMinio">
                        <span v-if="minioSaving" class="loading loading-spinner loading-xs"></span>
                        <Save v-else class="size-3.5" /> Simpan
                    </button>
                    <span v-if="minioSaved" class="badge badge-success badge-sm gap-1"><Check class="size-3" /> Tersimpan</span>
                </div>
                <div v-if="minioTest && !minioTest.success" class="alert alert-error text-xs py-2 mt-3">{{ minioTest.message }}</div>
            </div>
            <!-- ↑ nambah config service baru nanti: taruh 1 card baru persis di sini
                 (jangan lupa `flex flex-col` + tombol `mt-auto` biar tetap sejajar),
                 masih di dalam grid yang sama, otomatis dapat kolom/baris berikutnya -->
            </div>
        </template>
    </div>
</template>
