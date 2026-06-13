# DebtPilot Testing Guide

## ⚠️ BEFORE TESTING - SETUP SUPABASE

### Step 1: Create Supabase Project
1. Go to https://app.supabase.com
2. Sign up / Login
3. Click "New project"
4. Name: `debtpilot`
5. Password: Create strong password
6. Region: `Southeast Asia (Singapore)` recommended
7. Click "Create new project" → Wait 5-10 minutes

### Step 2: Create Tables (Copy-Paste SQL)

Di Supabase Dashboard → SQL Editor:
1. Click "New Query"
2. Paste seluruh SQL dari SUPABASE_SETUP.md (Section 2.A)
3. Click "Run"
4. Result: Tables created ✅

### Step 3: Create Storage Bucket

Di Supabase Dashboard → Storage:
1. Click "New bucket"
2. Name: `payment-proofs`
3. Toggle "Make it public"
4. Click "Create bucket"

### Step 4: Get Credentials

Di Supabase Dashboard → Settings → API:
1. Copy `Project URL` (bukan base URL)
2. Copy `anon public key`
3. Open `app.js` (line 10-11)
4. Replace:
   ```javascript
   const SUPABASE_URL = 'https://YOUR_PROJECT_NAME.supabase.co';
   const SUPABASE_KEY = 'YOUR_ANON_KEY';
   ```
5. Save file

### Step 5: Open App & Check Console

1. Open `index.html` in browser (atau lokal server)
2. Press `F12` → Open Console
3. Should see:
   - `🚀 App initializing...`
   - `✅ Supabase initialized` atau `⚠️ Not connected (will use localStorage)`
   - `✅ State loaded successfully` atau `Using default state`
   - `✅ App loaded - showing login`

Jika error, check konsol untuk detail error.

---

## TESTING PHASES

### Phase 1: Login Testing

**Test Case 1.1: Valid login - User**
```
Username: abi
Password: abdulhadi
Expected: Dashboard loads, sidebar shows user features
```

**Test Case 1.2: Valid login - Admin**
```
Username: aim
Password: hafandi
Expected: Dashboard loads, sidebar shows "Transaksi" menu + "Add Debt" form
```

**Test Case 1.3: Invalid login**
```
Username: wrong
Password: wrong
Expected: Error toast "Kredensial tidak cocok"
```

**Verification:**
- [ ] Login button works
- [ ] Console shows `✅ App loaded - authenticated`
- [ ] Can see correct menus based on role
- [ ] Logout button works

---

### Phase 2: Debt Setup (Admin Only)

**As user: aim/hafandi**

1. **Go to: Debt Details panel**
   - Look for "Set nilai utang awal" form
   - Should see 5 input fields per platform

2. **Add Debt #1:**
   ```
   Platform: Bank Jago
   Initial Debt: 5000000
   Installment: 500000
   Due Date: 2026-12-31
   Priority: 1
   Click: "Tambah utang"
   ```
   - Expected: Toast "Utang ditambahkan - 1 platform telah ditambahkan"
   - Check: Appears in table below form

3. **Add Debt #2:**
   ```
   Platform: Blu by BCA
   Initial Debt: 3000000
   Installment: 300000
   Due Date: 2026-11-30
   Priority: 2
   Click: "Tambah utang"
   ```

4. **Add Debt #3:**
   ```
   Platform: Kredivo
   Initial Debt: 2000000
   Installment: 200000
   Due Date: 2026-10-31
   Priority: 3
   ```

**Verification:**
- [ ] Form submits successfully
- [ ] Toast shows correct count
- [ ] Data appears in table
- [ ] Can edit by clicking "Edit" button
- [ ] Can delete by clicking "Delete" button (confirm dialog appears)
- [ ] Form hides for non-admin users

---

### Phase 3: Payment Entry

**As user: abi/abdulhadi**

1. **Go to: Update Payment panel**

2. **Add Payment #1:**
   ```
   Platform: Bank Jago
   Amount: 500000
   Date: Today
   Notes: Cicilan bulanan
   Click: "Simpan pembayaran"
   ```
   - Expected: Toast "Pembayaran berhasil dicatat"
   - Check: Appears in Payment History

3. **Check Dashboard:**
   - Total debt: Should show 3 utangs
   - Remaining debt: Should decrease
   - Summary cards update with new values

**Verification:**
- [ ] Payment form works
- [ ] Data appears in history
- [ ] Dashboard updates
- [ ] Can edit/delete payment from history

---

### Phase 4: Upload Bukti Pembayaran

**As user: abi/abdulhadi**

1. **Go to: Upload Bukti panel**

2. **Upload Payment Proof:**
   - Click "Pilih gambar"
   - Select JPG/PNG image (any image, < 5MB)
   - Enter Nominal: 500000
   - Expected: Image preview appears
   - Click "Upload"
   - Expected: Toast "Bukti pembayaran telah diunggah"

3. **Check Upload History:**
   - Should see upload in list with "pending" status

**Verification:**
- [ ] Image selection works
- [ ] Image preview displays
- [ ] Upload submission works
- [ ] Upload appears in history list
- [ ] Status shows "pending"

---

### Phase 5: Transaksi Approval (Admin Only)

**As user: aim/hafandi**

1. **Go to: Transaksi (Admin) panel**

2. **Find pending upload:**
   - Should see upload with image thumbnail
   - Shows nominal, uploader name, status

3. **Approve upload:**
   - Select platform: "Bank Jago"
   - Click "Approve"
   - Expected: Toast "Upload disetujui"
   - Status changes to "approved"

4. **Check Laporan:**
   - Go to Laporan panel
   - Should see new entry with image displayed
   - Can edit keterangan (admin only)

