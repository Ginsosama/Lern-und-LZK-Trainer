/*
 * Verwaltungsfunktionen für Administratoren. Dieses Modul ermöglicht
 * Benutzermanagement (Anlegen, Löschen und Passwortänderung), die
 * Verwaltung temporärer Benutzer sowie das Hochladen und Bearbeiten von
 * Fragen-Dateien. Anfragen laufen host-/portgleich ohne /api-Präfix.
 */

(function () {
  const API_ROOT = "http://209.25.141.16:4533/";
  const MAX_PASSWORD_LENGTH = 20;
  // Aktuelle Benutzer im Speicher – für temporäre Benutzer wird
  // localStorage genutzt. In einer Datenbank könnten temporäre
  // Benutzer mit Ablaufdatum abgelegt werden. Hier erfolgt eine
  // clientseitige Verwaltung.
  let tempUsers = JSON.parse(localStorage.getItem('tempUsers') || '{}');
  let rouletteNames = [];
  let currentRoulette = '';
  let allUsers = [];

  function getCurrentRole() {
    try {
      const data = JSON.parse(localStorage.getItem('lzktrainer_session') || '{}');
      var role = data.r || data.role || '';
      return role ? role.toLowerCase() : '';
    } catch (e) {
      return '';
    }
  }

  function hasAdminAccess() {
    const role = getCurrentRole();
    return role === 'owner' || role === 'admin' || role === 'trainer';
  }

  function hasFullAdminRights() {
    const role = getCurrentRole();
    return role === 'owner' || role === 'admin';
  }

  function saveTempUsers() {
    localStorage.setItem('tempUsers', JSON.stringify(tempUsers));
  }

  function forEachNode(list, cb) {
    for (var i = 0; i < list.length; i++) {
      cb(list[i], i);
    }
  }

  /**
   * Lädt alle Benutzer und bereitet die Dropdowns zur Auswahl nach Rolle
   * und Benutzer vor. Erst nach Auswahl der Rolle kann ein Benutzer gewählt
   * und bearbeitet oder gelöscht werden.
   */
  async function showUserList() {
    if (!hasFullAdminRights()) return;
    const container = document.getElementById('existingUsers');
    const roleSelect = document.getElementById('roleSelect');
    const userSelect = document.getElementById('userSelect');
    if (container) container.innerHTML = '';
    if (roleSelect) roleSelect.innerHTML = '<option value="">-- Rolle auswählen --</option>';
    if (userSelect) {
      userSelect.innerHTML = '<option value="">-- Benutzer auswählen --</option>';
      userSelect.disabled = true;
    }
    try {
      const role = getCurrentRole();
      const response = await fetch(API_ROOT + 'users', {
        headers: { 'X-User-Role': role }
      });
      if (!response.ok) throw new Error('Fehler beim Laden der Benutzer');
      allUsers = await response.json();
      const roles = Array.from(new Set(allUsers.map(u => u.role)));
      roles.forEach(function (r) {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r.charAt(0).toUpperCase() + r.slice(1);
        if (roleSelect) roleSelect.appendChild(opt);
      });
    } catch (err) {
      if (container) container.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
  }

  /**
   * Zeigt ein Formular zum Bearbeiten eines Benutzers (Name, Passwort, Rolle).
   */
  function showEditUserForm(username, userRole) {
    const container = document.getElementById('existingUsers');
    const item = container.querySelector(`.user-item[data-username="${username}"]`);
    if (!item) return;
    if (item.querySelector('.edit-user-form')) return;
    const form = document.createElement('div');
    form.className = 'edit-user-form';
    const editorRole = getCurrentRole();
    let roleOptions = '';
    if (editorRole === 'owner') {
      roleOptions =
        '<option value="owner">Owner</option>' +
        '<option value="admin">Admin</option>' +
        '<option value="trainer">Trainer</option>' +
        '<option value="user">User</option>';
    } else if (editorRole === 'admin') {
      roleOptions = '<option value="trainer">Trainer</option>' +
        '<option value="user">User</option>';
    }
    form.innerHTML = `
      <h4>Benutzer ${username} bearbeiten</h4>
      <input type="text" id="editName-${username}" value="${username}" placeholder="Neuer Benutzername">
      <input type="password" id="editPassword-${username}" placeholder="Neues Passwort" maxlength="20">
      <select id="editRole-${username}">${roleOptions}</select>
      <button class="save-user-btn" data-username="${username}">Speichern</button>
      <button class="cancel-edit-btn">Abbrechen</button>
    `;
    item.appendChild(form);
    const roleSelect = form.querySelector(`#editRole-${username}`);
    if (roleSelect) roleSelect.value = userRole;
    form.querySelector('.save-user-btn').addEventListener('click', async function () {
      const newName = document.getElementById(`editName-${username}`).value.trim();
      const newPwd = document.getElementById(`editPassword-${username}`).value;
      const newRole = document.getElementById(`editRole-${username}`).value;
      const payload = {};
      if (newName && newName !== username) payload.newUsername = newName;
      if (newPwd) {
        if (newPwd.length > MAX_PASSWORD_LENGTH) {
          alert('Passwort darf maximal ' + MAX_PASSWORD_LENGTH + ' Zeichen haben');
          return;
        }
        payload.newPassword = newPwd;
      }
      if (newRole && newRole !== userRole) payload.role = newRole;
      try {
        await updateUser(username, payload);
        showUserList();
        alert(`Benutzer ${username} erfolgreich aktualisiert.`);
      } catch (err) {
        alert(err.message);
      }
    });
    form.querySelector('.cancel-edit-btn').addEventListener('click', function () {
      form.remove();
    });
  }

  /**
   * Ruft vom Server die Liste der Benutzer ab. Wird intern genutzt,
   * um die Liste zu aktualisieren.
   */
  async function fetchUsers() {
    const role = getCurrentRole();
    const response = await fetch(API_ROOT + 'users', {
      headers: { 'X-User-Role': role }
    });
    if (!response.ok) throw new Error('Benutzer konnten nicht geladen werden');
    return await response.json();
  }

  /**
   * Sendet eine Anfrage an den Server, um einen Benutzer zu löschen.
   */
  async function deleteUser(username) {
    const role = getCurrentRole();
    const response = await fetch(API_ROOT + 'users/' + encodeURIComponent(username), {
      method: 'DELETE',
      headers: { 'X-User-Role': role }
    });
    if (!response.ok) throw new Error('Benutzer konnte nicht gelöscht werden');
  }

  /**
   * Aktualisiert einen Benutzer.
   */
  async function updateUser(username, data) {
    const role = getCurrentRole();
    const response = await fetch(API_ROOT + 'users/' + encodeURIComponent(username), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Benutzer konnte nicht aktualisiert werden');
    }
  }

  /**
   * Fügt einen neuen Benutzer hinzu.
   */
  async function addUser(username, password, role) {
    // Eingaben normalisieren, um unerwartete Leerzeichen zu verhindern.
    const requesterRole = getCurrentRole();
    const payload = {
      username: typeof username === 'string' ? username.trim() : '',
      password: typeof password === 'string' ? password.trim() : '',
      role: typeof role === 'string' ? role.trim().toLowerCase() : ''
    };
    const response = await fetch(API_ROOT + 'users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': requesterRole },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      // Fehlertext sicher auslesen, kann JSON oder Text sein
      let errMsg = 'Benutzer konnte nicht erstellt werden';
      try {
        const err = await response.json();
        errMsg = err.error || errMsg;
        if (err.code) errMsg += ' (' + err.code + ')';
      } catch (e) {}
      throw new Error(errMsg);
    }
  }

  /**
   * Zeigt die Liste der temporären Benutzer aus localStorage. Verfallene
   * Benutzer werden automatisch entfernt.
   */
  function showTempUsersList() {
    const list = document.getElementById('tempUsersList');
    list.innerHTML = '';
    const now = Date.now();
    let expired = false;
    Object.keys(tempUsers).forEach(function (username) {
      const data = tempUsers[username];
      if (data.expiryDate < now) {
        delete tempUsers[username];
        expired = true;
        return;
      }
      const expiryDate = new Date(data.expiryDate);
      const daysLeft = Math.ceil((data.expiryDate - now) / (1000 * 60 * 60 * 24));
      const item = document.createElement('div');
      item.className = 'user-item';
      item.innerHTML = `
        <span>${username} (Läuft ab: ${expiryDate.toLocaleDateString()} - noch ${daysLeft} Tage)</span>
        <div class="user-actions">
          <button class="delete-temp-user-btn" data-username="${username}">Löschen</button>
        </div>
      `;
      list.appendChild(item);
    });
    if (expired) saveTempUsers();
    forEachNode(list.querySelectorAll('.delete-temp-user-btn'), function (btn) {
      btn.addEventListener('click', function () {
        const uname = btn.getAttribute('data-username');
        if (confirm('Temporären Benutzer ' + uname + ' löschen?')) {
          delete tempUsers[uname];
          saveTempUsers();
          showTempUsersList();
        }
      });
    });
  }

  /**
   * Legt einen temporären Benutzer im Backend an und speichert ihn zusätzlich
   * lokal, um die Übersicht im Frontend zu behalten. Die Ablaufzeit wird in
   * Tagen übergeben.
   */
  async function createTempUser(username, password, days) {
    const role = getCurrentRole();
    const response = await fetch(API_ROOT + 'users/temp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
      body: JSON.stringify({ username, password, expires: days })
    });
    if (!response.ok) {
      const err = await response.json().catch(function () { return {}; });
      throw new Error(err.error || 'Temporärer Benutzer konnte nicht erstellt werden');
    }
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    tempUsers[username] = {
      password,
      role: 'user',
      expiryDate: expiryDate.getTime()
    };
    saveTempUsers();
    showTempUsersList();
    alert(`Temporärer Benutzer ${username} wurde erfolgreich erstellt (gültig bis ${expiryDate.toLocaleDateString()}).`);
  }

  /**
   * Kümmert sich um den Datei-Upload. Die ausgewählte Datei wird per
   * FormData an den Server gesendet. Nach Abschluss wird der Status
   * angezeigt und die Dateiliste aktualisiert.
   */
  async function handleFileUpload(e) {
    e.preventDefault();
    const fileInput = document.getElementById('fileToUpload');
    const nameInput = document.getElementById('fileName');
    const statusEl = document.getElementById('uploadStatus');
    if (!fileInput.files.length || !nameInput.value) {
      alert('Bitte Datei und Namen angeben');
      return;
    }
    const file = fileInput.files[0];
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      alert('Nur .xlsx-Dateien erlaubt');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', nameInput.value.trim() + '.xlsx');
    statusEl.textContent = 'Datei wird hochgeladen...';
    try {
      const response = await fetch(API_ROOT + 'upload', { method: 'POST', body: formData });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Upload fehlgeschlagen');
      }
      const result = await response.json();
      statusEl.textContent = result.message || 'Datei erfolgreich hochgeladen';
      statusEl.style.color = 'green';
      fileInput.value = '';
      nameInput.value = '';
      // Liste neu laden
      if (typeof window.loadAvailableFiles === 'function') {
        window.loadAvailableFiles();
      }
    } catch (err) {
      statusEl.textContent = 'Fehler: ' + err.message;
      statusEl.style.color = 'red';
    }
  }

  /**
   * Lädt eine Excel-Datei und zeigt sie im Editor an. Der Benutzer kann
   * die einzelnen Zellen ändern und anschließend speichern.
   */
  async function loadExcelFileForEditing(filename) {
    try {
      const response = await fetch(API_ROOT + 'files/' + encodeURIComponent(filename));
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      displayExcelData(jsonData, filename);
    } catch (error) {
      alert('Fehler beim Laden der Datei: ' + error.message);
    }
  }

  /**
   * Zeigt ein JSON-Array in einer HTML-Tabelle an. Jede Zelle wird als
   * Input-Feld dargestellt, sodass sie bearbeitet werden kann. Nach dem
   * Speichern wird die Datei wieder als XLSX gespeichert.
   */
  function displayExcelData(data, filename) {
    const editor = document.getElementById('excelEditor');
    const table = document.getElementById('excelTable');
    editor.classList.remove('hidden');
    table.querySelector('thead').innerHTML = '';
    table.querySelector('tbody').innerHTML = '';
    const headers = Object.keys(data[0] || {});
    const headerRow = document.createElement('tr');
    headers.forEach(function (h) {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    });
    table.querySelector('thead').appendChild(headerRow);
    data.forEach(function (row, rowIndex) {
      const tr = document.createElement('tr');
      headers.forEach(function (header) {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = row[header] || '';
        input.dataset.header = header;
        input.dataset.rowIndex = rowIndex;
        td.appendChild(input);
        tr.appendChild(td);
      });
      table.querySelector('tbody').appendChild(tr);
    });
    document.getElementById('saveExcelBtn').onclick = function () {
      saveExcelChanges(filename);
    };
    document.getElementById('cancelEditBtn').onclick = function () {
      editor.classList.add('hidden');
    };
  }

  /**
   * Rekonstruiert das Excel-Dokument aus der HTML-Tabelle und sendet es
   * an den Server zur Speicherung. Nach erfolgreichem Speichern wird
   * eine Bestätigung ausgegeben.
   */
  async function saveExcelChanges(filename) {
    const table = document.getElementById('excelTable');
    const inputs = table.querySelectorAll('input');
    const headers = Array.from(table.querySelectorAll('th')).map(function (th) { return th.textContent; });
    const rowIndices = Array.from(inputs).map(function (inp) { return parseInt(inp.dataset.rowIndex); });
    const rowCount = Math.max.apply(Math, rowIndices) + 1;
    const data = [];
    for (var i = 0; i < rowCount; i++) {
      const row = {};
      headers.forEach(function (header) {
        const input = table.querySelector(`input[data-header="${header}"][data-row-index="${i}"]`);
        if (input) row[header] = input.value;
      });
      data.push(row);
    }
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    try {
      const response = await fetch(API_ROOT + 'save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Filename': filename
        },
        body: excelBuffer
      });
      if (!response.ok) throw new Error('Speichern fehlgeschlagen');
      alert('Änderungen erfolgreich gespeichert');
      document.getElementById('excelEditor').classList.add('hidden');
    } catch (err) {
      alert('Fehler beim Speichern: ' + err.message);
    }
  }

  /**
   * Löscht die aktuell ausgewählte Excel‑Datei aus dem Backend und
   * aktualisiert anschließend die Dateiliste. Der Benutzer muss den
   * Löschvorgang vorher bestätigen.
   */
  async function deleteSelectedFile() {
    const select = document.getElementById('editFileSelect');
    const filename = select ? select.value : '';
    if (!filename) {
      alert('Bitte eine Datei auswählen');
      return;
    }
    if (!confirm(`Datei ${filename} wirklich löschen?`)) return;
    try {
      const res = await fetch(API_ROOT + 'files/' + encodeURIComponent(filename), { method: 'DELETE' });
      if (!res.ok) throw new Error('Löschen fehlgeschlagen');
      alert('Datei gelöscht');
      if (typeof window.loadAvailableFiles === 'function') {
        window.loadAvailableFiles();
      }
      const editor = document.getElementById('excelEditor');
      if (editor) editor.classList.add('hidden');
      if (select) select.value = '';
    } catch (err) {
      alert('Fehler: ' + err.message);
    }
  }

  /**
   * Initialisiert das Admin-Menü und navigiert zwischen den Bereichen.
   */
  function initAdminMenu() {
    const menuToggle = document.getElementById('adminMenuToggle');
    const menu = document.getElementById('adminMenu');
    if (!menuToggle || !menu) return;
    menu.style.display = 'none';

    function showEl(id) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('hidden');
        el.style.display = '';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
      }
    }

    const handlers = {
      userManagement: function () {
        if (!hasFullAdminRights()) return;
        showEl('userManagementSection');
        showEl('adminContainer');
        document.getElementById('mainContainer').classList.add('hidden');
        showUserList();
      },
      tempUsers: function () {
        showEl('tempUsersSection');
        showEl('adminContainer');
        document.getElementById('mainContainer').classList.add('hidden');
        showTempUsersList();
      },
      addUser: function () {
        if (!hasFullAdminRights()) return;
        showEl('addUserSection');
        showEl('adminContainer');
        var form = document.getElementById('addUserForm');
        if (form) { form.style.display = ''; }
        document.getElementById('mainContainer').classList.add('hidden');
      },
      fileUpload: function () {
        showEl('fileUploadSection');
        showEl('adminContainer');
        document.getElementById('mainContainer').classList.add('hidden');
      },
      fileEdit: function () {
        showEl('fileEditSection');
        showEl('adminContainer');
        document.getElementById('mainContainer').classList.add('hidden');
        if (typeof window.loadAvailableFiles === 'function') {
          window.loadAvailableFiles();
        }
      },
      dbTest: function () {
        if (!hasFullAdminRights()) return;
        showEl('dbTestSection');
        showEl('adminContainer');
        document.getElementById('mainContainer').classList.add('hidden');
      },
      nameRoulette: function () {
        showEl('nameRouletteSection');
        showEl('adminContainer');
        document.getElementById('mainContainer').classList.add('hidden');
      }
    };

    function hideSections() {
      forEachNode(document.querySelectorAll('.admin-section'), function (sec) { sec.classList.add('hidden'); });
    }

    function activateSection(section) {
      hideSections();
      if (handlers[section]) {
        handlers[section]();
      }
    }

    menuToggle.addEventListener('click', function () {
      if (!hasAdminAccess()) return;
      var isActive = menu.classList.toggle('active');
      document.body.classList.toggle('admin-menu-active', isActive);
      menu.style.display = isActive ? 'block' : 'none';
      menuToggle.style.transform = isActive ? 'rotate(90deg)' : 'rotate(0)';
      menuToggle.style.left = isActive ? '230px' : '10px';
      menuToggle.style.zIndex = isActive ? '1501' : '1001';

      var ribbon = document.getElementById('userRibbon');
      var ribbonToggle = document.getElementById('ribbonToggle');
      if (ribbon && ribbon.classList) ribbon.classList.remove('show');
      if (ribbonToggle) ribbonToggle.style.display = isActive ? 'none' : '';

      if (isActive && document.getElementById('adminContainer').classList.contains('hidden')) {
        var first = menu.querySelector('.admin-menu-item:not([style*="display: none"])');
        if (first) {
          activateSection(first.getAttribute('data-section'));
          forEachNode(menu.querySelectorAll('.admin-menu-item'), function (mi) { mi.classList.remove('active'); });
          first.classList.add('active');
        }
      }
    });

    var menuItems = document.querySelectorAll('.admin-menu-item');
    forEachNode(menuItems, function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        if (!hasAdminAccess()) return;
        var section = item.getAttribute('data-section');
        if (section === 'backToMain') {
          hideSections();
          var adminCont = document.getElementById('adminContainer');
          var mainCont = document.getElementById('mainContainer');
          var mainMenu = document.getElementById('mainMenuContainer');
          var multiCont = document.getElementById('multiplayerContainer');
          var toolsCont = document.getElementById('toolsContainer');
          if (adminCont) { adminCont.classList.add('hidden'); adminCont.style.display = 'none'; }
          if (mainCont) { mainCont.classList.add('hidden'); mainCont.style.display = 'none'; }
          if (multiCont) { multiCont.classList.add('hidden'); multiCont.style.display = 'none'; }
          if (toolsCont) { toolsCont.classList.add('hidden'); toolsCont.style.display = 'none'; }
          if (mainMenu) {
            mainMenu.classList.remove('hidden');
            mainMenu.style.display = '';
            mainMenu.style.visibility = 'visible';
            mainMenu.style.opacity = '1';
          }
          menu.classList.remove('active');
          menu.style.display = 'none';
          document.body.classList.remove('admin-menu-active');
          menuToggle.style.transform = 'rotate(0)';
          menuToggle.style.left = '10px';
          menuToggle.style.zIndex = '1001';
          var rbToggle = document.getElementById('ribbonToggle');
          if (rbToggle) rbToggle.style.display = '';
          return;
        }
        activateSection(section);
        forEachNode(menuItems, function (mi) { mi.classList.remove('active'); });
        item.classList.add('active');
        menu.classList.remove('active');
        menu.style.display = 'none';
        document.body.classList.remove('admin-menu-active');
        menuToggle.style.transform = 'rotate(0)';
        menuToggle.style.left = '10px';
        menuToggle.style.zIndex = '1001';
        var rbToggle2 = document.getElementById('ribbonToggle');
        if (rbToggle2) rbToggle2.style.display = '';
      });
    });
  }

  // Eventlistener für Formulare
  document.addEventListener('DOMContentLoaded', function () {
    initAdminMenu();
    if (!hasAdminAccess()) {
      const toggle = document.getElementById('adminMenuToggle');
      if (toggle) toggle.classList.remove('visible');
    }

    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
      const roleSelect = document.getElementById('newUserRole');
      const currentRole = getCurrentRole();
      roleSelect.innerHTML = '<option value="">-- Rolle auswählen --</option>' +
        '<option value="owner">Owner</option>' +
        '<option value="admin">Admin</option>' +
        '<option value="trainer">Trainer</option>' +
        '<option value="user">User</option>';
      if (currentRole !== 'owner' && currentRole !== 'admin') {
        addUserForm.style.display = 'none';
      }
      addUserForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value;
        const role = document.getElementById('newUserRole').value;
        const errorBox = document.getElementById('addUserError');
        if (errorBox) {
          errorBox.textContent = '';
          errorBox.style.color = 'red';
        }
        if (!username || !password || !role) {
          if (errorBox) errorBox.textContent = 'Bitte alle Felder ausfüllen';
          else alert('Bitte alle Felder ausfüllen');
          return;
        }
        if (password.length > MAX_PASSWORD_LENGTH) {
          const msg = 'Passwort darf maximal ' + MAX_PASSWORD_LENGTH + ' Zeichen haben';
          if (errorBox) errorBox.textContent = msg;
          else alert(msg);
          return;
        }
        try {
          await addUser(username, password, role);
          addUserForm.reset();
          showUserList();
          if (errorBox) {
            errorBox.style.color = 'green';
            errorBox.textContent = `Benutzer ${username} erfolgreich erstellt`;
          } else {
            alert(`Benutzer ${username} erfolgreich erstellt`);
          }
        } catch (err) {
          if (errorBox) {
            errorBox.style.color = 'red';
            errorBox.textContent = err.message;
          } else {
            alert(err.message);
          }
        }
      });
    }

    const roleSelectEl = document.getElementById('roleSelect');
    const userSelectEl = document.getElementById('userSelect');
    if (roleSelectEl && userSelectEl) {
      roleSelectEl.addEventListener('change', function () {
        const selected = roleSelectEl.value;
        userSelectEl.innerHTML = '<option value="">-- Benutzer auswählen --</option>';
        document.getElementById('existingUsers').innerHTML = '';
        if (!selected) {
          userSelectEl.disabled = true;
          return;
        }
        const filtered = allUsers.filter(u => u.role === selected);
        filtered.forEach(function (u) {
          const opt = document.createElement('option');
          opt.value = u.username;
          opt.textContent = u.username;
          userSelectEl.appendChild(opt);
        });
        userSelectEl.disabled = filtered.length === 0;
      });

      userSelectEl.addEventListener('change', function () {
        const uname = userSelectEl.value;
        const container = document.getElementById('existingUsers');
        container.innerHTML = '';
        if (!uname) return;
        const user = allUsers.find(u => u.username === uname);
        if (!user) return;
        const item = document.createElement('div');
        item.className = 'user-item';
        item.dataset.username = user.username;
        const role = getCurrentRole();
        const canModify = role === 'owner' || (role === 'admin' && user.role !== 'owner' && user.role !== 'admin');
        let actions = '';
        if (canModify) {
          actions =
            '<div class="user-actions">' +
            `<button class="edit-user-btn" data-username="${user.username}" data-role="${user.role}">Bearbeiten</button>` +
            `<button class="delete-user-btn" data-username="${user.username}">Löschen</button>` +
            '</div>';
        }
        item.innerHTML = `<span>${user.username} (Rolle: ${user.role})</span>${actions}`;
        container.appendChild(item);
        const editBtn = container.querySelector('.edit-user-btn');
        if (editBtn) {
          editBtn.addEventListener('click', function () {
            showEditUserForm(user.username, user.role);
          });
        }
        const delBtn = container.querySelector('.delete-user-btn');
        if (delBtn) {
          delBtn.addEventListener('click', async function () {
            if (confirm('Benutzer ' + user.username + ' wirklich löschen?')) {
              await deleteUser(user.username);
              showUserList();
            }
          });
        }
      });
    }

    const addTempUserForm = document.getElementById('addTempUserForm');
    if (addTempUserForm) {
      addTempUserForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const username = document.getElementById('tempUsername').value.trim();
        const password = document.getElementById('tempPassword').value;
        const days = parseInt(document.getElementById('tempDays').value);
        if (!username || !password || !days) {
          alert('Bitte alle Felder ausfüllen');
          return;
        }
        if (tempUsers[username]) {
          alert('Benutzername existiert bereits');
          return;
        }
        try {
          await createTempUser(username, password, days);
          addTempUserForm.reset();
        } catch (err) {
          alert(err.message);
        }
      });
    }

    const fileUploadForm = document.getElementById('fileUploadForm');
    if (fileUploadForm) {
      fileUploadForm.addEventListener('submit', handleFileUpload);
    }

    const editFileSelect = document.getElementById('editFileSelect');
    if (editFileSelect) {
      editFileSelect.addEventListener('change', function (e) {
        const filename = e.target.value;
        if (filename) loadExcelFileForEditing(filename);
      });
    }

    const deleteFileBtn = document.getElementById('deleteFileBtn');
    if (deleteFileBtn) {
      deleteFileBtn.addEventListener('click', deleteSelectedFile);
    }

    const dbTestButton = document.getElementById('dbTestButton');
    if (dbTestButton) {
      dbTestButton.addEventListener('click', testDbConnection);
    }

    const startRouletteBtn = document.getElementById('startRouletteBtn');
    const rouletteCorrectBtn = document.getElementById('rouletteCorrectBtn');
    const rouletteWrongBtn = document.getElementById('rouletteWrongBtn');
    const rouletteNamesArea = document.getElementById('rouletteNames');
    const rouletteCurrentEl = document.getElementById('rouletteCurrent');
    if (startRouletteBtn) {
      startRouletteBtn.addEventListener('click', function () {
        rouletteNames = (rouletteNamesArea.value || '').split('\n').map(s=>s.trim()).filter(Boolean);
        pickRoulette();
      });
    }
    if (rouletteCorrectBtn) {
      rouletteCorrectBtn.addEventListener('click', function () {
        var idx = rouletteNames.indexOf(currentRoulette);
        if (idx >= 0) rouletteNames.splice(idx,1);
        pickRoulette();
      });
    }
    if (rouletteWrongBtn) {
      rouletteWrongBtn.addEventListener('click', pickRoulette);
    }
    function pickRoulette() {
      if (!rouletteNames.length) {
        rouletteCurrentEl.textContent = 'Keine Namen mehr';
        rouletteCorrectBtn.classList.add('hidden');
        rouletteWrongBtn.classList.add('hidden');
        return;
      }
      currentRoulette = rouletteNames[Math.floor(Math.random() * rouletteNames.length)];
      rouletteCurrentEl.textContent = currentRoulette;
      rouletteCorrectBtn.classList.remove('hidden');
      rouletteWrongBtn.classList.remove('hidden');
    }

    async function testDbConnection() {
      const resultEl = document.getElementById('dbTestResult');
      if (resultEl) {
        resultEl.textContent = 'Verbindung wird geprüft...';
        resultEl.style.color = '';
      }
      try {
        const res = await fetch(API_ROOT + 'db-test', { cache: 'no-store' });
        if (resultEl) {
          if (res.ok) {
            resultEl.textContent = 'Verbindung erfolgreich';
            resultEl.style.color = 'green';
          } else {
            resultEl.textContent = 'Verbindung fehlgeschlagen';
            resultEl.style.color = 'red';
          }
        }
      } catch (err) {
        if (resultEl) {
          resultEl.textContent = 'Verbindung fehlgeschlagen';
          resultEl.style.color = 'red';
        }
      }
    }
  });
})();
