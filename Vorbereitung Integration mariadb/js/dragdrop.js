// dragdrop.js – Touch/Drag-Logik & Slot-Markierung
function initDragDrop(frage){
  const dragZone=document.getElementById('dragZone');
  const dropZone=document.getElementById('dropZone');
  dropZone.innerHTML='';
  const cont=document.createElement('div'); cont.className='drop-slots-container';
  const count=(frage.richtigeReihenfolge||[]).length;
  for(let i=0;i<count;i++){
    const slot=document.createElement('div'); slot.className='drop-slot'; slot.dataset.position=i;
    slot.innerHTML=`<small>Position ${i+1}</small>`;
    slot.addEventListener('touchstart', handleSlotTouchStart, {passive:false});
    slot.addEventListener('touchmove', handleSlotTouchMove, {passive:false});
    slot.addEventListener('touchend', improvedHandleDragTouchEnd);
    cont.appendChild(slot);
  }
  dropZone.appendChild(cont);
  const optionen=frage.Optionen.split(',').map(o=>o.trim()); shuffleArray(optionen);
  optionen.forEach(opt=>{
    const el=document.createElement('div'); el.className='draggable'; el.textContent=opt;
    el.setAttribute('draggable','true'); el.dataset.value=opt;
    el.addEventListener('touchstart', handleDragTouchStart, {passive:false});
    el.addEventListener('touchmove', handleDragTouchMove, {passive:false});
    el.addEventListener('touchend', improvedHandleDragTouchEnd);
    el.addEventListener('dragstart', (e)=>{ draggedItem=e.target; setTimeout(()=>e.target.classList.add('dragging'),0); });
    el.addEventListener('dragend', (e)=>{ e.target.classList.remove('dragging'); draggedItem=null; });
    dragZone.appendChild(el);
  });

  [dragZone, dropZone].forEach(zone=>{
    zone.addEventListener('dragover', (e)=>{
      e.preventDefault();
      if(!e.target.classList.contains('dragging')){
        const slot=e.target.closest('.drop-slot'); if(slot) slot.classList.add('highlight');
      }
    });
    zone.addEventListener('dragleave', (e)=>{
      const slot=e.target.closest('.drop-slot'); if(slot) slot.classList.remove('highlight');
    });
    zone.addEventListener('drop', (e)=>{
      e.preventDefault();
      const slot=e.target.closest('.drop-slot'); if(slot) slot.classList.remove('highlight');
      if(draggedItem && slot){
        const prev=draggedItem.closest('.drop-slot');
        if(prev){ prev.innerHTML = prev.dataset.position?`<small>Position ${parseInt(prev.dataset.position)+1}</small>`:''; }
        slot.innerHTML=''; slot.appendChild(draggedItem); slot.dataset.filled='true';
      }
    });
  });
}

