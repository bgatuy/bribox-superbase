// ====== Trackmate (Supabase-Ready, Meta Reuse, Stable TTD) ======

async function sha256File(file) {
  try {
    const buf = await file.arrayBuffer();
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
  } catch {
    // fallback kalau SubtleCrypto gak ada
    return `fz_${file.size}_${file.lastModified}_${Math.random().toString(36).slice(2,10)}`;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const title = document.querySelector('.dashboard-header h1')?.textContent?.toLowerCase() || "";
  const body = document.body;
  if (title.includes('trackmate'))      body.setAttribute('data-page', 'trackmate');
  else if (title.includes('appsheet'))  body.setAttribute('data-page', 'appsheet');
  else if (title.includes('serah'))     body.setAttribute('data-page', 'serah');
  else if (title.includes('merge'))     body.setAttribute('data-page', 'merge');
  if (typeof initSidebar === 'function') initSidebar();  
  if (typeof initLogoutButton === 'function') initLogoutButton();
  if (typeof initAdminFeatures === 'function') initAdminFeatures();
  // Setup field lokasi (input + datalist, lazy populate)
  setupLokasiWithSearch();
});

/* ========= Query DOM ========= */
const fileInput    = document.getElementById('pdfFile');
const output       = document.getElementById('output');
const copyBtn      = document.getElementById('copyBtn');
const lokasiSelect = document.getElementById('inputLokasi');
const lokasiSearch = document.getElementById('lokasiSearch');

// Daftar lokasi (dipakai untuk Trackmate & Appsheet; salin dari HTML asli)
const LOCATIONS = [
  "BRI 1 Lt. Split","BRI 1 Lt. 2","BRI 1 Lt. 3","BRI 1 Lt. 4","BRI 1 Lt. 5","BRI 1 Lt. 6","BRI 1 Lt. 7","BRI 1 Lt. 8","BRI 1 Lt. 9","BRI 1 Lt. 10","BRI 1 Lt. 11","BRI 1 Lt. 12","BRI 1 Lt. 13","BRI 1 Lt. 14","BRI 1 Lt. 15","BRI 1 Lt. 16","BRI 1 Lt. 17","BRI 1 Lt. 18","BRI 1 Lt. 19","BRI 1 Lt. 20",
  "BRI 2 Lt. Basement","BRI 2 Lt. 2","BRI 2 Lt. 3","BRI 2 Lt. 4","BRI 2 Lt. 5","BRI 2 Lt. 6","BRI 2 Lt. 7","BRI 2 Lt. 8","BRI 2 Lt. 9","BRI 2 Lt. 10","BRI 2 Lt. 11","BRI 2 Lt. 12","BRI 2 Lt. 13","BRI 2 Lt. 14","BRI 2 Lt. 15","BRI 2 Lt. 16","BRI 2 Lt. 17","BRI 2 Lt. 18","BRI 2 Lt. 19","BRI 2 Lt. 20","BRI 2 Lt. 21","BRI 2 Lt. 22","BRI 2 Lt. 23","BRI 2 Lt. 24","BRI 2 Lt. 25","BRI 2 Lt. 26","BRI 2 Lt. 27","BRI 2 Lt. 28","BRI 2 Lt. 29","BRI 2 Lt. 30","BRI 2 Lt. 31",
  "Gd. Parkir BRI Lt. 1","Gd. Parkir BRI Lt. 5","Gd. Parkir BRI Lt. 8",
  "Menara Brilian Lt. 5","Menara Brilian Lt. 8","Menara Brilian Lt. 9","Menara Brilian Lt. 26","Menara Brilian Lt. 27","Menara Brilian Lt. 28","Menara Brilian Lt. 29","Menara Brilian Lt. 30","Menara Brilian Lt. 31","Menara Brilian Lt. 32","Menara Brilian Lt. 33","Menara Brilian Lt. 37","Menara Brilian Lt. 40",
  "PSCF Ragunan Lt. 1","PSCF Ragunan Lt. 2","PSCF Ragunan Lt. 3",
  "GTI Ragunan Lt. 5","GTI Ragunan Lt. 6","GTI Ragunan Lt. 7","GTI Ragunan Lt. 8"
];

