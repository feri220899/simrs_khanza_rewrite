<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, Settings, LayoutGrid, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { allMenu, bottomMenu } from '../config/menu'

const route = useRoute()
const authStore = useAuthStore()
const openItems = ref(new Set())

// Pencarian menu — FITUR BARU. Filter live ke label item & submenu, grup
// yang ada anak cocok otomatis "expand" (tanpa perlu diklik) selama query
// masih diisi. Shortcut Ctrl+K / Cmd+K fokus ke input, sekaligus perluas
// sidebar dulu kalau lagi ciut (tidak ada ruang buat ngetik saat collapsed).
const searchQuery = ref(localStorage.getItem('sidebar_search_query') || '')
const searchInputRef = ref(null)
watch(searchQuery, value => localStorage.setItem('sidebar_search_query', value))

function clearSearch() {
    searchQuery.value = ''
    localStorage.removeItem('sidebar_search_query')
}

async function focusSearch() {
    if (collapsed.value) collapsed.value = false
    await nextTick()
    searchInputRef.value?.focus()
}

function onGlobalKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        focusSearch()
    }
}
onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown))

// Collapsible sidebar — FITUR BARU (tidak ada di referensi pos-desktop).
const collapsed = ref(localStorage.getItem('sidebar_collapsed') === '1')
watch(collapsed, (v) => localStorage.setItem('sidebar_collapsed', v ? '1' : '0'))
function toggleCollapsed() { collapsed.value = !collapsed.value }

// Tooltip/flyout saat collapsed di-TELEPORT ke <body> (bukan absolute di
// dalam <nav>). Alasan: <nav> punya overflow-y-auto — begitu overflow-y
// diset non-'visible', browser otomatis menghitung overflow-x jadi 'auto'
// juga (aturan CSS "mixed overflow"), jadi elemen absolute yang nongol ke
// kanan (left-full) selalu memicu scrollbar horizontal, walau overflow-x
// sudah ditulis 'visible' manual. Teleport ke body + posisi dihitung dari
// getBoundingClientRect() itu satu-satunya cara yang benar-benar lepas dari
// area scroll manapun.
const flyout = ref(null) // { top, left, label, children? }
let closeTimer = null

// Untuk tooltip label (bukan kartu submenu), posisi vertikal dihitung
// langsung ke tengah trigger DI SINI (bukan pakai CSS transform: translateY)
// — supaya `transform` bebas dipakai animasi masuk (geser halus) tanpa
// tabrakan dua nilai transform sekaligus.
const TOOLTIP_HALF_HEIGHT = 14

function openFlyout(e, label, children = null, center = false) {
    if (!collapsed.value) return
    clearTimeout(closeTimer)
    const r = e.currentTarget.getBoundingClientRect()
    flyout.value = {
        label,
        children,
        left: r.right + 10,
        top: center ? (r.top + r.height / 2 - TOOLTIP_HALF_HEIGHT) : r.top,
    }
}
function scheduleCloseFlyout() {
    closeTimer = setTimeout(() => { flyout.value = null }, 120)
}
function cancelCloseFlyout() {
    clearTimeout(closeTimer)
}

function navClass(path) {
    const base = 'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors'
    return route.path === path
        ? `${base} bg-primary text-white`
        : `${base} text-white/70 hover:bg-base-200 hover:text-white`
}

function childNavClass(path) {
    const base = 'flex items-center gap-2 px-2.5 py-1 rounded-lg text-sm font-medium transition-colors'
    return route.path === path
        ? `${base} bg-primary text-white`
        : `${base} text-white/60 hover:bg-base-200 hover:text-white hover:text-white/80`
}

function toggleOpen(label) {
    const s = new Set(openItems.value)
    s.has(label) ? s.delete(label) : s.add(label)
    openItems.value = s
}

function isParentActive(item) {
    return item.children?.some(c => route.path === c.to)
}

function syncOpenFromRoute() {
    allMenu.forEach(section => {
        section.items.forEach(item => {
            if (item.children?.some(c => route.path === c.to)) {
                const s = new Set(openItems.value)
                s.add(item.label)
                openItems.value = s
            }
        })
    })
}

watch(() => route.path, () => { syncOpenFromRoute(); flyout.value = null })

// Permission berjenjang, semantik OR — sama seperti referensi pos-desktop.
const bolehAkses = (permHalaman, permModul) =>
    authStore.can(permHalaman) || (!!permModul && authStore.can(permModul))

const bolehPengaturan = computed(() => bottomMenu.some(m => authStore.can(m.permission)))

