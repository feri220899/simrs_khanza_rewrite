<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Plus, Users, ShieldCheck, Search, Trash2, Pencil, Copy, UserPlus } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useToast } from '../../composables/useToast.js'
import AppSelect from '../../components/AppSelect.vue'

// "Kelola Role" — satu-satunya cara atur akses akun `user` biasa (lihat
// README.md > "Login & Permission (pivot MySQL)"). Akun `admin` (Admin
// Utama) TIDAK muncul di sini, aksesnya hardcode di AuthService.js, bukan
// lewat role. Semua IPC di sini di-gate isFullAdmin (bukan slug permission
// biasa) — mencerminkan "kelola user cuma bisa Admin Utama" di Java asli.
//
// Dipakai sebagai child tab "Pengaturan User" di bawah top-level "User" milik
// Pengaturan.vue (bukan halaman/route sendiri lagi) — panel Migrasi ada di
// top-level "Database" (sibling tab), lihat Pengaturan.vue.
const authStore = useAuthStore()
const { showToast } = useToast()

const activeTab = ref('role')

// Instalasi baru yang migration electron_* belum pernah jalan -> tabel
// electron_roles/permissions/dst BELUM ADA, fetch di bawah bakal gagal.
// Guard ini nampilin pesan arahkan ke tab "Database > Migrasi" (sibling,
// bukan di komponen ini lagi).
const dataSiap = ref(false) // true kalau fetch Role/User berhasil (tabel electron_* ada)

// ── Role ─────────────────────────────────────────────────────────────────
const roles = ref([])
const loadingRoles = ref(true)
const permissions = ref([]) // semua 1213 slug, di-fetch sekali
const namaBaru = ref('')
const creating = ref(false)

async function fetchRoles() {
    loadingRoles.value = true
    roles.value = await window.api.role.list(authStore.token)
    loadingRoles.value = false
}

async function fetchPermissionsOnce() {
    if (permissions.value.length) return
    permissions.value = await window.api.role.listAllPermissions(authStore.token)
}

async function createRole() {
    if (!namaBaru.value.trim()) return
    creating.value = true
    try {
        const res = await window.api.role.create(authStore.token, namaBaru.value)
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Role berhasil dibuat — atur permission-nya lewat tombol Edit.')
        namaBaru.value = ''
        await fetchRoles()
    } finally {
        creating.value = false
    }
}

async function hapusRole(role) {
    if (!confirm(`Hapus role "${role.nama}"?`)) return
    const res = await window.api.role.delete(authStore.token, role.id)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast('Role berhasil dihapus.')
    await fetchRoles()
}

async function copyRole(role) {
    const namaBaru2 = prompt(`Nama role baru (salinan dari "${role.nama}"):`, `${role.nama} (Copy)`)
    if (!namaBaru2?.trim()) return
    const res = await window.api.role.duplicate(authStore.token, role.id, namaBaru2)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast(`Role "${namaBaru2}" berhasil dibuat dengan permission sama seperti "${role.nama}".`)
    await fetchRoles()
}

// ── Modal edit permission per-role ──────────────────────────────────────
const modalRole = ref(null)
const editingRole = reactive({ id: null, nama: '' })
const editRolePermIds = ref(new Set())
const permSearch = ref('')
const savingPerm = ref(false)

const filteredPermissions = computed(() => {
    const q = permSearch.value.trim().toLowerCase()
    if (!q) return permissions.value
    return permissions.value.filter(p => p.slug.includes(q) || p.label.toLowerCase().includes(q))
})

async function openEditRole(role) {
    await fetchPermissionsOnce()
    editingRole.id = role.id
    editingRole.nama = role.nama
    permSearch.value = ''
    const ids = await window.api.role.getPermissions(authStore.token, role.id)
    editRolePermIds.value = new Set(ids)
    modalRole.value?.showModal()
}

function togglePerm(id) {
    const s = editRolePermIds.value
    if (s.has(id)) s.delete(id); else s.add(id)
    editRolePermIds.value = new Set(s)
}

function pilihSemuaTerfilter() {
    const s = new Set(editRolePermIds.value)
    filteredPermissions.value.forEach(p => s.add(p.id))
    editRolePermIds.value = s
}

function kosongkanTerfilter() {
    const s = new Set(editRolePermIds.value)
    filteredPermissions.value.forEach(p => s.delete(p.id))
    editRolePermIds.value = s
}

async function simpanRolePermission() {
    savingPerm.value = true
    try {
        if (editingRole.nama.trim()) {
            const renameRes = await window.api.role.update(authStore.token, editingRole.id, editingRole.nama)
            if (!renameRes.success) { showToast(renameRes.message, 'error'); return }
        }
        const res = await window.api.role.setPermissions(authStore.token, editingRole.id, [...editRolePermIds.value])
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Permission role berhasil disimpan.')
        modalRole.value?.close()
        await fetchRoles()
    } finally {
        savingPerm.value = false
    }
}

