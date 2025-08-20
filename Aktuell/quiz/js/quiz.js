// quiz.js – Moduswahl, Timer, Auswertung
function setupModeSelection(){
  document.getElementById('lzkModeBtn').addEventListener('click', ()=>{
    document.getElementById('modeSelection').classList.add('hidden');
    document.getElementById('settingsContainer').classList.remove('hidden');
    document.getElementById('timeLimitContainer').classList.remove('hidden');
    isLZKMode=true; addSkipButton();
  });
  document.getElementById('learnModeBtn').addEventListener('click', ()=>{
    document.getElementById('modeSelection').classList.add('hidden');
    document.getElementById('settingsContainer').classList.remove('hidden');
    document.getElementById('timeLimitContainer').classList.add('hidden');
    isLZKMode=false; addSkipButton();
  });
  document.getElementById('startQuizBtn').addEventListener('click', ()=>{
    questionCount=parseInt(document.getElementById('questionCount').value);
    if(isLZKMode) timePerQuestion=parseInt(document.getElementById('timeLimit').value);
    showQuizConfirmationDialog();
  });
}

function showQuizConfirmationDialog(){
  const dlg=document.createElement('div');
  dlg.className='confirmation-dialog';
  dlg.innerHTML=`<h3>Quiz starten mit folgenden Einstellungen:</h3>
    <p>Modus: ${isLZKMode?'LZK-Modus':'Lern-Modus'}</p>
    <p>Anzahl Fragen: ${questionCount}</p>
    ${isLZKMode?`<p>Zeit pro Frage: ${timePerQuestion} Sekunden</p>`:''}
    <button id="confirmStartBtn">Starten</button>
    <button id="cancelStartBtn">Abbrechen</button>`;
  document.body.appendChild(dlg);
  dlg.querySelector('#confirmStartBtn').addEventListener('click', ()=>{
    dlg.remove(); document.getElementById('settingsContainer').classList.add('hidden'); startQuiz(isLZKMode);
  });
  dlg.querySelector('#cancelStartBtn').addEventListener('click', ()=>dlg.remove());
}

function addSkipButton(){
  if(!isLZKMode){
    const grp=document.querySelector('.button-group');
    if(!document.getElementById('skipBtn')){
      const b=document.createElement('button'); b.id='skipBtn'; b.textContent='Überspringen';
      b.addEventListener('click', ()=>{ currentIndex++; zeigeFrage(); });
      grp.appendChild(b);
    }
  }else{
    const b=document.getElementById('skipBtn'); if(b) b.remove();
  }
}

async function startQuiz(isLZK){
  isLZKMode=isLZK;
  const res=await fetch(`${BASE_URL}files/${selectedFile}`);
  const buf=await res.arrayBuffer();
  const data=new Uint8Array(buf);
  const wb=XLSX.read(data,{type:'array'});
  const sheet=wb.Sheets[wb.SheetNames[0]];
  fragen=XLSX.utils.sheet_to_json(sheet);
  fragen.forEach(f=>{
    if(f.Typ==='Drag-and-Drop'){ f.richtigeReihenfolge=parseDragDropAnswer(f.RichtigeAntwort); }
    if(!f.Erklaerung){ f.Erklaerung='Keine Erklärung verfügbar'; }
  });
  aktuelleFragen=[...fragen].sort(()=>0.5-Math.random()).slice(0, questionCount);
  currentIndex=0; score=0; antwortenLog=[];
  document.getElementById('modeSelection').classList.add('hidden');
  document.getElementById('quizContainer').classList.remove('hidden');
  document.getElementById('timer').classList.toggle('hidden', !isLZKMode);
  document.getElementById('totalQuestions').textContent=aktuelleFragen.length;
  zeigeFrage();
}

function parseDragDropAnswer(s){
  const parts=s.split(',').map(p=>p.trim()); const arr=[];
  parts.forEach(part=>{
    const [k,v]=part.split('=').map(x=>x.trim()); const n=parseInt(k);
    if(!isNaN(n)) arr[n-1]=v;
  });
  return arr.filter(x=>x!==undefined);
}

function zeigeFrage(){
  if(currentIndex>=aktuelleFragen.length){ zeigeErgebnisse(); return; }
  clearInterval(timer);
  if(isLZKMode) startTimer();
  const frage=aktuelleFragen[currentIndex];
  document.getElementById('currentQuestion').textContent=currentIndex+1;
  document.getElementById('questionText').textContent=frage.Frage;
  const container=document.getElementById('optionsContainer'); container.innerHTML='';
  document.getElementById('confirmBtn').disabled=false;
  document.getElementById('nextBtn').classList.add('hidden');
  document.getElementById('feedbackContainer').classList.add('hidden');
  if(frage.Typ==='True/False'){
    container.innerHTML = `<div style="display:flex;gap:20px;justify-content:center;">
      <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="antwort" value="Wahr">Wahr</label>
      <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="antwort" value="Falsch">Falsch</label>
    </div>`;
  }else if(frage.Typ==='Multiple Choice'){
    const options=frage.Optionen.split(',').map(o=>o.trim());
    options.forEach(opt=>{
      container.innerHTML += `<label style="display:block;margin:10px 0;padding:10px;background:var(--dragzone-bg);border-radius:5px;">
        <input type="checkbox" value="${opt}" style="margin-right:10px;">${opt}
      </label>`;
    });
  }else if(frage.Typ==='Drag-and-Drop'){
    container.innerHTML = `<div style="margin-bottom:20px;"><h3 style="margin-bottom:10px;">Optionen:</h3><div class="drag-zone" id="dragZone"></div></div>
      <div><h3 style="margin-bottom:10px;">Ihre Zuordnung:</h3><div class="drop-zone" id="dropZone"></div></div>`;
    initDragDrop(frage);
  }
  updateProgressBar();
}

