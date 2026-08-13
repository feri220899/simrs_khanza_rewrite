<script setup>
import { ref, onMounted } from 'vue'
import { Info, RefreshCcw, Check, X, Database, MonitorDown, UserPlus, Wifi, AlertTriangle } from 'lucide-vue-next'
import { useToast } from '../composables/useToast.js'

// Cek pembaruan MANUAL (tombol ini) — pemicu otomatis saat app start ada di
// UpdaterService.init() (main process), cuma CEK & KASIH TAHU (lewat notif
// mengambang AppUpdater.vue di pojok kanan-bawah), TIDAK auto-download/
// install. Sumber rilis: GitHub Releases repo ini sendiri (lihat `publish`
// di package.json + .github/workflows/rilis.yml).
const { showToast } = useToast()

const appVersion = ref('')
const checking = ref(false)
const result = ref(null) // { ok, available?, version?, current?, reason?, error? }

onMounted(async () => {
    appVersion.value = await window.api.app.getVersion()
})

async function cekUpdate() {
    checking.value = true
    result.value = null
    try {
        result.value = await window.api.updater.check()
        if (result.value?.available) {
            showToast(`Versi baru (v${result.value.version}) tersedia. Silakan lihat kotak notifikasi pembaruan di pojok kanan bawah.`)
        }
    } finally {
        checking.value = false
    }
}
</script>

