<script setup>
import { reactive, ref, watch, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

// Layar PERTAMA yang dibuka (route "/") sebelum Aktivasi/Login — instalasi
// baru (PC/RS lain yang pakai app open source ini) belum tahu host/kredensial
// MySQL `sik` milik mereka sendiri, jadi tidak bisa langsung connect kayak
// dev environment yang pakai `.env`. Diisi & dites di sini SEKALI, tersimpan
// terenkripsi (lihat ConfigService.js > safeStorage) di komputer itu — kalau
// sudah pernah diisi & valid, layar ini dilewati otomatis.
//
// CUMA MySQL yang wajib di sini (satu-satunya yang app tidak bisa jalan sama
// sekali tanpanya) — MinIO & config tambahan lain nanti (mis. Redis) TIDAK
// di sini, sengaja dipindah ke Pengaturan > Environment (opsional, diisi
// belakangan tanpa mem-block pemakaian awal, lihat EnvironmentPanel.vue).
//
// Opsi "Import" di bawah dipakai instalasi PC ke-2 dst di RS yang SAMA
// (host MySQL sama persis) — supaya tidak ketik ulang manual tiap komputer,
// lihat catatan lengkap di ConfigService.js.
const router = useRouter()

const db = reactive({ host: 'localhost', port: 3306, database: 'sik', user: 'root', password: '' })

const dbTesting = ref(false)
const dbTest = ref(null)
const saving = ref(false)
const memuat = ref(true)

const importPass = ref('')
const importBusy = ref(false)
const importResult = ref(null)

// Field berubah setelah dites -> hasil test lama tidak relevan lagi, jangan
// biarkan tombol "Simpan & Lanjutkan" tetap aktif pakai hasil basi.
watch(db, () => { dbTest.value = null }, { deep: true })

const bisaLanjut = computed(() => dbTest.value?.success === true)

onMounted(async () => {
    if (await window.api.config.isConfigured()) {
        router.replace('/aktivasi')
        return
    }
    const savedDb = await window.api.config.getDbConfig()
    if (savedDb) Object.assign(db, savedDb)
    memuat.value = false
})

async function cekDb() {
    dbTesting.value = true
    try {
        dbTest.value = await window.api.config.testDbConnection({ ...db, port: Number(db.port) })
    } finally {
        dbTesting.value = false
    }
}

async function simpanLanjut() {
    if (!bisaLanjut.value) return
    saving.value = true
    try {
        await window.api.config.saveDbConfig({ ...db, port: Number(db.port) })
        router.replace('/aktivasi')
    } finally {
        saving.value = false
    }
}

async function importKonfigurasi() {
    importBusy.value = true
    importResult.value = null
    try {
        const res = await window.api.config.importConfig(importPass.value)
        importResult.value = res
        if (res.success && res.data.db) {
            Object.assign(db, res.data.db)
            // Import ditest ulang otomatis dari komputer INI juga — server
            // yang sama belum tentu terjangkau dari jaringan PC ini (beda
            // VLAN/firewall dsb), jangan asumsikan pasti nyambung.
            await cekDb()
        }
    } finally {
        importBusy.value = false
        importPass.value = ''
    }
}
</script>

<template>
    <div class="h-screen flex items-center justify-center bg-base-200">
        <div v-if="memuat" class="loading loading-spinner loading-lg text-primary"></div>
        <div v-else class="card w-96 bg-base-100 shadow-xl">
            <div class="card-body">
                <h2 class="card-title">Pengaturan Awal</h2>
                <p class="text-sm text-base-content/60">
                    Sebelum dipakai, Khanza Desktop perlu tahu alamat database MySQL <code>sik</code>
                    milik rumah sakit ini. Diisi sekali di komputer ini saja — pengaturan lain
                    (MinIO, dst) bisa diatur belakangan lewat Pengaturan &gt; Environment.
                </p>

                <div class="grid grid-cols-3 gap-2 mt-2">
                    <div class="col-span-2">
                        <label class="label text-xs">Host</label>
                        <input v-model="db.host" type="text" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="label text-xs">Port</label>
                        <input v-model="db.port" type="number" class="input input-bordered input-sm w-full" />
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-2">
                    <div>
                        <label class="label text-xs">Nama Database</label>
                        <input v-model="db.database" type="text" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="label text-xs">User</label>
                        <input v-model="db.user" type="text" class="input input-bordered input-sm w-full" />
                    </div>
                </div>
                <label class="label text-xs mt-2">Password</label>
                <input v-model="db.password" type="password" class="input input-bordered input-sm w-full" />

                <div class="flex items-center gap-3 mt-2">
                    <button class="btn btn-sm" :disabled="dbTesting" @click="cekDb">
                        <span v-if="dbTesting" class="loading loading-spinner loading-xs"></span>
                        Cek Koneksi
                    </button>
                    <span v-if="dbTest?.success" class="text-success text-sm">✓ Terhubung</span>
                    <span v-else-if="dbTest && !dbTest.success" class="text-error text-sm">✗ {{ dbTest.message }}</span>
                </div>

                <button class="btn btn-primary mt-4" :disabled="!bisaLanjut || saving" @click="simpanLanjut">
                    <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                    Simpan & Lanjutkan
                </button>
                <p v-if="!bisaLanjut" class="text-xs text-base-content/50 text-center mt-1">
                    Cek koneksi dulu sebelum lanjut.
                </p>

                <div class="divider text-xs">atau</div>
                <p class="text-xs text-base-content/50 mb-1">
                    Sudah punya file export konfigurasi dari komputer lain di RS ini?
                </p>
                <div class="flex gap-2">
                    <input v-model="importPass" type="password" class="input input-bordered input-sm flex-1" placeholder="Passphrase file export" />
                    <button class="btn btn-sm" :disabled="importBusy || !importPass" @click="importKonfigurasi">
                        <span v-if="importBusy" class="loading loading-spinner loading-xs"></span>
                        Pilih File & Import
                    </button>
                </div>
                <p v-if="importResult && !importResult.success" class="text-error text-xs mt-1">{{ importResult.message }}</p>
                <p v-else-if="importResult?.success" class="text-success text-xs mt-1">
                    Berhasil di-import — cek status koneksi di atas sebelum lanjut.
                </p>
            </div>
        </div>
    </div>
</template>
