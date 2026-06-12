# 🚀 DebtPilot - Upgrade Plan & Implementation

**Status:** Planning Phase  
**Date:** June 11, 2026

---

## 📋 Upgrade Requirements Summary

### 1. **New Panel: Upload Bukti Bayar, Transaksi, Laporan**

#### A. Upload Panel
- Upload gambar bukti bayar/transfer
- Input nominal (required before upload)
- Gambar tersimpan dan digunakan untuk laporan
- Automatic image compression

#### B. Transaksi Panel (Khusus Role: AIM)
- Menampilkan data upload yang menunggu approval
- User AIM bisa:
  - Pilih platform (dropdown: Jago, SeaBank, Blue by BCA, SPay, Gojek, Arsanta)
  - Tambah keterangan
  - Data terotomasi sesuai format laporan

#### C. Laporan Panel
- Table dengan 5 kolom:
  1. **Tanggal** - Auto fill (format: DD Bulan YYYY)
  2. **Platform** - Selected by AIM
  3. **Nota** - Image thumbnail dari upload
  4. **Nominal** - Angka dari input
  5. **Keterangan** - Text dari AIM

---

### 2. **Multi-User Login System**

#### Users:
| Username | Password | Role | Akses |
|----------|----------|------|-------|
| abi | abdulhadi | User Biasa | Dashboard, Upload |
| umi | rohmah | User Biasa | Dashboard, Upload |
| aim | hafandi | Admin | Semua Panel (Dashboard, Upload, Transaksi, Laporan) |

#### Role Details:
- **AIM (Admin):**
  - View: Dashboard, Upload Bukti, Transaksi, Laporan
  - Action: Edit/Approve transaksi, Add platform & keterangan
  - Access: Semua fitur

- **ABI & UMI (User Biasa):**
  - View: Dashboard, Upload Bukti, Laporan (read-only)
  - Action: Upload gambar & nominal
  - Cannot: Edit laporan, akses transaksi panel

---

### 3. **Data Storage & Image Management**

#### Storage Strategy:
- **Metadata:** localStorage (small)
- **Images:** IndexedDB atau File System API
- **Compression:** Automatic image resize before storage
- **Size Optimization:** Max 500KB per image

#### Implementation:
```
Local Storage:
├── User credentials
├── Dashboard data
└── Transaction metadata

IndexedDB:
├── Images (compressed)
├── Transaction records
└── Laporan data

File System (After Deploy):
├── /uploads/[user]/images/
├── /uploads/[user]/compressed/
└── /data/laporan.json
```

---

## 🏗️ Architecture Changes

### Current Structure:
```
DebtPilot v1.0
├── Panel: Dashboard
├── Panel: Update Pembayaran
├── Panel: Debt Details
├── Panel: Payment History
├── Panel: Settings
└── Single User (monitor/monitor123)
```

### New Structure:
```
DebtPilot v2.0
├── Authentication System (3 users, roles)
├── Dashboard (updated for roles)
├── Upload Bukti Bayar (new)
├── Transaksi Panel (new, AIM only)
├── Laporan Panel (new, updated)
├── Old Panels (Debt Details, History - optional keep/remove)
└── Settings (role-based)
```

---

## 🗂️ New Data Models

### User Model:
```javascript
{
  id: 'user-001',
  username: 'abi',
  password: 'abdulhadi', // Hash in production
  role: 'user', // 'admin' or 'user'
  createdAt: '2026-06-11'
}
```

### Upload Model:
```javascript
{
  id: 'upload-001',
  userId: 'user-001',
  username: 'abi',
  imageId: 'img-001', // Reference to IndexedDB
  nominal: 500000,
  status: 'pending', // 'pending', 'approved'
  uploadedAt: '2026-06-11T10:30:00Z',
  approvedBy: null, // AIM username
  approvedAt: null
}
```

