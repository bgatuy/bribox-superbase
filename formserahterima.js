// ===== FORM SERAH TERIMA (Supabase + Meta reuse + Anchor patched) =====

/*************************
 *   ELEMENTS & GLOBALS  *
 *************************/
const tbody = document.getElementById('historiBody');
const inputTanggalSerah = document.getElementById('tglSerahTerima');
const btnGenerate = document.getElementById('btnGenerate'); // tombol lama (tetap)
const btnReset = document.getElementById('btnReset');
const selNama = document.getElementById('selNamaTTD');

// Tombol baru (opsional – hanya jika ada di HTML)
const btnGenCombo     = document.getElementById('btnGenCombo');
const btnGenCMOnly    = document.getElementById('btnGenCMOnly');
const btnGenFilesOnly = document.getElementById('btnGenFilesOnly');

// Master checkbox (opsional – jika kamu tambah di header)
const pickAllCheckbox = document.getElementById('pickAll');

// Debug flags
const DEBUG_SHOW_MARKER = false;   // titik oranye
const DEBUG_CONSOLE_LOG = false;   // Kembalikan ke false setelah masalah selesai

/********************
 *   SIDEBAR/UX     *
 ********************/
// Hapus DOMContentLoaded listener yang berulang.
// Inisialisasi layout dan fitur global sekarang ditangani oleh utils.js.
document.addEventListener('DOMContentLoaded', function () {
  renderTabel();
  loadNama();
});

/********************
 *   SUPABASE HELP  *
 ********************/
async function getUserOrThrow() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error || !session?.user) throw new Error('User tidak login.');
  return session.user;
}

/********************
 *   UTILITIES      *
 ********************/
const stripLeadingColon = (s) => (s || '').replace(/^\s*:+\s*/, '');
const cleanHashForComparison = (str) => (str || '').replace(/[^0-9a-fA-F]/g, ''); // Lebih agresif: hanya sisakan hex
function toNumDateDMY(s){const m=(s||'').match(/(\d{2})\/(\d{2})\/(\d{4})/); if(!m) return 0; const ts=Date.parse(`${m[3]}-${m[2]}-${m[1]}`); return Number.isNaN(ts)?0:ts;}
function formatTanggalSerahForPdf(val){ if(!val||!/^\d{4}-\d{2}-\d{2}$/.test(val)) return '-'; const [y,m,d]=val.split('-'); return `${d}/${m}/${y}`;}

function ensureLibsOrThrow(opts = { requireJsPDF: false, requirePDFLib: true, requirePdfjs: false }) {
  if (opts.requireJsPDF && !window.jspdf?.jsPDF) throw new Error("jsPDF belum dimuat.");
  if (opts.requirePDFLib && !window.PDFLib?.PDFDocument) throw new Error("pdf-lib belum dimuat.");
  if (opts.requirePdfjs && !window.pdfjsLib?.getDocument) throw new Error("pdf.js belum dimuat.");
}

/********************
 *   DROPDOWN SAVE  *
 ********************/
const KEY_NAMA='serah_ttd_nama';
function loadNama(){
  // selalu balik default (biar nggak salah stamp dari cache)
  if (selNama) { selNama.selectedIndex = 0; selNama.value = ''; }
  localStorage.removeItem(KEY_NAMA);
}
window.addEventListener('pageshow', (e) => {
  const nav = performance.getEntriesByType('navigation')[0];
  if (e.persisted || (nav && nav.type !== 'navigate')) {
    if (selNama) { selNama.selectedIndex = 0; selNama.value = ''; }
  }
});

/********************
 *   TABLE RENDER   *
 ********************/
function collectRowsForPdf(){
  const rows=[];
  document.querySelectorAll('#historiBody tr').forEach((tr,i)=>{
    const cells = tr.querySelectorAll('td');
    if (cells.length < 6) return;

    const hasPickCol = !!tr.querySelector('input.pick') || (cells.length >= 7);

    const idxNo   = hasPickCol ? 1 : 0;
    const idxSer  = hasPickCol ? 2 : 1;
    const idxUker = hasPickCol ? 3 : 2;
    const idxPek  = hasPickCol ? 4 : 3;

    const noCell  = cells[idxNo];
    const serCell = tr.querySelector('.tgl-serah') || cells[idxSer];

    const no = (noCell?.textContent || `${i+1}`).trim();
    const raw = (serCell?.dataset?.iso || serCell?.textContent || '').trim();
    const tanggalSerah = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? formatTanggalSerahForPdf(raw) : (raw || '-');
    const namaUker = stripLeadingColon((cells[idxUker]?.textContent || '-').trim());
    const tanggalPekerjaan = (cells[idxPek]?.textContent || '-').trim();

    rows.push({ no, tanggalSerah, namaUker, tanggalPekerjaan });
  });
  return rows;
}

