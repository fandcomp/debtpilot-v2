# Supabase Setup untuk DebtPilot

## 1. Buat Project di Supabase

1. Go to https://supabase.com
2. Sign up atau login
3. Create new project dengan nama `debtpilot`
4. Tunggu project initialize (5-10 menit)

## 2. Buat Tabel `app_state`

Di Supabase Dashboard → SQL Editor, jalankan query ini:

```sql
CREATE TABLE app_state (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  state JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- Create policy untuk public read/write (gunakan dengan hati-hati)
CREATE POLICY "Allow public access to app_state"
  ON app_state
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create realtime subscription
ALTER PUBLICATION supabase_realtime ADD TABLE app_state;
```

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