const visibleMenu = computed(() =>
    allMenu
        .map(section => ({
            ...section,
            items: section.items
                .map(item => item.children
                    ? { ...item, children: item.children.filter(c => bolehAkses(c.permission, item.permission)) }
                    : item)
                .filter(item => item.children
                    ? item.children.length > 0
                    : authStore.can(item.permission)),
        }))
        .filter(section => section.items.length > 0)
)

// Hasil pencarian — dihitung DARI visibleMenu (jadi tetap menghormati
// permission, tidak nampilin menu yang harusnya tersembunyi).
const filteredMenu = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return visibleMenu.value

    return visibleMenu.value
        .map(section => ({
            ...section,
            items: section.items
                .map(item => {
                    if (!item.children) {
                        return item.label.toLowerCase().includes(q) ? item : null
                    }
                    const labelMatch = item.label.toLowerCase().includes(q)
                    const children = labelMatch
                        ? item.children
                        : item.children.filter(c => c.label.toLowerCase().includes(q))
                    return children.length ? { ...item, children } : null
                })
                .filter(Boolean),
        }))
        .filter(section => section.items.length > 0)
})

const isSearching = computed(() => searchQuery.value.trim().length > 0)

onMounted(syncOpenFromRoute)
</script>

<template>
    <aside data-theme="night"
        class="flex flex-col h-screen shrink-0 bg-base-100 border-r border-base-300 transition-[width] duration-200"
        :class="collapsed ? 'w-16' : 'w-80'">

        <!-- Header: logo (cuma saat expanded) + tombol ciutkan/perluas -->
        <div class="flex items-center h-16 shrink-0 border-b border-base-300 px-3"
            :class="collapsed ? 'justify-center' : 'justify-between gap-2'">
            <div v-if="!collapsed" class="flex items-center gap-3 min-w-0">
                <div class="btn btn-primary btn-square btn-sm no-animation pointer-events-none shrink-0">
                    <LayoutGrid class="size-4" />
                </div>
                <div class="font-bold text-base-content leading-tight truncate">Khanza JavaScript</div>
            </div>
            <button class="btn btn-ghost btn-square btn-sm shrink-0"
                :title="collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'"
                @click="toggleCollapsed">
                <component :is="collapsed ? PanelLeftOpen : PanelLeftClose" class="size-4" />
            </button>
        </div>

        <!-- Pencarian menu -->
        <div v-if="!collapsed" class="px-3 py-2 border-b border-base-300">
            <label class="input input-sm input-bordered flex items-center gap-2 w-full">
                <Search class="size-3.5 text-base-content/40 shrink-0" />
                <input ref="searchInputRef" v-model="searchQuery" type="text" class="grow"
                    placeholder="Cari menu... (Ctrl+K)" />
                <button v-if="searchQuery" type="button" class="text-base-content/40 hover:text-base-content cursor-pointer"
                    @click="clearSearch">
                    <X class="size-3.5" />
                </button>
            </label>
        </div>
        <div v-else class="px-2 py-2 border-b border-base-300 flex justify-center">
            <button class="btn btn-ghost btn-square btn-sm" title="Cari menu (Ctrl+K)" @click="focusSearch">
                <Search class="size-4" />
            </button>
        </div>

        <nav class="flex-1 overflow-y-auto py-3 px-2 space-y-4" :class="collapsed ? 'sidebar-scroll-thin' : ''">
            <p v-if="isSearching && filteredMenu.length === 0" class="px-3 py-4 text-xs text-base-content/40 text-center">
                Tidak ada menu yang cocok dengan "{{ searchQuery }}"
            </p>

            <div v-for="section in filteredMenu" :key="section.title">
                <p v-if="!collapsed" class="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-base-content/50 truncate">
                    {{ section.title }}
                </p>
                <div v-else class="mx-2 mb-1 border-t border-base-300"></div>

                <ul class="space-y-0.5">
                    <li v-for="item in section.items" :key="item.label" class="relative"
                        @mouseenter="item.children?.length
                            ? openFlyout($event, item.label, item.children, false)
                            : openFlyout($event, item.label, null, true)"
                        @mouseleave="scheduleCloseFlyout">
                        <template v-if="item.children?.length">
                            <button
                                class="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                                :class="[isParentActive(item)
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-white/70 hover:bg-base-200 hover:text-white',
                                    collapsed ? 'justify-center' : '']"
                                @click="toggleOpen(item.label)">
                                <component :is="item.icon" class="size-4 shrink-0" />
                                <template v-if="!collapsed">
                                    <span class="flex-1 text-left truncate">{{ item.label }}</span>
                                    <ChevronDown class="size-3.5 shrink-0 transition-transform duration-200"
                                        :class="openItems.has(item.label) ? 'rotate-180' : ''" />
                                </template>
                            </button>

                            <!-- Expanded: submenu inline (auto-expand kalau lagi search) -->
                            <ul v-if="!collapsed && (openItems.has(item.label) || isSearching)"
                                class="mt-0.5 ml-2 pl-3 border-l border-base-300 space-y-0.5">
                                <li v-for="child in item.children" :key="child.to">
                                    <RouterLink :to="child.to" :class="childNavClass(child.to)">
                                        <component v-if="child.icon" :is="child.icon" class="size-3.5 shrink-0" />
                                        <span class="truncate">{{ child.label }}</span>
                                    </RouterLink>
                                </li>
                            </ul>
                        </template>

                        <RouterLink v-else :to="item.to" :class="[navClass(item.to), collapsed ? 'justify-center' : '']">
                            <component :is="item.icon" class="size-4 shrink-0" />
                            <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
                        </RouterLink>
                    </li>
                </ul>
            </div>
        </nav>

        <div class="px-2 py-2 border-t border-base-300">
            <div v-if="bolehPengaturan" class="relative"
                @mouseenter="openFlyout($event, 'Pengaturan', null, true)"
                @mouseleave="scheduleCloseFlyout">
                <RouterLink to="/pengaturan/aplikasi" :class="[navClass('/pengaturan/aplikasi'), collapsed ? 'justify-center' : '']">
                    <Settings class="size-4 shrink-0" />
                    <span v-if="!collapsed" class="truncate">Pengaturan</span>
                </RouterLink>
            </div>
        </div>
    </aside>

    <!-- Tooltip/flyout collapsed — di-teleport ke body, lepas dari overflow sidebar -->
    <Teleport to="body">
        <Transition name="sidebar-flyout">
            <div v-if="flyout" data-theme="night"
                class="fixed z-50 flex items-center"
                :style="{ top: flyout.top + 'px', left: flyout.left + 'px' }"
                @mouseenter="cancelCloseFlyout" @mouseleave="scheduleCloseFlyout">

                <!-- Grup dengan submenu: kartu menu (bisa diklik) -->
                <div v-if="flyout.children"
                    class="min-w-56 bg-base-100 rounded-xl shadow-xl ring-1 ring-base-content/10 py-2 overflow-hidden">
                    <p class="px-3.5 pb-2 mb-1 border-b border-base-300 text-xs font-semibold text-base-content/60 uppercase tracking-wide truncate">
                        {{ flyout.label }}
                    </p>
                    <ul class="space-y-0.5 px-2">
                        <li v-for="child in flyout.children" :key="child.to">
                            <RouterLink :to="child.to" :class="childNavClass(child.to)" @click="flyout = null">
                                <component v-if="child.icon" :is="child.icon" class="size-3.5 shrink-0" />
                                <span class="truncate">{{ child.label }}</span>
                            </RouterLink>
                        </li>
                    </ul>
                </div>

                <!-- Item biasa / Pengaturan: tooltip label gaya AdminLTE (dark + panah) -->
                <template v-else>
                    <span class="w-0 h-0 border-y-[5px] border-y-transparent border-r-[5px] border-r-neutral shrink-0"></span>
                    <span class="px-3 py-1.5 bg-neutral text-neutral-content text-xs font-semibold tracking-wide rounded-md whitespace-nowrap shadow-xl ring-1 ring-white/10">
                        {{ flyout.label }}
                    </span>
                </template>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
