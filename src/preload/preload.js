import { contextBridge, ipcRenderer } from 'electron'

// Pola sama seperti pos-desktop (contextBridge.exposeInMainWorld('api', {...})),
// BEDANYA: tidak ada 'server:start' / mode master-client / discovery LAN — di
// sini setiap komputer connect langsung ke Postgres pusat lewat IPC ke main
// process (lihat Khanza.md > "Arsitektur UI & Koneksi Data").
contextBridge.exposeInMainWorld('api', {
    lisensi: {
        aktivasi:    (key)   => ipcRenderer.invoke('lisensi:aktivasi', key),
        validasi:    (key)   => ipcRenderer.invoke('lisensi:validasi', key),
        deaktivasi:  (key)   => ipcRenderer.invoke('lisensi:deaktivasi', key),
        verifyToken: (token) => ipcRenderer.invoke('lisensi:verifyToken', token),
    },
    config: {
        get: (key)        => ipcRenderer.invoke('config:get', key),
        set: (key, value) => ipcRenderer.invoke('config:set', key, value),
    },
    device: {
        getId:   () => ipcRenderer.invoke('device:getId'),
        getInfo: () => ipcRenderer.invoke('device:getInfo'),
    },
    app: {
        getVersion: () => ipcRenderer.invoke('app:getVersion'),
    },
    auth: {
        login:          (username, password) => ipcRenderer.invoke('auth:login', username, password),
        me:             (token)              => ipcRenderer.invoke('auth:me', token),
        changePassword: (token, oldPw, newPw) => ipcRenderer.invoke('auth:changePassword', token, oldPw, newPw),
    },
    // Satu channel generik per modul Fase 1, bukan 1 file Controller per modul
    // kayak referensi (Express dibuang, lihat Khanza.md). Tiap modul daftar
    // handler-nya sendiri di src/main/modules/<modul>.js — lihat SOP sebelum
    // menambah aksi baru.
    parkir: {
        listJenis: ()        => ipcRenderer.invoke('parkir:listJenis'),
        cekBarcode: (kode)   => ipcRenderer.invoke('parkir:cekBarcode', kode),
    },
    // Migration DB — status boleh dibaca siapa saja yang login, tapi jalankan
    // migration divalidasi ulang role-nya di main process (lihat main/index.js),
    // bukan cuma disembunyikan tombolnya di renderer.
    db: {
        migrationStatus:    ()      => ipcRenderer.invoke('db:migrationStatus'),
        runMigrations:      (token) => ipcRenderer.invoke('db:runMigrations', token),
        // Cuma jalan kalau database benar-benar belum pernah di-migration
        // sama sekali — lihat guard-nya di main/index.js. Dipakai dari
        // Login.vue saat layar "Database Belum Disiapkan" muncul.
        runInitialMigration: () => ipcRenderer.invoke('db:runInitialMigration'),
    },
})
