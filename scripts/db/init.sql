-- Basis data utama dibuat lewat POSTGRES_DB. Basis data kedua khusus uji otomatis
-- supaya tes integrasi tidak menyentuh data pengembangan.
CREATE DATABASE payme_test OWNER payme;