// ── User ─────────────────────────────────────────────────────────────────
const users = ref([])
const loadingUsers = ref(true)
const userSearch = ref('')
const pendingRoleByUser = reactive({})

async function fetchUsers() {
    loadingUsers.value = true
    users.value = await window.api.role.listUsers(authStore.token)
    loadingUsers.value = false
}

const filteredUsers = computed(() => {
    const q = userSearch.value.trim().toLowerCase()
    if (!q) return users.value
    return users.value.filter(u => u.id_user.toLowerCase().includes(q))
})

const roleOptions = computed(() => roles.value.map(r => ({ id: r.id, nama: r.nama })))

async function simpanRoleUser(user) {
    const roleId = pendingRoleByUser[user.id_user]
    if (!roleId) return
    const res = await window.api.role.assignUser(authStore.token, user.id_user, roleId)
    if (!res.success) { showToast(res.message, 'error'); return }
    showToast(`Role untuk "${user.id_user}" berhasil disimpan.`)
    await fetchUsers()
}

async function hapusRoleUser(user) {
    if (!confirm(`Cabut role dari akun "${user.id_user}"?`)) return
    await window.api.role.removeUser(authStore.token, user.id_user)
    showToast('Role dicabut.')
    await fetchUsers()
}

// ── Tambah User Baru (akun BENERAN baru di tabel `user` asli) ────────────
// Replika src/setting/DlgUser.java: id_user & password diisi dari
// kd_dokter/nip hasil pilih Dokter/Petugas (password default SAMA PERSIS
// dengan kode itu, editable) — dropdown Select2-style (AppSelect, client-side
// search, sama pola dgn Perpustakaan), bukan search-as-you-type server. Field
// username/password tetap editable manual kalau tidak terkait dokter/petugas.
const modalUserBaru = ref(null)
const userBaruForm = reactive({ id_user: '', password: '', konfirmasi: '', roleId: null })
const creatingUser = ref(false)
const orangList = ref([]) // gabungan dokter+petugas, di-fetch sekali
const orangTerpilih = ref(null) // kode terpilih di AppSelect
const jabatanTerpilih = ref('') // tampilan doang, TIDAK disimpan (sama seperti Java)

const orangOptions = computed(() => orangList.value.map(o => ({
    kode: o.kode,
    label: `${o.nama} (${o.tipe}${o.jabatan && o.jabatan !== '-' ? ' — ' + o.jabatan : ''})`,
})))

async function fetchOrangOnce() {
    if (orangList.value.length) return
    orangList.value = await window.api.role.listOrang(authStore.token)
}

function bukaModalUserBaru() {
    userBaruForm.id_user = ''
    userBaruForm.password = ''
    userBaruForm.konfirmasi = ''
    userBaruForm.roleId = null
    orangTerpilih.value = null
    jabatanTerpilih.value = ''
    fetchOrangOnce()
    modalUserBaru.value?.showModal()
}

function pilihOrang(kode) {
    orangTerpilih.value = kode
    const item = orangList.value.find(o => o.kode === kode)
    if (!item) return
    userBaruForm.id_user = item.kode
    userBaruForm.password = item.kode // default = kode, PERSIS Java — editable
    jabatanTerpilih.value = item.jabatan
}

async function simpanUserBaru() {
    if (userBaruForm.password !== userBaruForm.konfirmasi) {
        showToast('Konfirmasi password tidak cocok', 'error')
        return
    }
    creatingUser.value = true
    try {
        const res = await window.api.role.createUser(authStore.token, {
            id_user: userBaruForm.id_user,
            password: userBaruForm.password,
            roleId: userBaruForm.roleId,
        })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast(res.warning || 'Akun user baru berhasil dibuat.')
        modalUserBaru.value?.close()
        await fetchUsers()
    } finally {
        creatingUser.value = false
    }
}

async function fetchSemua() {
    try {
        await Promise.all([fetchRoles(), fetchUsers(), fetchPermissionsOnce()])
        dataSiap.value = true
    } catch (err) {
        // Kemungkinan besar migration electron_* belum pernah jalan (tabel
        // belum ada) — arahkan ke tab "Database > Migrasi" (sibling top-level
        // tab di Pengaturan.vue), jangan tampilkan error mentah dari database.
        dataSiap.value = false
        console.error('Gagal muat data role/user (migration belum jalan?):', err.message)
    }
}