### Transaksi Model:
```javascript
{
  id: 'txn-001',
  uploadId: 'upload-001',
  platform: 'Bank Jago', // Selected by AIM
  keterangan: 'Transfer untuk cicilan',
  status: 'pending', // 'pending', 'approved', 'reported'
  createdAt: '2026-06-11T10:30:00Z',
  approvedAt: null,
  approvedBy: 'aim'
}
```

### Laporan Model:
```javascript
{
  id: 'laporan-001',
  tanggal: '2026-06-11', // Auto
  platform: 'Bank Jago', // From Transaksi
  nota: 'img-001', // Image reference
  nominal: 500000, // From Upload
  keterangan: 'Transfer untuk cicilan' // From Transaksi
}
```

---

## 💾 Storage Implementation

### Option 1: IndexedDB (Recommended)
```javascript
// Database: debtpilot-db
// Stores:
- users (small, metadata)
- uploads (images + metadata)
- transaksi (transaction records)
- laporan (report data)
- images (binary image data, compressed)
```

**Pros:**
- ✅ Larger storage (50MB+ available)
- ✅ Better for binary data
- ✅ Async operations
- ✅ Structured queries

**Cons:**
- ❌ More complex to implement

### Option 2: File System API (Modern)
```javascript
// If available in browser
// Create directory structure:
/uploads/abi/images/img-001.jpg
/uploads/abi/compressed/img-001.jpg
/data/transactions.json
```

**Pros:**
- ✅ Direct file access
- ✅ Organized structure

**Cons:**
- ❌ Limited browser support
- ❌ Permission issues

### **Recommendation: Use IndexedDB for images + localStorage for metadata**

---

## 🖼️ Image Compression Strategy

### Implementation:
```javascript
// Before storage:
1. Upload image (any size)
2. Detect format (jpeg, png, etc)
3. Resize to max 800x600px
4. Compress quality (85%)
5. Convert to WebP if supported
6. Save to IndexedDB
7. Store reference in localStorage

// Size optimization:
- Original: 2-5MB (typical phone photo)
- Compressed: 200-500KB
- IndexedDB allocation: ~50MB per origin
- Can store ~100 compressed images
```

---

## 📱 UI/UX Changes

### Navigation (Before/After Role):

**AIM Login:**
```
Sidebar:
├── Dashboard
├── Upload Bukti Bayar
├── Transaksi (AIM Only)
├── Laporan
└── Settings
```

**ABI/UMI Login:**
```
Sidebar:
├── Dashboard
├── Upload Bukti Bayar
├── Laporan (Read-only)
└── Settings
```

### Upload Panel Flow:
```
1. User select image
2. Image preview
3. Input nominal
4. Submit button (disabled until nominal filled)
5. Confirmation
6. Success toast
7. Data saved to IndexedDB
```

### Transaksi Panel (AIM Only):
```
1. List of pending uploads (card/table)
2. Each item shows:
   - User name
   - Image thumbnail
   - Nominal
   - Keterangan field (empty)
   - Platform dropdown
   - Save button
3. After save → mark as "approved"
```

### Laporan Panel:
```
1. Table with 5 columns
2. Data from approved transaksi
3. For AIM: Edit capability
4. For Others: Read-only
5. Export to PDF (future)
```

---

## 🔐 Security Considerations

### Password Handling:
```javascript
// Current: Plaintext (for demo)
// Production: Should hash with bcrypt

// For now (demo):
const users = [
  { username: 'abi', password: 'abdulhadi', role: 'user' },
  { username: 'umi', password: 'rohmah', role: 'user' },
  { username: 'aim', password: 'hafandi', role: 'admin' }
];

// Validate on login:
if (username === user.username && password === user.password) {
  // Login success
}
```

### Image Security:
```javascript
// Validate image:
- Check file type (only jpg, png, webp)
- Check file size (max 5MB)
- Check image dimensions (max 4000x4000)
- Sanitize filename
```

---