function populateLokasi(select, list){
  if (!select) return;
  // sisakan placeholder di index 0
  select.innerHTML = '<option value="">-- Pilih Lokasi --</option>';
  const frag = document.createDocumentFragment();
  for (const name of list){
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    frag.appendChild(opt);
  }
  select.appendChild(frag);
}

function setupLokasiWithSearch(){
  if (!lokasiSelect) return;
  // Mode INPUT + DATALIST
  if (lokasiSelect.tagName === 'INPUT'){
    // Matikan datalist native agar UI konsisten
    const listId = lokasiSelect.getAttribute('list');
    if (listId){ try{ document.getElementById(listId)?.remove(); }catch{}; lokasiSelect.removeAttribute('list'); }
    attachCombo(lokasiSelect, LOCATIONS);
    return;
  }
  // Fallback: SELECT + optional external search input (hampir tidak terpakai sekarang)
  let populated = false;
  const ensure = ()=>{ if(populated) return; populated = true; populateLokasi(lokasiSelect, LOCATIONS); };
  ['focus','mousedown','touchstart','keydown'].forEach(ev=> lokasiSelect.addEventListener(ev, ensure, { once:true }));
  if (lokasiSearch){
    lokasiSearch.addEventListener('input', ()=>{
      ensure();
      const term = (lokasiSearch.value||'').toLowerCase();
      const filtered = term ? LOCATIONS.filter(n=> n.toLowerCase().includes(term)) : LOCATIONS;
      const current = lokasiSelect.value;
      populateLokasi(lokasiSelect, filtered);
      if (filtered.includes(current)) lokasiSelect.value = current;
    });
  }
}

function attachCombo(input, items){
  const popup = document.createElement('div');
  popup.className = 'combo-popup';
  popup.hidden = true;
  input.parentElement?.appendChild(popup);

  let filtered = items.slice();
  let active = -1;
  let isOpen = false;
  let hideTimer = null;
  const render = ()=>{
    popup.innerHTML = filtered.map((n,i)=>`<div class="combo-item${i===active?' active':''}" data-val="${n}">${n}</div>`).join('');
  };
  const open = ()=>{
    if (isOpen && !popup.hidden) return;
    filtered = filter(input.value); active = -1; render();
    try {
      popup.style.width = input.offsetWidth + 'px';
      popup.style.left  = input.offsetLeft + 'px';
      popup.style.top   = (input.offsetTop + input.offsetHeight + 4) + 'px';
    } catch {}
    popup.hidden = false;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    requestAnimationFrame(()=> popup.classList.add('is-visible'));
    isOpen = true;
  };
  const close = ()=>{
    if (!isOpen) return;
    isOpen = false;
    popup.classList.remove('is-visible');
    hideTimer = window.setTimeout(()=>{ if(!isOpen) popup.hidden = true; }, 220);
  };
  const filter = (q)=>{ q=(q||'').toLowerCase(); return q? items.filter(n=> n.toLowerCase().includes(q)) : items; };
  const ensureOpen = ()=>{ if (!isOpen) open(); };

  input.addEventListener('focus', open);
  input.addEventListener('click', ()=>{ if(!isOpen) open(); });
  input.addEventListener('input', ()=>{
    filtered = filter(input.value); active = -1; render();
    ensureOpen();
  });
  input.addEventListener('keydown', (e)=>{
    if (!isOpen && (e.key==='ArrowDown' || e.key==='Enter')) { open(); e.preventDefault(); return; }
    if (!isOpen) return;
    if (e.key==='ArrowDown'){ active = Math.min(filtered.length-1, active+1); render(); e.preventDefault(); }
    else if (e.key==='ArrowUp'){ active = Math.max(0, active-1); render(); e.preventDefault(); }
    else if (e.key==='Enter'){
      if (active>=0 && filtered[active]){ input.value = filtered[active]; input.dispatchEvent(new Event('change',{bubbles:true})); close(); e.preventDefault(); }
    } else if (e.key==='Escape'){ close(); }
  });
  popup.addEventListener('mousedown', (e)=>{
    const item = e.target.closest('.combo-item'); if(!item) return;
    const val = item.getAttribute('data-val')||''; input.value = val; input.dispatchEvent(new Event('change',{bubbles:true})); close();
  });
  document.addEventListener('click', (e)=>{ if(isOpen && !popup.contains(e.target) && e.target!==input) close(); });
}

