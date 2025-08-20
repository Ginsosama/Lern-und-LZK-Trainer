
// Quiz & Datei Handling
(function(){
  const BASE_URL = window.BASE_URL || 'http://209.25.141.16:4728/';
  window.BASE_URL = BASE_URL;

  // State
  window.selectedFile = null;
  window.fragen = [];
  let aktuelleFragen = [];
  let currentIndex = 0;
  let score = 0;
  let antwortenLog = [];
  let timer = null;
  let timeLeft = 60;
  let isLZKMode = false;
  let currentElement = null;
  let activeDropSlot = null;
  let touchOffsetX = 0;
  let touchOffsetY = 0;
  let questionCount = 20;
  let timePerQuestion = 60;

  // Public helpers
  async function loadAvailableFiles(){
    const select = document.getElementById('fileSelect');
    const editSelect = document.getElementById('editFileSelect');
    try{
      const res = await fetch(`${BASE_URL}files/`);
      if (!res.ok) throw new Error(`Serverfehler: ${res.status}`);
      const files = await res.json();

      select.innerHTML = '<option value="">-- Datei auswählen --</option>';
      editSelect.innerHTML = '<option value="">-- Datei auswählen --</option>';
      files.forEach(file => {
        const opt = document.createElement('option');
        opt.value = file; opt.textContent = file; select.appendChild(opt);
        const opt2 = document.createElement('option');
        opt2.value = file; opt2.textContent = file; editSelect.appendChild(opt2);
      });

      select.onchange = (e)=>{
        window.selectedFile = e.target.value;
        if (window.selectedFile){
          document.getElementById('fileSelectionContainer').classList.add('hidden');
          document.getElementById('modeSelection').classList.remove('hidden');
        }
      };
      editSelect.onchange = (e)=>{
        const f = e.target.value;
        if (f) loadExcelFileForEditing(f);
      };

    }catch(err){
      console.error(err);
      select.innerHTML = `<option value="">-- Fehler: ${err.message} --</option>`;
      editSelect.innerHTML = `<option value="">-- Fehler: ${err.message} --</option>`;
    }
  }
  window.loadAvailableFiles = loadAvailableFiles;

  function setupModeSelection(){
    document.getElementById('lzkModeBtn').addEventListener('click', ()=>{
      document.getElementById('modeSelection').classList.add('hidden');
      document.getElementById('settingsContainer').classList.remove('hidden');
      document.getElementById('timeLimitContainer').classList.remove('hidden');
      isLZKMode = true;
      addSkipButton();
    });
    document.getElementById('learnModeBtn').addEventListener('click', ()=>{
      document.getElementById('modeSelection').classList.add('hidden');
      document.getElementById('settingsContainer').classList.remove('hidden');
      document.getElementById('timeLimitContainer').classList.add('hidden');
      isLZKMode = false;
      addSkipButton();
    });
    document.getElementById('startQuizBtn').addEventListener('click', ()=>{
      questionCount = parseInt(document.getElementById('questionCount').value,10);
      if (isLZKMode) timePerQuestion = parseInt(document.getElementById('timeLimit').value,10);
      showQuizConfirmationDialog();
    });
  }

  function vibrate(el){
    if (!el) return;
    el.classList.add('vibrate');
    setTimeout(()=>el.classList.remove('vibrate'),300);
    if ('vibrate' in navigator) navigator.vibrate(50);
  }

  function showQuizConfirmationDialog(){
    const dialog = document.createElement('div');
    dialog.className='confirmation-dialog';
    dialog.innerHTML = `
      <h3>Quiz starten mit folgenden Einstellungen:</h3>
      <p>Modus: ${isLZKMode ? 'LZK-Modus' : 'Lern-Modus'}</p>
      <p>Anzahl Fragen: ${questionCount}</p>
      ${isLZKMode ? `<p>Zeit pro Frage: ${timePerQuestion} Sekunden</p>` : ''}
      <button id="confirmStartBtn">Starten</button>
      <button id="cancelStartBtn">Abbrechen</button>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#confirmStartBtn').addEventListener('click',()=>{
      dialog.remove();
      document.getElementById('settingsContainer').classList.add('hidden');
      startQuiz(isLZKMode);
    });
    dialog.querySelector('#cancelStartBtn').addEventListener('click',()=>dialog.remove());
  }

  function addSkipButton(){
    const buttonGroup = document.querySelector('.button-group');
    const existing = document.getElementById('skipBtn');
    if (!isLZKMode){
      if (!existing){
        const skip = document.createElement('button');
        skip.id='skipBtn'; skip.textContent='Überspringen';
        skip.addEventListener('click', ()=>{ currentIndex++; zeigeFrage(); });
        buttonGroup.appendChild(skip);
      }
    }else{
      if (existing) existing.remove();
    }
  }

  async function startQuiz(isLZK){
    isLZKMode = isLZK;
    try{
      const res = await fetch(`${BASE_URL}files/${window.selectedFile}`);
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), {type:'array'});
      const sheet = wb.Sheets[wb.SheetNames[0]];
      window.fragen = XLSX.utils.sheet_to_json(sheet);
      window.fragen.forEach(f=>{
        if (f.Typ === 'Drag-and-Drop'){
          f.richtigeReihenfolge = parseDragDropAnswer(f.RichtigeAntwort || '');
        }
        if (!f.Erklaerung) f.Erklaerung = 'Keine Erklärung verfügbar';
      });
      aktuelleFragen = [...window.fragen].sort(()=>0.5 - Math.random()).slice(0, questionCount);
      currentIndex = 0; score = 0; antwortenLog = [];

      document.getElementById('modeSelection').classList.add('hidden');
      document.getElementById('quizContainer').classList.remove('hidden');
      document.getElementById('timer').classList.toggle('hidden', !isLZKMode);
      document.getElementById('totalQuestions').textContent = aktuelleFragen.length.toString();
      zeigeFrage();
    }catch(err){
      console.error(err);
      alert('Fehler beim Laden der Quiz-Datei: '+err.message);
    }
  }

  function parseDragDropAnswer(s){
    const parts = (s||'').split(',').map(p=>p.trim()).filter(Boolean);
    const order = [];
    parts.forEach(part=>{
      const [k,v] = part.split('=').map(x=>x.trim());
      const idx = parseInt(k,10);
      if (!isNaN(idx)) order[idx-1] = v;
    });
    return order.filter(x=>x!==undefined);
  }

  function zeigeFrage(){
    if (currentIndex >= aktuelleFragen.length){ zeigeErgebnisse(); return; }
    clearInterval(timer);
    if (isLZKMode) startTimer();
    const frage = aktuelleFragen[currentIndex];
    document.getElementById('currentQuestion').textContent = String(currentIndex+1);
    document.getElementById('questionText').textContent = frage.Frage || '';
    const container = document.getElementById('optionsContainer');
    container.innerHTML='';

    document.getElementById('confirmBtn').disabled = false;
    document.getElementById('nextBtn').classList.add('hidden');
    document.getElementById('feedbackContainer').classList.add('hidden');

    switch(frage.Typ){
      case 'True/False':
        container.innerHTML = `
          <div style="display:flex;gap:20px;justify-content:center;">
            <label style="display:flex;align-items:center;gap:5px;">
              <input type="radio" name="antwort" value="Wahr"> Wahr
            </label>
            <label style="display:flex;align-items:center;gap:5px;">
              <input type="radio" name="antwort" value="Falsch"> Falsch
            </label>
          </div>`;
        break;
      case 'Multiple Choice':
        (frage.Optionen||'').split(',').map(o=>o.trim()).filter(Boolean).forEach(opt=>{
          container.innerHTML += `
            <label style="display:block;margin:10px 0;padding:10px;background:var(--dragzone-bg);border-radius:5px;">
              <input type="checkbox" value="${opt}" style="margin-right:10px;"> ${opt}
            </label>`;
        });
        break;
      case 'Drag-and-Drop':
        container.innerHTML = `
          <div style="margin-bottom:20px;">
            <h3 style="margin-bottom:10px;">Optionen:</h3>
            <div class="drag-zone" id="dragZone"></div>
          </div>
          <div>
            <h3 style="margin-bottom:10px;">Ihre Zuordnung:</h3>
            <div class="drop-zone" id="dropZone"></div>
          </div>`;
        initDragDrop(frage);
        break;
    }
    updateProgressBar();
  }

  function initDragDrop(frage){
    const dragZone = document.getElementById('dragZone');
    const dropZone = document.getElementById('dropZone');
    dropZone.innerHTML='';
    const dropSlotsContainer = document.createElement('div');
    dropSlotsContainer.className='drop-slots-container';

    const slotCount = (frage.richtigeReihenfolge||[]).length;
    for (let i=0;i<slotCount;i++){
      const slot = document.createElement('div');
      slot.className='drop-slot';
      slot.dataset.position = String(i);
      slot.innerHTML = `<small>Position ${i+1}</small>`;
      slot.addEventListener('touchstart', handleSlotTouchStart, {passive:false});
      slot.addEventListener('touchmove', handleSlotTouchMove, {passive:false});
      slot.addEventListener('touchend', improvedHandleDragTouchEnd);
      dropSlotsContainer.appendChild(slot);
    }
    dropZone.appendChild(dropSlotsContainer);

    const optionen = (frage.Optionen||'').split(',').map(o=>o.trim()).filter(Boolean);
    shuffleArray(optionen);
    optionen.forEach(opt=>{
      const el = document.createElement('div');
      el.className='draggable';
      el.textContent = opt;
      el.setAttribute('draggable','true');
      el.dataset.value = opt;
      el.addEventListener('touchstart', handleDragTouchStart, {passive:false});
      el.addEventListener('touchmove', handleDragTouchMove, {passive:false});
      el.addEventListener('touchend', improvedHandleDragTouchEnd);
      el.addEventListener('dragstart', (e)=>{
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', ()=>el.classList.remove('dragging'));
      dragZone.appendChild(el);
    });

    [dragZone, dropZone].forEach(zone=>{
      zone.addEventListener('dragover', (e)=>{
        e.preventDefault();
        const slot = e.target.closest('.drop-slot');
        if (slot) slot.classList.add('highlight');
      });
      zone.addEventListener('dragleave', (e)=>{
        const slot = e.target.closest('.drop-slot');
        if (slot) slot.classList.remove('highlight');
      });
      zone.addEventListener('drop', (e)=>{
        e.preventDefault();
        const draggable = document.querySelector('.draggable.dragging');
        const slot = e.target.closest('.drop-slot');
        if (slot) slot.classList.remove('highlight');
        if (draggable && slot){
          const prev = draggable.closest('.drop-slot');
          if (prev){
            prev.innerHTML = `<small>Position ${parseInt(prev.dataset.position,10)+1}</small>`;
          }
          slot.innerHTML = '';
          slot.appendChild(draggable);
          vibrate(slot);
        }
      });
    });
  }

  function handleDragTouchStart(e){
    e.preventDefault();
    currentElement = e.target;
    const touch = e.touches[0];
    const rect = currentElement.getBoundingClientRect();
    touchOffsetX = touch.clientX - rect.left;
    touchOffsetY = touch.clientY - rect.top;
    currentElement.classList.add('dragging');
    currentElement.style.position='fixed';
    currentElement.style.zIndex='1000';
    currentElement.style.width = rect.width + 'px';
    currentElement.style.left = (touch.clientX - touchOffsetX) + 'px';
    currentElement.style.top  = (touch.clientY - touchOffsetY) + 'px';
    currentElement.dataset.originalContainer = currentElement.parentElement.id || '';
  }
  function handleDragTouchMove(e){
    if (!currentElement) return;
    e.preventDefault();
    const touch = e.touches[0];
    currentElement.style.left = (touch.clientX - touchOffsetX) + 'px';
    currentElement.style.top  = (touch.clientY - touchOffsetY) + 'px';
    const slots = document.querySelectorAll('.drop-slot');
    let newActive = null;
    slots.forEach(slot=>{
      const r = slot.getBoundingClientRect();
      if (touch.clientX>r.left && touch.clientX<r.right && touch.clientY>r.top && touch.clientY<r.bottom){
        slot.classList.add('highlight'); newActive = slot;
      }else{ slot.classList.remove('highlight'); }
    });
    if (activeDropSlot !== newActive){
      if (activeDropSlot) activeDropSlot.classList.remove('highlight');
      activeDropSlot = newActive;
    }
  }
  function improvedHandleDragTouchEnd(e){
    if (!currentElement) return;
    e.preventDefault();
    const dropSlots = [...document.querySelectorAll('.drop-slot')];
    const rect = currentElement.getBoundingClientRect();
    const center = {x:rect.left+rect.width/2, y:rect.top+rect.height/2};
    let closest = null; let minD = Infinity;
    dropSlots.forEach(slot=>{
      const sr = slot.getBoundingClientRect();
      const sc = {x:sr.left+sr.width/2, y:sr.top+sr.height/2};
      const d = Math.hypot(center.x-sc.x, center.y-sc.y);
      if (d<minD && d<150){ minD=d; closest=slot; }
    });
    if (closest){
      if (currentElement.parentElement.classList.contains('drop-slot')){
        currentElement.parentElement.innerHTML = `<small>Position ${parseInt(currentElement.parentElement.dataset.position,10)+1}</small>`;
      }
      closest.innerHTML='';
      closest.appendChild(currentElement);
      vibrate(closest);
    }else{
      const origId = currentElement.dataset.originalContainer;
      if (origId){
        const orig = document.getElementById(origId);
        if (orig) orig.appendChild(currentElement);
      }
    }
    currentElement.classList.remove('dragging');
    currentElement.style.position=''; currentElement.style.top=''; currentElement.style.left=''; currentElement.style.zIndex=''; currentElement.style.width='';
    currentElement=null;
    document.querySelectorAll('.drop-slot').forEach(s=>s.classList.remove('highlight'));
  }
  function handleSlotTouchStart(e){
    const slot = e.target.closest('.drop-slot');
    if (!slot || !slot.querySelector('.draggable')) return;
    e.preventDefault();
    currentElement = slot.querySelector('.draggable');
    const touch = e.touches[0];
    const rect = currentElement.getBoundingClientRect();
    touchOffsetX = touch.clientX - rect.left;
    touchOffsetY = touch.clientY - rect.top;
    currentElement.classList.add('dragging');
    currentElement.style.position='fixed';
    currentElement.style.zIndex='1000';
    currentElement.style.width = rect.width + 'px';
    currentElement.style.left = (touch.clientX - touchOffsetX) + 'px';
    currentElement.style.top  = (touch.clientY - touchOffsetY) + 'px';
  }
  function handleSlotTouchMove(e){
    if (!currentElement) return;
    e.preventDefault();
    const touch = e.touches[0];
    currentElement.style.left = (touch.clientX - touchOffsetX) + 'px';
    currentElement.style.top  = (touch.clientY - touchOffsetY) + 'px';
    const slots = document.querySelectorAll('.drop-slot');
    let newActive = null;
    slots.forEach(slot=>{
      const r = slot.getBoundingClientRect();
      if (touch.clientX>r.left && touch.clientX<r.right && touch.clientY>r.top && touch.clientY<r.bottom){
        slot.classList.add('highlight'); newActive = slot;
      }else{ slot.classList.remove('highlight'); }
    });
    if (activeDropSlot !== newActive){
      if (activeDropSlot) activeDropSlot.classList.remove('highlight');
      activeDropSlot = newActive;
    }
  }

  function startTimer(){
    timeLeft = timePerQuestion;
    updateTimerDisplay();
    clearInterval(timer);
    timer = setInterval(()=>{
      timeLeft--;
      updateTimerDisplay();
      if (timeLeft<=0){ clearInterval(timer); handleTimeOut(); }
    },1000);
  }
  function updateTimerDisplay(){
    const t = document.getElementById('timer');
    t.textContent = `Verbleibende Zeit: ${timeLeft} Sekunden`;
    t.style.backgroundColor = (timeLeft<=10 ? '#c0392b' : '#e74c3c');
  }
  function handleTimeOut(){
    const frage = aktuelleFragen[currentIndex];
    const fb = document.getElementById('feedbackContainer');
    fb.className='answer-feedback incorrect';
    fb.innerHTML = `<strong>✗ Zeit abgelaufen!</strong><br><strong>Richtige Antwort:</strong> ${frage.RichtigeAntwort||''}<br>${frage.Erklaerung||'Keine Erklärung verfügbar'}`;
    antwortenLog.push({frage:frage.Frage,userAntwort:'Keine Antwort (Zeit abgelaufen)', richtigeAntwort:frage.RichtigeAntwort, erklaerung:frage.Erklaerung||'Keine Erklärung verfügbar'});
    fb.classList.remove('hidden');
    document.getElementById('confirmBtn').disabled=true;
    const next = document.getElementById('nextBtn');
    next.classList.remove('hidden'); next.disabled=false;
  }

  function updateProgressBar(){
    const progress = (currentIndex/aktuelleFragen.length)*100;
    document.getElementById('progressBar').style.width = `${progress}%`;
  }

  document.getElementById('confirmBtn').addEventListener('click', ()=>{
    clearInterval(timer);
    const frage = aktuelleFragen[currentIndex];
    let userAntwort = ''; let isCorrect=false; let correctAnswer='';

    switch(frage.Typ){
      case 'True/False': {
        const selected = document.querySelector('input[name="antwort"]:checked');
        userAntwort = selected ? selected.value : '';
        correctAnswer = frage.RichtigeAntwort || '';
        isCorrect = (userAntwort === correctAnswer);
        break;
      }
      case 'Multiple Choice': {
        const selected = [...document.querySelectorAll('input[type="checkbox"]:checked')];
        userAntwort = selected.map(cb=>cb.value).sort().join(', ');
        correctAnswer = (frage.RichtigeAntwort||'').split(',').map(s=>s.trim()).sort().join(', ');
        isCorrect = (userAntwort === correctAnswer);
        break;
      }
      case 'Drag-and-Drop': {
        const slots = [...document.querySelectorAll('#dropZone .drop-slot')].sort((a,b)=>parseInt(a.dataset.position,10)-parseInt(b.dataset.position,10));
        const userAnswers = slots.map(s=>s.querySelector('.draggable')?.textContent.trim() || '');
        if (userAnswers.some(a=>a==='')){ alert('Bitte füllen Sie alle Zuordnungsfelder aus!'); return; }
        const nUser = userAnswers.map(a=>a.toLowerCase().trim());
        const nCorrect = (frage.richtigeReihenfolge||[]).map(a=>(a||'').toLowerCase().trim());
        isCorrect = (nUser.length===nCorrect.length) && nUser.every((a,i)=>a===nCorrect[i]);
        userAntwort = userAnswers.join(', ');
        correctAnswer = (frage.richtigeReihenfolge||[]).join(', ');
        markDropSlotsAfterEvaluation(frage, isCorrect);
        break;
      }
    }

    const fb = document.getElementById('feedbackContainer');
    if (isCorrect){
      score++;
      fb.className='answer-feedback correct';
      fb.innerHTML = `<strong>✓ Richtig!</strong><br>${frage.Erklaerung||'Keine Erklärung verfügbar'}`;
    }else{
      fb.className='answer-feedback incorrect';
      fb.innerHTML = `<strong>✗ Falsch!</strong><br><strong>Richtige Antwort:</strong> ${correctAnswer}<br>${frage.Erklaerung||'Keine Erklärung verfügbar'}`;
    }
    antwortenLog.push({frage:frage.Frage, userAntwort, richtigeAntwort:correctAnswer, erklaerung:frage.Erklaerung||'Keine Erklärung verfügbar'});
    fb.classList.remove('hidden');
    document.getElementById('confirmBtn').disabled = true;
    const next = document.getElementById('nextBtn');
    next.classList.remove('hidden'); next.disabled=false;
  });

  document.getElementById('nextBtn').addEventListener('click', ()=>{
    currentIndex++; zeigeFrage();
  });

  function markDropSlotsAfterEvaluation(frage, isCorrect){
    const slots = [...document.querySelectorAll('.drop-slot')].sort((a,b)=>parseInt(a.dataset.position,10)-parseInt(b.dataset.position,10));
    const userAnswers = slots.map(s=>s.querySelector('.draggable')?.textContent.trim() || '');
    slots.forEach((slot, i)=>{
      const userA = userAnswers[i];
      const correctA = (frage.richtigeReihenfolge||[])[i]?.trim() || '';
      if (isCorrect){ slot.classList.add('correct-slot'); }
      else{
        if (userA === correctA) slot.classList.add('correct-slot');
        else if (userA) slot.classList.add('incorrect-slot');
      }
    });
  }

  document.getElementById('restartBtn').addEventListener('click', ()=>{
    document.getElementById('resultContainer').style.display='none';
    document.getElementById('fileSelectionContainer').classList.remove('hidden');
    document.getElementById('modeSelection').classList.add('hidden');
    document.getElementById('quizContainer').classList.add('hidden');
    document.getElementById('settingsContainer').classList.add('hidden');
    document.getElementById('fileSelect').value='';
  });

  function zeigeErgebnisse(){
    clearInterval(timer);
    const prozent = Math.round((score/aktuelleFragen.length)*100);
    const note = berechneNote(prozent);
    document.getElementById('quizContainer').classList.add('hidden');
    document.getElementById('resultContainer').style.display='block';
    document.getElementById('scoreDisplay').innerHTML = `
      <h3>Zusammenfassung für ${window.currentUser||'-'}</h3>
      <p>Richtige Antworten: <strong>${score}/${aktuelleFragen.length}</strong></p>
      <p>Erreichte Punktzahl: <strong>${prozent}%</strong></p>
      <p>Note: <strong>${note}</strong></p>`;
    const tbody = document.querySelector('#resultTable tbody');
    tbody.innerHTML='';
    antwortenLog.forEach(item=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${item.frage}</td><td>${item.userAntwort||'Keine Antwort'}</td><td>${item.richtigeAntwort}</td><td>${item.erklaerung}</td>`;
      tbody.appendChild(tr);
    });
  }

  // Upload
  async function uploadExcelFile(file, filename){
    const fd = new FormData();
    fd.append('file', file); fd.append('filename', filename);
    const res = await fetch(`${BASE_URL}upload`, { method:'POST', body:fd });
    if (!res.ok){
      const text = await res.text();
      try{ const j = JSON.parse(text); throw new Error(j.error || 'Upload fehlgeschlagen'); }
      catch{ throw new Error(text || 'Serverfehler'); }
    }
    return await res.json();
  }

  document.getElementById('fileUploadForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fileInput = document.getElementById('fileToUpload');
    const fileNameInput = document.getElementById('fileName');
    const uploadStatus = document.getElementById('uploadStatus');
    if (!fileInput.files.length || !fileNameInput.value){ alert('Bitte Datei und Namen angeben!'); return; }
    const file = fileInput.files[0];
    const fileName = fileNameInput.value.trim()+'.xlsx';
    if (!file.name.endsWith('.xlsx')){ alert('Nur .xlsx erlaubt!'); return; }
    uploadStatus.textContent='Datei wird hochgeladen...'; uploadStatus.style.color='inherit';
    try{
      const result = await uploadExcelFile(file, fileName);
      uploadStatus.textContent = result.message || 'Datei erfolgreich hochgeladen!';
      uploadStatus.style.color='green';
      fileInput.value=''; fileNameInput.value='';
      loadAvailableFiles();
    }catch(err){
      uploadStatus.textContent = 'Fehler: '+err.message; uploadStatus.style.color='red';
    }
  });

  async function loadExcelFileForEditing(filename){
    try{
      const res = await fetch(`${BASE_URL}files/${filename}`);
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), {type:'array'});
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);
      displayExcelData(data, filename);
    }catch(err){
      alert('Fehler beim Laden der Datei: '+err.message);
    }
  }

  function displayExcelData(data, filename){
    const editor = document.getElementById('excelEditor');
    const table = document.getElementById('excelTable');
    editor.classList.remove('hidden');
    table.querySelector('thead').innerHTML='';
    table.querySelector('tbody').innerHTML='';
    const headers = Object.keys(data[0]||{});
    const hr = document.createElement('tr');
    headers.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; hr.appendChild(th); });
    table.querySelector('thead').appendChild(hr);
    data.forEach((row, idx)=>{
      const tr = document.createElement('tr');
      headers.forEach(h=>{
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type='text'; input.value = row[h] || ''; input.dataset.header=h; input.dataset.rowIndex=String(idx);
        td.appendChild(input); tr.appendChild(td);
      });
      table.querySelector('tbody').appendChild(tr);
    });
    document.getElementById('saveExcelBtn').onclick = ()=>saveExcelChanges(filename);
    document.getElementById('cancelEditBtn').onclick = ()=>editor.classList.add('hidden');
  }

  async function saveExcelChanges(filename){
    const table = document.getElementById('excelTable');
    const inputs = table.querySelectorAll('input');
    const headers = [...table.querySelectorAll('th')].map(th=>th.textContent);
    const rowCount = Math.max(...[...inputs].map(i=>parseInt(i.dataset.rowIndex,10)),0)+1;
    const out = [];
    for (let i=0;i<rowCount;i++){
      const row = {};
      headers.forEach(h=>{
        const el = table.querySelector(`input[data-header="${h}"][data-row-index="${i}"]`);
        if (el) row[h]=el.value;
      });
      out.push(row);
    }
    try{
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(out);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = XLSX.write(wb, {bookType:'xlsx', type:'array'});
      const res = await fetch(`${BASE_URL}save`, {
        method:'POST',
        headers:{ 'Content-Type':'application/octet-stream', 'X-Filename': filename },
        body: buffer
      });
      if (!res.ok) throw new Error('Speichern fehlgeschlagen');
      alert('Änderungen erfolgreich gespeichert!');
      document.getElementById('excelEditor').classList.add('hidden');
    }catch(err){
      alert('Fehler beim Speichern: '+err.message);
    }
  }

  function shuffleArray(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }
  function berechneNote(p){ if (p>=90) return "1, Sehr gut"; if (p>=80) return "2, Gut"; if (p>=65) return "3, Befriedigend"; if (p>=50) return "4, Ausreichend"; return "5, Nicht ausreichend"; }

  document.addEventListener('DOMContentLoaded', ()=>{
    if (typeof window.loadUsersFromStorage === 'function') window.loadUsersFromStorage();
    if (typeof window.initTheme === 'function') window.initTheme();
    setupModeSelection();
    loadAvailableFiles();
    // Admin-Startseite default
    const firstAdminItem = document.querySelector('.admin-menu-item[data-section="userManagement"]');
    if (firstAdminItem) firstAdminItem.click(); // pre-select for rendering
  });
})();