## 📊 Implementation Phases

### Phase 1: Authentication (1-2 hours)
- [ ] Create user model
- [ ] Implement login system (3 users)
- [ ] Session management
- [ ] Update UI based on role
- [ ] Test all login combinations

### Phase 2: Upload Feature (2-3 hours)
- [ ] Image upload input
- [ ] Image compression logic
- [ ] IndexedDB setup
- [ ] Upload model creation
- [ ] Data persistence
- [ ] UI for upload panel
- [ ] Validation

### Phase 3: Transaksi Panel (2-3 hours)
- [ ] AIM-only access control
- [ ] List pending uploads
- [ ] Platform dropdown
- [ ] Keterangan input
- [ ] Approve/save logic
- [ ] UI for transaksi panel
- [ ] Validation

### Phase 4: Laporan Panel (2-3 hours)
- [ ] Table creation
- [ ] Data population from transaksi
- [ ] Role-based access (read-only for users)
- [ ] Edit capability for AIM
- [ ] Image thumbnail display
- [ ] Format tanggal (DD Bulan YYYY)
- [ ] UI styling

### Phase 5: Testing & Refinement (2-3 hours)
- [ ] Test all roles
- [ ] Test image upload/compression
- [ ] Test data flow
- [ ] Edge cases
- [ ] Error handling
- [ ] Performance

**Total Estimated Time: 10-15 hours**

---

## 🔄 Data Flow Diagram

```
User Upload Image
    ↓
[Upload Panel]
    ↓
Select image + Input nominal
    ↓
Validate & Compress
    ↓
Save to IndexedDB
    ↓
[Transaksi Panel] (AIM only)
    ↓
Select Platform + Input Keterangan
    ↓
Mark as "approved"
    ↓
[Laporan Panel]
    ↓
Display in Table (5 columns)
    ↓
For AIM: Can edit
For Others: Read-only
```

---

## 🎯 Next Steps

### Before GitHub Push:
1. ✅ Create detailed spec for each panel
2. ✅ Design database schema
3. ✅ Plan image compression strategy
4. ✅ Create wireframes/mockups

### Implementation Order:
1. **Step 1:** Update authentication system (3 users, roles)
2. **Step 2:** Create upload panel + image compression
3. **Step 3:** Create transaksi panel (AIM only)
4. **Step 4:** Create laporan panel
5. **Step 5:** Test all features
6. **Step 6:** Push to GitHub
7. **Step 7:** Deploy to Netlify

### Code Structure:
```
app.js refactoring needed:
├── Auth module (user management, session)
├── Upload module (image handling, compression)
├── Transaksi module (transaction management)
├── Laporan module (report generation)
├── Storage module (IndexedDB operations)
└── UI module (role-based rendering)
```

---

## 📋 Summary

| Item | Detail |
|------|--------|
| **Effort** | 10-15 hours development |
| **Complexity** | Medium-High |
| **New Features** | Upload, Transaksi, Laporan, Multi-user |
| **Breaking Changes** | Yes (auth system, data model) |
| **Database Change** | Add IndexedDB for images |
| **Storage Impact** | +50MB potential usage |
| **Backward Compat** | No (migrate data needed) |

---

## ⚠️ Important Considerations

1. **Storage Limits:**
   - localStorage: ~5-10MB
   - IndexedDB: ~50MB+
   - Total available: ~50MB per origin

2. **Image Compression:**
   - Need to implement canvas-based compression
   - Use sharp.js alternative (lightweight)
   - Or use native browser compression

3. **Data Migration:**
   - Old demo data needs migration
   - Or start fresh with new schema

4. **Security:**
   - Passwords should be hashed in production
   - Image validation important
   - CORS considerations for deployment

---

**Status:** Ready for Implementation ✅  
**Estimated Duration:** 10-15 hours  
**Complexity:** Medium-High  
**Start Date:** Ready anytime

Proceed with implementation? 🚀
