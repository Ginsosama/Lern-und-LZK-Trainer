/*
 * Diese Datei implementiert die komplette Quizlogik des Lern- und
 * LZK‑Trainers. Sie sorgt für das Laden der verfügbaren Excel‑Dateien,
 * den Ablauf des Quiz, die Anzeige einzelner Fragen (inklusive
 * Drag‑and‑Drop‑Aufgaben) sowie für die Auswertung und das Anzeigen
 * der Ergebnisse. Viele Funktionen orientieren sich eng an der
 * ursprünglichen Vorlage und wurden modularisiert.
 */

(function () {
  const API_ROOT = 'http://209.25.141.16:4533/';

  // Einstellungen und Zustandsvariablen
  let selectedFile = null;
  let fragen = [];
  let aktuelleFragen = [];
  let currentIndex = 0;
  let score = 0;
  let antwortenLog = [];
  let timer;
  let timeLeft = 60;
  let isLZKMode = false;
  let questionCount = 20;
  let timePerQuestion = 60;

  /**
   * Lädt die Liste der verfügbaren Excel‑Dateien vom Server. Die Dateien
   * werden sowohl für das Quiz als auch für den Admin‑Bearbeiten‑Dialog
   * benötigt. Bei einem Fehler erscheint eine entsprechende Meldung in
   * der Selectbox.
   */
  async function loadAvailableFiles() {
    const select = document.getElementById('fileSelect');
    const editSelect = document.getElementById('editFileSelect');
    try {
      // Dateien werden vom Backend als JSON-Array geliefert.
      const response = await fetch(API_ROOT + 'files/');
      if (!response.ok) throw new Error('Fehler beim Abrufen der Dateien');
      const files = await response.json();
      // Quizdateien
      select.innerHTML = '<option value="">-- Datei auswählen --</option>';
      files.forEach(file => {
        const option = document.createElement('option');
        option.value = file;
        option.textContent = file;
        select.appendChild(option);
      });
      // Editorselect
      editSelect.innerHTML = '<option value="">-- Datei auswählen --</option>';
      files.forEach(file => {
        const opt = document.createElement('option');
        opt.value = file;
        opt.textContent = file;
        editSelect.appendChild(opt);
      });
    } catch (err) {
      select.innerHTML = `<option value="">-- Fehler: ${err.message} --</option>`;
      editSelect.innerHTML = `<option value="">-- Fehler: ${err.message} --</option>`;
    }
  }

  /**
   * Konfiguriert die Modusauswahl (LZK oder Lern). Zeigt anschließend
   * den Einstellungsdialog und fügt einen optionalen Überspringen‑Button
   * hinzu.
   */
  function setupModeSelection() {
    document.getElementById('lzkModeBtn').addEventListener('click', () => {
      document.getElementById('modeSelection').classList.add('hidden');
      document.getElementById('settingsContainer').classList.remove('hidden');
      document.getElementById('timeLimitContainer').classList.remove('hidden');
      isLZKMode = true;
      addSkipButton();
    });
    document.getElementById('learnModeBtn').addEventListener('click', () => {
      document.getElementById('modeSelection').classList.add('hidden');
      document.getElementById('settingsContainer').classList.remove('hidden');
      document.getElementById('timeLimitContainer').classList.add('hidden');
      isLZKMode = false;
      addSkipButton();
    });
    document.getElementById('startQuizBtn').addEventListener('click', () => {
      questionCount = parseInt(document.getElementById('questionCount').value);
      if (isLZKMode) {
        timePerQuestion = parseInt(document.getElementById('timeLimit').value);
      }
      showQuizConfirmationDialog();
    });
  }

  /**
   * Zeigt einen Bestätigungsdialog vor dem Quizstart. Wird der Start
   * bestätigt, wird das Quiz initialisiert und die erste Frage geladen.
   */
  function showQuizConfirmationDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'confirmation-dialog';
    dialog.innerHTML = `
      <h3>Quiz starten mit folgenden Einstellungen:</h3>
      <p>Modus: ${isLZKMode ? 'LZK-Modus' : 'Lern-Modus'}</p>
      <p>Anzahl Fragen: ${questionCount}</p>
      ${isLZKMode ? `<p>Zeit pro Frage: ${timePerQuestion} Sekunden</p>` : ''}
      <button id="confirmStartBtn">Starten</button>
      <button id="cancelStartBtn">Abbrechen</button>
    `;
    document.body.appendChild(dialog);
    dialog.querySelector('#confirmStartBtn').addEventListener('click', async () => {
      dialog.remove();
      document.getElementById('settingsContainer').classList.add('hidden');
      await startQuiz(isLZKMode);
    });
    dialog.querySelector('#cancelStartBtn').addEventListener('click', () => {
      dialog.remove();
    });
  }

  /**
   * Fügt einen Überspringen‑Button hinzu, falls nicht im LZK‑Modus.
   */
  function addSkipButton() {
    const buttonGroup = document.querySelector('.button-group');
    let skipBtn = document.getElementById('skipBtn');
    if (!isLZKMode) {
      if (!skipBtn) {
        skipBtn = document.createElement('button');
        skipBtn.id = 'skipBtn';
        skipBtn.textContent = 'Überspringen';
        skipBtn.addEventListener('click', () => {
          currentIndex++;
          showQuestion();
        });
        buttonGroup.appendChild(skipBtn);
      }
    } else if (skipBtn) {
      skipBtn.remove();
    }
  }

  /**
   * Startet das Quiz. Zunächst wird die ausgewählte Datei vom Server
   * geladen und mit der XLSX‑Bibliothek in ein JSON‑Array umgewandelt.
   * Anschließend werden die Fragen gemischt und auf die gewünschte
   * Anzahl reduziert.
   */
  async function startQuiz(isLZK) {
    isLZKMode = isLZK;
    try {
      // Die ausgewählte Quiz‑Datei wird ohne /api-Präfix geladen. Der
      // Pfad /files/<Dateiname> verweist auf den statischen Alias, der
      // die hochgeladenen Excel‑Dateien bereitstellt. Da der Rückgabewert
      // eine Binärdatei ist, wird er wie gewohnt ausgelesen.
      const response = await fetch(API_ROOT + 'files/' + encodeURIComponent(selectedFile));
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      fragen = XLSX.utils.sheet_to_json(sheet);
      fragen.forEach(frage => {
        if (frage.Typ === 'Drag-and-Drop') {
          frage.richtigeReihenfolge = window.parseDragDropAnswer(frage.RichtigeAntwort);
        }
        if (!frage.Erklaerung) {
          frage.Erklaerung = 'Keine Erklärung verfügbar';
        }
      });
      aktuelleFragen = [...fragen].sort(() => 0.5 - Math.random()).slice(0, questionCount);
      currentIndex = 0;
      score = 0;
      antwortenLog = [];
      document.getElementById('modeSelection').classList.add('hidden');
      document.getElementById('quizContainer').classList.remove('hidden');
      document.getElementById('timer').classList.toggle('hidden', !isLZKMode);
      document.getElementById('totalQuestions').textContent = aktuelleFragen.length;
      showQuestion();
    } catch (error) {
      console.error('Fehler beim Quizstart:', error);
      alert('Fehler beim Laden der Quiz-Datei: ' + error.message);
    }
  }

  /**
   * Zeigt die aktuelle Frage basierend auf dem Index. Bei Drag‑and‑Drop
   * werden die entsprechenden Slots initialisiert. Nach der letzten
   * Frage werden die Ergebnisse angezeigt.
   */
  function showQuestion() {
    if (currentIndex >= aktuelleFragen.length) {
      showResults();
      return;
    }
    clearInterval(timer);
    if (isLZKMode) startTimer();
    const frage = aktuelleFragen[currentIndex];
    document.getElementById('currentQuestion').textContent = currentIndex + 1;
    document.getElementById('questionText').textContent = frage.Frage;
    const container = document.getElementById('optionsContainer');
    container.innerHTML = '';
    document.getElementById('confirmBtn').disabled = false;
    document.getElementById('nextBtn').classList.add('hidden');
    document.getElementById('feedbackContainer').classList.add('hidden');
    switch (frage.Typ) {
      case 'True/False':
        container.innerHTML = `
          <div style="display: flex; gap: 20px; justify-content: center;">
            <label style="display: flex; align-items: center; gap: 5px;">
              <input type="radio" name="antwort" value="Wahr"> Wahr
            </label>
            <label style="display: flex; align-items: center; gap: 5px;">
              <input type="radio" name="antwort" value="Falsch"> Falsch
            </label>
          </div>
        `;
        break;
      case 'Multiple Choice':
        const options = frage.Optionen.split(',').map(opt => opt.trim());
        options.forEach(opt => {
          const label = document.createElement('label');
          label.style.display = 'block';
          label.style.margin = '10px 0';
          label.style.padding = '10px';
          label.style.background = 'var(--dragzone-bg)';
          label.style.borderRadius = '5px';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = opt;
          checkbox.style.marginRight = '10px';
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(opt));
          container.appendChild(label);
        });
        break;
      case 'Drag-and-Drop':
        container.innerHTML = `
          <div style="margin-bottom: 20px;">
            <h3 style="margin-bottom: 10px;">Optionen:</h3>
            <div class="drag-zone" id="dragZone"></div>
          </div>
          <div>
            <h3 style="margin-bottom: 10px;">Ihre Zuordnung:</h3>
            <div class="drop-zone" id="dropZone"></div>
          </div>
        `;
        window.initDragDrop(frage);
        break;
    }
    updateProgressBar();
  }

  /**
   * Startet den Timer für den LZK‑Modus. Bei Zeitüberschreitung wird
   * automatisch ausgewertet und zur nächsten Frage weitergeschaltet.
   */
  function startTimer() {
    timeLeft = timePerQuestion;
    updateTimerDisplay();
    clearInterval(timer);
    timer = setInterval(() => {
      timeLeft--;
      updateTimerDisplay();
      if (timeLeft <= 0) {
        clearInterval(timer);
        handleTimeOut();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const timerEl = document.getElementById('timer');
    timerEl.textContent = `Verbleibende Zeit: ${timeLeft} Sekunden`;
    timerEl.style.backgroundColor = timeLeft <= 10 ? '#c0392b' : '#e74c3c';
  }

  /**
   * Verarbeitet den Fall, dass im LZK‑Modus die Zeit abläuft. Es wird
   * keine Antwort gewertet, die richtige Antwort wird gezeigt und der
   * Benutzer kann zur nächsten Frage wechseln.
   */
  function handleTimeOut() {
    const frage = aktuelleFragen[currentIndex];
    document.getElementById('feedbackContainer').className = 'answer-feedback incorrect';
    document.getElementById('feedbackContainer').innerHTML = `
      <strong>✗ Zeit abgelaufen!</strong><br>
      <strong>Richtige Antwort:</strong> ${frage.RichtigeAntwort}<br>
      ${frage.Erklaerung}
    `;
    antwortenLog.push({
      frage: frage.Frage,
      userAntwort: 'Keine Antwort (Zeit abgelaufen)',
      richtigeAntwort: frage.RichtigeAntwort,
      erklaerung: frage.Erklaerung
    });
    document.getElementById('feedbackContainer').classList.remove('hidden');
    document.getElementById('confirmBtn').disabled = true;
    const nextBtn = document.getElementById('nextBtn');
    nextBtn.classList.remove('hidden');
    nextBtn.disabled = false;
  }

  /**
   * Aktualisiert den Fortschrittsbalken basierend auf der aktuellen Frage.
   */
  function updateProgressBar() {
    const progress = (currentIndex / aktuelleFragen.length) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
  }

  /**
   * Bestätigt die aktuelle Antwort. Der Antworttyp entscheidet über die
   * Auswertung. Nach der Auswertung werden Punkte vergeben und das
   * nächste‑Button aktiviert. Bei Drag‑and‑Drop wird zusätzlich die
   * farbliche Markierung ausgelöst.
   */
  document.getElementById('confirmBtn').addEventListener('click', () => {
    clearInterval(timer);
    const frage = aktuelleFragen[currentIndex];
    let userAntwort = '';
    let isCorrect = false;
    let correctAnswer = '';
    switch (frage.Typ) {
      case 'True/False': {
        const selected = document.querySelector('input[name="antwort"]:checked');
        userAntwort = selected ? selected.value : '';
        correctAnswer = frage.RichtigeAntwort;
        isCorrect = userAntwort === correctAnswer;
        break;
      }
      case 'Multiple Choice': {
        const selectedCheckboxes = [...document.querySelectorAll('input[type="checkbox"]:checked')];
        userAntwort = selectedCheckboxes.map(cb => cb.value).sort().join(', ');
        correctAnswer = frage.RichtigeAntwort.split(',').map(s => s.trim()).sort().join(', ');
        isCorrect = userAntwort === correctAnswer;
        break;
      }
      case 'Drag-and-Drop': {
        const dropSlots = [...document.querySelectorAll('#dropZone .drop-slot')].sort((a,b) => parseInt(a.dataset.position) - parseInt(b.dataset.position));
        const userAnswers = dropSlots.map(slot => {
          const draggable = slot.querySelector('.draggable');
          return draggable ? draggable.textContent.trim() : '';
        });
        if (userAnswers.some(ans => ans === '')) {
          alert('Bitte füllen Sie alle Zuordnungsfelder aus!');
          return;
        }
        const normalizedUser = userAnswers.map(a => a.toLowerCase().trim());
        const normalizedCorrect = frage.richtigeReihenfolge.map(a => a.toLowerCase().trim());
        isCorrect = normalizedUser.length === normalizedCorrect.length && normalizedUser.every((val, idx) => val === normalizedCorrect[idx]);
        userAntwort = userAnswers.join(', ');
        correctAnswer = frage.richtigeReihenfolge.join(', ');
        window.markDropSlotsAfterEvaluation(frage, isCorrect);
        break;
      }
    }
    if (isCorrect) {
      score++;
      document.getElementById('feedbackContainer').className = 'answer-feedback correct';
      document.getElementById('feedbackContainer').innerHTML = `
        <strong>✓ Richtig!</strong><br>
        ${frage.Erklaerung}
      `;
    } else {
      document.getElementById('feedbackContainer').className = 'answer-feedback incorrect';
      document.getElementById('feedbackContainer').innerHTML = `
        <strong>✗ Falsch!</strong><br>
        <strong>Richtige Antwort:</strong> ${correctAnswer}<br>
        ${frage.Erklaerung}
      `;
    }
    antwortenLog.push({
      frage: frage.Frage,
      userAntwort: userAntwort || 'Keine Antwort',
      richtigeAntwort: correctAnswer,
      erklaerung: frage.Erklaerung
    });
    document.getElementById('feedbackContainer').classList.remove('hidden');
    document.getElementById('confirmBtn').disabled = true;
    const nextBtn = document.getElementById('nextBtn');
    nextBtn.classList.remove('hidden');
    nextBtn.disabled = false;
  });

  /**
   * Listener für den "Nächste Frage"‑Button. Schaltet zur nächsten Frage
   * und zeigt sie an.
   */
  document.getElementById('nextBtn').addEventListener('click', () => {
    currentIndex++;
    showQuestion();
  });

  /**
   * Zeigt die Ergebnisse am Ende des Quiz an. Es werden sowohl die
   * Gesamtpunktzahl als auch die einzelnen Antworten dargestellt.
   */
  function showResults() {
    clearInterval(timer);
    const prozent = Math.round((score / aktuelleFragen.length) * 100);
    const note = calculateGrade(prozent);
    const noteVal = parseFloat(note);
    document.getElementById('quizContainer').classList.add('hidden');
    const resultCont = document.getElementById('resultContainer');
    resultCont.style.display = 'block';
    document.getElementById('scoreDisplay').innerHTML = `
      <h3>Zusammenfassung</h3>
      <p>Richtige Antworten: <strong>${score}/${aktuelleFragen.length}</strong></p>
      <p>Erreichte Punktzahl: <strong>${prozent}%</strong></p>
      <p>Note: <strong>${note}</strong></p>
    `;
    try {
      const sess = JSON.parse(localStorage.getItem('lzktrainer_session') || '{}');
      if (sess.u) {
        const stats = JSON.parse(localStorage.getItem('userStats') || '{}');
        const list = stats[sess.u] || [];
        list.push({ file: selectedFile, correct: score, total: aktuelleFragen.length, grade: noteVal });
        stats[sess.u] = list;
        localStorage.setItem('userStats', JSON.stringify(stats));
      }
    } catch (e) {}
    const tbody = document.querySelector('#resultTable tbody');
    tbody.innerHTML = '';
    antwortenLog.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.frage}</td>
        <td>${item.userAntwort || 'Keine Antwort'}</td>
        <td>${item.richtigeAntwort}</td>
        <td>${item.erklaerung}</td>
      `;
      tbody.appendChild(row);
    });
  }

  /**
   * Berechnet eine Schulnote basierend auf dem Prozentsatz richtig
   * beantworteter Fragen. Die Notenskala kann angepasst werden.
   */
  function calculateGrade(percent) {
    if (percent >= 90) return '1, Sehr gut';
    if (percent >= 80) return '2, Gut';
    if (percent >= 65) return '3, Befriedigend';
    if (percent >= 50) return '4, Ausreichend';
    return '5, Nicht ausreichend';
  }

  /**
   * Listener für die Dateiauswahl. Sobald eine Datei ausgewählt wird,
   * wechselt die Ansicht zur Modusauswahl.
   */
  document.getElementById('fileSelect').addEventListener('change', e => {
    selectedFile = e.target.value;
    if (selectedFile) {
      document.getElementById('fileSelectionContainer').classList.add('hidden');
      document.getElementById('modeSelection').classList.remove('hidden');
    }
  });

  // Neustart des Quiz
  document.getElementById('restartBtn').addEventListener('click', () => {
    document.getElementById('resultContainer').style.display = 'none';
    document.getElementById('fileSelectionContainer').classList.remove('hidden');
    document.getElementById('modeSelection').classList.add('hidden');
    document.getElementById('quizContainer').classList.add('hidden');
    document.getElementById('settingsContainer').classList.add('hidden');
    document.getElementById('fileSelect').value = '';
  });

  // Initialisierung nach dem DOM‑Load: Modusauswahl einrichten und
  // Dateiliste abrufen
  document.addEventListener('DOMContentLoaded', () => {
    setupModeSelection();
    loadAvailableFiles();
  });

  // Exporte (falls nötig)
  window.loadAvailableFiles = loadAvailableFiles;
})();