function startTimer(){
  timeLeft=timePerQuestion; updateTimerDisplay();
  clearInterval(timer);
  timer=setInterval(()=>{ timeLeft--; updateTimerDisplay(); if(timeLeft<=0){ clearInterval(timer); handleTimeOut(); } },1000);
}
function updateTimerDisplay(){
  const t=document.getElementById('timer'); t.textContent=`Verbleibende Zeit: ${timeLeft} Sekunden`; 
  t.style.backgroundColor = timeLeft<=10 ? '#c0392b' : '#e74c3c';
}

function handleTimeOut(){
  const frage=aktuelleFragen[currentIndex];
  const fb=document.getElementById('feedbackContainer');
  fb.className='answer-feedback incorrect';
  fb.innerHTML = `<strong>✗ Zeit abgelaufen!</strong><br><strong>Richtige Antwort:</strong> ${frage.RichtigeAntwort}<br>${frage.Erklaerung}`;
  antwortenLog.push({frage:frage.Frage,userAntwort:'Keine Antwort (Zeit abgelaufen)',richtigeAntwort:frage.RichtigeAntwort,erklaerung:frage.Erklaerung});
  fb.classList.remove('hidden');
  document.getElementById('confirmBtn').disabled=true;
  const nextBtn=document.getElementById('nextBtn'); nextBtn.classList.remove('hidden'); nextBtn.disabled=false;
}

function updateProgressBar(){
  const progress=(currentIndex/aktuelleFragen.length)*100; document.getElementById('progressBar').style.width=`${progress}%`;
}

document.getElementById('confirmBtn').addEventListener('click', ()=>{
  clearInterval(timer);
  const frage=aktuelleFragen[currentIndex];
  let userAntwort=''; let isCorrect=false; let correctAnswer='';
  if(frage.Typ==='True/False'){
    const sel=document.querySelector('input[name="antwort"]:checked'); userAntwort=sel?sel.value:'';
    correctAnswer=frage.RichtigeAntwort; isCorrect=(userAntwort===correctAnswer);
  }else if(frage.Typ==='Multiple Choice'){
    const cbs=[...document.querySelectorAll('input[type="checkbox"]:checked')];
    userAntwort=cbs.map(cb=>cb.value).sort().join(', ');
    correctAnswer=frage.RichtigeAntwort.split(',').map(s=>s.trim()).sort().join(', ');
    isCorrect=(userAntwort===correctAnswer);
  }else if(frage.Typ==='Drag-and-Drop'){
    const slots=[...document.querySelectorAll('#dropZone .drop-slot')].sort((a,b)=>parseInt(a.dataset.position)-parseInt(b.dataset.position));
    const answers=slots.map(slot=>slot.querySelector('.draggable')?.textContent.trim()||'');
    if(answers.some(a=>a==='')){ alert('Bitte füllen Sie alle Zuordnungsfelder aus!'); return; }
    const normUser=answers.map(a=>a.toLowerCase().trim());
    const normCorrect=frage.richtigeReihenfolge.map(a=>a.toLowerCase().trim());
    isCorrect=normUser.length===normCorrect.length && normUser.every((a,i)=>a===normCorrect[i]);
    userAntwort=answers.join(', '); correctAnswer=frage.richtigeReihenfolge.join(', ');
    markDropSlotsAfterEvaluation(frage, isCorrect);
  }
  const fb=document.getElementById('feedbackContainer');
  if(isCorrect){
    score++; fb.className='answer-feedback correct';
    fb.innerHTML=`<strong>✓ Richtig!</strong><br>${frage.Erklaerung}`;
  }else{
    fb.className='answer-feedback incorrect';
    fb.innerHTML=`<strong>✗ Falsch!</strong><br><strong>Richtige Antwort:</strong> ${correctAnswer}<br>${frage.Erklaerung}`;
  }
  antwortenLog.push({frage:frage.Frage,userAntwort,richtigeAntwort:correctAnswer,erklaerung:frage.Erklaerung});
  fb.classList.remove('hidden');
  document.getElementById('confirmBtn').disabled=true;
  const nextBtn=document.getElementById('nextBtn'); nextBtn.classList.remove('hidden'); nextBtn.disabled=false;
});

document.getElementById('nextBtn').addEventListener('click', ()=>{ currentIndex++; zeigeFrage(); });

function zeigeErgebnisse(){
  clearInterval(timer);
  const prozent=Math.round((score/aktuelleFragen.length)*100);
  const note = prozent>=90?'1, Sehr gut':prozent>=80?'2, Gut':prozent>=65?'3, Befriedigend':prozent>=50?'4, Ausreichend':'5, Nicht ausreichend';
  document.getElementById('quizContainer').classList.add('hidden');
  document.getElementById('resultContainer').style.display='block';
  document.getElementById('scoreDisplay').innerHTML=`
    <h3>Zusammenfassung für ${currentUser}</h3>
    <p>Richtige Antworten: <strong>${score}/${aktuelleFragen.length}</strong></p>
    <p>Erreichte Punktzahl: <strong>${prozent}%</strong></p>
    <p>Note: <strong>${note}</strong></p>`;
  const tbody=document.querySelector('#resultTable tbody'); tbody.innerHTML='';
  antwortenLog.forEach(item=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${item.frage}</td><td>${item.userAntwort||'Keine Antwort'}</td><td>${item.richtigeAntwort}</td><td>${item.erklaerung}</td>`;
    tbody.appendChild(tr);
  });
}