// Debounce flag untuk mencegah double-upload di mobile
let isUploading = false;

// Upload helper dengan 1x retry untuk kasus network error (mobile)
async function uploadWithRetry(filePath, file, options = {}) {
  const bucket = supabaseClient.storage.from('pdf-forms');

  const tryBlob = () => bucket.upload(filePath, file, options);
  const tryArrayBuffer = async () => {
    const buf = await file.arrayBuffer();
    return bucket.upload(filePath, buf, options);
  };

  // 1) Coba langsung pakai File/Blob
  let res = await tryBlob();
  if (res?.error && /failed to fetch|network/i.test(res.error.message || '')) {
    // 2) Backoff lalu ulang (Blob)
    await new Promise(r => setTimeout(r, 500));
    res = await tryBlob();
  }
  if (res?.error && /failed to fetch|network/i.test(res.error.message || '')) {
    // 3) Fallback: kirim sebagai ArrayBuffer (beberapa browser HP lebih stabil)
    await new Promise(r => setTimeout(r, 400));
    res = await tryArrayBuffer();
  }
  return res;
}

/* ========= Supabase helpers ========= */
async function getUserOrThrow() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error || !session?.user) throw new Error('User tidak login.');
  return session.user;
}

async function getMetaByHash(contentHash) {
  try {
    const user = await getUserOrThrow();
    const { data, error } = await supabaseClient
      .from('pdf_history')
      .select('meta')
      .eq('user_id', user.id)
      .eq('content_hash', contentHash)
      .maybeSingle();
    if (error) return null;
    return data?.meta || null;
  } catch {
    return null;
  }
}

/* === AUTO-CALIBRATE: cari anchor "Diselesaikan Oleh," dan "Nama & Tanda Tangan" ===
   NOTE: sudah DI-PATCH supaya tidak pakai offset mati +95, tapi kunci kolom yang sama */
async function autoCalibratePdf(buffer){
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await doc.getPage(1);
  const items = (await page.getTextContent()).items || [];

  // "Diselesaikan Oleh," (kolom tengah)
  let atas = items.find(it => /Diselesaikan\s*Oleh/i.test(it.str));
  if(!atas){
    for(let i=0;i<items.length-1;i++){
      if(/Diselesaikan/i.test(items[i].str) && /Oleh/i.test(items[i+1].str)){ atas = items[i]; break; }
    }
  }
  if (!atas){ try{doc.destroy()}catch{}; return null; }

  const xA = atas.transform[4], yA = atas.transform[5];

  // "Nama & Tanda Tangan" di bawahnya yang sekolom
  const kandidat = items.filter(it =>
    /Nama\s*&?\s*Tanda\s*&?\s*Tangan/i.test(it.str) && it.transform && it.transform[5] < yA
  );
  let bawah=null, best=Infinity;
  for(const it of kandidat){
    const x = it.transform[4], y = it.transform[5];
    const dx=Math.abs(x-xA), dy=Math.max(0,yA-y);
    const score = 1.6*dx + dy;
    if (dx <= 120 && score < best){ best = score; bawah = it; }
  }

  // PATCHED: titik dasar (x,y) untuk nama — kunci kolom, hindari angka paten
  let x = xA + 95;
  let y = bawah ? (bawah.transform[5] + 12) : (yA - 32);

  // (opsional) info baris UK & SOLUSI – bisa dipakai nanti, tidak wajib
  const first = r => items.find(it => r.test(it.str));
  const labUK = first(/Unit\s*Kerja/i), labKC = first(/Kantor\s*Cabang/i);
  let linesUK = 0;
  if (labUK && labKC){
    const yTop = labUK.transform[5], yBot = labKC.transform[5]-1;
    const xL = labUK.transform[4] + 40, xR = xL + 260;
    const ys=[];
    for(const it of items){
      if(!it.transform) continue;
      const x0=it.transform[4], y0=it.transform[5];
      if (y0<=yTop+2 && y0>=yBot-2 && x0>=xL && x0<=xR){
        const yy = Math.round(y0/2)*2;
        if(!ys.some(v=>Math.abs(v-yy)<2)) ys.push(yy);
      }
    }
    linesUK = Math.max(1, Math.min(5, ys.length||0));
  }

  const labSol = first(/Solusi\/?Perbaikan/i), labStatus = first(/Status\s*Pekerjaan/i);
  let linesSOL = 0;
  if (labSol && labStatus){
    const yTop = labSol.transform[5] + 1, yBot = labStatus.transform[5] + 2;
    const xL = labSol.transform[4] + 120, xR = xL + 300;
    const ys=[];
    for(const it of items){
      if(!it.transform) continue;
      const x0=it.transform[4], y0=it.transform[5];
      if (y0>=yBot && y0<=yTop && x0>=xL && x0<=xR){
        const yy = Math.round(y0/2)*2;
        if(!ys.some(v=>Math.abs(v-yy)<2)) ys.push(yy);
      }
    }
    linesSOL = Math.max(1, Math.min(6, ys.length||0));
  }

  try{ doc.destroy() }catch{}
  return { x, y, linesUK, linesSOL, dx:0, dy:0, v:1 };
}

