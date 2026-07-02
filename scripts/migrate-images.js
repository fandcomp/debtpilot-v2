/**
 * Migrasi satu kali: pindahkan gambar base64 di app_state (Supabase)
 * ke bucket Storage 'payment-proofs', lalu ganti field-nya dengan URL.
 *
 * Prasyarat: bucket 'payment-proofs' sudah dibuat (lihat SUPABASE_SETUP.md).
 * Jalankan:  node scripts/migrate-images.js
 * Dry run:   node scripts/migrate-images.js --dry-run
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wubbbjqqdowuqxjpmqpt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_1VZ6iZWdGiJX_jQCELROIA_kKPuZ9dh';
const BUCKET = 'payment-proofs';
const USER_ID = 'default-user';
const DRY_RUN = process.argv.includes('--dry-run');

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image');
}

async function uploadDataUrl(dataUrl, path) {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.*)$/s);
  if (!match) throw new Error(`Bukan data URL gambar yang valid: ${path}`);
  const [, contentType, base64] = match;
  const body = Buffer.from(base64, 'base64');

  if (DRY_RUN) {
    console.log(`  [dry-run] akan upload ${path} (${Math.round(body.length / 1024)}KB)`);
  } else {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': contentType, 'x-upsert': 'true' },
      body,
    });
    if (!res.ok) throw new Error(`Upload ${path} gagal: HTTP ${res.status} ${await res.text()}`);
    console.log(`  ✅ upload ${path} (${Math.round(body.length / 1024)}KB)`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function main() {
  console.log(`Mengambil app_state (user_id=${USER_ID})...`);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/app_state?user_id=eq.${USER_ID}&select=*`,
    { headers: HEADERS },
  );
  if (!res.ok) throw new Error(`Gagal mengambil app_state: HTTP ${res.status}`);
  const rows = await res.json();
  if (!rows.length) throw new Error('Row app_state tidak ditemukan.');

  const state = rows[0].state;
  const sizeBefore = JSON.stringify(state).length;
  let migrated = 0;

  for (const upload of state.uploads || []) {
    if (isDataUrl(upload.imageThumbnail)) {
      const url = upload.imageUrl || (await uploadDataUrl(upload.imageThumbnail, `migrated/upload-${upload.id}.jpg`));
      upload.imageUrl = url;
      upload.imageThumbnail = url;
      migrated += 1;
    }
  }

  for (const item of state.laporan || []) {
    if (isDataUrl(item.nota)) {
      const url = item.imageUrl || (await uploadDataUrl(item.nota, `migrated/laporan-${item.id}.jpg`));
      item.nota = url;
      item.imageUrl = url;
      migrated += 1;
    }
  }

  for (const proof of state.debtProofs || []) {
    if (isDataUrl(proof.image)) {
      proof.image = await uploadDataUrl(proof.image, `migrated/proof-${proof.id}.jpg`);
      migrated += 1;
    }
  }

  const sizeAfter = JSON.stringify(state).length;
  console.log(`\nGambar dimigrasikan: ${migrated}`);
  console.log(`Ukuran state: ${Math.round(sizeBefore / 1024)}KB -> ${Math.round(sizeAfter / 1024)}KB`);

  if (DRY_RUN) {
    console.log('[dry-run] app_state TIDAK diubah.');
    return;
  }
  if (migrated === 0) {
    console.log('Tidak ada yang perlu dimigrasikan.');
    return;
  }

  const patch = await fetch(`${SUPABASE_URL}/rest/v1/app_state?user_id=eq.${USER_ID}`, {
    method: 'PATCH',
    headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ state, updated_at: new Date().toISOString() }),
  });
  if (!patch.ok) throw new Error(`Gagal menyimpan app_state: HTTP ${patch.status} ${await patch.text()}`);
  console.log('✅ app_state diperbarui. Migrasi selesai.');
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
