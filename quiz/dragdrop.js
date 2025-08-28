/*
 * Drag‑and‑Drop‑Funktionen. Dieses Modul kapselt die gesamte Logik
 * rund um Zuordnungsfragen. Es bietet Funktionen zum Initialisieren der
 * Drag‑Zonen, zum Behandeln von Berührungsereignissen und zur
 * farblichen Markierung nach der Auswertung. Die Funktionen werden an
 * window angehängt, damit quiz.js sie aufrufen kann.
 */

(() => {
  // Vibrationsfunktion für haptisches Feedback
  function vibrate(element) {
    element.classList.add('vibrate');
    setTimeout(() => {
      element.classList.remove('vibrate');
    }, 300);
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }

  // Verbesserte Touch‑Handler
  let currentElement = null;
  let activeDropSlot = null;
  let touchOffsetX = 0;
  let touchOffsetY = 0;

  function handleDragTouchStart(e) {
    e.preventDefault();
    currentElement = e.target;
    const touch = e.touches[0];
    const rect = currentElement.getBoundingClientRect();
    touchOffsetX = touch.clientX - rect.left;
    touchOffsetY = touch.clientY - rect.top;
    currentElement.classList.add('dragging');
    currentElement.style.position = 'fixed';
    currentElement.style.zIndex = '1000';
    currentElement.style.width = rect.width + 'px';
    currentElement.style.left = (touch.clientX - touchOffsetX) + 'px';
    currentElement.style.top = (touch.clientY - touchOffsetY) + 'px';
    currentElement.dataset.originalContainer = currentElement.parentElement.id;
  }

  function handleDragTouchMove(e) {
    if (!currentElement) return;
    e.preventDefault();
    const touch = e.touches[0];
    currentElement.style.left = (touch.clientX - touchOffsetX) + 'px';
    currentElement.style.top = (touch.clientY - touchOffsetY) + 'px';
    const slots = document.querySelectorAll('.drop-slot');
    let newActiveSlot = null;
    slots.forEach(slot => {
      const rect = slot.getBoundingClientRect();
      if (touch.clientX > rect.left && touch.clientX < rect.right &&
          touch.clientY > rect.top && touch.clientY < rect.bottom) {
        slot.classList.add('highlight');
        newActiveSlot = slot;
      } else {
        slot.classList.remove('highlight');
      }
    });
    if (activeDropSlot !== newActiveSlot) {
      if (activeDropSlot) {
        activeDropSlot.classList.remove('highlight');
      }
      activeDropSlot = newActiveSlot;
    }
  }

  function improvedHandleDragTouchEnd(e) {
    if (!currentElement) return;
    e.preventDefault();
    const dropSlots = [...document.querySelectorAll('.drop-slot')];
    const elementRect = currentElement.getBoundingClientRect();
    const elementCenter = {
      x: elementRect.left + elementRect.width / 2,
      y: elementRect.top + elementRect.height / 2
    };
    let closestSlot = null;
    let minDistance = Infinity;
    dropSlots.forEach(slot => {
      if (slot.dataset.filled === 'true' && slot !== currentElement.parentElement) return;
      const rect = slot.getBoundingClientRect();
      const slotCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      const distance = Math.sqrt(
        Math.pow(elementCenter.x - slotCenter.x, 2) +
        Math.pow(elementCenter.y - slotCenter.y, 2)
      );
      if (distance < minDistance && distance < 150) {
        minDistance = distance;
        closestSlot = slot;
      }
    });
    if (closestSlot) {
      // Element aus vorherigem Slot entfernen
      if (currentElement.parentElement.classList.contains('drop-slot')) {
        currentElement.parentElement.dataset.filled = 'false';
        currentElement.parentElement.innerHTML = `<small>Position ${parseInt(currentElement.parentElement.dataset.position) + 1}</small>`;
      }
      closestSlot.innerHTML = '';
      closestSlot.appendChild(currentElement);
      closestSlot.dataset.filled = 'true';
      vibrate(closestSlot);
    } else {
      // Zurück zur Drag‑Zone
      const originalContainer = document.getElementById(currentElement.dataset.originalContainer);
      originalContainer.appendChild(currentElement);
    }
    currentElement.classList.remove('dragging');
    currentElement.style.position = '';
    currentElement.style.top = '';
    currentElement.style.left = '';
    currentElement.style.zIndex = '';
    currentElement.style.width = '';
    currentElement = null;
    document.querySelectorAll('.drop-slot').forEach(slot => slot.classList.remove('highlight'));
  }

  function handleSlotTouchStart(e) {
    const slot = e.target.closest('.drop-slot');
    if (!slot || !slot.querySelector('.draggable')) return;
    e.preventDefault();
    currentElement = slot.querySelector('.draggable');
    const touch = e.touches[0];
    const rect = currentElement.getBoundingClientRect();
    touchOffsetX = touch.clientX - rect.left;
    touchOffsetY = touch.clientY - rect.top;
    currentElement.classList.add('dragging');
    currentElement.style.position = 'fixed';
    currentElement.style.zIndex = '1000';
    currentElement.style.width = rect.width + 'px';
    currentElement.style.left = (touch.clientX - touchOffsetX) + 'px';
    currentElement.style.top = (touch.clientY - touchOffsetY) + 'px';
  }

  function handleSlotTouchMove(e) {
    if (!currentElement) return;
    e.preventDefault();
    const touch = e.touches[0];
    currentElement.style.left = (touch.clientX - touchOffsetX) + 'px';
    currentElement.style.top = (touch.clientY - touchOffsetY) + 'px';
    const slots = document.querySelectorAll('.drop-slot');
    let newActiveSlot = null;
    slots.forEach(slot => {
      const rect = slot.getBoundingClientRect();
      if (touch.clientX > rect.left && touch.clientX < rect.right &&
          touch.clientY > rect.top && touch.clientY < rect.bottom) {
        slot.classList.add('highlight');
        newActiveSlot = slot;
      } else {
        slot.classList.remove('highlight');
      }
    });
    if (activeDropSlot !== newActiveSlot) {
      if (activeDropSlot) {
        activeDropSlot.classList.remove('highlight');
      }
      activeDropSlot = newActiveSlot;
    }
  }

  // Erstellt die Drop‑Slots und initialisiert die Drag‑Zonen für eine
  // gegebene Frage. Die Funktionen touchstart/move/end werden an die
  // jeweiligen Elemente gebunden.
  function initDragDrop(frage) {
    const dragZone = document.getElementById('dragZone');
    const dropZone = document.getElementById('dropZone');
    dropZone.innerHTML = '';
    const dropSlotsContainer = document.createElement('div');
    dropSlotsContainer.className = 'drop-slots-container';
    const richtigeReihenfolge = frage.richtigeReihenfolge || [];
    const slotCount = richtigeReihenfolge.length;
    for (let i = 0; i < slotCount; i++) {
      const slot = document.createElement('div');
      slot.className = 'drop-slot';
      slot.dataset.position = i;
      slot.innerHTML = `<small>Position ${i + 1}</small>`;
      slot.addEventListener('touchstart', handleSlotTouchStart, { passive: false });
      slot.addEventListener('touchmove', handleSlotTouchMove, { passive: false });
      slot.addEventListener('touchend', improvedHandleDragTouchEnd);
      dropSlotsContainer.appendChild(slot);
    }
    dropZone.appendChild(dropSlotsContainer);
    // Drag‑Elemente befüllen
    dragZone.innerHTML = '';
    const optionen = frage.Optionen.split(',').map(opt => opt.trim());
    shuffleArray(optionen);
    optionen.forEach(opt => {
      const elem = document.createElement('div');
      elem.className = 'draggable';
      elem.textContent = opt;
      elem.setAttribute('draggable', 'true');
      elem.dataset.value = opt;
      elem.addEventListener('touchstart', handleDragTouchStart, { passive: false });
      elem.addEventListener('touchmove', handleDragTouchMove, { passive: false });
      elem.addEventListener('touchend', improvedHandleDragTouchEnd);
      elem.addEventListener('dragstart', e => {
        currentElement = e.target;
        setTimeout(() => e.target.classList.add('dragging'), 0);
      });
      elem.addEventListener('dragend', e => {
        if (currentElement) {
          currentElement.classList.remove('dragging');
          currentElement = null;
        }
      });
      dragZone.appendChild(elem);
    });
    // Dragover und Drop Ereignisse auf der Drop‑Zone
    [dragZone, dropZone].forEach(zone => {
      zone.addEventListener('dragover', e => {
        e.preventDefault();
        const slot = e.target.closest('.drop-slot');
        if (slot) slot.classList.add('highlight');
      });
      zone.addEventListener('dragleave', e => {
        const slot = e.target.closest('.drop-slot');
        if (slot) slot.classList.remove('highlight');
      });
      zone.addEventListener('drop', e => {
        e.preventDefault();
        const slot = e.target.closest('.drop-slot');
        if (slot) slot.classList.remove('highlight');
        if (currentElement && slot) {
          const previousSlot = currentElement.closest('.drop-slot');
          if (previousSlot) {
            previousSlot.removeChild(currentElement);
            previousSlot.innerHTML = `<small>Position ${parseInt(previousSlot.dataset.position) + 1}</small>`;
            previousSlot.dataset.filled = 'false';
          }
          slot.appendChild(currentElement);
          slot.dataset.filled = 'true';
          currentElement = null;
        }
      });
    });
  }

  // Erzeugt ein Array aus der Drag‑and‑Drop‑Antwort im Format
  // "1=Antwort1, 2=Antwort2". Entfernt leere Einträge.
  function parseDragDropAnswer(antwort) {
    const parts = antwort.split(',').map(p => p.trim());
    const reihenfolge = [];
    parts.forEach(part => {
      const [key, value] = part.split('=').map(s => s.trim());
      const numKey = parseInt(key);
      if (!isNaN(numKey)) {
        reihenfolge[numKey - 1] = value;
      }
    });
    return reihenfolge.filter(item => item !== undefined);
  }

  // Setzt nach der Auswertung farbliche Markierungen auf den Drop‑Slots.
  function markDropSlotsAfterEvaluation(frage, isCorrect) {
    const dropSlots = [...document.querySelectorAll('.drop-slot')].sort((a, b) =>
      parseInt(a.dataset.position) - parseInt(b.dataset.position)
    );
    const userAnswers = dropSlots.map(slot => {
      const draggable = slot.querySelector('.draggable');
      return draggable ? draggable.textContent.trim() : '';
    });
    dropSlots.forEach((slot, index) => {
      const userAnswer = userAnswers[index];
      const correctAnswer = frage.richtigeReihenfolge[index]?.trim() || '';
      if (isCorrect) {
        slot.classList.add('correct-slot');
      } else {
        if (userAnswer === correctAnswer) {
          slot.classList.add('correct-slot');
        } else if (userAnswer) {
          slot.classList.add('incorrect-slot');
        }
      }
    });
  }

  // Hilfsfunktion zum Mischen eines Arrays (Fisher–Yates)
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // Exportieren
  window.initDragDrop = initDragDrop;
  window.parseDragDropAnswer = parseDragDropAnswer;
  window.markDropSlotsAfterEvaluation = markDropSlotsAfterEvaluation;
})();