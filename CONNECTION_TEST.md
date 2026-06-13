# Testing Supabase Connection

## Quick Test Steps

### Step 1: Open App & Check Initial Console

1. **Open** `index.html` di browser (local atau server)
2. **Open Console** (Press `F12` → Console tab)
3. **You should see:**

```
🚀 App initializing...
🔧 Initializing Supabase...
   URL: https://wubbbjqqdowuqxjpmqpt.supabase.co
   Key: sb_publishable_1VZ6iZWdGiJ...
🔍 Testing Supabase connection...
✅ Supabase client created
✅ Supabase connection verified!
📊 Tables accessible: YES
✅ Supabase fully operational
✅ State loaded successfully
✅ App loaded - showing login
```

### ✅ IF YOU SEE ABOVE:
**Supabase connected & working!** 🎉

---

## Step 2: If Connection Test Failed

Jika console menunjukkan error, ikuti debugging ini:

### Issue: "Supabase library not loaded"
```
⚠️ Supabase library not loaded
```

**Fix:**
- Check `index.html` line 13 ada: `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
- Refresh page
- Check browser network tab (F12 → Network) apakah script loaded

### Issue: "Connection test failed"
```
❌ Connection test failed: [error message]
```

**Debug steps:**

1. **Type di Console:**
   ```javascript
   checkSupabase()
   ```
   - Should show Supabase initialized: true
   - Should show URL & Key present

2. **Type di Console:**
   ```javascript
   testConnection()
   ```
   - Check error message detail

3. **Common errors:**
   - `401 Unauthorized` → Key salah/expired
   - `404 Not Found` → Table tidak ada
   - `CORS error` → Domain issue
   - `Connection refused` → Supabase project down

### Issue: Login doesn't work

1. **Check Console untuk error:**
   ```javascript
   checkState()
   ```
   - Should show empty debts, payments, etc.

2. **Try login:**
   - Username: `aim`
   - Password: `hafandi`

3. **If still doesn't work:**
   - Check browser localStorage enabled (F12 → Application → Storage → localStorage)
   - Try incognito/private window
   - Clear browser cache

---

## Step 3: Manual Console Test

Setelah app loaded, Anda bisa test fitur dari console:

### Test 1: Check Supabase Status
```javascript
checkSupabase()
```

**Output:**
```
🔍 Supabase Status:
  - Initialized: true
  - URL: https://wubbbjqqdowuqxjpmqpt.supabase.co
  - Key present: true
```

### Test 2: Test Connection
```javascript
testConnection()
```

**Output jika sukses:**
```
🧪 Running connection test...
🔍 Testing Supabase connection...
✅ Supabase connection verified!
📊 Tables accessible: YES
```

### Test 3: Check Current State
```javascript
checkState()
```

**Output:**
```
📊 Current State: {
  debts: [],
  payments: [],
  uploads: [],
  laporan: [],
  ...
}
```

---

## Step 4: Test Actual Features

### Test Login
1. **Type di Console:**
   ```javascript
   showLogin()
   ```
   - Login form appears

2. **Login dengan:**
   - Username: `aim`
   - Password: `hafandi`

3. **Check Console:**
   ```
   ✅ App loaded - authenticated
   ```

### Test Data Save
1. **Login sebagai aim/hafandi**
2. **Go to:** Debt Details
3. **Add debt:**
   - Platform: Bank Jago
   - Amount: 5000000
   - Due: 2026-12-31
4. **Click:** Tambah utang

5. **Check Console:**
   - Should see Supabase save logs
   - Data appears in table

### Test Real-time Sync
1. **Open 2 browser windows** dengan app
2. **Both login sebagai aim**
3. **Window 1:** Add payment
4. **Check Window 2:**
   - Should update without refresh
   - Toast: "Data disinkronkan"
5. **Console:**
   ```
   📡 Real-time update received
   ```

---

## Step 5: Verify Database

### Check Supabase Dashboard

1. **Go to:** https://app.supabase.com
2. **Select project:** debtpilot
3. **Go to:** SQL Editor
4. **Run:**
   ```sql
   SELECT * FROM app_state LIMIT 1;
   ```
   - Should return data if saved

### Check Table Exists
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

Should show:
- app_state ✅
- uploads ✅
- (other system tables)

---

## SUCCESS CHECKLIST ✅

Jika semua ini checked, Supabase fully connected:

- [ ] Console shows `✅ Supabase fully operational`
- [ ] `checkSupabase()` shows initialized: true
- [ ] `testConnection()` returns success
- [ ] Can login & see app
- [ ] Can add/edit data
- [ ] Data appears in Supabase dashboard
- [ ] Real-time sync works (2 browser windows)

---

## Common Console Commands

**Cepat copy-paste untuk test:**

```javascript
// 1. Check Supabase initialized
checkSupabase()

// 2. Test connection
testConnection()

// 3. View current state
checkState()

// 4. Show login form
showLogin()

// 5. Check auth status
isAuthenticated()

// 6. Get current user
getCurrentUser()

// 7. View localStorage
Object.keys(localStorage)

// 8. Clear state & refresh
localStorage.clear(); location.reload()
```

---

## If Everything Works ✅

Congratulations! 🎉

**Next steps:**
1. Test all features (Debt, Payment, Upload, Laporan)
2. Test real-time sync with 2 devices
3. Test mobile responsive
4. Deploy to Netlify

---

## If Still Having Issues ❌

**Collect this info & debug:**

1. **Screenshot console errors**
2. **Run & share output:**
   ```javascript
   console.log('URL:', SUPABASE_URL)
   console.log('Key:', SUPABASE_KEY.substring(0, 30) + '...')
   checkSupabase()
   ```
3. **Check Supabase dashboard:**
   - Project status (running, not paused)
   - Tables exist (SELECT * FROM pg_tables)
   - RLS policies correct

---

**Happy testing! 🚀**

