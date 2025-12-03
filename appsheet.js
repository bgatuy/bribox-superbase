// ===== AppSheet =====

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
  try { setupLokasiField(); } catch {}
});

/* ========= Query DOM ========= */
const pdfInput     = document.getElementById("pdfFile");
const output       = document.getElementById("output");
const copyBtn      = document.getElementById("copyBtn");
const lokasiSelect = document.getElementById("inputLokasi");
let lokasiSearch = null;

// Daftar lokasi (sinkron dengan Trackmate)
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
  select.innerHTML = '<option value="">-- Pilih Lokasi --</option>';
  const frag = document.createDocumentFragment();
  for (const name of list){
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    frag.appendChild(opt);
  }
  select.appendChild(frag);
}

function setupLokasiField(){
  if (!lokasiSelect) return;
  if (lokasiSelect.tagName === 'INPUT'){
    const listId = lokasiSelect.getAttribute('list');
    if (listId){ try{ document.getElementById(listId)?.remove(); }catch{}; lokasiSelect.removeAttribute('list'); }
    attachCombo(lokasiSelect, LOCATIONS);
    return;
  }
  // Fallback (SELECT)
  let populated = false;
  const ensure = ()=>{ if(populated) return; populated = true; populateLokasi(lokasiSelect, LOCATIONS); };
  ['focus','mousedown','touchstart','keydown'].forEach(ev=> lokasiSelect.addEventListener(ev, ensure, { once:true }));
}