/* Saat sidebar ciut (64px), scrollbar dihilangkan total — scroll (roda
   mouse/trackpad) tetap jalan normal, cuma track/thumb-nya tidak dirender
   sama sekali. Dua-duanya perlu di-override: `::-webkit-scrollbar` (cara
   lama) DAN `scrollbar-width` (properti standar CSS Scrollbars Styling yang
   sekarang juga didukung Chromium/Electron versi baru) — style.css global
   set `scrollbar-width: thin` di `*`, kalau cuma width:0 di webkit-scrollbar
   yang di-override, punya kita masih kalah sama scrollbar-width itu. */
.sidebar-scroll-thin { scrollbar-width: none; }
.sidebar-scroll-thin::-webkit-scrollbar { width: 0; height: 0; }

/* Animasi masuk/keluar tooltip & flyout — geser tipis + fade, bukan muncul
   tiba-tiba. `transform` di sini bebas dipakai karena posisi vertikal
   tooltip sudah dihitung di JS (bukan pakai CSS transform lagi). */
.sidebar-flyout-enter-active,
.sidebar-flyout-leave-active {
    transition: opacity 140ms ease, transform 140ms ease;
}
.sidebar-flyout-enter-from,
.sidebar-flyout-leave-to {
    opacity: 0;
    transform: translateX(-6px);
}
</style>
