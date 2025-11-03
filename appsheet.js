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
  if (typeof initAdminFeatures === 'function') initAdminFeatures();
  if (typeof initLogoutButton === 'function') initLogoutButton();
});

/* ========= Query DOM ========= */
const pdfInput     = document.getElementById("pdfFile");
const output       = document.getElementById("output");
const copyBtn      = document.getElementById("copyBtn");
const lokasiSelect = document.getElementById("inputLokasi");

// === AUTO-CALIBRATE: cari anchor "Diselesaikan Oleh," dan "Nama & Tanda Tangan" ===
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

  // "Nama & Tanda Tangan" di bawahnya yang se-kolom
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

  // titik dasar (x,y) untuk nama
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
  showSpinner?.();
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

    // 4. Upload file ke Supabase Storage
    const { error: uploadError } = await supabaseClient.storage
      .from('pdf-forms')
      .upload(filePath, currentFile, { upsert: true });
    if (uploadError) throw uploadError;

    // 5. Ekstrak metadata posisi TTD
    const meta = await autoCalibratePdf(await currentFile.arrayBuffer()).catch(err => {
      console.warn("Gagal auto-calibrate PDF:", err);
      return null;
    });

    // 6. Simpan semua info ke database
    const namaUkerBersih = stripLeadingColon(unitKerja) || '-';
    const { error: dbError } = await supabaseClient.from('pdf_history').upsert({
      content_hash: contentHash,
      nama_uker: namaUkerBersih,
      tanggal_pekerjaan: currentTanggalRaw,
      file_name: currentFile.name,
      storage_path: filePath,
      size_bytes: currentFile.size,
      meta: meta, // Simpan metadata posisi TTD
    }, { onConflict: 'content_hash' });
    if (dbError) throw dbError;

    showToast("Berhasil disimpan ke server.", 3000, "success");
  } catch (err) {
    console.error("Copy/Save Error:", err);
    showToast(`Gagal menyimpan: ${err.message}`, 4500, 'warn');
  } finally {
    hideSpinner?.();
  }
});