/* ========= Helpers ========= */
const clean = (x) => String(x || '')
  .replace(/[\u00A0\u2007\u202F]/g, ' ')  // NBSP family -> spasi biasa
  .replace(/\u00C2/g, '')                 // buang 'Â' sisa decode
  .replace(/\s+/g, ' ')
  .trim();
function stripLeadingColon(s) { return (s || '').replace(/^\s*:+\s*/, ''); }
function formatTanggalIndonesia(tanggal) {
  if (!tanggal) return '-';
  const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const [dd, mm, yyyy] = tanggal.split('/');
  return `${dd} ${bulan[parseInt(mm,10)-1]} ${yyyy}`;
}
function extractFlexibleBlock(lines, startLabel, stopLabels = []) {
  const norm = s => (s || '')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')   // NBSP family -> space
    .replace(/\s+/g, ' ')
    .trim();

  const text = (lines || []).map(x => x || '').join('\n');

  const startRe = new RegExp(`${startLabel}\\s*:\\s*`, 'i');
  const mStart  = startRe.exec(text);
  if (!mStart) return '';

  const tail = text.slice(mStart.index + mStart[0].length);

  const stopParts = [];
  for (const lbl of stopLabels) stopParts.push(`${lbl}\\s*:\\s*`);
  if (stopLabels.some(s => /^tanggal$/i.test(s))) {
    stopParts.push(`Tanggal(?:\\s*Tiket)?\\s+\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}`);
  }
  if (stopLabels.some(s => /^kantor\\s*cabang$/i.test(s))) {
    stopParts.push(`(?<!^)Kantor\\s*Cabang(?!\\s*:)`);
  }
  stopParts.push(`[\\r\\n]+[A-Za-z][A-Za-z/() ]+\\s*:\\s*`);

  const stopPattern = stopParts.join('|');
  const cutRe = new RegExp(`([\\s\\S]*?)(?=${stopPattern})`, 'i');
  const mCut  = cutRe.exec(tail);
  const captured = mCut ? mCut[1] : tail;

  return norm(captured);
}

/* ========= State ========= */
let unitKerja = "-", kantorCabang = "-", tanggalFormatted = "-", tanggalRaw = "",
    problem = "-", berangkat = "-", tiba = "-", mulai = "-", selesai = "-",
    solusi = "-", jenisPerangkat = "-", serial = "-", merk = "-", type = "-",
    pic = "-", status = "-";

/* ========= Events ========= */
lokasiSelect?.addEventListener("change", updateOutput);