**Verification:**
- [ ] Transaksi panel shows pending uploads
- [ ] Approval form works
- [ ] Status updates
- [ ] Entry auto-appears in Laporan

---

### Phase 6: Laporan View

**Any user**

1. **Go to: Laporan panel**

2. **Check display:**
   - Shows approved payments
   - Image displayed with responsive sizing
   - Click image for fullscreen
   - Card layout responsive on mobile

3. **Edit (Admin only):**
   - As aim: Should see input field for "Keterangan"
   - Edit text, click "Simpan"
   - Data updates
   - As abi: Should only see text, no edit option

**Verification:**
- [ ] Laporan displays correctly
- [ ] Images show properly
- [ ] Card layout responsive
- [ ] Edit works for admin only

---

### Phase 7: Real-time Sync (Multi-Device)

**Required: 2 browsers or devices**

1. **Device A - Browser 1:**
   - Open app, login as `abi`
   - Go to Update Payment
   - Keep page open

2. **Device B - Browser 2:**
   - Open app, login as `abi`
   - Keep page open

3. **Device A: Add Payment**
   - Add payment: 250000
   - Click save

4. **Check Device B:**
   - Should auto-update WITHOUT refresh
   - Toast: "Data disinkronkan - Data diperbarui dari device lain"
   - Payment appears in history

5. **Console Check:**
   - Device B console should show: `📡 Real-time update received`

**Verification:**
- [ ] Real-time update received
- [ ] No manual refresh needed
- [ ] Data consistent across devices
- [ ] Toast notification appears

---

### Phase 8: Mobile Responsive

**Test on mobile browser or use Chrome DevTools mobile view**

1. **Test Sidebar:**
   - Click hamburger menu
   - Sidebar slides in from left
   - Click overlay or close button to close
   - Menu items accessible

2. **Test Forms:**
   - All inputs full-width
   - No horizontal scroll
   - Buttons full-width and touchable
   - Font size readable (16px+)

3. **Test Tables:**
   - Can horizontal scroll if needed
   - Data readable
   - Buttons stacked vertically

4. **Test Images:**
   - Laporan images responsive
   - No overflow
   - Touch-friendly

**Verification:**
- [ ] No layout overflow
- [ ] Sidebar menu works
- [ ] Forms responsive
- [ ] Images fit screen
- [ ] All buttons touchable

---

### Phase 9: Data Persistence

1. **Add some data** (as admin):
   - 3 debts
   - 2 payments
   - 1 upload

2. **Close browser completely**

3. **Reopen app, login:**
   - Data should still be there
   - Check Dashboard
   - Check Payment History
   - Check Debt Details

4. **Check where data stored:**
   - Console: If `✅ State loaded from Supabase` → Cloud ☁️
   - Console: If using localStorage → Local 💻

**Verification:**
- [ ] Data persists after browser close
- [ ] Data in either Supabase or localStorage
- [ ] No data loss

---

### Phase 10: Error Handling

**Test invalid inputs:**

1. **Debt form:**
   - [ ] Empty platform → Error
   - [ ] Zero nominal → Error
   - [ ] No due date → Error
   - [ ] Duplicate platform → Warning

2. **Payment form:**
   - [ ] Zero amount → Error
   - [ ] No date → Error
   - [ ] Platform not selected → Error

3. **Upload form:**
   - [ ] Non-image file → Error
   - [ ] File > 5MB → Error
   - [ ] Zero nominal → Error
   - [ ] No image selected → Error

4. **Network error:**
   - [ ] If offline → Uses localStorage
   - [ ] When online again → Auto-sync

---

## CONSOLE DEBUGGING

Buka F12 → Console untuk monitor:

**Good signs:**
```
✅ App initializing...
✅ Supabase initialized
✅ State loaded successfully
✅ Real-time sync setup complete
✅ App loaded - authenticated
```

**Warning signs:**
```
❌ Supabase init error
❌ Init error
⚠️ Not connected
```

**Real-time sync:**
```
📡 Real-time update received
```

---

## COMMON ISSUES

### Issue: "Cannot login"
- [ ] Check username/password correct
- [ ] Check console for errors
- [ ] Check if app initialized (look for `🚀 App initializing...`)

### Issue: "Supabase not connected"
- [ ] Check credentials in app.js (line 10-11)
- [ ] Verify Project URL format
- [ ] Verify anon key is long enough
- [ ] Check Supabase project status (not paused)

### Issue: "Data not persisting"
- [ ] Check browser allows localStorage
- [ ] Check Supabase table exists (SELECT * FROM app_state)
- [ ] Check RLS policies (should allow public access)

### Issue: "Real-time not syncing"
- [ ] Check if Supabase connection works
- [ ] Check browser console for errors
- [ ] Check table has realtime enabled
- [ ] Try refresh page

---

## SUCCESS CHECKLIST

Jika semua ini hijau ✅, aplikasi siap:

- [ ] Login works (both users)
- [ ] Admin can add/edit/delete debts
- [ ] User can add payments
- [ ] Upload with image works
- [ ] Admin approves uploads
- [ ] Laporan shows images
- [ ] Real-time sync works
- [ ] Mobile responsive
- [ ] Data persists
- [ ] Console shows success messages
- [ ] No unhandled errors

---

## NEXT: DEPLOY TO NETLIFY

Setelah testing selesai:

1. Push ke GitHub (sudah siap)
2. Deploy to Netlify
   - Connect GitHub repo
   - Build: none (static)
   - Publish: root directory
   - Done!

3. Update Supabase URL if needed (custom domain)

---

**Happy testing! 🚀**
