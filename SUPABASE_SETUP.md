# Supabase Setup untuk DebtPilot

## 1. Buat Project di Supabase

1. Go to https://supabase.com
2. Sign up atau login
3. Create new project dengan nama `debtpilot`
4. Tunggu project initialize (5-10 menit)

## 2. Buat Tabel `app_state` & Storage Bucket

### A. Di Supabase Dashboard → SQL Editor, jalankan query ini:

```sql
-- Create app_state table
CREATE TABLE app_state (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  state JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- Create policy untuk public read/write
CREATE POLICY "Allow public access to app_state"
  ON app_state
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime subscription
ALTER PUBLICATION supabase_realtime ADD TABLE app_state;

-- Create uploads table untuk track bukti pembayaran
CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  nominal NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  nota_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS pada uploads
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow public access to uploads"
  ON uploads
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE uploads;
```

### B. Buat Storage Bucket untuk Gambar

Di Supabase Dashboard → Storage:

1. **Create new bucket** dengan nama: `payment-proofs`
2. **Make it public** (toggle "Public bucket")
3. **File size limit**: 50 MB
4. **Allowed MIME types**: `image/*`

Atau gunakan SQL Editor:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true);
```

**Wajib**: tambahkan policy agar aplikasi (anon key) bisa membaca dan meng-upload gambar ke bucket ini. Jalankan di SQL Editor:

```sql
CREATE POLICY "Public read payment-proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs');

CREATE POLICY "Anon upload payment-proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-proofs');
```

Tanpa policy INSERT di atas, upload gambar akan gagal diam-diam dan aplikasi
kembali menyimpan base64 di `app_state` (membuat loading lambat).

### C. Migrasi Gambar Lama (base64 → Storage)

Jika `app_state` sudah telanjur berisi gambar base64 (state membengkak, loading lambat),
jalankan skrip migrasi satu kali setelah bucket + policy dibuat:

```bash
node scripts/migrate-images.js --dry-run   # cek dulu apa yang akan dimigrasikan
node scripts/migrate-images.js             # jalankan migrasi
```

Skrip akan meng-upload semua gambar base64 di `uploads`, `laporan`, dan `debtProofs`
ke bucket `payment-proofs`, lalu mengganti field-nya dengan URL.

## 3. Get Credentials dari Supabase

Di Supabase Dashboard (https://app.supabase.com):

1. **Login ke akun Anda**
2. **Pilih project "debtpilot"**
3. **Sidebar kiri → Settings → API**
4. **Di halaman API, akan lihat:**
   - `Project URL` (contoh: `https://vrpfkpqmzfcehskczupd.supabase.co`)
   - `anon public key` (contoh: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

5. **Copy kedua nilai tersebut**

6. **Update di `app.js` (lines 5-6):**

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_NAME.supabase.co';  // Dari "Project URL"
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIs...';               // Dari "anon public key"
```

### ⚠️ PENTING: Jangan Bingung dengan Secret Key

Di halaman API, ada 3 key:
- `Project URL` → Gunakan ini untuk SUPABASE_URL ✅
- `anon public key` → Gunakan ini untuk SUPABASE_KEY ✅
- `service_role secret key` → JANGAN gunakan di frontend ❌

Gunakan **anon public key** karena aman untuk di-expose di browser.
Secret key hanya untuk backend/server saja.

## 4. Test Connection

Open aplikasi di browser → Check console (F12)
- ✅ "Supabase initialized"
- ✅ "State loaded from Supabase" atau "State saved to Supabase"
- ✅ "Real-time sync setup complete"

## 5. Test Real-time Sync

1. Buka aplikasi di Browser 1
2. Buka aplikasi di Browser 2 (atau device lain)
3. Tambah data di Browser 1
4. Browser 2 akan auto-update dengan toast "Data disinkronkan"

## Notes

- Data sudah disimpan di Supabase cloud
- Semua device/browser akan sync otomatis
- Jika offline, data tersimpan di localStorage dan sync saat online
- Password & credentials aman di USERS_DB (tidak disimpan di DB)

## Troubleshooting

Jika error:
1. Check browser console (F12)
2. Verify API keys di app.js
3. Check Supabase project is running
4. Check RLS policies allow public access

## Security Notes

Untuk production:
- Gunakan authentication properly (JWT tokens)
- Update RLS policies untuk lebih restrictive
- Encrypt sensitive data sebelum save
- Monitor database usage