fileInput?.addEventListener('change', async function () {
  const file = fileInput.files[0];
  if (!file || file.type !== 'application/pdf') return;

  const reader = new FileReader();
  reader.onload = async function () {
    try {
      const typedarray = new Uint8Array(reader.result);
      const pdf = await pdfjsLib.getDocument(typedarray).promise;

      let rawText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        rawText += content.items.map(item => item.str).join('\n') + '\n';
      }

      const lines = rawText.split('\n');

      unitKerja       = stripLeadingColon(extractFlexibleBlock(lines,'Unit Kerja',['Kantor Cabang','Tanggal']) || '-');
      kantorCabang    = stripLeadingColon(extractFlexibleBlock(lines,'Kantor Cabang',['Tanggal','Pelapor']) || '-');
      tanggalRaw      = rawText.match(/Tanggal(?:\sTiket)?\s*:\s*(\d{2}\/\d{2}\/\d{4})/)?.[1] || '';
      tanggalFormatted= tanggalRaw ? formatTanggalIndonesia(tanggalRaw) : '-';
      problem         = extractFlexibleBlock(lines,'Trouble Dilaporkan',['Masalah','Solusi','Progress']) || '-';

      const ambilJam = (text, label) => text.match(new RegExp(`${label}\\s+(\\d{2}:\\d{2})(?::\\d{2})?`))?.[1] || '';
      berangkat = ambilJam(rawText, 'Berangkat') || '-';
      tiba      = ambilJam(rawText, 'Tiba') || '-';
      mulai     = ambilJam(rawText, 'Mulai') || '-';
      selesai   = ambilJam(rawText, 'Selesai') || '-';

      solusi          = extractFlexibleBlock(lines,'Solusi/Perbaikan',['STATUS','Jenis Perangkat','SN','Merk','Type']) || '-';
      jenisPerangkat  = clean(rawText.match(/Jenis Perangkat\s*:\s*(.+)/)?.[1]) || '-';
      serial          = clean(rawText.match(/SN\s*:\s*(.+)/)?.[1]) || '-';
      merk            = clean(rawText.match(/Merk\s*:\s*(.+)/)?.[1]) || '-';
      type            = clean(rawText.match(/Type\s*:\s*(.+)/)?.[1]) || '-';
      (() => {
        const stops = [
          'Jabatan','Jenis Perangkat','Serial Number','SN','Merk','Type',
          'Status','STATUS','Tanggal','Nama','Tanda','Cap','Progress',
          'Unit Kerja','Kantor Cabang'
        ];
        const block = extractFlexibleBlock(lines, '(?:Pelapor|PIC)', stops) || '';
        const m = block.match(/^\s*([^()\[\]\n]+?)\s*(?:[\(\[]\s*([^()\[\]]+?)\s*[\)\]])?\s*$/);
        const name = clean(m ? m[1] : block);
        const jab  = clean(m && m[2] ? m[2] : extractFlexibleBlock(lines, 'Jabatan', stops) || '');
        pic = jab ? `${name} (${jab})` : (name || '-');
      })();

      status = clean(rawText.match(/STATUS PEKERJAAN\s*:\s*(.+)/)?.[1]) || '-';

      updateOutput();
    } catch (err) {
      console.error("Gagal memproses PDF:", err);
      alert("Terjadi kesalahan saat membaca PDF.");
    }
  };
  reader.readAsArrayBuffer(file);
});

/* ========= Output ========= */
function updateOutput() {
  const lokasiTerpilih = lokasiSelect?.value || '';
  const unitKerjaLengkap = (lokasiTerpilih && unitKerja !== '-') ? `${unitKerja} (${lokasiTerpilih})` : unitKerja;

  const finalOutput =
`Selamat Pagi/Siang/Sore Petugas Call Center, Update Pekerjaan

Unit Kerja : ${unitKerjaLengkap}
Kantor Cabang : ${kantorCabang}

Tanggal : ${tanggalFormatted}

Jenis Pekerjaan (Problem) : ${problem}

Berangkat : ${berangkat}
Tiba : ${tiba}
Mulai : ${mulai}
Selesai : ${selesai}

Progress : ${solusi}

Jenis Perangkat : ${jenisPerangkat}
Serial Number : ${serial}
Merk Perangkat : ${merk}
Type Perangkat : ${type}

PIC : ${pic}
Status : ${status}`;

  if (output) output.textContent = finalOutput;
}