function attachCombo(input, items){
  const popup = document.createElement('div');
  popup.className = 'combo-popup';
  popup.hidden = true;
  input.parentElement?.appendChild(popup);

  let filtered = items.slice();
  let active = -1;
  const render = ()=>{
    popup.innerHTML = filtered.map((n,i)=>`<div class="combo-item${i===active?' active':''}" data-val="${n}">${n}</div>`).join('');
  };
  const open = ()=>{
    filtered = filter(input.value); active = -1; render();
    try {
      popup.style.width = input.offsetWidth + 'px';
      popup.style.left  = input.offsetLeft + 'px';
      popup.style.top   = (input.offsetTop + input.offsetHeight + 4) + 'px';
    } catch {}
    popup.hidden = false;
  };
  const close = ()=>{ popup.hidden = true; };
  const filter = (q)=>{ q=(q||'').toLowerCase(); return q? items.filter(n=> n.toLowerCase().includes(q)) : items; };

  input.addEventListener('focus', open);
  input.addEventListener('click', ()=>{ if(popup.hidden) open(); });
  input.addEventListener('input', ()=>{ filtered = filter(input.value); active = -1; render(); popup.hidden = false; });
  input.addEventListener('keydown', (e)=>{
    if (popup.hidden && (e.key==='ArrowDown' || e.key==='Enter')) { open(); e.preventDefault(); return; }
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
  document.addEventListener('click', (e)=>{ if(!popup.hidden && !popup.contains(e.target) && e.target!==input) close(); });
}

/* ========= State ========= */
let lokasiTerpilih = "", unitKerja = "-", kantor = "-", tanggal = "-", problem = "-",
    berangkat = "-", tiba = "-", mulai = "-", selesai = "-", progress = "-",
    jenis = "-", sn = "-", merk = "-", tipe = "-", pic = "-", status = "-",
    currentFile = null, currentTanggalRaw = "-";

/* ========= Helpers ========= */
function formatTanggalIndo(tanggalStr) {
  const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const [dd, mm, yyyy] = tanggalStr.split("/");
  return `${dd} ${bulan[parseInt(mm,10)-1]} ${yyyy}`;
}
function ambil(text, regex, fallback = "-") {
  const match = text.match(regex);
  return match?.[1]?.trim() || fallback;
}
function cleanJam(text) {
  if (!text || text === "-") return "-";
  const match = text.match(/\d{2}[.:]\d{2}/);
  return match ? match[0].replace(/\./g, ":") : "-";
}
function stripLeadingColon(s) { return (s || '').replace(/^\s*:+\s*/, ''); }

/* ========= Output ========= */
function generateLaporan() {
  const unitKerjaLengkap = (lokasiTerpilih && unitKerja !== "-") ? `${unitKerja} (${lokasiTerpilih})` : unitKerja;
  const laporanBaru =
`Selamat Pagi/Siang/Sore Petugas Call Center, Update Pekerjaan

Unit Kerja : ${unitKerjaLengkap}
Kantor Cabang : ${kantor}

Tanggal : ${tanggal}

Jenis Pekerjaan (Problem) : ${problem}

Berangkat : ${berangkat}
Tiba : ${tiba}
Mulai : ${mulai}
Selesai : ${selesai}

Progress : ${progress}

Jenis Perangkat : ${jenis}
Serial Number : ${sn}
Merk Perangkat : ${merk}
Type Perangkat : ${tipe}

PIC : ${pic}
Status : ${status}`;
  output.textContent = laporanBaru;
}

lokasiSelect?.addEventListener("change", () => {
  lokasiTerpilih = lokasiSelect.value;
  generateLaporan();
});

/* ========= File Input ========= */
pdfInput?.addEventListener("change", async () => {
  const file = pdfInput.files[0];
  if (!file) return;
  currentFile = file;

  console.log('🧪 File input:', { name: file.name, type: file.type, size: file.size });
  if (file.type !== 'application/pdf' || !file.size) { alert('File bukan PDF valid.'); return; }

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let rawText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    rawText += content.items.map(i => i.str).join(" ") + "\n";
  }
  rawText = rawText.replace(/\s+/g, " ").trim();

  unitKerja = stripLeadingColon(ambil(rawText, /Unit Kerja\s*:\s*(.+?)\s+(Perangkat|Kantor Cabang)/));
  kantor    = ambil(rawText, /Kantor Cabang\s*:\s*(.+?)\s+(Tanggal|Asset ID|Tanggal\/Jam)/);
  const tglRaw = ambil(rawText, /Tanggal\/Jam\s*:\s*(\d{2}\/\d{2}\/\d{4})/);
  currentTanggalRaw = tglRaw;
  tanggal  = tglRaw !== "-" ? formatTanggalIndo(tglRaw) : "-";

  problem  = ambil(rawText, /Trouble Dilaporkan\s*:\s*(.+?)\s+(Solusi|Progress|KETERANGAN)/i);
  if (problem === "-") problem = ambil(rawText, /Problem\s*[:\-]?\s*(.+?)\s+(Solusi|Progress|KETERANGAN)/i);

  berangkat = cleanJam(ambil(rawText, /BERANGKAT\s+(\d{2}[.:]\d{2})/));
  tiba      = cleanJam(ambil(rawText, /TIBA\s+(\d{2}[.:]\d{2})/));
  mulai     = cleanJam(ambil(rawText, /MULAI\s+(\d{2}[.:]\d{2})/));
  selesai   = cleanJam(ambil(rawText, /SELESAI\s+(\d{2}[.:]\d{2})/));

  progress = ambil(rawText, /Solusi\s*\/?\s*Perbaikan\s*:\s*(.+?)\s+(KETERANGAN|Status|$)/i);
  jenis    = ambil(rawText, /Perangkat\s*[:\-]?\s*(.+?)\s+(Kantor Cabang|SN|Asset ID)/i);
  sn       = ambil(rawText, /SN\s*[:\-]?\s*([A-Za-z0-9\-]+)/i);
  tipe     = ambil(rawText, /Type\s*[:\-]?\s*([A-Za-z0-9\s\-]+?)(?=\s+(SN|PW|Status|PIC|$))/i);
  merk     = ambil(rawText, /Merk\s*[:\-]?\s*([A-Za-z]+)/i);

  if ((merk === "-" || !merk) && tipe && tipe !== "-") {
    const t = tipe.toUpperCase();
    if (t.includes("LENOVO")) merk = "LENOVO";
    else if (t.includes("DELL")) merk = "DELL";
    else if (t.includes("HP"))   merk = "HP";
    else if (t.includes("ASUS")) merk = "ASUS";
    else if (t.includes("ACER")) merk = "ACER";
    else if (t.includes("AXIOO")) merk = "AXIOO";
    else if (t.includes("MSI"))   merk = "MSI";
    else if (t.includes("ZYREX")) merk = "ZYREX";
  }

  pic    = ambil(rawText, /Pelapor\s*:\s*(.+?)\s+(Type|Status|$)/);
  if (pic.includes("(")) pic = pic.split("(")[0].trim();
  status = ambil(rawText, /Status Pekerjaan\s*:?\s*(Done|Pending|On\s?Progress|Done By Repairing)/i);

  generateLaporan();
});

/* ========= Copy & Save ========= */
copyBtn?.addEventListener('click', async () => {
  try {
    // 1. Copy teks ke clipboard
    const text = output?.textContent || '';
    await navigator.clipboard.writeText(text);
    if (copyBtn) {
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    }

    // 2. Validasi file
    if (!currentFile || !currentTanggalRaw) {
      showToast("Tidak ada file/tanggal untuk disimpan.", 3000, 'warn');
      return;
    }

    // 3. Persiapan data untuk Supabase
    const contentHash = await sha256File(currentFile);
    // Gunakan getSession() yang lebih andal untuk mendapatkan user ID
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session?.user) throw new Error('User tidak login.');
    const user = session.user;
    const filePath = `${user.id}/${contentHash}.pdf`;

    // 4. Upload file ke Supabase Storage (dengan retry & fallback ArrayBuffer)
    async function uploadWithRetryAB(path, file, options = {}) {
      const bucket = supabaseClient.storage.from('pdf-forms');
      const tryBlob = () => bucket.upload(path, file, options);
      const tryArrayBuffer = async () => bucket.upload(path, await file.arrayBuffer(), options);
      let res = await tryBlob();
      if (res?.error && /failed to fetch|network/i.test(res.error.message || '')) {
        await new Promise(r => setTimeout(r, 500));
        res = await tryBlob();
      }
      if (res?.error && /failed to fetch|network/i.test(res.error.message || '')) {
        await new Promise(r => setTimeout(r, 400));
        res = await tryArrayBuffer();
      }
      return res;
    }
    const { error: uploadError } = await uploadWithRetryAB(filePath, currentFile, { upsert: true, contentType: currentFile.type || 'application/pdf' });
    if (uploadError) throw new Error(`Upload gagal: ${uploadError.message}`);

    // 5. Simpan semua info ke database (tanpa metadata TTD)
    const namaUkerBersih = stripLeadingColon(unitKerja) || '-';
    const payload = {
      // FIX: Pastikan user_id selalu disertakan agar lolos RLS policy.
      user_id: user.id,
      content_hash: contentHash,
      nama_uker: namaUkerBersih,
      tanggal_pekerjaan: currentTanggalRaw,
      file_name: currentFile.name,
      storage_path: filePath,
      size_bytes: currentFile.size,
      meta: null, // PDF dari AppSheet sudah ada nama, tidak perlu meta
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
    if (dbError) throw dbError;

    showToast("Berhasil disimpan ke server.", 3000, "success");
  } catch (err) {
    console.error("Copy/Save Error:", err);
    const msg = String(err?.message || err || '').trim();
    if (/failed to fetch/i.test(msg)) {
      showToast("Upload gagal: koneksi ke Supabase Storage terputus/terblokir. Coba matikan VPN/Private DNS/Ad-block, gunakan Wi‑Fi yang sama dengan laptop, atau coba ulang.", 6000, 'warn');
    } else {
      showToast(`Gagal menyimpan: ${msg}`, 4500, 'warn');
    }
  } finally {
  }
});
