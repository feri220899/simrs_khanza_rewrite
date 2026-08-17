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
        isConfigured:      () => ipcRenderer.invoke('config:isConfigured'),
        getDbConfig:       () => ipcRenderer.invoke('config:getDbConfig'),
        saveDbConfig:      (cfg) => ipcRenderer.invoke('config:saveDbConfig', cfg),
        testDbConnection:  (cfg) => ipcRenderer.invoke('config:testDbConnection', cfg),
        getMinioConfig:    () => ipcRenderer.invoke('config:getMinioConfig'),
        saveMinioConfig:   (cfg) => ipcRenderer.invoke('config:saveMinioConfig', cfg),
        testMinioConnection: (cfg) => ipcRenderer.invoke('config:testMinioConnection', cfg),
        getCacheConfig:    () => ipcRenderer.invoke('config:getCacheConfig'),
        saveCacheConfig:   (cfg) => ipcRenderer.invoke('config:saveCacheConfig', cfg),
        testCacheConnection: (cfg) => ipcRenderer.invoke('config:testCacheConnection', cfg),
        exportConfig: (passphrase) => ipcRenderer.invoke('config:exportConfig', passphrase),
        importConfig: (passphrase) => ipcRenderer.invoke('config:importConfig', passphrase),
    },
    device: {
        getId:   () => ipcRenderer.invoke('device:getId'),
        getInfo: () => ipcRenderer.invoke('device:getInfo'),
    },
    app: {
        getVersion: () => ipcRenderer.invoke('app:getVersion'),
    },
    updater: {
        check:    ()   => ipcRenderer.invoke('updater:check'),
        download: ()   => ipcRenderer.invoke('updater:download'),
        install:  ()   => ipcRenderer.invoke('updater:install'),
        onEvent:  (cb) => ipcRenderer.on('updater:event', (_, payload) => cb(payload)),
        offEvent: ()   => ipcRenderer.removeAllListeners('updater:event'),
    },
    log: {
        getToday:    ()             => ipcRenderer.invoke('log:getToday'),
        clearToday:  ()             => ipcRenderer.invoke('log:clearToday'),
        reportError: (message, meta) => ipcRenderer.invoke('log:reportError', message, meta),
    },
    auth: {
        login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
        me:    (token)               => ipcRenderer.invoke('auth:me', token),
    },
    role: {
        list:            (token)                 => ipcRenderer.invoke('role:list', token),
        create:          (token, nama)           => ipcRenderer.invoke('role:create', token, nama),
        update:          (token, id, nama)       => ipcRenderer.invoke('role:update', token, id, nama),
        delete:          (token, id)             => ipcRenderer.invoke('role:delete', token, id),
        duplicate:       (token, id, namaBaru)   => ipcRenderer.invoke('role:duplicate', token, id, namaBaru),
        listAllPermissions: (token)              => ipcRenderer.invoke('role:permissions:listAll', token),
        getPermissions:  (token, roleId)         => ipcRenderer.invoke('role:permissions:get', token, roleId),
        setPermissions:  (token, roleId, ids)    => ipcRenderer.invoke('role:permissions:set', token, roleId, ids),
        listUsers:       (token)                 => ipcRenderer.invoke('role:user:list', token),
        assignUser:      (token, idUser, roleId) => ipcRenderer.invoke('role:user:assign', token, idUser, roleId),
        removeUser:      (token, idUser)         => ipcRenderer.invoke('role:user:remove', token, idUser),
        createUser:      (token, data)           => ipcRenderer.invoke('role:user:create', token, data),
        listOrang:       (token)                  => ipcRenderer.invoke('role:user:listOrang', token),
    },
    schema: {
        compareFile:          (token)                     => ipcRenderer.invoke('schema:compareFile', token),
        applyTable:           (token, tableName)           => ipcRenderer.invoke('schema:applyTable', token, tableName),
        applyColumn:          (token, table, column, type) => ipcRenderer.invoke('schema:applyColumn', token, table, column, type),
        checkPermissionSync:  (token)                      => ipcRenderer.invoke('schema:checkPermissionSync', token),
        applyPermission:      (token, slug)                => ipcRenderer.invoke('schema:applyPermission', token, slug),
        removeOrphanPermission: (token, slug)              => ipcRenderer.invoke('schema:removeOrphanPermission', token, slug),
    },
    // Satu channel generik per modul Fase 1, bukan 1 file Controller per modul
    // kayak referensi (Express dibuang, lihat Khanza.md). Tiap modul daftar
    // handler-nya sendiri di src/main/modules/<modul>.js — lihat SOP sebelum
    // menambah aksi baru.
    parkir: {
        listJenis:      (params)             => ipcRenderer.invoke('parkir:listJenis', params),
        nextJenisKode:  ()                   => ipcRenderer.invoke('parkir:nextJenisKode'),
        createJenis:    (token, data)        => ipcRenderer.invoke('parkir:createJenis', token, data),
        updateJenis:    (token, oldKode, data) => ipcRenderer.invoke('parkir:updateJenis', token, oldKode, data),
        deleteJenis:    (token, kode)        => ipcRenderer.invoke('parkir:deleteJenis', token, kode),

        listBarcode:    (params)             => ipcRenderer.invoke('parkir:listBarcode', params),
        cekBarcode:     (kode)                => ipcRenderer.invoke('parkir:cekBarcode', kode),
        nextKartuNomor: ()                   => ipcRenderer.invoke('parkir:nextKartuNomor'),
        createBarcode:  (token, data)        => ipcRenderer.invoke('parkir:createBarcode', token, data),
        updateBarcode:  (token, oldKode, data) => ipcRenderer.invoke('parkir:updateBarcode', token, oldKode, data),
        deleteBarcode:  (token, kode)        => ipcRenderer.invoke('parkir:deleteBarcode', token, kode),
    },
    // Surat — 9 tabel taksonomi identik, satu channel generik diparameterkan
    // `jenis` (lihat SuratTaksonomiService.js buat daftar jenis yang valid).
    surat: {
        daftarJenis: ()                       => ipcRenderer.invoke('surat:daftarJenis'),
        list:        (jenis, params)          => ipcRenderer.invoke('surat:list', jenis, params),
        nextKode:    (jenis)                  => ipcRenderer.invoke('surat:nextKode', jenis),
        create:      (token, jenis, data)     => ipcRenderer.invoke('surat:create', token, jenis, data),
        update:      (token, jenis, oldKode, data) => ipcRenderer.invoke('surat:update', token, jenis, oldKode, data),
        delete:      (token, jenis, kode)     => ipcRenderer.invoke('surat:delete', token, jenis, kode),
        // Surat Masuk/Keluar — modul pertama hasil porting dari webapps/surat/
        // PHP, lihat SuratMasukKeluarService.js. `jenis`: 'masuk' | 'keluar'.
        masukKeluar: {
            list:        (jenis, params) => ipcRenderer.invoke('surat:masukKeluar:list', jenis, params),
            nextNoUrut:  (jenis, tgl)    => ipcRenderer.invoke('surat:masukKeluar:nextNoUrut', jenis, tgl),
            create:      (token, jenis, data)   => ipcRenderer.invoke('surat:masukKeluar:create', token, jenis, data),
            delete:      (token, jenis, noUrut) => ipcRenderer.invoke('surat:masukKeluar:delete', token, jenis, noUrut),
        },
    },
    // Toko — MASTER DATA + STOK OPNAME saja (transaksi ditunda ke Fase 3,
    // lihat Khanza.md section 14).
    toko: {
        jenis: {
            list:     (params)             => ipcRenderer.invoke('toko:jenis:list', params),
            nextKode: ()                   => ipcRenderer.invoke('toko:jenis:nextKode'),
            create:   (token, data)        => ipcRenderer.invoke('toko:jenis:create', token, data),
            update:   (token, oldKode, data) => ipcRenderer.invoke('toko:jenis:update', token, oldKode, data),
            delete:   (token, kode)        => ipcRenderer.invoke('toko:jenis:delete', token, kode),
        },
        suplier: {
            list:     (params)             => ipcRenderer.invoke('toko:suplier:list', params),
            nextKode: ()                   => ipcRenderer.invoke('toko:suplier:nextKode'),
            create:   (token, data)        => ipcRenderer.invoke('toko:suplier:create', token, data),
            update:   (token, oldKode, data) => ipcRenderer.invoke('toko:suplier:update', token, oldKode, data),
            delete:   (token, kode)        => ipcRenderer.invoke('toko:suplier:delete', token, kode),
        },
        member: {
            list:     (params)             => ipcRenderer.invoke('toko:member:list', params),
            nextKode: ()                   => ipcRenderer.invoke('toko:member:nextKode'),
            create:   (token, data)        => ipcRenderer.invoke('toko:member:create', token, data),
            update:   (token, oldKode, data) => ipcRenderer.invoke('toko:member:update', token, oldKode, data),
            delete:   (token, kode)        => ipcRenderer.invoke('toko:member:delete', token, kode),
        },
        barang: {
            list:       (params)             => ipcRenderer.invoke('toko:barang:list', params),
            listSampah: (token, params)      => ipcRenderer.invoke('toko:barang:listSampah', token, params),
            nextKode:   ()                   => ipcRenderer.invoke('toko:barang:nextKode'),
            calcHarga:  (beli)               => ipcRenderer.invoke('toko:barang:calcHarga', beli),
            create:     (token, data)        => ipcRenderer.invoke('toko:barang:create', token, data),
            update:     (token, oldKode, data) => ipcRenderer.invoke('toko:barang:update', token, oldKode, data),
            delete:     (token, kode)        => ipcRenderer.invoke('toko:barang:delete', token, kode),
            restore:    (token, kode)        => ipcRenderer.invoke('toko:barang:restore', token, kode),
            hardDelete: (token, kode)        => ipcRenderer.invoke('toko:barang:hardDelete', token, kode),
        },
        opname: {
            listBarang:  (params)      => ipcRenderer.invoke('toko:opname:listBarang', params),
            list:        (params)      => ipcRenderer.invoke('toko:opname:list', params),
            createBatch: (token, data) => ipcRenderer.invoke('toko:opname:createBatch', token, data),
            delete:      (token, data) => ipcRenderer.invoke('toko:opname:delete', token, data),
        },
        riwayat: {
            list: (params) => ipcRenderer.invoke('toko:riwayat:list', params),
        },
    },
    ipsrs: {
        jenis: {
            list:     (params)             => ipcRenderer.invoke('ipsrs:jenis:list', params),
            listAll:  ()                   => ipcRenderer.invoke('ipsrs:jenis:listAll'),
            nextKode: ()                   => ipcRenderer.invoke('ipsrs:jenis:nextKode'),
            create:   (token, data)        => ipcRenderer.invoke('ipsrs:jenis:create', token, data),
            update:   (token, oldKode, data) => ipcRenderer.invoke('ipsrs:jenis:update', token, oldKode, data),
            delete:   (token, kode)        => ipcRenderer.invoke('ipsrs:jenis:delete', token, kode),
        },
        suplier: {
            list:     (params)             => ipcRenderer.invoke('ipsrs:suplier:list', params),
            listAll:  ()                   => ipcRenderer.invoke('ipsrs:suplier:listAll'),
            nextKode: ()                   => ipcRenderer.invoke('ipsrs:suplier:nextKode'),
            create:   (token, data)        => ipcRenderer.invoke('ipsrs:suplier:create', token, data),
            update:   (token, oldKode, data) => ipcRenderer.invoke('ipsrs:suplier:update', token, oldKode, data),
            delete:   (token, kode)        => ipcRenderer.invoke('ipsrs:suplier:delete', token, kode),
        },
        barang: {
            list:       (params)        => ipcRenderer.invoke('ipsrs:barang:list', params),
            nextKode:   ()               => ipcRenderer.invoke('ipsrs:barang:nextKode'),
            listAktif:  ()               => ipcRenderer.invoke('ipsrs:barang:listAktif'),
            listSampah: (token, params) => ipcRenderer.invoke('ipsrs:barang:listSampah', token, params),
            create:     (token, data)   => ipcRenderer.invoke('ipsrs:barang:create', token, data),
            update:     (token, oldKode, data) => ipcRenderer.invoke('ipsrs:barang:update', token, oldKode, data),
            delete:     (token, kode)   => ipcRenderer.invoke('ipsrs:barang:delete', token, kode),
            restore:    (token, kode)   => ipcRenderer.invoke('ipsrs:barang:restore', token, kode),
            hardDelete: (token, kode)   => ipcRenderer.invoke('ipsrs:barang:hardDelete', token, kode),
        },
        stok: {
            listBarang:  (params)      => ipcRenderer.invoke('ipsrs:stok:listBarang', params),
            list:        (params)      => ipcRenderer.invoke('ipsrs:stok:list', params),
            createBatch: (token, data) => ipcRenderer.invoke('ipsrs:stok:createBatch', token, data),
            delete:      (token, data) => ipcRenderer.invoke('ipsrs:stok:delete', token, data),
        },
        riwayat: {
            list: (params) => ipcRenderer.invoke('ipsrs:riwayat:list', params),
        },
        permintaan: {
            list:      (params)                    => ipcRenderer.invoke('ipsrs:permintaan:list', params),
            detail:    (noPermintaan)               => ipcRenderer.invoke('ipsrs:permintaan:detail', noPermintaan),
            nextNomor: (tanggal)                    => ipcRenderer.invoke('ipsrs:permintaan:nextNomor', tanggal),
            create:    (token, data)                => ipcRenderer.invoke('ipsrs:permintaan:create', token, data),
            setStatus: (token, noPermintaan, status) => ipcRenderer.invoke('ipsrs:permintaan:setStatus', token, noPermintaan, status),
            delete:    (token, noPermintaan)        => ipcRenderer.invoke('ipsrs:permintaan:delete', token, noPermintaan),
        },
        pengajuan: {
            list:      (params)                  => ipcRenderer.invoke('ipsrs:pengajuan:list', params),
            detail:    (noPengajuan)              => ipcRenderer.invoke('ipsrs:pengajuan:detail', noPengajuan),
            nextNomor: (tanggal)                  => ipcRenderer.invoke('ipsrs:pengajuan:nextNomor', tanggal),
            create:    (token, data)              => ipcRenderer.invoke('ipsrs:pengajuan:create', token, data),
            setStatus: (token, noPengajuan, status) => ipcRenderer.invoke('ipsrs:pengajuan:setStatus', token, noPengajuan, status),
            approve:   (token, noPengajuan)       => ipcRenderer.invoke('ipsrs:pengajuan:approve', token, noPengajuan),
            prefillForSuratPemesanan: (noPengajuan) => ipcRenderer.invoke('ipsrs:pengajuan:prefillForSuratPemesanan', noPengajuan),
            delete:    (token, noPengajuan)       => ipcRenderer.invoke('ipsrs:pengajuan:delete', token, noPengajuan),
        },
        suratPemesanan: {
            list:      (params)               => ipcRenderer.invoke('ipsrs:suratPemesanan:list', params),
            detail:    (noPemesanan)          => ipcRenderer.invoke('ipsrs:suratPemesanan:detail', noPemesanan),
            nextNomor: (tanggal)              => ipcRenderer.invoke('ipsrs:suratPemesanan:nextNomor', tanggal),
            create:    (token, data)          => ipcRenderer.invoke('ipsrs:suratPemesanan:create', token, data),
            tandaiProsesPesan:  (token, noPemesanan) => ipcRenderer.invoke('ipsrs:suratPemesanan:tandaiProsesPesan', token, noPemesanan),
            tandaiSudahDatang:  (token, noPemesanan) => ipcRenderer.invoke('ipsrs:suratPemesanan:tandaiSudahDatang', token, noPemesanan),
            delete:             (token, noPemesanan) => ipcRenderer.invoke('ipsrs:suratPemesanan:delete', token, noPemesanan),
        },
        laporan: {
            rekapPermintaan:    (params) => ipcRenderer.invoke('ipsrs:laporan:rekapPermintaan', params),
            ringkasanPengajuan: (params) => ipcRenderer.invoke('ipsrs:laporan:ringkasanPengajuan', params),
            ringkasanPemesanan: (params) => ipcRenderer.invoke('ipsrs:laporan:ringkasanPemesanan', params),
        },
    },
    keuangan: {
        rekening: {
            list: () => ipcRenderer.invoke('keuangan:rekening:list'),
            create: (token, data) => ipcRenderer.invoke('keuangan:rekening:create', token, data),
            update: (token, oldKode, data) => ipcRenderer.invoke('keuangan:rekening:update', token, oldKode, data),
            delete: (token, kode) => ipcRenderer.invoke('keuangan:rekening:delete', token, kode),
        },
        rekeningTahun: {
            list: (tahun) => ipcRenderer.invoke('keuangan:rekeningTahun:list', tahun),
            save: (token, tahun, data) => ipcRenderer.invoke('keuangan:rekeningTahun:save', token, tahun, data),
        }
    },
    // Satuan — SHARED lintas modul (bukan eksklusif Toko), lihat SatuanService.js.
    satuan: {
        list:     (params)             => ipcRenderer.invoke('satuan:list', params),
        nextKode: ()                   => ipcRenderer.invoke('satuan:nextKode'),
        create:   (token, data)        => ipcRenderer.invoke('satuan:create', token, data),
        update:   (token, oldKode, data) => ipcRenderer.invoke('satuan:update', token, oldKode, data),
        delete:   (token, kode)        => ipcRenderer.invoke('satuan:delete', token, kode),
    },
    // File lampiran (MinIO) — dipakai Surat Masuk/Keluar & modul lain ke
    // depannya yang butuh upload file. `data` HARUS ArrayBuffer/Uint8Array
    // (baca file via `File.arrayBuffer()` di renderer dulu), bukan File object
    // langsung (Electron IPC structured-clone tidak selalu reliable utk File).
    file: {
        upload: (objectKey, data, contentType) => ipcRenderer.invoke('file:upload', objectKey, data, contentType),
        getUrl: (objectKey) => ipcRenderer.invoke('file:getUrl', objectKey),
    },
    // Perpustakaan — 8 sub-modul (lihat Khanza.md > section 19 & README.md
    // buat detail koreksi arsitektur hasil investigasi ulang).
    perpustakaan: {
        taksonomi: {
            daftarJenis: ()                       => ipcRenderer.invoke('perpustakaan:taksonomi:daftarJenis'),
            list:        (jenis, params)          => ipcRenderer.invoke('perpustakaan:taksonomi:list', jenis, params),
            nextKode:    (jenis)                  => ipcRenderer.invoke('perpustakaan:taksonomi:nextKode', jenis),
            create:      (token, jenis, data)     => ipcRenderer.invoke('perpustakaan:taksonomi:create', token, jenis, data),
            update:      (token, jenis, oldKode, data) => ipcRenderer.invoke('perpustakaan:taksonomi:update', token, jenis, oldKode, data),
            delete:      (token, jenis, kode)     => ipcRenderer.invoke('perpustakaan:taksonomi:delete', token, jenis, kode),
        },
        penerbit: {
            list:     (params)             => ipcRenderer.invoke('perpustakaan:penerbit:list', params),
            nextKode: ()                   => ipcRenderer.invoke('perpustakaan:penerbit:nextKode'),
            create:   (token, data)        => ipcRenderer.invoke('perpustakaan:penerbit:create', token, data),
            update:   (token, oldKode, data) => ipcRenderer.invoke('perpustakaan:penerbit:update', token, oldKode, data),
            delete:   (token, kode)        => ipcRenderer.invoke('perpustakaan:penerbit:delete', token, kode),
        },
        koleksi: {
            list:     (params)             => ipcRenderer.invoke('perpustakaan:koleksi:list', params),
            nextKode: ()                   => ipcRenderer.invoke('perpustakaan:koleksi:nextKode'),
            create:   (token, data)        => ipcRenderer.invoke('perpustakaan:koleksi:create', token, data),
            update:   (token, oldKode, data) => ipcRenderer.invoke('perpustakaan:koleksi:update', token, oldKode, data),
            delete:   (token, kode)        => ipcRenderer.invoke('perpustakaan:koleksi:delete', token, kode),
        },
        anggota: {
            list:     (params)             => ipcRenderer.invoke('perpustakaan:anggota:list', params),
            nextKode: ()                   => ipcRenderer.invoke('perpustakaan:anggota:nextKode'),
            create:   (token, data)        => ipcRenderer.invoke('perpustakaan:anggota:create', token, data),
            update:   (token, oldKode, data) => ipcRenderer.invoke('perpustakaan:anggota:update', token, oldKode, data),
            delete:   (token, kode)        => ipcRenderer.invoke('perpustakaan:anggota:delete', token, kode),
        },
        inventaris: {
            list:     (params)             => ipcRenderer.invoke('perpustakaan:inventaris:list', params),
            summary:  ()                   => ipcRenderer.invoke('perpustakaan:inventaris:summary'),
            nextKode: ()                   => ipcRenderer.invoke('perpustakaan:inventaris:nextKode'),
            create:   (token, data)        => ipcRenderer.invoke('perpustakaan:inventaris:create', token, data),
            update:   (token, oldKode, data) => ipcRenderer.invoke('perpustakaan:inventaris:update', token, oldKode, data),
            delete:   (token, kode)        => ipcRenderer.invoke('perpustakaan:inventaris:delete', token, kode),
        },
        sirkulasi: {
            getSetting:     ()             => ipcRenderer.invoke('perpustakaan:sirkulasi:getSetting'),
            listPetugas:    ()             => ipcRenderer.invoke('perpustakaan:sirkulasi:listPetugas'),
            list:           (params)       => ipcRenderer.invoke('perpustakaan:sirkulasi:list', params),
            previewPinjam:  (data)         => ipcRenderer.invoke('perpustakaan:sirkulasi:previewPinjam', data),
            pinjam:         (token, data)  => ipcRenderer.invoke('perpustakaan:sirkulasi:pinjam', token, data),
            previewKembali: (data)         => ipcRenderer.invoke('perpustakaan:sirkulasi:previewKembali', data),
            kembali:        (token, data)  => ipcRenderer.invoke('perpustakaan:sirkulasi:kembali', token, data),
            perpanjang:     (token, data)  => ipcRenderer.invoke('perpustakaan:sirkulasi:perpanjang', token, data),
            delete:         (token, data)  => ipcRenderer.invoke('perpustakaan:sirkulasi:delete', token, data),
        },
        denda: {
            list:     (params)             => ipcRenderer.invoke('perpustakaan:denda:list', params),
            nextKode: ()                   => ipcRenderer.invoke('perpustakaan:denda:nextKode'),
            create:   (token, data)        => ipcRenderer.invoke('perpustakaan:denda:create', token, data),
            update:   (token, oldKode, data) => ipcRenderer.invoke('perpustakaan:denda:update', token, oldKode, data),
            delete:   (token, kode)        => ipcRenderer.invoke('perpustakaan:denda:delete', token, kode),
        },
        bayarDenda: {
            listHarian:   (params)        => ipcRenderer.invoke('perpustakaan:bayarDenda:listHarian', params),
            createHarian: (token, data)   => ipcRenderer.invoke('perpustakaan:bayarDenda:createHarian', token, data),
            deleteHarian: (token, data)   => ipcRenderer.invoke('perpustakaan:bayarDenda:deleteHarian', token, data),
            listLain:     (params)        => ipcRenderer.invoke('perpustakaan:bayarDenda:listLain', params),
            createLain:   (token, data)   => ipcRenderer.invoke('perpustakaan:bayarDenda:createLain', token, data),
            deleteLain:   (token, data)   => ipcRenderer.invoke('perpustakaan:bayarDenda:deleteLain', token, data),
        },
        pengaturan: {
            get:    ()             => ipcRenderer.invoke('perpustakaan:pengaturan:get'),
            upsert: (token, data)  => ipcRenderer.invoke('perpustakaan:pengaturan:upsert', token, data),
            delete: (token)        => ipcRenderer.invoke('perpustakaan:pengaturan:delete', token),
        },
    },
    eeksekutif: {
        landing: () => ipcRenderer.invoke('eeksekutif:landing'),
        rawatJalan: (tgl1, tgl2) => ipcRenderer.invoke('eeksekutif:rawatJalan', tgl1, tgl2),
        igd: (tgl1, tgl2) => ipcRenderer.invoke('eeksekutif:igd', tgl1, tgl2),
        rawatInap: (tgl1, tgl2) => ipcRenderer.invoke('eeksekutif:rawatInap', tgl1, tgl2),
        lab: (tgl1, tgl2) => ipcRenderer.invoke('eeksekutif:lab', tgl1, tgl2),
        radiologi: (tgl1, tgl2) => ipcRenderer.invoke('eeksekutif:radiologi', tgl1, tgl2),
        sisaStokFarmasi: () => ipcRenderer.invoke('eeksekutif:sisaStokFarmasi'),
        daruratStokFarmasi: () => ipcRenderer.invoke('eeksekutif:daruratStokFarmasi'),
        kadaluarsaBatchFarmasi: () => ipcRenderer.invoke('eeksekutif:kadaluarsaBatchFarmasi'),
        ringkasanMutasiFarmasi: (tgl1, tgl2, jenisMutasi) => ipcRenderer.invoke('eeksekutif:ringkasanMutasiFarmasi', tgl1, tgl2, jenisMutasi),
        ringkasanObatPoliklinik: (tgl1, tgl2) => ipcRenderer.invoke('eeksekutif:ringkasanObatPoliklinik', tgl1, tgl2),
        ringkasanObatDokter: (tgl1, tgl2, statusLanjut) => ipcRenderer.invoke('eeksekutif:ringkasanObatDokter', tgl1, tgl2, statusLanjut),
        penerimaanVendorPerBulan: (tahun) => ipcRenderer.invoke('eeksekutif:penerimaanVendorPerBulan', tahun),
        stokTidakBergerak: (bulan) => ipcRenderer.invoke('eeksekutif:stokTidakBergerak', bulan),
        sisaStokNonMedis: () => ipcRenderer.invoke('eeksekutif:sisaStokNonMedis'),
        ringkasanMutasiNonMedis: (tgl1, tgl2, jenisMutasi) => ipcRenderer.invoke('eeksekutif:ringkasanMutasiNonMedis', tgl1, tgl2, jenisMutasi),
        penerimaanVendorNonMedisPerBulan: (tahun) => ipcRenderer.invoke('eeksekutif:penerimaanVendorNonMedisPerBulan', tahun),
        sisaStokDapur: () => ipcRenderer.invoke('eeksekutif:sisaStokDapur'),
        ringkasanMutasiDapur: (tgl1, tgl2, jenisMutasi) => ipcRenderer.invoke('eeksekutif:ringkasanMutasiDapur', tgl1, tgl2, jenisMutasi),
        penerimaanVendorDapurPerBulan: (tahun) => ipcRenderer.invoke('eeksekutif:penerimaanVendorDapurPerBulan', tahun),
        mutuLamaPelayanan: (token, tgl1, tgl2, jenis) => ipcRenderer.invoke('eeksekutif:mutu:lamaPelayanan', token, tgl1, tgl2, jenis),
        kasirPendapatan: (token, tgl1, tgl2, jenis) => ipcRenderer.invoke('eeksekutif:kasir:pendapatan', token, tgl1, tgl2, jenis),
        akuntansiHutang: (token, jenis) => ipcRenderer.invoke('eeksekutif:akuntansi:hutang', token, jenis),
        akuntansiPiutang: (token, jenis) => ipcRenderer.invoke('eeksekutif:akuntansi:piutangBelumLunas', token, jenis),
        laporanKeuangan: (token, tahun) => ipcRenderer.invoke('eeksekutif:akuntansi:laporanKeuangan', token, tahun),
        rekeningTahun: (token, tahun) => ipcRenderer.invoke('eeksekutif:akuntansi:rekeningTahun', token, tahun),
        saldoAkunPerBulan: (token, tahun) => ipcRenderer.invoke('eeksekutif:akuntansi:saldoAkunPerBulan', token, tahun),
    },
    laporan: {
        rl13: () => ipcRenderer.invoke('laporan:rl13:get'),
        borAlos: (params) => ipcRenderer.invoke('laporan:borAlos:get', params),
        rl3: (params) => ipcRenderer.invoke('laporan:rl3:get', params),
        rl4: (params) => ipcRenderer.invoke('laporan:rl4:get', params),
    },
    // Migration DB — status boleh dibaca siapa saja yang login, tapi jalankan
    // migration divalidasi ulang role-nya di main process (lihat main/index.js),
    // bukan cuma disembunyikan tombolnya di renderer.
    db: {
        migrationStatus: ()      => ipcRenderer.invoke('db:migrationStatus'),
        runMigrations:   (token) => ipcRenderer.invoke('db:runMigrations', token),
    },
})