async function getPdfHistoriFromSupabase() {
  if (typeof supabaseClient === 'undefined') return [];
  try {
    // RLS akan otomatis filter by user_id, tapi kita bisa ambil kolom penting saja
    const { data, error } = await supabaseClient
      .from('pdf_history')
      .select('content_hash, nama_uker, tanggal_pekerjaan, file_name, storage_path, size_bytes, meta, created_at')
      .order('tanggal_pekerjaan', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Gagal mengambil histori PDF:', error);
    showToast?.(`Gagal memuat data: ${error.message}`, 4000, 'warn');
    return [];
  }
}

async function renderTabel(){
  if(!tbody) return;
  let data = await getPdfHistoriFromSupabase();
  if(!data.length){
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Belum ada data histori. Unggah PDF di Trackmate atau AppSheet.</td></tr>`;
    return;
  }
  data = data.map((it,i)=>({ ...it, _no: i+1, nama_uker: stripLeadingColon(it.nama_uker) }));

  const headerHasPick = !!pickAllCheckbox;

  tbody.innerHTML = data.map((item, idx)=>{
    const iso = inputTanggalSerah?.value || '';
    const tglSerahText = iso ? formatTanggalSerahForPdf(iso) : '';
    const tglSerahData = iso ? `data-iso="${iso}"` : '';
    return `
    <tr data-i="${idx}" data-name="${(item.file_name||'').replace(/"/g,'&quot;')}" data-hash="${item.content_hash||''}" data-path="${item.storage_path||''}">
      ${headerHasPick ? `<td style="text-align:center"><input type="checkbox" class="pick"></td>` : ``}
      <td>${item._no}</td>
      <td contenteditable="true" class="tgl-serah" ${tglSerahData}>${tglSerahText}</td>
      <td>${(item.nama_uker || '-').replace(/\s+/g,' ').trim()}</td>
      <td>${item.tanggal_pekerjaan || '-'}</td>
      <td>${item.file_name || '-'}</td>
      <td class="aksi text-center">
        <button class="btn-del" data-i="${idx}" title="Hapus entri"><span class="material-icons">delete</span></button>
      </td>
    </tr>`;
  }).join('');

  syncPickAllState();
}

/********************
 *   STORAGE FETCH  *
 ********************/
/**
 * Ambil buffer sesuai pilihan (hash → fallback nama), urut sesuai pilihan tabel.
 * OPTIMASI: Download PARALEL dan HANYA file yang dipilih.
 */
async function fetchPdfBuffersBySelection(selected) {
  if (!supabaseClient || !selected.length) return [];
  const user = await getUserOrThrow();

  // 1. Siapkan hash untuk query metadata
  const hashes = selected.map(s => s.hash).filter(Boolean);
  
  // 2. Ambil metadata sekaligus (1 request)
  let metaMap = new Map();
  if (hashes.length) {
    const { data: rows } = await supabaseClient
      .from('pdf_history')
      .select('content_hash, meta')
      .in('content_hash', hashes);
    if (rows) {
      metaMap = new Map(rows.map(r => [r.content_hash, r.meta]));
    }
  }

  // 3. Download file secara PARALEL (hanya yang dipilih)
  const promises = selected.map(async (item) => {
    // Tentukan path. Prioritas: data-path dari tabel > konstruksi manual
    let path = item.path;
    if (!path) {
      // Fallback: coba tebak path standar jika data lama tidak punya path
      if (item.hash) path = `${user.id}/${item.hash}.pdf`;
      else path = `${user.id}/${item.name}`;
    }

    try {
      const { data: blob, error } = await supabaseClient.storage
        .from('pdf-forms')
        .download(path);

      if (error) throw error;
      
      const buffer = await blob.arrayBuffer();
      return {
        name: item.name,
        buffer: buffer,
        meta: metaMap.get(item.hash) || null,
        contentHash: item.hash
      };
    } catch (err) {
      console.warn(`Skip file gagal download: ${path}`, err);
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter(Boolean);
}

/**
 * Cepat: Hanya ambil DAFTAR NAMA file dari Supabase Storage, tanpa download isinya.
 * Ini jauh lebih efisien daripada getAllPdfBuffersFromSupabase untuk sekadar validasi.
 * @returns {Promise<{byHash: Set<string>, byName: Set<string>}>}
 */
async function getExistingFileNamesFromSupabase() {
  if (!supabaseClient) return { byHash: new Set(), byName: new Set() };
  const user = await getUserOrThrow();

  // Hanya minta daftar file, bukan kontennya. Ini sangat cepat.
  const { data: files, error: listError } = await supabaseClient.storage
    .from('pdf-forms')
    // FIX: Hapus opsi 'search' yang salah. Opsi ini mencari file yang namanya *dimulai* dengan '.pdf', yang mana tidak akan pernah cocok.
    .list(user.id, { limit: 1000 }); // Hapus , search: '.pdf' dari sini jika masih ada.

  if (listError) {
    console.error("Gagal ambil daftar file dari Supabase:", listError);
    throw listError;
  }

  const cleanedFileHashes = (files || [])
    .map(f => cleanHashForComparison(f.name.replace(/\.pdf$/i, '')))
    .filter(Boolean); // Pastikan tidak ada string kosong
  
  const byName = new Set((files || []).map(f => f.name));
  const byHash = new Set(cleanedFileHashes);
  
  if (DEBUG_CONSOLE_LOG) {
    console.log('%cDEBUG: Hashes dari Supabase Storage (sudah dibersihkan):', 'color:blue; font-weight:bold;', Array.from(byHash));
  }

  return { byHash, byName };
}

/*****************************************
 *   AUTO-ANCHOR (fallback pakai PDF.js) *
 *****************************************/
async function findAnchorsDiselesaikan(buffer){
  if (!window.pdfjsLib) return [];
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const anchors = [];
  for (let p = 1; p <= doc.numPages; p++){
    const page = await doc.getPage(p);
    const items = (await page.getTextContent()).items || [];

    // "Diselesaikan Oleh," (kolom tengah)
    let atas = items.find(it => /Diselesaikan\s*Oleh/i.test(it.str));
    if(!atas){
      for(let i=0;i<items.length-1;i++){
        if(/Diselesaikan/i.test(items[i].str) && /Oleh/i.test(items[i+1].str)){ atas = items[i]; break; }
      }
    }
    if (!atas){ anchors.push(null); continue; }

    const xA = atas.transform[4], yA = atas.transform[5];

    // "Nama & Tanda Tangan" di bawahnya (pilih yang sekolom tengah)
    const kandidat = items.filter(it =>
      /Nama\s*&?\s*Tanda\s*&?\s*Tangan/i.test(it.str) &&
      it.transform && it.transform[5] < yA
    );
    let bawah=null, best=Infinity;
    for(const it of kandidat){
      const x = it.transform[4], y = it.transform[5];
      const dx=Math.abs(x-xA), dy=Math.max(0,yA-y);
      const score = 1.6*dx + dy;
      if (dx <= 120 && score < best){ best = score; bawah = it; }
    }

    // PATCHED: kunci kolom (hindari angka paten +95)
    let x = xA + 95;
    let y = bawah ? (bawah.transform[5] + 12) : (yA - 32);

    anchors.push({ x, y });
  }
  try { doc.destroy && doc.destroy(); } catch {}
  return anchors;
}

/***************************************
 *   GENERATE & MERGE (main function)  *
 ***************************************/
async function generatePdfSerahTerima(){
  ensureLibsOrThrow({ requireJsPDF: true, requirePDFLib: true, requirePdfjs: false });
  const histori = await getPdfHistoriFromSupabase();
  if(!histori.length){ alert("Histori kosong. Tidak bisa generate PDF."); return; }

  const namaTeknisi = (selNama?.value || '').trim();
  const namaDiselesaikan = namaTeknisi || '';

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p','mm','a4');
  const rows = collectRowsForPdf();
  if(rows.length===0){ alert('Tidak ada data untuk digenerate.'); return; }

  // --- REKAP ---
  const chunkSize=50, chunks=[];
  for(let i=0;i<rows.length;i+=chunkSize) chunks.push(rows.slice(i,i+chunkSize));

  let globalIndex=0;
  chunks.forEach((chunk,idx)=>{
    if(idx>0) doc.addPage();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(18); doc.setFont(undefined,'bold');
    doc.text('FORM TANDA TERIMA CM', pageWidth/2, 20, { align:'center' });

    doc.autoTable({
      head:[['NO.','TANGGAL SERAH TERIMA','NAMA UKER','TANGGAL PEKERJAAN']],
      body:chunk.map(r=>{globalIndex+=1; return [r.no||globalIndex, r.tanggalSerah||'-', r.namaUker||'-', r.tanggalPekerjaan||'-'];}),
      startY:28,
      styles:{ fontSize:5, minCellHeight:4, cellPadding:0.5, halign:'center', valign:'middle', lineColor:[0,0,0], lineWidth:.2, textColor:[0,0,0]},
      headStyles:{ fillColor:false, fontSize:7, fontStyle:'bold'},
      bodyStyles:{ fontSize:5, textColor:[0,0,0], lineColor:[0,0,0]},
      columnStyles:{ 0:{cellWidth:10}, 1:{cellWidth:40}, 2:{cellWidth:90}, 3:{cellWidth:40}},
      theme:'grid', margin:{left:15,right:15}
    });

    const yAfter = (doc.lastAutoTable?.finalY || 32) + 3;
    doc.autoTable({
      head:[['TTD TEKNISI','TTD LEADER','TTD CALL CENTER']],
      body:[['','','']],
      startY:yAfter,
      styles:{ fontSize:7, halign:'center', valign:'middle', lineColor:[0,0,0], lineWidth:.2, textColor:[0,0,0]},
      headStyles:{ fontStyle:'bold', fontSize:7, textColor:[0,0,0], fillColor:false, minCellHeight:5},
      bodyStyles:{minCellHeight:24},
      columnStyles:{ 0:{cellWidth:60}, 1:{cellWidth:60}, 2:{cellWidth:60}},
      theme:'grid', margin:{left:15,right:15},
      didDrawCell: (data) => {
        if (data.section !== 'body') return;
        const { cell, column } = data;
        if (column.index === 0) {
          const txt = (namaTeknisi || '').trim();
          if (!txt) return;
          doc.setFontSize(8);
          const yText = cell.y + cell.height - 3.5;
          doc.text(txt, cell.x + cell.width / 2, yText, { align: 'center' });
        }
      }
    });
  });

  // --- jsPDF -> buffer rekap ---
  const mainPdfBlob = doc.output('blob');
  const mainPdfBuffer = await mainPdfBlob.arrayBuffer();

  // --- Ambil file dari Supabase Storage (HANYA YANG DIPILIH) ---
  const selectedFiles = getSelectedFromTable();
  const buffersToMerge = await fetchPdfBuffersBySelection(selectedFiles);

  // --- Merge & Stamping ---
  const mergedPdf = await PDFLib.PDFDocument.create();
  const mainDoc = await PDFLib.PDFDocument.load(mainPdfBuffer);
  const helv = await mergedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
  const mainPages = await mergedPdf.copyPages(mainDoc, mainDoc.getPageIndices());
  mainPages.forEach(p=>mergedPdf.addPage(p));
  let offset = mainPages.length;

  for(const {name, buffer, meta} of buffersToMerge){
    try{
      const donor = await PDFLib.PDFDocument.load(buffer);
      const donorPages = await mergedPdf.copyPages(donor, donor.getPageIndices());

      // fallback: cari anchor otomatis (kalau meta tidak ada)
      let anchors = [];
      try{ anchors = await findAnchorsDiselesaikan(buffer); } catch(e){ anchors = []; }

      donorPages.forEach((pg,i)=>{
        mergedPdf.addPage(pg);
        const page = mergedPdf.getPage(offset + i);
        const sz = page.getSize();

        // baseline fallback
        let x = sz.width * 0.493;
        let y = sz.height * 0.207;

        // 1) Prioritas: META tersimpan saat upload
        if (meta && typeof meta.x==='number' && typeof meta.y==='number') {
          x = meta.x + (meta.dx||0);
          y = meta.y + (meta.dy||0);
        }
        // 2) Jika meta tidak ada, tapi anchor on-the-fly ada → pakai anchor
        else {
          const an = anchors[i];
          if (an && typeof an.x === 'number' && typeof an.y === 'number'){
            x = an.x; y = an.y;
          }
        }
        // Geser global (koreksi kecil)
        const GLOBAL_Y_BIAS_PT = -12;
        y += GLOBAL_Y_BIAS_PT;

        if (DEBUG_SHOW_MARKER) {
          page.drawRectangle({ x:x-3, y:y-3, width:6, height:6, color: PDFLib.rgb(1,0.5,0) });
        }
        if (DEBUG_CONSOLE_LOG) {
          console.log('[STAMP]', { page: offset+i+1, file: name, meta, anchor: anchors[i], finalXY:{x,y} });
        }

        // Gambar nama (center)
        const size = 8;
        const text = (namaDiselesaikan || '').trim() || ' ';
        const w = helv.widthOfTextAtSize(text, size) || 0;
        page.drawText(text, {
          x: x - w/2,
          y: Math.max(30, Math.min(y, sz.height - 30)),
          size,
          font: helv,
          color: PDFLib.rgb(0,0,0)
        });
      });

      offset += donorPages.length;
    }catch(e){ console.warn(`❌ Gagal merge/stamp file "${name}"`, e); }
  }

  const mergedBytes = await mergedPdf.save();
  const mergedBlob  = new Blob([mergedBytes], { type:'application/pdf' });

  const url = URL.createObjectURL(mergedBlob);
  const a = document.createElement('a'); a.href = url; a.download = 'Form CM merged.pdf'; a.click();
  URL.revokeObjectURL(url);
}

/* ===== Tambahan: generator baru TANPA mengganggu yang lama ===== */

// Baca pilihan dari tabel: kalau tidak ada yg dicentang → anggap semua
function getSelectedFromTable(){
  const rows = Array.from(document.querySelectorAll('#historiBody tr[data-name], #historiBody tr[data-hash]'));
  const picked = rows.filter(r => r.querySelector('input.pick')?.checked);
  const base = (picked.length ? picked : rows);
  return base.map(r => ({
    hash: cleanHashForComparison(r.getAttribute('data-hash')),
    name: (r.getAttribute('data-name') || '').trim(), // Nama file boleh punya spasi, jadi tetap pakai trim biasa
    path: r.getAttribute('data-path') || ''
  }));
}

async function checkMissingSelection(selected){
  // OPTIMASI: Gunakan fungsi yang hanya me-list nama file, bukan mengunduh semua isinya.
  const { byHash, byName } = await getExistingFileNamesFromSupabase();
  const missing = [];

  for (const s of selected){
    // Pengecekan paling andal adalah berdasarkan content_hash yang sudah dibersihkan.
    // FIX: Cek juga byName untuk mengakomodasi file lama yang mungkin belum punya hash di nama filenya
    const ok = (s.hash && byHash.has(s.hash)) || (s.name && byName.has(s.name));
    if (!ok) {
      if (DEBUG_CONSOLE_LOG) {
        console.error('DEBUG: HASH TIDAK DITEMUKAN ->', `"${s.hash}"`, '(dari tabel HTML)');
      }
      missing.push(s);
    }
  }
  return missing;
}

function markMissingRows(missing){
  const setH = new Set(missing.map(m=>m.hash).filter(Boolean));
  const setN = new Set(missing.map(m=>m.name).filter(Boolean));
  document.querySelectorAll('#historiBody tr[data-name], #historiBody tr[data-hash]')
    .forEach(tr=>{
      const h = tr.getAttribute('data-hash')||'';
      const n = tr.getAttribute('data-name')||'';
      tr.classList.toggle('missing', (h && setH.has(h)) || (n && setN.has(n)));
    });
}

// Sinkron master checkbox
function syncPickAllState(){
  if (!pickAllCheckbox) return;
  const cbs = Array.from(document.querySelectorAll('#historiBody input.pick'));
  if (!cbs.length){ pickAllCheckbox.checked=false; pickAllCheckbox.indeterminate=false; return; }
  const allChecked = cbs.every(cb => cb.checked);
  const anyChecked = cbs.some(cb => cb.checked);
  pickAllCheckbox.checked = allChecked;
  pickAllCheckbox.indeterminate = anyChecked && !allChecked;
}
pickAllCheckbox?.addEventListener('change', (e)=> {
  document.querySelectorAll('#historiBody input.pick').forEach(cb => cb.checked = e.target.checked);
});

// jsPDF: bangun FORM CM saja
async function buildFormCMBlob(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p','mm','a4');
  if (typeof doc.autoTable !== 'function') throw new Error('jspdf-autotable belum dimuat.');

  const rows = collectRowsForPdf();
  if(rows.length===0) throw new Error('Tidak ada data untuk FORM CM');

  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(18); doc.setFont(undefined,'bold');
  doc.text('FORM TANDA TERIMA CM', pageWidth/2, 20, { align:'center' });

  const namaTeknisi = (selNama?.value || '').trim();

  let globalIndex=0;
  const chunkSize=50;
  for(let i=0;i<rows.length;i+=chunkSize){
    const chunk = rows.slice(i,i+chunkSize);
    if(i>0) doc.addPage();
    doc.autoTable({
      head:[['NO.','TANGGAL SERAH TERIMA','NAMA UKER','TANGGAL PEKERJAAN']],
      body:chunk.map(r=>{globalIndex+=1;return [r.no||globalIndex, r.tanggalSerah||'-', r.namaUker||'-', r.tanggalPekerjaan||'-'];}),
      startY:28,
      styles:{ fontSize:5, minCellHeight:4, cellPadding:0.5, halign:'center', valign:'middle', lineColor:[0,0,0], lineWidth:.2, textColor:[0,0,0]},
      headStyles:{ fillColor:false, fontSize:7, fontStyle:'bold'},
      bodyStyles:{ fontSize:5, textColor:[0,0,0], lineColor:[0,0,0]},
      columnStyles:{ 0:{cellWidth:10}, 1:{cellWidth:40}, 2:{cellWidth:90, halign:'center'}, 3:{cellWidth:40}},
      theme:'grid', margin:{left:15,right:15}
    });

    const yAfter = (doc.lastAutoTable?.finalY || 32) + 3;
    doc.autoTable({
      head:[['TTD TEKNISI','TTD LEADER','TTD CALL CENTER']],
      body:[['','','']],
      startY:yAfter,
      styles:{ fontSize:7, halign:'center', valign:'middle', lineColor:[0,0,0], lineWidth:.2, textColor:[0,0,0]},
      headStyles:{ fontStyle:'bold', fontSize:7, textColor:[0,0,0], fillColor:false, minCellHeight:5},
      bodyStyles:{minCellHeight:24},
      columnStyles:{ 0:{cellWidth:60}, 1:{cellWidth:60}, 2:{cellWidth:60}},
      theme:'grid', margin:{left:15,right:15},
      didDrawCell: (data) => {
        if (data.section !== 'body') return;
        const { cell, column } = data;
        if (column.index === 0 && namaTeknisi) {
          const yText = cell.y + cell.height - 3.5;
          doc.setFontSize(8);
          doc.text(namaTeknisi, cell.x + cell.width / 2, yText, { align: 'center' });
        }
      }
    });
  }

  return new Blob([doc.output('arraybuffer')], { type:'application/pdf' });
}

/* Merge helper (pdf-lib) */
async function mergePdfBuffers(buffers){
  const { PDFDocument } = window.PDFLib;
  const target = await PDFDocument.create();
  for (const buf of buffers){
    const src = await PDFDocument.load(buf);
    const pages = await target.copyPages(src, src.getPageIndices());
    pages.forEach(p => target.addPage(p));
  }
  const bytes = await target.save();
  return new Blob([bytes], { type:'application/pdf' });
}
async function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* Gabungan (FST + PDF TERPILIH) – tidak mengubah fungsi lama */
async function generateCombinedSelected(){
  ensureLibsOrThrow({ requireJsPDF: true, requirePDFLib: true, requirePdfjs: false });
  const cmBlob = await buildFormCMBlob();
  const selected = getSelectedFromTable();
  const originals = await fetchPdfBuffersBySelection(selected);

  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const target = await PDFDocument.create();

  const cmDoc = await PDFDocument.load(await cmBlob.arrayBuffer());
  const cmPages = await target.copyPages(cmDoc, cmDoc.getPageIndices());
  cmPages.forEach(p => target.addPage(p));
  let offset = cmPages.length;

  const helv = await target.embedFont(StandardFonts.Helvetica);
  const namaDiselesaikan = (selNama?.value || '').trim();

  for (const {name, buffer, meta} of originals){
    const donor = await PDFDocument.load(buffer);
    const donorPages = await target.copyPages(donor, donor.getPageIndices());
    let anchors = [];
    try{ anchors = await findAnchorsDiselesaikan(buffer); } catch { anchors = []; }

    donorPages.forEach((pg,i)=>{
      target.addPage(pg);
      const page = target.getPage(offset + i);
      const sz = page.getSize();

      let x = sz.width * 0.493, y = sz.height * 0.207;
      if (meta && typeof meta.x==='number' && typeof meta.y==='number'){ x = meta.x + (meta.dx||0); y = meta.y + (meta.dy||0); }
      else if (anchors[i]){ x = anchors[i].x; y = anchors[i].y; }

      y -= 12; // bias kecil (hanya vertikal)
      if (DEBUG_SHOW_MARKER) page.drawRectangle({ x:x-3, y:y-3, width:6, height:6, color: rgb(1,0.5,0) });

      if (namaDiselesaikan){
        const size = 8, w = helv.widthOfTextAtSize(namaDiselesaikan, size) || 0;
        page.drawText(namaDiselesaikan, { x: x - w/2, y: Math.max(30, Math.min(y, sz.height - 30)), size, font: helv, color: rgb(0,0,0) });
      }
    });
    offset += donorPages.length;
  }

  const bytes = await target.save();
  await downloadBlob(new Blob([bytes], {type:'application/pdf'}), 'Form Serah Terima + PDF CM.pdf');
}

/* FORM CM saja */
async function generateCMOnly(){
  const blob = await buildFormCMBlob();
  await downloadBlob(blob, 'Form Tanda Terima CM.pdf');
}

/* PDF asli terpilih saja — SEKARANG ikut stamping nama di kolom TTD */
async function generateOriginalsOnly(selected){
  ensureLibsOrThrow({ requireJsPDF: false, requirePDFLib: true, requirePdfjs: false });
  const originals = await fetchPdfBuffersBySelection(selected);
  if (!originals.length){ alert('Tidak ada file terpilih / ditemukan.'); return; }

  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const target = await PDFDocument.create();
  const helv = await target.embedFont(StandardFonts.Helvetica);
  const namaDiselesaikan = (selNama?.value || '').trim();

  let offset = 0;
  for (const {name, buffer, meta} of originals){
    const donor = await PDFDocument.load(buffer);
    const donorPages = await target.copyPages(donor, donor.getPageIndices());

    // cari anchor on-the-fly (fallback kalau meta tidak ada)
    let anchors = [];
    try{ anchors = await findAnchorsDiselesaikan(buffer); } catch { anchors = []; }

    donorPages.forEach((pg,i)=>{
      target.addPage(pg);
      const page = target.getPage(offset + i);
      const sz = page.getSize();

      // posisi default
      let x = sz.width * 0.493;
      let y = sz.height * 0.207;

      // prioritas pakai meta upload; kalau tidak ada pakai anchor
      if (meta && typeof meta.x==='number' && typeof meta.y==='number'){
        x = meta.x + (meta.dx||0);
        y = meta.y + (meta.dy||0);
      } else if (anchors[i] && typeof anchors[i].x==='number' && typeof anchors[i].y==='number'){
        x = anchors[i].x; y = anchors[i].y;
      }

      y -= 12; // Hanya terapkan bias vertikal

      // gambar nama kalau ada
      if (namaDiselesaikan){
        const size = 8;
        const w = helv.widthOfTextAtSize(namaDiselesaikan, size) || 0;
        page.drawText(namaDiselesaikan, {
          x: x - w/2,
          y: Math.max(30, Math.min(y, sz.height - 30)),
          size,
          font: helv,
          color: rgb(0,0,0)
        });
      }
    });

    offset += donorPages.length;
  }

  const bytes = await target.save();
  await downloadBlob(new Blob([bytes], { type:'application/pdf' }), 'Gabungan PDF CM.pdf');
}


/********************
 *   EVENTS         *
 ********************/
inputTanggalSerah?.addEventListener('change', ()=>{
  const iso = inputTanggalSerah.value || '';
  document.querySelectorAll('.tgl-serah').forEach(td=>{
    td.dataset.iso = iso;
    td.textContent = iso ? formatTanggalSerahForPdf(iso) : '';
  });
  if (btnGenerate) btnGenerate.disabled = !iso;
  if (btnGenCombo) btnGenCombo.disabled = !iso;
  if (btnGenCMOnly) btnGenCMOnly.disabled = !iso;
});

tbody?.addEventListener('change', (e)=>{
  if (e.target.matches('input.pick')) syncPickAllState();
});

tbody?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-del'); 
  if (!btn) return;
  if (!confirm('Hapus entri ini dari histori?')) return;

  const tr = btn.closest('tr');
  const hashFromRow = tr?.dataset?.hash || '';
  const pathFromRow = tr?.dataset?.path || '';

  if (!hashFromRow) {
    showToast?.('Gagal menghapus: ID data tidak ditemukan.', 4000, 'warn');
    return;
  }

  try {
    showSpinner?.();
    // 1) Hapus row (RLS jaga user scope)
    const { error: dbError } = await supabaseClient.from('pdf_history').delete().eq('content_hash', hashFromRow);
    if (dbError) throw dbError;

    // 2) Hapus file storage (kalau ada path)
    if (pathFromRow) {
      const { error: storageError } = await supabaseClient.storage.from('pdf-forms').remove([pathFromRow]);
      if (storageError) console.warn(`Gagal hapus file di storage: ${storageError.message}`);
    }

    showToast?.('Entri berhasil dihapus dari server.', 3000, 'success');
  } catch (error) {
    showToast?.(`Gagal menghapus: ${error.message}`, 4000, 'warn');
  } finally {
    hideSpinner?.();
  }
  renderTabel();
});

btnReset?.addEventListener('click', async ()=>{
  if(!confirm('Yakin akan mereset SEMUA histori PDF Anda di server? Tindakan ini tidak bisa dibatalkan.')) return;

  try {
    showSpinner?.();
    const user = await getUserOrThrow();

    // 1) Ambil semua file milik user
    const { data: files, error: listError } = await supabaseClient.storage.from('pdf-forms').list(
      user.id, { limit: 1000 }
    );
    if (listError) throw listError;

    // 2) Hapus baris tabel pdf_history milik user
    const { error: dbError } = await supabaseClient.from('pdf_history').delete().eq('user_id', user.id);
    if (dbError) throw dbError;

    // 3) Hapus semua file di storage
    if (files && files.length > 0) {
      const filePaths = files.map(file => `${user.id}/${file.name}`);
      const { error: storageError } = await supabaseClient.storage.from('pdf-forms').remove(filePaths);
      if (storageError) throw storageError;
    }

    showToast?.('Semua histori PDF Anda telah direset dari server.', 4000, 'success');
    renderTabel();
  } catch (error) {
    showToast?.(`Gagal mereset: ${error.message}`, 5000, 'warn');
  } finally {
    hideSpinner?.();
  }
});

// ========== TOMBOL LAMA: generate gabungan (semua) ==========
btnGenerate?.addEventListener('click', async ()=>{
  const btn = btnGenerate;
  const tanggalInput = inputTanggalSerah.value;
  if(!tanggalInput){ alert('Silakan isi tanggal serah terima terlebih dahulu.'); return; }

  btn.disabled = true;
  showSpinner?.();
  try{
    const selected = getSelectedFromTable(); // semua jika tidak ada yang dicentang
    const missing = await checkMissingSelection(selected);
    if (missing.length){
      markMissingRows(missing);
      const list = missing.slice(0,10).map(m=>m.name||m.hash).join('\n');
      if(!confirm(`Ada ${missing.length} file tidak ditemukan, silahkan upload ulang file ini:\n${list}${missing.length>10?'\n...':''}\n\nLanjut generate tanpa file ini?`)){
        return;
      }
    }
    await generatePdfSerahTerima();
  }
  catch(err){ console.error(err); alert('Gagal generate PDF. Pastikan jsPDF, AutoTable, PDF-lib & PDF.js sudah dimuat.'); }
  finally{
    hideSpinner?.();
    btn.disabled = false;
  }
});

// ========== TOMBOL BARU (jika ada di HTML) ==========
btnGenCombo?.addEventListener('click', async ()=>{
  const btn = btnGenCombo;
  const tanggalInput = inputTanggalSerah?.value || '';
  if(!tanggalInput){ alert('Isi Tanggal Serah Terima dulu.'); return; }

  btn.disabled = true;
  showSpinner?.();
  try{
    const selected = getSelectedFromTable();
    const missing = await checkMissingSelection(selected);
    if (missing.length){
      markMissingRows(missing);
      const list = missing.slice(0,10).map(m=>m.name||m.hash).join('\n');
      if(!confirm(`Ada ${missing.length} file tidak ditemukan, silahkan upload ulang file ini:\n${list}${missing.length>10?'\n...':''}\n\nLanjut generate tanpa file ini?`)){
        return;
      }
    }
    await generateCombinedSelected();
  }
  catch(err){ console.error(err); alert('Gagal membuat PDF gabungan.'); }
  finally{
    hideSpinner?.();
    btn.disabled = false;
  }
});

btnGenCMOnly?.addEventListener('click', async ()=>{
  const btn = btnGenCMOnly;
  const tanggalInput = inputTanggalSerah?.value || '';
  if(!tanggalInput){ alert('Isi Tanggal Serah Terima dulu.'); return; }

  btn.disabled = true;
  showSpinner?.();
  try{
    await generateCMOnly();
  }
  catch(err){ console.error(err); alert('Gagal membuat FORM CM.'); }
  finally{
    hideSpinner?.();
    btn.disabled = false;
  }
});

btnGenFilesOnly?.addEventListener('click', async ()=>{
  const btn = btnGenFilesOnly;
  const selected = Array.from(document.querySelectorAll('#historiBody tr[data-name], #historiBody tr[data-hash]'))
    .filter(tr => tr.querySelector('input.pick')?.checked)
    .map(tr => ({ 
      hash: cleanHashForComparison(tr.getAttribute('data-hash')), 
      name: (tr.getAttribute('data-name') || '').trim(),
      path: tr.getAttribute('data-path') || ''
    }));

  if (selected.length === 0) {
    alert('Pilih minimal satu file dulu (ceklist di kolom paling kiri).');
    return;
  }

  btn.disabled = true;
  showSpinner?.();
  try{
    const missing = await checkMissingSelection(selected);
    if (missing.length){
      markMissingRows(missing);
      const list = missing.slice(0,10).map(m=>m.name||m.hash).join('\n');
      if(!confirm(`Ada ${missing.length} file tidak ditemukan, silahkan upload ulang file ini:\n${list}${missing.length>10?'\n...':''}\n\nLanjut generate tanpa file ini?`)){
        return;
      }
    }
    await generateOriginalsOnly(selected);
  }
  catch(err){ console.error(err); alert('Gagal menggabungkan PDF asli.'); }
  finally{
    hideSpinner?.();
    btn.disabled = false;
  }
});