/* ========= Copy & Save Histori (single final toast) ========= */
copyBtn?.addEventListener("click", async () => {
  try {
    if (isUploading) return; // cegah trigger ganda
    isUploading = true;
    if (copyBtn) copyBtn.disabled = true;
    showSpinner?.(); // <-- TAMPILKAN SPINNER DI AWAL
    // 1) Copy teks ke clipboard
    const text = output?.textContent || "";
    await navigator.clipboard.writeText(text);
    if (copyBtn) {
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    }

    // 2) Validasi file
    const file = fileInput?.files?.[0];
    if (!file) {
      showToast?.("Tidak ada file PDF yang dipilih.", 3500, "warn");
      // Jangan lupa sembunyikan spinner dan reset state jika ada error di awal
      isUploading = false;
      if (copyBtn) copyBtn.disabled = false;
      hideSpinner?.();
      return;
    }

    // 3) Persiapan data untuk Supabase
    const contentHash = await sha256File(file);
    const user = await getUserOrThrow();
    const filePath = `${user.id}/${contentHash}.pdf`;

    // 4) Upload file ke Supabase Storage (idempotent by path)
    const { error: uploadError } = await uploadWithRetry(
      filePath,
      file,
      { upsert: true, contentType: file.type || 'application/pdf' }
    );
    if (uploadError) throw new Error(`Upload gagal: ${uploadError.message}`);

    // 5) META: coba reuse dulu kalau hash ini sudah pernah ada
    let meta = await getMetaByHash(contentHash);
    if (!meta) {
      // Kalau belum ada → kalibrasi baru (pakai rumus patched)
      meta = await autoCalibratePdf(await file.arrayBuffer()).catch(err => {
        console.warn("Gagal auto-calibrate PDF:", err);
        return null;
      });
    }

    // 6) Simpan semua info ke database Supabase (COMPOSITE KEY!)
    const namaUkerBersih = stripLeadingColon(unitKerja) || "-";
    const payload = {
      user_id: user.id,                  // <— WAJIB, composite
      content_hash: contentHash,         // <— WAJIB, composite
      nama_uker: namaUkerBersih,
      tanggal_pekerjaan: tanggalRaw || null,
      file_name: file.name,
      storage_path: filePath,
      size_bytes: file.size,
      meta: meta || null                 // bisa null, fallback di sisi generator
    };

    // FIX: Lakukan Cek-dan-Update/Insert manual untuk menghindari error 'no unique constraint'
    const { data: existing, error: checkError } = await supabaseClient
      .from('pdf_history')
      .select('content_hash')
      .eq('user_id', user.id)
      .eq('content_hash', contentHash)
      .maybeSingle();

    const dbQuery = existing ? supabaseClient.from('pdf_history').update(payload).eq('user_id', user.id).eq('content_hash', contentHash) : supabaseClient.from('pdf_history').insert(payload);
    const { error: dbError } = await dbQuery;
    if (dbError) throw new Error(`Simpan DB gagal: ${dbError.message}`);

    showToast?.("Berhasil disimpan ke server.", 3000, "success");
  } catch (err) {
    console.error("Copy handler error:", err);
    const msg = String(err?.message || err || '').trim();
    if (/failed to fetch/i.test(msg)) {
      showToast?.("Upload gagal: koneksi ke Supabase Storage terputus/terblokir. Coba matikan VPN/Private DNS/Ad-block, gunakan Wi‑Fi yang sama dengan laptop, atau coba ulang.", 6000, 'warn');
    } else {
      showToast?.(`Error: ${msg}`, 5000, "warn");
    }
  } finally {
    isUploading = false;
    if (copyBtn) copyBtn.disabled = false;
    hideSpinner?.(); // <-- SEMBUNYIKAN SPINNER DI AKHIR (baik sukses maupun gagal)
  }
});