<template>
    <div class="max-w-2xl">
        <!-- Versi & cek update manual -->
        <div class="bg-base-100 rounded-2xl border border-base-200 p-4">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h3 class="font-semibold text-sm flex items-center gap-2 mb-1">
                        <Info class="size-4 text-primary" /> Khanza Desktop
                    </h3>
                    <p class="text-xs text-base-content/50 mb-3">
                        Versi yang terpasang pada komputer ini saat ini.
                    </p>
                    <p class="text-2xl font-bold tabular-nums">v{{ appVersion || '...' }}</p>
                </div>
                <button class="btn btn-sm gap-2 shrink-0" :disabled="checking" @click="cekUpdate">
                    <span v-if="checking" class="loading loading-spinner loading-xs"></span>
                    <RefreshCcw v-else class="size-3.5" /> Cek Pembaruan
                </button>
            </div>

            <div v-if="result" class="mt-3 text-sm border-t border-base-200 pt-3">
                <div v-if="!result.ok" class="text-warning">
                    <span class="flex items-center gap-1">
                        <X class="size-3.5" />
                        {{ result.reason === 'dev' ? 'Pemeriksaan pembaruan hanya tersedia pada aplikasi yang telah terpasang.' : 'Pemeriksaan pembaruan gagal dilakukan.' }}
                    </span>
                    <!-- Pesan asli dari electron-updater — WAJIB ditampilkan, jangan cuma
                         "gagal" generik, biar penyebabnya (draft release/repo private/
                         tidak ada internet) langsung ketahuan tanpa nebak. -->
                    <p v-if="result.error" class="text-xs font-mono text-base-content/50 mt-1 break-all">{{ result.error }}</p>
                </div>
                <span v-else-if="result.available" class="text-success flex items-center gap-1">
                    <Check class="size-3.5" /> Versi baru v{{ result.version }} tersedia. Silakan lihat kotak notifikasi pembaruan di pojok kanan bawah.
                </span>
                <span v-else class="text-base-content/60 flex items-center gap-1">
                    <Check class="size-3.5" /> Aplikasi sudah menggunakan versi terbaru.
                </span>
            </div>

            <div class="alert alert-info text-xs py-2 mt-3 items-start">
                <Wifi class="size-3.5 shrink-0 mt-0.5" />
                <span>
                    Pemeriksaan pembaruan ini memerlukan akses <b>internet ke GitHub</b>, berbeda
                    dengan koneksi MySQL/MinIO yang hanya memerlukan jaringan lokal rumah sakit.
                    Apabila komputer tidak memiliki akses internet keluar, pemeriksaan dan pengunduhan
                    pembaruan dapat dilakukan dari komputer lain yang memiliki akses, kemudian
                    installer-nya didistribusikan secara manual.
                </span>
            </div>
        </div>

        <!-- Urutan mekanisme pembaruan — timeline 3 langkah -->
        <div class="bg-base-100 rounded-2xl border border-base-200 p-4 mt-4">
            <h3 class="font-semibold text-sm mb-1">Urutan Mekanisme Pembaruan</h3>
            <p class="text-xs text-base-content/50 mb-4">
                Ikuti urutan berikut setiap kali terdapat versi baru. Urutan ini tidak boleh dibalik,
                agar aplikasi yang telah diperbarui tidak mengharapkan kolom/tabel database yang belum
                tersedia.
            </p>

            <ol class="relative border-l-2 border-base-200 ml-3">
                <li class="mb-6 ml-6 relative">
                    <span class="absolute -left-[1.9rem] flex items-center justify-center size-6 rounded-full bg-primary text-primary-content ring-4 ring-base-100 text-xs font-bold">1</span>
                    <p class="text-sm font-semibold flex items-center gap-1.5"><Database class="size-3.5" /> Admin Utama memperbarui database terlebih dahulu</p>
                    <p class="text-xs text-base-content/60 mt-1 leading-relaxed">
                        Apabila versi baru mengubah skema database (tabel/kolom baru), jalankan menu
                        <b>Pengaturan &gt; Database &gt; Migrasi</b> — periksa terlebih dahulu badge "N
                        migrasi tertunda" pada menu tersebut. Apabila vendor Khanza merilis
                        <code>sik.sql</code> versi baru, lakukan juga perbandingan melalui fitur
                        <b>Pembanding Skema</b> pada tab yang sama. Ikuti konfirmasi backup yang
                        muncul sebelum menjalankan proses apa pun, karena aplikasi ini tidak membuat
                        backup secara otomatis.
                    </p>
                    <p class="text-xs text-base-content/50 mt-1.5 leading-relaxed">
                        Proses ini cukup dilakukan <b>satu kali</b>, dari <b>satu</b> komputer mana pun
                        — database <code>sik</code> digunakan bersama oleh seluruh komputer, sehingga
                        begitu migrasi dijalankan, seluruh komputer akan otomatis mengikuti skema baru
                        tersebut tanpa perlu diulang pada tiap komputer.
                    </p>
                </li>

                <li class="mb-6 ml-6 relative">
                    <span class="absolute -left-[1.9rem] flex items-center justify-center size-6 rounded-full bg-primary text-primary-content ring-4 ring-base-100 text-xs font-bold">2</span>
                    <p class="text-sm font-semibold flex items-center gap-1.5"><MonitorDown class="size-3.5" /> Selanjutnya, perbarui aplikasi pada tiap komputer</p>
                    <p class="text-xs text-base-content/60 mt-1 leading-relaxed">
                        Aplikasi akan secara otomatis memeriksa pembaruan kurang lebih 3 detik setelah
                        dibuka (hanya memeriksa dan memberi notifikasi, tidak mengunduh secara
                        otomatis). Apabila terdapat versi baru, akan muncul kotak notifikasi pada
                        pojok kanan bawah — klik <b>"Unduh & Pasang"</b>, tunggu proses pengunduhan
                        selesai, kemudian klik <b>"Pasang & Restart"</b>. Pemeriksaan juga dapat
                        dipicu secara manual melalui tombol "Cek Pembaruan" di atas.
                    </p>
                    <p class="text-xs text-base-content/50 mt-1.5 leading-relaxed">
                        Proses ini dapat dilakukan oleh <b>pengguna itu sendiri</b> dan tidak harus
                        melalui tim IT, karena hanya mengubah versi aplikasi pada komputer tersebut
                        tanpa memengaruhi database bersama. Apabila notifikasi ditunda (memilih
                        "Nanti"), pembaruan yang telah terunduh akan tetap terpasang secara otomatis
                        saat aplikasi ditutup berikutnya.
                    </p>
                </li>

                <li class="ml-6 relative">
                    <span class="absolute -left-[1.9rem] flex items-center justify-center size-6 rounded-full bg-warning text-warning-content ring-4 ring-base-100 text-xs font-bold">
                        <AlertTriangle class="size-3.5" />
                    </span>
                    <p class="text-sm font-semibold flex items-center gap-1.5"><UserPlus class="size-3.5" /> Pengecualian untuk instalasi baru pertama kali</p>
                    <p class="text-xs text-base-content/60 mt-1 leading-relaxed">
                        Komputer yang belum pernah memasang aplikasi ini sama sekali <b>wajib
                        ditangani oleh tim IT</b>, bukan oleh pengguna biasa. Layar pertama yang
                        muncul ("Pengaturan Awal") akan meminta kredensial MySQL, yang tidak
                        sepatutnya diinput oleh pengguna biasa.
                    </p>
                    <p class="text-xs text-base-content/50 mt-1.5 leading-relaxed">
                        Terdapat dua cara pengisian: secara <b>manual</b> (memasukkan host/user/
                        password MySQL dan MinIO satu per satu), atau dengan meng-<b>impor</b> berkas
                        konfigurasi yang sebelumnya telah diekspor dari komputer lain pada rumah sakit
                        yang sama (lihat <b>Pengaturan &gt; Environment &gt; Export/Import</b>). Cara
                        kedua lebih cepat dan tidak memerlukan pengetikan ulang apabila jumlah
                        komputer yang dipasang cukup banyak.
                    </p>
                </li>
            </ol>
        </div>
    </div>
</template>
