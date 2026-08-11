// Fase 0 — Auth (lihat Khanza.md > "Arsitektur UI & Koneksi Data" & "Aktivasi Lisensi")
import m001 from './001_create_roles.js'
import m002 from './002_create_permissions.js'
import m003 from './003_create_role_permissions.js'
import m004 from './004_create_users.js'
import m005 from './005_seed_default_admin.js'

// Fase 1 — Modul berdiri sendiri (lihat Khanza.md > "Urutan Migrasi Modul")
import m006 from './006_create_parkir_jenis.js'
import m007 from './007_create_parkir_barcode.js'
import m008 from './008_create_toko_setharga.js'
import m009 from './009_create_perpustakaan_master.js'
import m010 from './010_create_perpustakaan_koleksi.js'
import m011 from './011_create_perpustakaan_anggota.js'
import m012 from './012_create_perpustakaan_sirkulasi.js'
import m013 from './013_create_perpustakaan_denda.js'
import m014 from './014_create_surat_master.js'
import m015 from './015_create_ipsrs_suplier_jenis.js'
import m016 from './016_create_ipsrs_pembelian.js'
import m017 from './017_seed_permissions_khanza_asli.js'
import m018 from './018_seed_permissions_electron_extra.js'
import m019 from './019_add_parkir_jenis_check.js'
import m020 from './020_add_surat_master_missing.js'
import m021 from './021_fix_perpustakaan_schema.js'
import m022 from './022_create_surat_masuk_keluar.js'
import m023 from './023_create_toko_master.js'
import m024 from './024_create_kodesatuan.js'

// CATATAN (sudah tidak berlaku, dibiarkan buat histori): SuratMasuk/SuratKeluar
// sempat TIDAK punya migration karena src/surat/SuratMasuk.java/SuratKeluar.java
// sendiri memang tidak nyentuh DB (JavaFX WebView shell doang) — TAPI ternyata
// logic aslinya ada di PHP webapps/surat/pages/{input,input2,list,list2}.php
// (pola "hybrid webview", lihat Khanza.md > "Arsitektur Hybrid WebView").
// Migration 022 nge-port skema dari PHP itu ke Postgres.

export default [
    m001, m002, m003, m004, m005,
    m006, m007, m008, m009, m010, m011, m012, m013, m014, m015, m016, m017, m018, m019, m020, m021, m022, m023, m024,
]