function handleDragTouchStart(e){
  e.preventDefault();
  currentElement=e.target;
  const touch=e.touches[0];
  const rect=currentElement.getBoundingClientRect();
  touchOffsetX=touch.clientX-rect.left;
  touchOffsetY=touch.clientY-rect.top;
  currentElement.classList.add('dragging');
  currentElement.style.position='fixed';
  currentElement.style.zIndex='1000';
  currentElement.style.width=rect.width+'px';
  currentElement.style.left=(touch.clientX-touchOffsetX)+'px';
  currentElement.style.top=(touch.clientY-touchOffsetY)+'px';
  currentElement.dataset.originalContainer=currentElement.parentElement.id;
}
function handleDragTouchMove(e){
  if(!currentElement) return;
  e.preventDefault();
  const touch=e.touches[0];
  currentElement.style.left=(touch.clientX-touchOffsetX)+'px';
  currentElement.style.top=(touch.clientY-touchOffsetY)+'px';
  const slots=document.querySelectorAll('.drop-slot');
  let newActive=null;
  slots.forEach(slot=>{
    const r=slot.getBoundingClientRect();
    if(touch.clientX>r.left && touch.clientX<r.right && touch.clientY>r.top && touch.clientY<r.bottom){
      slot.classList.add('highlight'); newActive=slot;
    }else{ slot.classList.remove('highlight'); }
  });
  if(activeDropSlot!==newActive){ if(activeDropSlot) activeDropSlot.classList.remove('highlight'); activeDropSlot=newActive; }
}
function improvedHandleDragTouchEnd(e){
  if(!currentElement) return;
  e.preventDefault();
  const slots=[...document.querySelectorAll('.drop-slot')];
  const rect=currentElement.getBoundingClientRect();
  const center={x:rect.left+rect.width/2, y:rect.top+rect.height/2};
  let best=null, bestDist=Infinity;
  slots.forEach(slot=>{
    if(slot.dataset.filled==='true' && slot!==currentElement.parentElement) return;
    const r=slot.getBoundingClientRect();
    const c={x:r.left+r.width/2, y:r.top+r.height/2};
    const d=Math.hypot(center.x-c.x, center.y-c.y);
    if(d<bestDist && d<150){ best=slot; bestDist=d; }
  });
  if(best){
    if(currentElement.parentElement.classList.contains('drop-slot')){
      const prev=currentElement.parentElement;
      prev.dataset.filled='false';
      prev.innerHTML=`<small>Position ${parseInt(prev.dataset.position)+1}</small>`;
    }
    best.innerHTML=''; best.appendChild(currentElement); best.dataset.filled='true'; vibrate(best);
  }else{
    const orig=document.getElementById(currentElement.dataset.originalContainer); if(orig) orig.appendChild(currentElement);
  }
  currentElement.classList.remove('dragging');
  Object.assign(currentElement.style,{position:'',top:'',left:'',zIndex:'',width:''});
  currentElement=null;
  document.querySelectorAll('.drop-slot').forEach(s=>s.classList.remove('highlight'));
}

function handleSlotTouchStart(e){
  const slot=e.target.closest('.drop-slot'); if(!slot || !slot.querySelector('.draggable')) return;
  e.preventDefault();
  currentElement=slot.querySelector('.draggable');
  const touch=e.touches[0];
  const rect=currentElement.getBoundingClientRect();
  touchOffsetX=touch.clientX-rect.left; touchOffsetY=touch.clientY-rect.top;
  currentElement.classList.add('dragging');
  currentElement.style.position='fixed'; currentElement.style.zIndex='1000';
  currentElement.style.width=rect.width+'px';
  currentElement.style.left=(touch.clientX-touchOffsetX)+'px';
  currentElement.style.top=(touch.clientY-touchOffsetY)+'px';
}
function handleSlotTouchMove(e){
  if(!currentElement) return;
  e.preventDefault();
  const touch=e.touches[0];
  currentElement.style.left=(touch.clientX-touchOffsetX)+'px';
  currentElement.style.top=(touch.clientY-touchOffsetY)+'px';
  const slots=document.querySelectorAll('.drop-slot');
  let newActive=null;
  slots.forEach(slot=>{
    const r=slot.getBoundingClientRect();
    if(touch.clientX>r.left && touch.clientX<r.right && touch.clientY>r.top && touch.clientY<r.bottom){
      slot.classList.add('highlight'); newActive=slot;
    }else{ slot.classList.remove('highlight'); }
  });
  if(activeDropSlot!==newActive){ if(activeDropSlot) activeDropSlot.classList.remove('highlight'); activeDropSlot=newActive; }
}

function markDropSlotsAfterEvaluation(frage, isCorrect){
  const slots=[...document.querySelectorAll('.drop-slot')].sort((a,b)=>parseInt(a.dataset.position)-parseInt(b.dataset.position));
  const answers=slots.map(slot=>slot.querySelector('.draggable')?.textContent.trim()||'');
  slots.forEach((slot,i)=>{
    const user=answers[i]; const correct=frage.richtigeReihenfolge[i]?.trim()||'';
    if(isCorrect){ slot.classList.add('correct-slot'); }
    else{ if(user===correct) slot.classList.add('correct-slot'); else if(user) slot.classList.add('incorrect-slot'); }
  });
}