defineExpose({ fetchSemua })
onMounted(fetchSemua)
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <p class="text-sm text-base-content/60 mb-4">
            Akun <code>admin</code> (Admin Utama) tidak muncul di sini — aksesnya penuh otomatis.
            Akun <code>user</code> biasa harus di-assign role dulu di sini sebelum bisa dipakai login.
        </p>

        <div v-if="!dataSiap" class="alert alert-warning text-sm py-2 mb-4 max-w-2xl">
            Belum bisa dibuka — migration electron_* kemungkinan belum pernah dijalankan di
            database ini. Buka tab <strong>Database &gt; Migrasi</strong> dulu untuk menjalankannya.
        </div>

        <div v-else class="flex bg-base-200 rounded-xl p-1 w-fit mb-4 shrink-0 gap-0.5">
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'role' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'role'">
                <ShieldCheck class="size-4" /> Role
            </button>
            <button
                :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer',
                    activeTab === 'user' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']"
                @click="activeTab = 'user'">
                <Users class="size-4" /> User
            </button>
        </div>

        <template v-if="dataSiap">
        <!-- Tab Role -->
        <div v-show="activeTab === 'role'" class="flex-1 min-h-0 overflow-y-auto">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm p-4 mb-4 max-w-xl">
                <h3 class="font-semibold text-sm mb-2">Tambah Role Baru</h3>
                <div class="flex gap-2">
                    <input v-model="namaBaru" type="text" placeholder="Contoh: Kasir, Apoteker"
                        class="input input-bordered input-sm flex-1" @keyup.enter="createRole" />
                    <button class="btn btn-primary btn-sm gap-1" :disabled="creating" @click="createRole">
                        <Plus class="size-4" /> Tambah
                    </button>
                </div>
            </div>

            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden">
                <table class="table">
                    <thead>
                        <tr class="bg-base-200">
                            <th>Nama Role</th>
                            <th class="text-center w-40">Jumlah Permission</th>
                            <th class="text-center w-44">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loadingRoles"><td colspan="3" class="text-center py-8">Memuat...</td></tr>
                        <tr v-else-if="roles.length === 0"><td colspan="3" class="text-center py-8 text-base-content/50">Belum ada role</td></tr>
                        <tr v-for="role in roles" :key="role.id" class="border-b border-base-200">
                            <td class="font-medium">{{ role.nama }}</td>
                            <td class="text-center">{{ role.jml_permission }} / {{ permissions.length || 1213 }}</td>
                            <td class="text-center">
                                <div class="flex gap-1 justify-center">
                                    <button class="btn btn-ghost btn-xs gap-1" @click="openEditRole(role)"><Pencil class="size-3.5" /> Edit</button>
                                    <button class="btn btn-ghost btn-xs gap-1" @click="copyRole(role)"><Copy class="size-3.5" /> Copy</button>
                                    <button class="btn btn-ghost btn-xs text-error gap-1" @click="hapusRole(role)"><Trash2 class="size-3.5" /> Hapus</button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Tab User -->
        <div v-show="activeTab === 'user'" class="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div class="flex items-center justify-between mb-3 shrink-0 gap-3">
                <div class="relative max-w-sm flex-1">
                    <Search class="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                    <input v-model="userSearch" type="text" placeholder="Cari username..."
                        class="input input-bordered input-sm w-full pl-9" />
                </div>
                <button class="btn btn-primary btn-sm gap-1" @click="bukaModalUserBaru">
                    <UserPlus class="size-4" /> Tambah User Baru
                </button>
            </div>

            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm flex-1 overflow-y-auto">
                <table class="table">
                    <thead class="sticky top-0 bg-base-200 z-10">
                        <tr>
                            <th>Username (id_user)</th>
                            <th>Role Saat Ini</th>
                            <th class="w-72">Ubah Role</th>
                            <th class="text-center w-24">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loadingUsers"><td colspan="4" class="text-center py-8">Memuat...</td></tr>
                        <tr v-else-if="filteredUsers.length === 0"><td colspan="4" class="text-center py-8 text-base-content/50">Tidak ada akun</td></tr>
                        <tr v-for="u in filteredUsers" :key="u.id_user" class="border-b border-base-200">
                            <td class="font-mono text-sm">{{ u.id_user }}</td>
                            <td>
                                <span v-if="u.role_nama" class="badge badge-primary badge-sm">{{ u.role_nama }}</span>
                                <span v-else class="badge badge-ghost badge-sm">Belum diberi role</span>
                            </td>
                            <td>
                                <AppSelect
                                    v-model="pendingRoleByUser[u.id_user]"
                                    :options="roleOptions" value-prop="id" label="nama"
                                    placeholder="Pilih role..." />
                            </td>
                            <td class="text-center">
                                <div class="flex gap-1 justify-center">
                                    <button class="btn btn-primary btn-xs" :disabled="!pendingRoleByUser[u.id_user]" @click="simpanRoleUser(u)">Simpan</button>
                                    <button v-if="u.role_nama" class="btn btn-ghost btn-xs text-error" @click="hapusRoleUser(u)">Cabut</button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        </template>
    </div>

    <!-- Modal edit role: rename + checklist permission -->
    <dialog ref="modalRole" class="modal">
        <div class="modal-box max-w-2xl">
            <h3 class="font-bold text-base mb-3">Edit Role</h3>

            <label class="block text-sm font-medium text-base-content/80 mb-1.5">Nama Role</label>
            <input v-model="editingRole.nama" type="text" class="input input-bordered input-sm w-full mb-3" />

            <div class="flex items-center justify-between mb-2">
                <label class="text-sm font-medium text-base-content/80">
                    Permission ({{ editRolePermIds.size }} / {{ permissions.length }} dipilih)
                </label>
                <div class="flex gap-2">
                    <button class="btn btn-ghost btn-xs" @click="pilihSemuaTerfilter">Pilih Semua (terfilter)</button>
                    <button class="btn btn-ghost btn-xs" @click="kosongkanTerfilter">Kosongkan (terfilter)</button>
                </div>
            </div>

            <input v-model="permSearch" type="text" placeholder="Cari permission (slug/label)..."
                class="input input-bordered input-sm w-full mb-2" />

            <div class="border border-base-300 rounded-lg h-80 overflow-y-auto p-2 grid grid-cols-2 gap-1">
                <label v-for="p in filteredPermissions" :key="p.id"
                    class="flex items-center gap-2 text-xs py-1 px-1.5 rounded hover:bg-base-200 cursor-pointer">
                    <input type="checkbox" class="checkbox checkbox-sm"
                        :checked="editRolePermIds.has(p.id)" @change="togglePerm(p.id)" />
                    <span class="truncate" :title="p.slug">{{ p.label }}</span>
                </label>
            </div>

            <div class="modal-action mt-4">
                <button class="btn btn-ghost btn-sm" @click="modalRole?.close()">Batal</button>
                <button class="btn btn-primary btn-sm gap-2" :disabled="savingPerm" @click="simpanRolePermission">
                    <span v-if="savingPerm" class="loading loading-spinner loading-xs"></span>
                    Simpan
                </button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>

    <!-- Modal Tambah User Baru — akun BENERAN baru di tabel `user` asli.
         Replika src/setting/DlgUser.java: pilih dari Dokter/Petugas via
         dropdown Select2-style (id_user & password default = kd_dokter/nip,
         editable), atau abaikan dropdown-nya buat isi manual. -->
    <dialog ref="modalUserBaru" class="modal">
        <div class="modal-box max-w-md">
            <h3 class="font-bold text-base mb-1">Tambah User Baru</h3>
            <p class="text-xs text-base-content/50 mb-3">
                Bikin akun baru di tabel <code>user</code> Khanza (bukan cuma assign role).
                1211 flag akses Java lama diisi "false" semua — kalau staff ini perlu akses
                di app Java, atur manual lewat sana.
            </p>

            <div class="mb-3">
                <label class="block text-sm font-medium text-base-content/80 mb-1.5">
                    Pilih dari Dokter/Petugas <span class="text-base-content/40 font-normal">(opsional — kosongkan kalau mau isi manual)</span>
                </label>
                <AppSelect :model-value="orangTerpilih" @update:model-value="pilihOrang"
                    :options="orangOptions" value-prop="kode" label="label"
                    placeholder="Cari nama dokter/petugas..." />
                <p v-if="jabatanTerpilih" class="text-xs text-base-content/50 mt-1">
                    Jabatan/Spesialis: {{ jabatanTerpilih }} (cuma info, tidak disimpan)
                </p>
            </div>

            <div class="space-y-3">
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Username</label>
                    <input v-model="userBaruForm.id_user" type="text" class="input input-bordered input-sm w-full" autocomplete="off" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">
                        Password
                        <span v-if="orangTerpilih" class="text-base-content/40 font-normal">(default sama dengan kode, ubah kalau perlu)</span>
                    </label>
                    <input v-model="userBaruForm.password" type="text" class="input input-bordered input-sm w-full" autocomplete="new-password" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Konfirmasi Password</label>
                    <input v-model="userBaruForm.konfirmasi" type="text" class="input input-bordered input-sm w-full" autocomplete="new-password" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-base-content/80 mb-1.5">Role (opsional, bisa di-assign nanti)</label>
                    <AppSelect v-model="userBaruForm.roleId" :options="roleOptions" value-prop="id" label="nama" placeholder="Pilih role..." />
                </div>
            </div>

            <div class="modal-action mt-4">
                <button class="btn btn-ghost btn-sm" @click="modalUserBaru?.close()">Batal</button>
                <button class="btn btn-primary btn-sm gap-2" :disabled="creatingUser" @click="simpanUserBaru">
                    <span v-if="creatingUser" class="loading loading-spinner loading-xs"></span>
                    Simpan
                </button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>
</template>
