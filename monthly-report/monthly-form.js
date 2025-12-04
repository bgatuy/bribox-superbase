(function(){
  // ===== elem refs
  const el = (id) => document.getElementById(id);
  const bulan = el('bulan');
  const tanggal = el('tanggal');
  const teknisi = el('teknisi');
  const jenis = el('jenis');
  const lokasiDari = el('lokasiDari');
  const lokasiKe = el('lokasiKe');
  const detail = el('detail');
  const status = el('status');
  const jamBerangkat = el('jamBerangkat');
  const jamMasuk = el('jamMasuk');
  const jamTiba = el('jamTiba');
  const jamMulai = el('jamMulai');
  const jamSelesai = el('jamSelesai');
  const durasiPenyelesaian = el('durasiPenyelesaian');
  const jarak = el('jarak');
  const waktuTempuh = el('waktuTempuh');
  const keterangan = el('keterangan');
  const form = el('formReport');
  const linkData = document.getElementById('linkData');
  const btnLihatBulan = document.getElementById('btnLihatBulan');
  const countBulan = document.getElementById('countBulan');
  const toast = document.getElementById('toast');
  const pageSubtitle = document.querySelector('.dashboard-header .page-subtitle');
  const formTitle = document.querySelector('section.card h3');
  const submitBtn = document.querySelector('#formReport .toolbar .btn.primary');

  // ===== utils
  const today = new Date();
  const pad = (n)=> String(n).padStart(2,'0');
  const toHHMM = (m)=>{
    m = Math.max(0, Math.round(m||0));
    const h = Math.floor(m/60); const mm = m%60; return `${h}:${pad(mm)}`;
  };
  const parseTimeToMin = (t)=>{
    if(!t) return null;
    const [h,m] = t.split(':').map(Number);
    if(Number.isNaN(h)||Number.isNaN(m)) return null;
    return h*60+m;
  };
  const minToTimeStr = (m)=> `${pad(Math.floor((m%1440)/60))}:${pad(Math.floor(m%60))}`;
  const defaultMonth = () => `${today.getFullYear()}-${pad(today.getMonth()+1)}`;
  const defaultDate  = () => `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

  // Normalisasi jam ke HH:MM (tanpa detik)
  const toHHMMnorm = (v)=>{
    if(!v) return '';
    const m = String(v).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    return m ? `${pad(m[1])}:${m[2]}` : String(v);
  };

  const qs = new URL(location.href).searchParams;
  const editId = qs.get('edit');

  async function refreshCountForMonth(month){
    if (countBulan && typeof supabaseClient !== 'undefined') {
      const { count, error } = await supabaseClient.from('monthly_reports').select('*', { count: 'exact', head: true }).eq('month', month);
      if (!error) {
        countBulan.textContent = count || 0;
      }
    }
  }

  function setLinkTargets(month){
    const href = `monthly-data.html?month=${encodeURIComponent(month)}`;
    if (linkData) linkData.href = href;
    if (btnLihatBulan) btnLihatBulan.href = href;
  }

  // ===== Dropdown teknisi (STATIS, TANPA tombol + / localStorage)
  function populateTeknisi(){
    if (!teknisi) return;
    const list = [
      "Mochammad Fathur Rachman",
      "Muhammad Farhan Baihaqi",
      "Halviansyah Wildana",
      "Dafa Farabi",
      "Azriel Raja Simamora",
      "Dimas Pujianto"
    ];
    // Kalau HTML sudah hard-coded, ini akan menimpa dengan list yang sama—aman.
    if (!teknisi.options.length || teknisi.firstElementChild?.value === "") {
      teknisi.innerHTML = ['<option value="">-- Pilih Nama --</option>']
        .concat(list.map(n=>`<option value="${n}">${n}</option>`)).join('');
    }
  }

  // ===== auto fields
  function computeAutoFields(){
    const berangkat = parseTimeToMin(jamBerangkat.value);
    if(berangkat!=null){
      const masuk = (berangkat - 5 + 1440) % 1440; // -5 menit, wrap 24h
      jamMasuk.value = minToTimeStr(masuk);
    } else { jamMasuk.value = ''; }

    const tiba = parseTimeToMin(jamTiba.value);
    if(berangkat!=null && tiba!=null){
      const tempuh = (tiba - berangkat + 1440) % 1440;
      waktuTempuh.value = toHHMM(tempuh);
    } else { waktuTempuh.value = '0:00'; }

    const mulai = parseTimeToMin(jamMulai.value);
    const selesai = parseTimeToMin(jamSelesai.value);
    if(mulai!=null && selesai!=null){
      const dur = (selesai - mulai + 1440) % 1440;
      durasiPenyelesaian.value = toHHMM(dur);
    } else { durasiPenyelesaian.value = '0:00'; }
  }

  // ===== Edit mode: load existing record
  async function loadForEdit(id){
    try{
      if(!id) return;
      const { data, error } = await supabaseClient.from('monthly_reports').select('*').eq('id', id).single();
      if(error) throw error;
      if(!data) return;

      // UI labels
      if (pageSubtitle) pageSubtitle.textContent = 'Edit Monthly Report';
      if (formTitle) formTitle.textContent = 'Edit SPJ Harian';
      if (submitBtn) submitBtn.textContent = 'Update';

      // month hint from URL if present
      const urlMonth = qs.get('month');

      // Fill values
      bulan.value = (data.month || urlMonth || defaultMonth());
      tanggal.value = (data.date || defaultDate());

      // Populate teknisi list before setting selected
      populateTeknisi();
      if (teknisi.querySelector(`option[value="${data.teknisi||''}"]`)) {
        teknisi.value = data.teknisi || '';
      } else {
        // fallback: add custom option if not in list
        if (data.teknisi) {
          const opt = document.createElement('option');
          opt.value = data.teknisi; opt.textContent = data.teknisi; teknisi.appendChild(opt); teknisi.value = data.teknisi;
        } else {
          teknisi.value = '';
        }
      }

      jenis.value = data.jenis || 'Corrective Maintenance';
      lokasiDari.value = data.lokasi_dari || '';
      lokasiKe.value = data.lokasi_ke || '';
      detail.value = data.detail || '';
      status.value = data.status || 'Done';

      jamMasuk.value = toHHMMnorm(data.jam_masuk || '');
      jamBerangkat.value = toHHMMnorm(data.jam_berangkat || '');
      jamTiba.value = toHHMMnorm(data.jam_tiba || '');
      jamMulai.value = toHHMMnorm(data.jam_mulai || '');
      jamSelesai.value = toHHMMnorm(data.jam_selesai || '');

      durasiPenyelesaian.value = (function(){
        const ms = String(data.jam_mulai||'').match(/^(\d{1,2}):(\d{2})/);
        const ss = String(data.jam_selesai||'').match(/^(\d{1,2}):(\d{2})/);
        const a = ms ? (+ms[1])*60 + (+ms[2]) : null;
        const b = ss ? (+ss[1])*60 + (+ss[2]) : null;
        const m = (a!=null && b!=null) ? ((b - a + 1440) % 1440) : 0;
        const hh = Math.floor(m/60), mm = m%60; return `${hh}:${pad(mm)}`;
      })();
      jarak.value = data.jarak_km ?? 0;
      waktuTempuh.value = (function(){
        const m = Math.max(0, data.waktu_tempuh_min ?? 0);
        const hh = Math.floor(m/60), mm = m%60; return `${hh}:${pad(mm)}`;
      })();
      keterangan.value = data.keterangan || '';

      // Update link targets and counters
      setLinkTargets(bulan.value);
      refreshCountForMonth(bulan.value);

      // Recompute to sync auto fields if user edits something next
      computeAutoFields();
    }catch(err){
      console.error('Gagal memuat data edit:', err);
      showToast(`Gagal memuat data: ${err.message}`, 4000, 'warn');
    }
  }

  // ===== helper
  function formatTanggalLong(dateStr){
    try { return new Date(dateStr+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long', day:'2-digit', month:'long', year:'numeric'}); }
    catch { return dateStr; }
  }

  // ===== submit (insert or update)
  function initializePage() {
    // ===== init (insert defaults; overridden in edit mode)
    if (!editId) {
      bulan.value = defaultMonth();
      tanggal.value = defaultDate();
    }
    setLinkTargets(bulan.value);
    refreshCountForMonth(bulan.value);
    populateTeknisi();

    // pastikan auto-hitungan jalan saat ketik ATAU blur
    [jamBerangkat,jamTiba,jamMulai,jamSelesai].forEach(inp=>{
      ['input','change'].forEach(ev => inp.addEventListener(ev, computeAutoFields));
    });
    computeAutoFields();

    bulan.addEventListener('change', ()=>{ setLinkTargets(bulan.value); refreshCountForMonth(bulan.value); });

    if (editId) { loadForEdit(editId); }

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const month = bulan.value?.trim();
      const dateStr = tanggal.value?.trim();
      const tech = teknisi.value?.trim() || (await supabaseClient.auth.getUser()).data.user?.email;
      if(!month || !dateStr || !tech){ showToast('Bulan, Tanggal, dan Teknisi wajib diisi.'); return; }

      computeAutoFields(); // ensure latest

      const berangkat = parseTimeToMin(jamBerangkat.value);
      const tiba = parseTimeToMin(jamTiba.value);
      const mulai = parseTimeToMin(jamMulai.value);
      const selesai = parseTimeToMin(jamSelesai.value);
      const durPenyMin = Math.max(0, (selesai - mulai + 1440) % 1440);
      const tempuhMin = Math.max(0, (tiba - berangkat + 1440) % 1440);

      const rec = {
        month, date: dateStr, tanggal_label: formatTanggalLong(dateStr), teknisi: tech,
        lokasi_dari: (lokasiDari.value||'').trim(), lokasi_ke: (lokasiKe.value||'').trim(),
        jenis: jenis.value, detail: (detail.value||'').trim(), status: status.value,
        jam_masuk: toHHMMnorm(jamMasuk.value) || null, jam_berangkat: toHHMMnorm(jamBerangkat.value) || null,
        jam_tiba: toHHMMnorm(jamTiba.value) || null, jam_mulai: toHHMMnorm(jamMulai.value) || null,
        jam_selesai: toHHMMnorm(jamSelesai.value) || null,
        durasi_penyelesaian_min: durPenyMin, jarak_km: parseFloat(jarak.value || '0') || 0,
        waktu_tempuh_min: tempuhMin, keterangan: (keterangan.value||'').trim(),
      };

      try {
        if (editId) {
          const { error } = await supabaseClient.from('monthly_reports').update(rec).eq('id', editId);
          if (error) throw error;
          showToast('Perubahan berhasil disimpan.');
          window.location.href = `monthly-data.html?month=${encodeURIComponent(month)}`;
        } else {
          const { error } = await supabaseClient.from('monthly_reports').insert([rec]);
          if (error) throw error;
          showToast('Data berhasil disimpan ke server.');
          form.reset(); bulan.value = month; tanggal.value = defaultDate();
          setLinkTargets(month); refreshCountForMonth(month); computeAutoFields();
        }
      } catch (error) {
        console.error('Gagal menyimpan laporan:', error);
        showToast(`Gagal menyimpan: ${error.message}`, 4000, 'warn');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initializePage);
})();
